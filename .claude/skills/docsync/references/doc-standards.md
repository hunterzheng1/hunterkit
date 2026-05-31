# 文档标准

## 文档职责分工

### README.md

- 面向用户（安装者和使用者）
- 项目简介、安装方式、快速开始、命令参考、开发指南、安全说明、环境要求、License

### AGENTS.md

- 面向 AI Agent（Claude Code、Codex 等）
- 项目说明、命令契约、开发规则、验证要求、安全约束
- 跨 agent 通用规则源

### CLAUDE.md

- 面向 Claude Code 在本项目中的使用
- 项目概览、常用命令、SDD 工作流、开发规范、目录结构
- Claude Code 轻量适配层，建议通过 `@AGENTS.md` 导入通用规则

## 同步原则

1. 最小化更新：只更新需要的文档和章节，不重写整篇
2. 禁止编造：所有命令、端口、环境变量、API 必须来自仓库事实
3. TODO(review)：不确定的内容必须标记，不得猜测
4. 保持简洁：避免重复和过时信息
5. 不读取密钥：禁止读取或输出 `.env`、token、凭证文件
6. 不执行危险操作：禁止 `git commit`、`git push`、`npm publish`
