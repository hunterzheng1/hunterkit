# CLAUDE.md — @hunterzheng/harness

## 项目概述

个人开发工具统一 CLI 入口，基于 OpenSpec SDD 工作流驱动。

## 命令

```bash
npm run build      # tsup 构建
npm run test       # vitest run
npm run test:watch # vitest watch 模式
npm run lint       # eslint src/ test/
npm run typecheck  # tsc --noEmit
```

## 架构

| 目录 | 职责 |
| --- | --- |
| `src/bin/harness.ts` | CLI 入口 |
| `src/cli/` | 命令注册、全局选项、交互式提示、输出格式化 |
| `src/core/` | 配置 schema、状态管理、工作空间、事务 |
| `src/capabilities/` | 各能力实现（develop/inspect/knowledge/review/safety/sync） |
| `src/adapters/` | 外部源适配器 |
| `src/commands/` | 顶层命令（config/doctor/status） |
| `test/` | 单元测试 |

## OpenSpec 集成

项目使用 OpenSpec 规范驱动开发，变更定义在 `openspec/changes/` 下。
可用 skill：`opsx-propose`, `opsx-spec`, `opsx-design`, `opsx-task`,
`opsx-apply`, `opsx-check`, `opsx-test`, `opsx-explore`, `opsx-archive`,
`opsx-knowledge`。

## 技术栈

- TypeScript 5.5+
- commander（CLI 解析）
- tsup（构建）
- vitest（测试）
- eslint（lint）
- @inquirer/prompts（交互式提示）
- chalk（终端着色）
