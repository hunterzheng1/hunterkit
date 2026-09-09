import { describe, expect, it } from "vitest";

import { inferCapabilities } from "../src/plan-evidence/capability-inference.js";

/**
 * WI-4b：capabilities 推断层单测——与 risk-signal-inference.test.ts 同一模式。
 * marker 表移植 harness_gate.py _diff_capabilities，按 v2 九值枚举扩展。
 */

describe("inferCapabilities", () => {
  it("affected_paths 命中 marker 时推断对应能力（无手填）", () => {
    const result = inferCapabilities({
      declared: [],
      affectedPaths: ["src/api/user_controller.ts", "db/migrations/001_init.sql"]
    });
    // controller → api；.sql → database；migrations → migration（+联动 database）
    expect(result.effective).toEqual(["api", "database", "migration"]);
    expect(result.provenance).toEqual([
      { capability: "api", source: "inferred" },
      { capability: "database", source: "inferred" },
      { capability: "migration", source: "inferred" }
    ]);
  });

  it("migration 命中时联动 database（与 Python _diff_capabilities 同向）", () => {
    const result = inferCapabilities({
      declared: [],
      affectedPaths: ["migrations/rename_column.ts"]
    });
    expect(result.effective).toEqual(["database", "migration"]);
  });

  it("手填与推断取并集，逐条标注来源；手填不能删推断项", () => {
    const result = inferCapabilities({
      declared: ["ui", "security"],
      affectedPaths: ["src/api/controller.ts"]
    });
    // ui/security 手填、api 推断——并集保留全部
    expect(result.effective).toEqual(["api", "security", "ui"]);
    const bySource = Object.fromEntries(result.provenance.map((item) =>
      [item.capability, item.source]));
    expect(bySource).toEqual({ api: "inferred", security: "declared", ui: "declared" });
  });

  it("declared+inferred：手填与推断同时命中同一能力", () => {
    const result = inferCapabilities({
      declared: ["api"],
      affectedPaths: ["src/api/order_controller.ts"]
    });
    expect(result.effective).toEqual(["api"]);
    expect(result.provenance).toEqual([{ capability: "api", source: "declared+inferred" }]);
  });

  it("git status 残留路径作为次源参与推断", () => {
    const result = inferCapabilities({
      declared: [],
      affectedPaths: ["README.md"],
      gitStatusPaths: ["src/auth/permissions.ts"]
    });
    // permissions.ts 命中 permissions；auth 路径同时命中 security 的 credential？
    // 不——marker 是子串匹配整份拼接文本：permissions 命中 permissions + security 的
    // credential 不在；实际 "permissions" 命中 permissions，"auth" 不在 security markers
    expect(result.effective).toContain("permissions");
  });

  it("纯文档路径不推断任何能力（安全地板为空）", () => {
    const result = inferCapabilities({
      declared: [],
      affectedPaths: ["docs/design.md"]
    });
    expect(result.effective).toEqual([]);
    expect(result.provenance).toEqual([]);
  });

  it("手填保留推断之外的值：union 永不取差集", () => {
    const result = inferCapabilities({
      declared: ["network", "filesystem"],
      affectedPaths: ["docs/only.md"]
    });
    expect(result.effective).toEqual(["filesystem", "network"]);
    expect(result.provenance.every((item) => item.source === "declared")).toBe(true);
  });
});
