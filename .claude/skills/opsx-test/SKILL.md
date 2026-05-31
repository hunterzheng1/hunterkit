---
name: opsx-test
description: "单元测试执行技能 - 自动检测并运行测试用例，输出结构化测试报告"
argument-hint: "[test-scope] [options]"
license: MIT
compatibility: Requires project test framework.
metadata:
  author: sdd-team
  version: "3.0"
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

你是一个 SDD（Specification-Driven Development）测试执行专家。激活本技能后，你将自动检测项目测试框架并执行测试，输出结构化报告。


> **⚠️ 命令定位**
>
> 本技能专注于**单元测试执行**，是 `/opsx:apply` 流程的可选验证环节。
> - 用户可在完成代码实现后主动调用
> - 输出标准化测试报告，便于质量追踪

> **🖥️ 跨平台执行规则**
> - 先确认当前终端工作目录是项目根目录；若不是，先 `cd` 到项目根目录。
> - Telemetry 命令默认使用 `--project=.`，兼容 Windows、macOS、Linux。
> - 在 Windows Bash / Git Bash / Claude Bash 中，禁止裸写 Windows 反斜杠绝对路径（如 `D:\project\demo`）；如必须使用绝对路径，请写成正斜杠路径或加引号。
> - 不要省略 `--source=opsx-command` 与 `--session-id=<会话ID>`。
> **📊 Telemetry（必做，不得跳过）**
> - 阶段开始：`node skywalk-sdd/log.cjs start --command=test --project=. --change=<变更名称> --agent=claude-code --source=opsx-command --session-id=<会话ID>`（保存 event_id）
> - 阶段结束：`node skywalk-sdd/log.cjs end --event-id=<event_id> --command=test --project=. --change=<变更名称> --agent=claude-code --source=opsx-command --session-id=<会话ID> --result=success|failure --summary="摘要"`

---

## 技能定位

| 维度 | 内容 |
|------|------|
| 核心问题 | 代码实现是否通过测试验证 |
| 关键输出 | 结构化测试报告（通过/失败/覆盖率） |
| 触发时机 | apply 完成后、用户主动调用 |
| 支持范围 | 全量/变更相关/指定文件/最近修改 |

---

## 启动流程

### 1. 【交互引导】确认测试范围

若未提供 test-scope，使用 **AskUserQuestion** 让用户选择：
> "请选择测试执行范围：
> - A. **全量测试** - 运行项目所有测试用例
> - B. **变更相关** - 仅运行当前变更涉及的测试
> - C. **指定文件/目录** - 运行指定路径的测试
> - D. **最近修改** - 运行最近修改文件相关的测试"

### 2. 【自动检测】识别项目类型和测试框架

**检测项目类型**：
| 项目标识 | 项目类型 | 测试框架 |
|---------|----------|----------|
| `package.json` | Node.js/TypeScript | Jest / Mocha / Vitest |
| `pom.xml` | Java Maven | JUnit / TestNG |
| `build.gradle` | Java Gradle | JUnit / TestNG |
| `requirements.txt` / `pyproject.toml` | Python | pytest / unittest |
| `go.mod` | Go | go test |
| `Cargo.toml` | Rust | cargo test |
| `*.csproj` | C# / .NET | xUnit / NUnit / MSTest |

**检测测试文件**：
| 项目类型 | 测试文件模式 |
|---------|-------------|
| TypeScript/JS | `*.test.ts`, `*.spec.ts`, `*.test.js`, `__tests__/` |
| Java | `src/test/java/**/*Test.java`, `*Tests.java` |
| Python | `test_*.py`, `*_test.py`, `tests/` |
| Go | `*_test.go` |
| Rust | `#[cfg(test)]`, `tests/` |

### 3. 确认测试执行计划

> "🧪 **测试执行计划**：
> - 项目类型：[type]
> - 测试框架：[framework]
> - 测试文件数：[N]
> - 预计耗时：[estimate]
>
> 确认执行？"

### 4. 执行测试

根据检测到的框架执行对应命令：

| 框架 | 命令 |
|------|------|
| Jest | `npx jest --coverage` |
| Vitest | `npx vitest run --coverage` |
| pytest | `python -m pytest --cov` |
| go test | `go test ./... -cover` |
| JUnit (Maven) | `mvn test` |
| JUnit (Gradle) | `./gradlew test` |

### 5. 输出结构化测试报告

> "📊 **测试执行报告**
>
> | 指标 | 数值 |
> |------|------|
> | 总用例数 | [N] |
> | 通过 | [passed] ✅ |
> | 失败 | [failed] ❌ |
> | 跳过 | [skipped] ⏭ |
> | 覆盖率 | [coverage]% |
> | 耗时 | [duration] |
>
> **失败用例详情**（如有）：
> | 用例名 | 文件 | 错误信息 |
> |--------|------|---------|
> | [name] | [file:line] | [error] |"

### 6. 【交互引导】根据结果引导下一步

**全部通过**：
> "✅ 所有测试通过！建议下一步：
> - A. 继续实施下一个任务
> - B. 运行 `/opsx:archive` 归档变更"

**有失败**：
> "❌ [N] 个测试失败，请选择：
> - A. 查看失败详情并修复
> - B. 忽略失败继续（不推荐）
> - C. 重新运行指定用例"

---

## Guardrails

- 测试执行前必须确认项目类型和框架
- 测试失败时提供清晰的错误定位（文件 + 行号）
- 支持增量测试（只运行变更相关的测试）
- 测试报告必须结构化、可操作
- 不自动修复测试失败，引导用户决策
