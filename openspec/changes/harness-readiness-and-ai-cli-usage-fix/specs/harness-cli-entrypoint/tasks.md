# 实施任务拆解 - harness-cli-entrypoint（增量）

> **边界声明**：增量修改，仅涉及 CLI 入口的 help 输出和 AI CLI 感知。

---

## 1. 任务总览

### 1.1 关联文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| 技术契约 | `specs/harness-cli-entrypoint/spec.md` | 3 需求项 5 场景 |
| 技术方案 | `specs/harness-cli-entrypoint/design.md` | 3 文件 2 修改点 |

### 1.2 实现范围

dist 入口 help 输出、--help --json 行为、AI CLI 环境变量检测。

### 1.3 技术栈

TypeScript 5.5+ / commander 12.1

---

## 2. 任务执行拓扑图

### 2.0 测试策略

**当前测试策略**：`测试驱动`

### 2.1 拓扑图

```
层级 1: [TASK-CLE-01] 编写 help + AI CLI 测试
层级 2: [TASK-CLE-02] 实现 --help --json 输出
        [TASK-CLE-03] 实现 AI CLI 环境检测 + 向导提示
层级 3: [TASK-CLE-04] 运行测试验证
```

---

## 3. 原子任务清单

### [TASK-CLE-01] 编写 help + AI CLI 测试

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [ ] 未完成

- **任务描述**: 编写测试覆盖 dist help 输出和 --help --json 行为
- **输出**: `test/cli-entrypoint-extra.test.ts`

- **实现步骤**:
  1. --help --json 测试：stdout 为合法 JSON + 含 commands 数组
  2. dist help 测试：stdout 含 8 命令列表
  3. 交互式入口 AI CLI 提示测试

- **验收标准**:
  - [ ] 3 个测试用例存在（预期部分失败）

---

### [TASK-CLE-02] 实现 --help --json 输出

- **类型**: 接口层
- **依赖**: TASK-CLE-01
- **状态**: [ ] 未完成

- **任务描述**: 在 `main()` 中实现 `--help --json` 输出命令列表 JSON
- **输入**: `src/cli/main.ts`
- **输出**: JSON 命令列表输出

- **实现步骤**:
  1. 检测 `isHelp && globalOptions.json`
  2. 构建 `{ commands: [...] }` JSON
  3. 调用 `writeCliResponse` 输出

- **验收标准**:
  - [ ] `--help --json` stdout 为合法 JSON
  - [ ] data.commands 数组含 8 个命令

- **关联设计**: design.md §4.1

---

### [TASK-CLE-03] 实现 AI CLI 环境检测 + 向导提示

- **类型**: 接口层
- **依赖**: TASK-CLE-01
- **状态**: [ ] 未完成

- **任务描述**: 在交互式入口增加 AI CLI 类型检测和提示
- **输入**: `src/cli/interactive.ts`
- **输出**: 向导/菜单增强

- **实现步骤**:
  1. 实现 `detectAiTool()`：检查 `CLAUDE_CODE_SESSION_ID`/`CODEX_SESSION_ID`
  2. 在向导首屏展示"由 Claude Code / Codex 触发"
  3. 在操作菜单展示 AI CLI 上下文

- **验收标准**:
  - [ ] 设置 `CLAUDE_CODE_SESSION_ID` 后向导显示 "Claude Code"
  - [ ] 未知环境不显示 AI 工具名

- **关联设计**: design.md §4.2

---

### [TASK-CLE-04] 运行测试验证

- **类型**: 测试-验证
- **依赖**: TASK-CLE-02, TASK-CLE-03
- **状态**: [ ] 未完成

**验收标准**:
- [ ] `test/cli-entrypoint-extra.test.ts` 全部通过
- [ ] `npm run typecheck` 通过

---

## 4. 验证方式

- [ ] `node dist/bin/harness.js --help --json` 输出合法 JSON
- [ ] `CLAUDE_CODE_SESSION_ID=1 node dist/bin/harness.js` 向导显示 Claude Code

---

> **质量红线检查清单**
> - [x] 每个任务 ≤ 5 分钟
> - [x] 100% 覆盖 spec.md（3 需求项 → 4 任务）
> - [x] 100% 覆盖 design.md（2 修改点 → 4 任务）
> - [x] 无循环依赖