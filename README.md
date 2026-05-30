# @hunterzheng/harness

个人开发工具统一 CLI 入口（Personal Development Tool Harness）。

Harness 为您的项目提供 inspect、sync、review、develop、knowledge、status、doctor、config 八大能力，全部通过 AI 工具 CLI 触发。

## 使用方式（目标项目用户）

Harness 面向目标项目的使用方式为：在 AI 工具 CLI（Claude Code、Codex 等）的对话中直接触发，无需手动安装或命令操作。

### 在 Claude Code 中使用

在 Claude Code 对话中输入以下命令即可触发 Harness：

```
npx @hunterzheng/harness
```

首次使用时 Harness 会自动进入交互式初始化向导，引导您完成项目配置。初始化完成后，**所有日常操作均由 AI 工具在对话中自动调用对应的 Harness 命令**，您只需向 AI 工具表达意图即可。

> **例如**：当您说「帮我审查代码」时，AI 工具会自动执行 `harness review --local`；当您说「检查项目状态」时，AI 工具会自动执行 `harness status`。

### 在 Codex 中使用

在 Codex 对话中输入以下命令即可触发 Harness：

```
npx @hunterzheng/harness
```

使用方式与 Claude Code 完全相同，Harness 会自动适配 Codex 的 Skill 和 Hook 机制。

### 初始化后使用

目标项目完成 Harness 初始化后，以下所有命令均由 AI 工具 CLI 自动触发：

| 命令 | 描述 | 需要工作空间初始化 | 状态 |
| --- | --- | --- | --- |
| `inspect` | 扫描项目结构并生成事实 | 是 | ✅ 已可用 |
| `sync` | 与知识库同步文档 | 是 | ✅ 已可用 |
| `review` | 执行代码审查 | 是 | ✅ 已可用（本地启发式扫描，多 agent 并行审查后续版本） |
| `develop` | 执行开发工作流 | 是 | 🔶 propose 可用，spec/design/tasks/check/apply/archive ⏳ 后续版本 |
| `knowledge` | 管理知识索引 | 是 | 🔶 基础搜索可用，高级功能 ⏳ 后续版本 |
| `status` | 显示工作空间和项目状态 | 否 | ✅ 已可用 |
| `doctor` | 诊断环境和依赖 | 否 | ✅ 已可用 |
| `config` | 管理 harness 配置 | 否 | ✅ 已可用 |

> **状态说明**：✅ 已可用 / 🔶 受限可用 / ⏳ 后续版本

### 全局选项

所有命令均支持以下全局选项：

- `--cwd <path>` — 指定项目根目录
- `--dry-run` — 预览模式，不写入文件
- `--json` — 纯 JSON 输出
- `--no-color` — 禁用 ANSI 颜色

运行 `harness --help` 查看可用命令。

---

## 开发（本仓库贡献者）

> **以下内容仅适用于 `@hunterzheng/harness` 仓库本身的开发者，目标项目用户无需关心。**

```bash
# 安装依赖
npm install

# 构建
npm run build

# 运行测试
npm run test

# 运行测试（watch 模式）
npm run test:watch

# lint 检查
npm run lint

# 类型检查
npm run typecheck
```

## 架构

- **CLI 入口**: `src/bin/harness.ts` — 基于 commander 的统一命令解析
- **命令注册**: `src/cli/command-registry.ts` — 能力命令动态注册
- **核心模块**: `src/core/` — 配置、状态、工作空间管理
- **能力层**: `src/capabilities/` — develop / inspect / knowledge / review / safety / sync
- **适配器层**: `src/adapters/` — 外部源适配
- **测试**: `test/` — vitest 单元测试

## 依赖

- Node.js >= 20.0.0
- npm >= 10.0.0