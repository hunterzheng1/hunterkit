# AGENTS.md — @hunterzheng/harness

## 项目约定

- TypeScript 项目，ESM 模块格式
- CLI 基于 commander，命令定义在 `src/capabilities/*/command.ts`
- 测试使用 vitest，测试文件位于 `test/`
- 构建使用 tsup，输出到 `dist/`

## OpenSpec SDD 工作流

变更通过 OpenSpec skill 管理：

1. `opsx-propose` → 业务意图
2. `opsx-spec` → 技术契约
3. `opsx-design` → 技术设计
4. `opsx-task` → 任务拆解
5. `opsx-apply` → 代码实现
6. `opsx-check` → 质量检查
7. `opsx-test` → 单元测试
8. `opsx-archive` → 归档

## 代码风格

- 使用中文注释
- 遵循 eslint 规则
- 提交信息遵循 Conventional Commits 格式
