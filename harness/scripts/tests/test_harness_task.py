#!/usr/bin/env python3
"""Regression tests for harness_task.py（批次 1 轻任务闭环）。

覆盖计划（cosmic-pulse-curie-chcqn1ba）测试矩阵 1-8；第 9 项（doc
contract 扫描 harness-task/ 目录）由 test_harness_doc_contract.py 覆盖，
此处只验证目录存在。

fixture 仿 test_harness_change.py:42-78：tmp git 项目 + build-profile
（仅 unitTestFull target——F6：node 探测 profile 的真实形态）。
"""

from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parents[1]


def load_module(name: str, filename: str):
    path = SCRIPTS_DIR / filename
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


ht = load_module("harness_task", "harness_task.py")

BUILD_PROFILE = {
    "schemaVersion": 3,
    "commands": {
        "unitTestFull": {
            "command": "python check.py",
            "argvTemplate": ["python", "check.py"],
            "scope": "full",
            "inputs": ["check.py"],
            "coverage": "unitTestFull",
            "source": "user",
        }
    },
    "verificationInputs": {"unitTestFull": ["check.py"]},
    "verificationGraph": {
        "schemaVersion": 1,
        "source": "user",
        "candidateTarget": "unitTestFull",
        "targets": {
            "unitTestFull": {
                "commandKey": "unitTestFull",
                "dependsOn": [],
                "requiredCoverage": "full",
                "candidate": True,
                "requiredCapabilities": [],
                "argvTemplate": ["python", "check.py"],
            }
        },
    },
}


class HarnessTaskFixture(unittest.TestCase):
    """tmp git 项目 + .harness 布局 + build-profile（仅 unitTestFull）。"""

    def setUp(self) -> None:
        self.project = Path(tempfile.mkdtemp(prefix="harness-task-project-"))
        self._git("init")
        self._git("config", "user.email", "test@example.com")
        self._git("config", "user.name", "Test")
        (self.project / "README.md").write_text("demo\n", encoding="utf-8")
        (self.project / "check.py").write_text("print('check ok')\n", encoding="utf-8")
        self._git("add", "-A")
        self._git("commit", "-m", "init")
        (self.project / ".harness" / "changes").mkdir(parents=True)
        (self.project / ".harness" / "config").mkdir(parents=True)
        (self.project / ".harness" / "config" / "build-profile.json").write_text(
            json.dumps(BUILD_PROFILE), encoding="utf-8"
        )

    def tearDown(self) -> None:
        shutil.rmtree(self.project, ignore_errors=True)

    def _git(self, *args: str) -> str:
        proc = subprocess.run(
            ["git", *args],
            cwd=self.project,
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        return proc.stdout.strip()

    def _run(self, *argv: str) -> tuple[int, dict]:
        """进程内调用 ht.main，捕获 stdout JSON（emit 走 print）。"""
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            rc = ht.main(list(argv))
        return rc, json.loads(buf.getvalue())

    def _begin(self, change: str, goal: str = "测试目标") -> dict:
        rc, out = self._run(
            "begin", "--project", str(self.project), "--change", change,
            "--executor", "test", "--goal", goal,
            "--acceptance", "验收条件", "--json",
        )
        self.assertEqual(rc, 0, out)
        self.assertEqual(out["code"], "TASK_BEGUN", out)
        return out

    def _finish(self, change: str, *extra: str) -> tuple[int, dict]:
        return self._run(
            "finish", "--project", str(self.project), "--change", change,
            "--json", *extra,
        )

    def _change_dir(self, change: str) -> Path:
        return self.project / ".harness" / "changes" / change

    def _events(self, change: str) -> list[dict]:
        path = self._change_dir(change) / "events.ndjson"
        return [
            json.loads(line)
            for line in path.read_text(encoding="utf-8-sig").splitlines()
            if line.strip()
        ]

    def _ledger(self, archive_dir: Path) -> dict:
        return json.loads(
            (archive_dir / "evidence" / "verification-ledger.json").read_text(
                encoding="utf-8-sig"
            )
        )


class BeginTests(HarnessTaskFixture):
    def test_begin_creates_files_and_is_idempotent(self) -> None:
        """矩阵 1：begin 建全套文件；重跑幂等（无重复 phase.start）。"""
        first = self._begin("idem-change")
        change_dir = self._change_dir("idem-change")
        for rel in (
            "meta/change-context.json",
            "meta/state-snapshot.json",
            "meta/task.json",
            "events.ndjson",
        ):
            self.assertTrue((change_dir / rel).is_file(), rel)
        task = json.loads(
            (change_dir / "meta" / "task.json").read_text(encoding="utf-8-sig")
        )
        self.assertEqual(task["status"], "open")
        self.assertEqual(task["goal"], "测试目标")
        self.assertIn("dirtyBaseline", task)

        second = self._begin("idem-change")
        self.assertEqual(second["runId"], first["runId"])
        starts = [
            e for e in self._events("idem-change")
            if e["type"] == "phase.start" and e["phase"] == "task"
        ]
        self.assertEqual(len(starts), 1)

    def test_begin_rejects_terminal_task(self) -> None:
        self._begin("done-change")
        task_path = self._change_dir("done-change") / "meta" / "task.json"
        task = json.loads(task_path.read_text(encoding="utf-8-sig"))
        task["status"] = "completed"
        task_path.write_text(json.dumps(task), encoding="utf-8")
        rc, out = self._run(
            "begin", "--project", str(self.project), "--change", "done-change",
            "--executor", "test", "--goal", "x", "--acceptance", "y", "--json",
        )
        self.assertEqual(rc, 2)
        self.assertEqual(out["code"], "TASK_ALREADY_FINISHED")


class FinishTierTests(HarnessTaskFixture):
    def test_finish_docs_only_diff_is_fast_tier(self) -> None:
        """矩阵 2：docs-only → fast 档、恰好 1 条 ledger（unitTest 回退）。"""
        self._begin("docs-only")
        (self.project / "README.md").write_text("v2\n", encoding="utf-8")
        rc, out = self._finish("docs-only")
        self.assertEqual(rc, 0, out)
        self.assertEqual(out["tier"], "fast")
        ledger = self._ledger(Path(out["archiveDir"]))
        # profile 只有 unitTestFull target：unitTest 经回退链落到它。
        self.assertEqual(sorted(ledger["validations"]), ["unitTestFull"])

    def test_finish_code_diff_runs_standard_validations(self) -> None:
        """矩阵 3：代码 diff → standard 档 3 项验证（回退后全落 unitTestFull）。"""
        self._begin("code-change")
        (self.project / "check.py").write_text("print('v2')\n", encoding="utf-8")
        rc, out = self._finish("code-change")
        self.assertEqual(rc, 0, out)
        self.assertEqual(out["tier"], "standard")
        ledger = self._ledger(Path(out["archiveDir"]))
        # compile/unitTest/unitTestFull 三项都经回退链解析到唯一 target，
        # ledger 按真实执行的验证名去重——1 条 unitTestFull 记录。
        self.assertEqual(sorted(ledger["validations"]), ["unitTestFull"])
        statuses = {
            key: value.get("status")
            for key, value in ledger["validations"].items()
        }
        self.assertEqual(statuses, {"unitTestFull": "OK"})

    def test_finish_auth_signal_is_rejected_without_side_effects(self) -> None:
        """矩阵 4：auth 路径 → TASK_TIER_UPGRADE_REQUIRED，无 ledger、无归档。"""
        (self.project / "auth.py").write_text("TOKEN='x'\n", encoding="utf-8")
        self._git("add", "-A")
        self._git("commit", "-m", "add auth")
        self._begin("auth-touch")
        (self.project / "auth.py").write_text("TOKEN='y'\n", encoding="utf-8")
        rc, out = self._finish("auth-touch")
        self.assertEqual(rc, 3)
        self.assertEqual(out["code"], "TASK_TIER_UPGRADE_REQUIRED")
        self.assertEqual(out["signals"], ["auth"])
        self.assertTrue(out["changePreserved"])
        change_dir = self._change_dir("auth-touch")
        self.assertTrue(change_dir.is_dir())
        self.assertFalse((change_dir / "evidence").is_dir())
        self.assertFalse((self.project / ".harness" / "archive").exists())


class FinishBoundaryTests(HarnessTaskFixture):
    def test_finish_rejects_preexisting_foreign_dirt(self) -> None:
        """矩阵 5：begin 前预存脏路径（任务未触碰）→ FOREIGN_PATHS_PRESENT。

        classify 首跑无 ownership 契约，非 .harness 路径全进 productPaths
        （harness_gate.py:1494-1497）——检测靠 begin 的 dirtyBaseline。
        """
        (self.project / "stray.txt").write_text("stray\n", encoding="utf-8")
        self._begin("foreign-dirt")
        (self.project / "README.md").write_text("v2\n", encoding="utf-8")
        rc, out = self._finish("foreign-dirt")
        self.assertEqual(rc, 2)
        self.assertEqual(out["code"], "FOREIGN_PATHS_PRESENT")
        self.assertIn("stray.txt", out["problems"])

    def test_finish_accepts_files_created_during_task(self) -> None:
        """begin 后新出现的文件是任务自身工作，正常提交。"""
        self._begin("new-file")
        (self.project / "notes.md").write_text("task work\n", encoding="utf-8")
        rc, out = self._finish("new-file")
        self.assertEqual(rc, 0, out)
        self.assertEqual(out["code"], "TASK_FINISHED")

    def test_finish_abandoned_closure_archives_without_ledger(self) -> None:
        """矩阵 7：abandoned 闭包无 ledger 归档。"""
        self._begin("give-up")
        (self.project / "README.md").write_text("v2\n", encoding="utf-8")
        rc, out = self._finish(
            "give-up", "--closure", "abandoned",
            "--closure-reason", "需求取消",
        )
        self.assertEqual(rc, 0, out)
        archive_dir = Path(out["archiveDir"])
        self.assertTrue(archive_dir.is_dir())
        self.assertFalse(
            (archive_dir / "evidence" / "verification-ledger.json").is_file()
        )


class FinishRoundTripTests(HarnessTaskFixture):
    def test_full_round_trip_contract(self) -> None:
        """矩阵 6：finish → 归档目录、businessGoal、知识候选、final-hash。"""
        self._begin("round-trip", goal="业务目标甲")
        (self.project / "check.py").write_text("print('v2')\n", encoding="utf-8")
        rc, out = self._finish("round-trip")
        self.assertEqual(rc, 0, out)
        archive_dir = Path(out["archiveDir"])
        self.assertTrue(archive_dir.is_dir())

        summary = json.loads(
            (archive_dir / "reports" / "final" / "summary-data.json").read_text(
                encoding="utf-8-sig"
            )
        )
        self.assertEqual(summary.get("businessGoal"), "业务目标甲")

        candidates = json.loads(
            (archive_dir / "candidates" / "knowledge.json").read_text(
                encoding="utf-8-sig"
            )
        )
        self.assertGreaterEqual(len(candidates), 1)

        # final-hash：execution-log 的 hash 即提交后 HEAD（无上游不 push）。
        head = self._git("rev-parse", "HEAD")
        self.assertEqual(out["commit"], head)

    def test_archive_failure_reverts_task_and_rerun_succeeds(self) -> None:
        """归档失败 → task.json 回滚 open、phase.end 不重复 → 重跑成功。

        档位沿用首次裁决（standard）：重跑时产品树已提交，classify 只见
        no-code-diff，不得降级记成 fast。
        """
        self._begin("archive-fail")
        (self.project / "check.py").write_text("print('v2')\n", encoding="utf-8")
        original = ht.ha.execute_archive
        try:
            ht.ha.execute_archive = lambda *a, **k: (
                1, {"ok": False, "error": "simulated", "issues": []}
            )
            rc, out = self._finish("archive-fail")
        finally:
            ht.ha.execute_archive = original
        self.assertEqual(rc, 2)
        self.assertEqual(out["code"], "ARCHIVE_FAILED")

        task = json.loads(
            (self._change_dir("archive-fail") / "meta" / "task.json").read_text(
                encoding="utf-8-sig"
            )
        )
        self.assertEqual(task["status"], "open")

        ends = [
            e for e in self._events("archive-fail")
            if e["type"] == "phase.end" and e["phase"] == "task"
        ]
        self.assertEqual(len(ends), 1)

        rc2, out2 = self._finish("archive-fail")
        self.assertEqual(rc2, 0, out2)
        self.assertEqual(out2["code"], "TASK_FINISHED")
        self.assertEqual(out2["tier"], "standard")

    def test_no_commit_escape_hatch(self) -> None:
        """--no-commit：不提交不归档，工作区保持脏树。"""
        self._begin("no-commit")
        (self.project / "README.md").write_text("v2\n", encoding="utf-8")
        rc, out = self._finish("no-commit", "--no-commit")
        self.assertEqual(rc, 0, out)
        self.assertEqual(out["code"], "TASK_FINISHED_NO_ARCHIVE")
        dirty = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=self.project, capture_output=True, text=True,
        ).stdout.strip()
        self.assertTrue(dirty)


class StatusTests(HarnessTaskFixture):
    def test_status_reports_open_task(self) -> None:
        self._begin("status-check")
        (self.project / "README.md").write_text("v2\n", encoding="utf-8")
        rc, out = self._run(
            "status", "--project", str(self.project), "--change", "status-check",
            "--json",
        )
        self.assertEqual(rc, 0)
        self.assertEqual(out["code"], "TASK_STATUS")
        self.assertEqual(out["status"], "open")
        self.assertIn("README.md", out["uncommittedPaths"])
        self.assertIn("finish", out["nextAction"])


class ExploratorySchemaTests(HarnessTaskFixture):
    def test_unknown_task_phase_events_survive_archive_package(self) -> None:
        """矩阵 8（探索性）：phase=task 事件不被归档 schema 拒绝。

        风险点 harness_archive.py:4489 默认放行未知 phase——实证而非假设。
        """
        self._begin("schema-probe")
        (self.project / "README.md").write_text("v2\n", encoding="utf-8")
        rc, out = self._finish("schema-probe")
        self.assertEqual(rc, 0, out)
        archive_dir = Path(out["archiveDir"])
        # 归档成功本身即 schema 未拒：finalize 的 validators 全过才发布。
        self.assertTrue((archive_dir / "reports" / "final" / "summary-data.json").is_file())
        events = [
            json.loads(line)
            for line in (archive_dir / "events.ndjson").read_text(
                encoding="utf-8-sig"
            ).splitlines()
            if line.strip()
        ]
        task_events = [e for e in events if e.get("phase") == "task"]
        self.assertTrue(task_events)
        types = {e["type"] for e in task_events}
        self.assertIn("phase.start", types)
        self.assertIn("phase.end", types)


class SkillDirectoryTests(unittest.TestCase):
    def test_harness_task_skill_directory_exists(self) -> None:
        """矩阵 9 前置：doc contract 扫描目标目录存在（SKILL.md/reference.md）。"""
        skill_dir = SCRIPTS_DIR.parent / "harness-task"
        self.assertTrue(skill_dir.is_dir(), skill_dir)
        self.assertTrue((skill_dir / "SKILL.md").is_file())
        self.assertTrue((skill_dir / "reference.md").is_file())


if __name__ == "__main__":
    unittest.main()
