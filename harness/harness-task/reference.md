# harness-task reference

错误码表、档位映射与平台陷阱。命令统一形态：
`python <skills-root>/scripts/harness_task.py <subcommand> --project . --change <cn> --json`

## 命令面

```
harness_task.py begin  --project . --change <cn> --executor <tool> \
                      --goal "<目标一句话>" --acceptance "<条件>" (可重复) --json
harness_task.py finish --project . --change <cn> [--commit-message <msg>] \
                       [--closure abandoned|superseded --closure-reason <r>] \
                       [--no-commit] --json
harness_task.py status --project . --change <cn> --json
```

- `begin`：建 `.harness/changes/<cn>/`（change-context + state-snapshot +
  task.json + phase.start + decision）。重跑幂等——复用同一 runId。
- `finish`：classify → 档位裁决 → 验证 → ledger → plan.md → commit →
  归档（record-only）。幂等——验证失败修复后、归档失败处理后都直接重跑。
- `status`：只读恢复视图（档位/已记验证/未提交 diff/下一步）。

## 档位映射

| 档位 | 触发 | 验证序列 | 回退链 |
|------|------|----------|--------|
| fast | docs-only / no-code-diff（.md/.txt/.rst、docs/） | unitTest | unitTest → unitTestFull |
| standard | 其余全部代码 diff | compile + unitTest + unitTestFull | compile → unitTest → unitTestFull；unitTest → unitTestFull |
| full | auth/security/migration/concurrency/artifact-protocol/shared-state/delete 信号 | **拒绝**（TASK_TIER_UPGRADE_REQUIRED） | — |

- 档位由 finish 从 classify signals 自行裁决（classify 的单调升级只升
  不降，docs-only 不会把默认 standard 降为 fast）。
- 回退后 ledger 记录**真实执行**的验证名（如 unitTestFull），不伪造
  缺失项；build-profile 缺 target 时按回退链找更广覆盖的目标。
- 归档失败重跑时产品树已提交（classify 只见 no-code-diff），档位沿用
  task.json 里上次裁决的记录，不降级。

## 错误码表

| code | 含义 | recoveryAction |
|------|------|----------------|
| TASK_INPUT_INVALID | begin 输入缺失/非法（change 名、goal、acceptance） | 按 problems[] 补参重跑 begin |
| TASK_NOT_BEGUN | change 缺 meta/task.json | 先运行 begin |
| TASK_ALREADY_FINISHED | 任务已终态（completed/abandoned/superseded） | `status` 查看结果；新任务换 change 名 |
| TASK_TIER_UPGRADE_REQUIRED | diff 触发 full 档信号（rc=3） | 改用 `/harness-plan` 完整流程；change 目录保留可续用 |
| FOREIGN_PATHS_PRESENT | begin 前预存且任务未触碰的脏路径（或 ownership 边界外路径） | 移出工作区/提交/stash 后重跑 finish |
| VERIFICATION_TARGET_MISSING | build-profile 未声明验证目标（含回退链） | `harness_preflight.py detect --project . --json` 重新探测 |
| VERIFICATION_FAILED | 验证命令 exit≠0（ledger 已记失败） | 修复后重跑 finish（ledger 覆盖） |
| GIT_COMMIT_FAILED | git add/commit 失败 | 手工检查 git status；或 `--no-commit` 跳过 |
| ARCHIVE_FAILED | 归档被阻断（task.json 已回滚 open） | 按 problems[] 处理后重跑 finish 补归档 |
| TASK_FINISHED_NO_ARCHIVE | `--no-commit` 成功但未提交未归档 | 手工提交后如需归档见 nextAction 命令 |
| POLICY_LOAD_FAILED | workflow-policy.json 加载失败 | 检查 `.harness/config/workflow-policy.json` |
| PROJECT_ROOT_INVALID | 项目未初始化（无 .harness/） | `npx hunter-harness init --profile general` |

错误信封统一带 `code` + `message` + `field_path` + `problems[]` +
`recoveryAction`（精确重跑命令）。

## finish 编排步骤（对照排障）

1. classify（post-run，读脏树 git status）
2. 档位裁决 + 外来脏路径检测（begin 脏树基线 + classify foreignPaths 双通道）
3. 声明 ownership.productPaths（classify 的 productPaths）
4. 写 gate-policy（plannedPhases=["task","archive"]）
5. 跑档位验证（回退链解析 argv）
6. 每项验证写 ledger（evidence 落 `evidence/<key>-<ts>.log`）
7. 生成 `plans/<cn>-plan.md`（目标:/风险等级:/## Tasks 契约行）
8. 刷新 state snapshot
9. git add -A + commit（不 push）
10. 写 `logs/execution-log.md`（final pushed hash 行）
11. phase.end + decision
12. task.json 终态 → 归档（record-only；失败回滚 open）
13. 简短摘要（完成内容/验证结果/残余风险/代码位置）

abandoned/superseded 闭包跳过 5-9 的验证与提交要求。

## Windows Git Bash 路径陷阱

- `--goal` 的值以 `/` 开头时（如 `/harness-task 的目标`），Git Bash 的
  MSYS 路径改写会把它变成 `C:/Program Files/Git/harness-task ...`。
  规避：目标不要以 `/` 开头，或用 `MSYS_NO_PATHCONV=1` 前缀执行。
- `--project` 用 `.`（相对）或正斜杠绝对路径；脚本内部已统一处理
  Windows 反斜杠。
- JSON 输出含中文/UTF-8，管道到文件时无 BOM。

## 产物清单（change 目录终态）

`meta/change-context.json`、`meta/state-snapshot.json`、
`meta/gate-policy.json`、`meta/task.json`、`meta/risk-classification.json`、
`events.ndjson`、`evidence/verification-ledger.json`、
`evidence/<verification>-<ts>.log`、`plans/<cn>-plan.md`、
`logs/execution-log.md`。归档移走整个目录到
`.harness/archive/<date>-<cn>/`。
