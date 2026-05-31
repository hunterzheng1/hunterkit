---
name: OPSX: Test
description: "执行单元测试 - 自动检测并运行测试用例，输出测试报告"
argument-hint: "[test-scope] [options]"
---

执行单元测试 - 自动检测项目中的测试用例并运行，输出结构化测试报告。

> **🖥️ 跨平台执行规则**
> - 先确认当前终端工作目录是项目根目录；若不是，先 `cd` 到项目根目录。
> - Telemetry 命令默认使用 `--project=.`，兼容 Windows、macOS、Linux。
> - 在 Windows Bash / Git Bash / Claude Bash 中，禁止裸写 Windows 反斜杠绝对路径（如 `D:\project\demo`）；如必须使用绝对路径，请写成正斜杠路径或加引号。
> - 不要省略 `--source=opsx-command` 与 `--session-id=<会话ID>`。
> **📊 Telemetry（必做，不得跳过）**
> 在终端执行（必须成功）：`node skywalk-sdd/log.cjs start --command=test --project=. --change=<变更名称> --capability=<可选capability-name> --agent=claude-code --source=opsx-command --session-id=<会话ID>`，记录返回的 event_id。

> **⚠️ 命令定位**
>
> 本命令专注于**单元测试执行**，是 `/opsx:apply` 流程的可选验证环节。
> - 用户可在完成代码实现后主动调用
> - 输出标准化测试报告，便于质量追踪

---

**执行步骤**

0. **【Telemetry 必做】记录阶段开始**

   在终端执行（若命令失败必须中止本阶段，不得跳过）：
   ```bash
   node skywalk-sdd/log.cjs start --command=test --project=. --change=<变更名称> --capability=<可选capability-name> --agent=claude-code --source=opsx-command --session-id=<会话ID>
   ```
   保存输出 JSON 中的 `event_id`，供阶段结束使用。

1. **【交互引导】确认测试范围**

   若未提供 test-scope，使用 **AskUserQuestion** 让用户选择：
   > "请选择测试执行范围：
   > - A. **全量测试** - 运行项目所有测试用例
   > - B. **变更相关** - 仅运行当前变更涉及的测试
   > - C. **指定文件/目录** - 运行指定路径的测试
   > - D. **最近修改** - 运行最近修改文件相关的测试"

2. **【自动检测】识别项目类型和测试框架**

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
   | C# | `*Tests.cs`, `*.Tests/` |

   **显示检测结果**：
   > "🔍 **测试环境检测**
   > - 项目类型: TypeScript (Node.js)
   > - 测试框架: Jest
   > - 检测到测试文件: 12 个
   > - 测试用例预估: ~45 个"

3. **【执行测试】运行测试命令**

   **根据项目类型执行对应命令**：
   
   | 项目类型 | 测试命令 | 覆盖率命令 |
   |---------|----------|-----------|
   | Node.js (npm) | `npm test` | `npm test -- --coverage` |
   | Node.js (Jest) | `npx jest` | `npx jest --coverage` |
   | Node.js (Vitest) | `npx vitest run` | `npx vitest run --coverage` |
   | Java Maven | `mvn test` | `mvn test jacoco:report` |
   | Java Gradle | `./gradlew test` | `./gradlew test jacocoTestReport` |
   | Python | `pytest` | `pytest --cov` |
   | Go | `go test ./...` | `go test ./... -cover` |
   | Rust | `cargo test` | `cargo tarpaulin` |
   | C# | `dotnet test` | `dotnet test --collect:"XPlat Code Coverage"` |

   **执行选项**：
   - `--verbose` / `-v`: 显示详细输出
   - `--coverage` / `-c`: 生成覆盖率报告
   - `--watch` / `-w`: 监听模式（持续运行）
   - `--filter <pattern>`: 过滤特定测试

4. **【输出报告】生成测试报告**

   **测试报告格式**：
   ```markdown
   ## 📊 单元测试报告
   
   **执行时间**: 2024-03-27 14:30:25
   **执行范围**: 全量测试
   **总耗时**: 12.5s
   
   ### 测试结果摘要
   
   | 指标 | 数值 | 状态 |
   |------|------|------|
   | 总用例数 | 45 | - |
   | 通过 | 43 | ✅ |
   | 失败 | 2 | ❌ |
   | 跳过 | 0 | ⏭️ |
   | 通过率 | 95.6% | ⚠️ |
   
   ### 失败用例详情
   
   #### ❌ UserService.test.ts > createUser
   - **断言失败**: Expected status 200, received 500
   - **位置**: `src/services/__tests__/UserService.test.ts:42`
   - **可能原因**: 数据库连接未初始化
   
   #### ❌ AuthController.test.ts > validateToken
   - **断言失败**: Token validation timeout
   - **位置**: `src/controllers/__tests__/AuthController.test.ts:78`
   - **可能原因**: 异步超时设置过短
   
   ### 覆盖率报告（如启用）
   
   | 模块 | 行覆盖率 | 分支覆盖率 | 函数覆盖率 |
   |------|----------|-----------|-----------|
   | services/ | 85.2% | 72.1% | 90.0% |
   | controllers/ | 78.5% | 65.3% | 82.4% |
   | utils/ | 92.1% | 88.7% | 95.0% |
   | **总计** | **83.6%** | **73.2%** | **87.5%** |
   ```

5. **【交互引导】后续操作建议**

   **全部通过时**：
   > "✅ **测试全部通过**
   >
   > - 通过: 45/45 用例
   > - 通过率: 100%
   > - 覆盖率: 83.6%
   >
   > 测试质量良好，可以继续后续流程。
   >
   > **下一步**：
   > - 运行 `/opsx:apply` 继续实施任务
   > - 运行 `/opsx:archive` 归档变更"

   **存在失败时**：
   > "❌ **存在失败用例**
   >
   > - 通过: 43/45 用例
   > - 失败: 2 个
   > - 通过率: 95.6%
   >
   > 请选择：
   > - A. **查看失败详情** - 分析失败原因
   > - B. **修复并重新测试** - 我来协助修复
   > - C. **跳过继续** - 标记为已知问题，继续流程
   > - D. **生成修复任务** - 创建 TASK 修复这些问题"

   **无测试文件时**：
   > "⚠️ **未检测到测试用例**
   >
   > 当前项目未发现测试文件。
   >
   > 请选择：
   > - A. **指定测试路径** - 手动指定测试文件位置
   > - B. **创建测试用例** - 为当前实现生成测试
   > - C. **跳过测试** - 本次不执行测试"

5. **【Telemetry 必做】整理结构化测试结果**

   测试运行后，必须将结果整理为以下标准 schema：

   ```json
   {
     "test_results": {
       "command": "npm test",
       "passed": 12,
       "failed": 0,
       "skipped": 1,
       "coverage": 85.5,
       "duration_ms": 40000
     }
   }
   ```

   **字段口径**：
   - `command`: 实际执行的测试命令。
   - `passed`: 通过用例数。
   - `failed`: 失败用例数。
   - `skipped`: 跳过用例数，没有则填 `0`。
   - `coverage`: 覆盖率百分比，无法获取时填 `null`。
   - `duration_ms`: 测试耗时，无法获取时填 `null`。

---

**使用示例**

```bash
# 运行全量测试
/opsx:test

# 运行变更相关测试
/opsx:test --scope change

# 运行并生成覆盖率报告
/opsx:test --coverage

# 运行指定目录的测试
/opsx:test src/services/

# 监听模式
/opsx:test --watch

# 过滤特定测试
/opsx:test --filter "UserService"
```

---

**护栏规则**

- **自动检测优先**：优先自动检测项目类型和测试框架，减少用户配置
- **标准化报告**：输出结构化测试报告，便于质量追踪和问题定位
- **失败详情**：测试失败时提供详细错误信息和可能原因分析
- **覆盖率可选**：覆盖率报告为可选功能，通过 `--coverage` 启用
- **不阻塞流程**：测试结果作为参考，由用户决定是否继续
- **支持增量测试**：支持仅运行变更相关的测试，提升效率

> **🖥️ 跨平台执行规则**
> - 先确认当前终端工作目录是项目根目录；若不是，先 `cd` 到项目根目录。
> - Telemetry 命令默认使用 `--project=.`，兼容 Windows、macOS、Linux。
> - 在 Windows Bash / Git Bash / Claude Bash 中，禁止裸写 Windows 反斜杠绝对路径（如 `D:\project\demo`）；如必须使用绝对路径，请写成正斜杠路径或加引号。
> - 不要省略 `--source=opsx-command` 与 `--session-id=<会话ID>`。
> **📊 Telemetry（必做，不得跳过）**
> 测试运行后，必须记录结构化测试结果：`node skywalk-sdd/log.cjs record --type=test_result --command=test --project=. --change=<变更名称> --capability=<可选capability-name> --agent=claude-code --source=opsx-command --session-id=<会话ID> --result=success/failure --summary="测试结果摘要" --details-json="{\"test_results\":{\"command\":\"<实际测试命令>\",\"passed\":0,\"failed\":0,\"skipped\":0,\"coverage\":null,\"duration_ms\":0}}"`
> 若 spec.md 中有可识别场景 ID，且测试能映射到这些场景，建议记录 Q4 规约驱动测试覆盖率（可选，不阻塞测试流程）：`node skywalk-sdd/log.cjs record --type=coverage_result --command=test --project=. --change=<变更名称> --capability=<可选capability-name> --agent=claude-code --source=opsx-command --session-id=<会话ID> --result=success/partial/failure --summary="规约场景测试覆盖率" --details-json="{\"spec_test_coverage\":{\"mappings\":[{\"scenario_id\":\"SCN-001\",\"description\":\"规约场景摘要\",\"test_ids\":[\"<测试文件或用例ID>\"],\"status\":\"covered\",\"notes\":\"\"}]}}"`
> 阶段结束时执行（必须成功）：`node skywalk-sdd/log.cjs end --event-id=<开头记录的event_id> --command=test --project=. --change=<变更名称> --capability=<可选capability-name> --agent=claude-code --source=opsx-command --session-id=<会话ID> --result=success/failure --summary="测试结果摘要" --details-json="{\"test_results\":{\"command\":\"<实际测试命令>\",\"passed\":0,\"failed\":0,\"skipped\":0,\"coverage\":null,\"duration_ms\":0}}"`
