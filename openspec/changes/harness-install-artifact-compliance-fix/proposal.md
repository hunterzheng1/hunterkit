---
# 【用户选择配置 - 由 /opsx:propose 引导填写】
mode: "full"           # full=每个能力域独立文档(specs/<capability>/*), simple=单一文档(spec.md/design.md/tasks.md)
test-strategy: "tdd"   # tdd=测试先行, impl-first=实现优先, none=无测试
---

# proposal.md - 业务意图与上下文总览

> **定位**：变更的业务意图（Why）与上下文总览
>
> **可选性**：【可跳过，直入spec】若跳过，必须将"影响范围"在 specs 中补齐

---

## 1. 需求背景

### 1.1 现状问题
- 在 `E:\MyProject\Document-Conversion-Tool` 通过 `npx @hunterzheng/harness` 安装 `@hunterzheng/harness@2.0.4` 后，生成产物只完成了 `.harness` 骨架和部分 Claude 运行时 Skill，未完整满足《个人开发工具-harness-实施方案.md》与《CLAUDE_CODE_CODEX_SKILLS_AGENTS_HOOKS_GUIDE.md》对 Skill、Agent、Hook、根文档和 doctor 自检的要求。
- 用户选择了完整质量门，但运行时缺少 `.claude/settings.json`、`.claude/hooks/`、`.codex/hooks.json`、`.codex/hooks/` 等实际可被 AI 工具识别的投影文件，导致 Hook 只存在于 `.harness/adapters/**` 源目录，不能形成确定性约束。
- 生成的 `harness` Skill 过薄，源目录与运行时投影结构不一致：共享目录有 `references/scripts/assets`，但缺少标准 `SKILL.md`；Claude adapter 有 `SKILL.md`，但缺少相邻参考资料；Codex 运行时 Skill 在未选择 Codex 时合理缺省，但 installer 输出没有清楚展示选择结果。
- 根文档仍保留旧 DocSync 指令，未把用户日常入口收敛到 `harness` Skill / AI 工具 CLI，造成“旧来源能力名继续暴露”的体验回退。
- `harness doctor` 当前报告 OK，却没有发现运行时投影缺失、Skill 结构不完整、Hook 未生效、根文档未更新等关键缺口，自检结果与真实可用性不一致。

### 1.2 业务诉求
- 让用户在目标项目中只需要执行一次 `npx @hunterzheng/harness` 完成交互式安装，随后在 AI 工具 CLI 中通过统一 `harness` Skill 使用 inspect、sync、develop、review、knowledge 等能力。
- 保持“一个用户可见 `harness` Skill”的产品原则，同时保证其背后具备符合 guide 的 references、scripts、assets、agents、hooks 和运行时投影。
- 安装完成后，目标项目中的 Skill、Agent、Hook、根文档、配置和 doctor 结果必须互相一致，可被 Claude Code / Codex 按各自规范实际识别。

---

## 2. 业务目标

| 目标维度 | 具体描述 | 验收标准 |
|---------|---------|---------|
| 功能目标 | 修复安装产物与实施方案不一致的问题 | 重新在临时目标项目执行 `npx @hunterzheng/harness` 后，生成的 Skill、Agent、Hook、根文档、配置与所选 AI 工具完全匹配 |
| 性能目标 | 安装与 doctor 校验保持本地快速执行 | 常规项目初始化与 doctor 不引入网络依赖，不因新增结构校验显著拖慢交互 |
| 体验目标 | 用户只面对统一 harness 入口，不再看到 DocSync/GSD/kld-sdd/kld-review 作为日常命令 | README/AGENTS/CLAUDE/Codex 入口文档只暴露 harness 使用方式；旧来源名仅可作为内部来源说明出现 |

---

## 3. 能力分解

### 3.1 新增能力
- 无。本变更修复既有 Harness 能力的安装合规性与验收闭环，不新增独立产品能力。

### 3.2 修改能力
- `harness-adapter-skill-runtime`: 明确 shared/Claude/Codex Skill 源结构、运行时薄投影、Agent metadata、选择性生成规则与 guide 合规验收。
- `harness-safety-orchestration`: 修复完整质量门下 Hook 源文件与运行时投影不一致的问题，补齐默认安全规则与 Hook 生效自检。
- `harness-sync`: 修复根文档 managed block 写入策略，移除旧 DocSync 日常命令暴露，保持 AI 工具入口文档短而准确。
- `harness-workspace-config`: 扩展 install config 与 doctor 校验，确保 doctor 能识别 Skill/Agent/Hook/文档投影缺失和配置不一致。
- `harness-cli-entrypoint`: 优化向导选择回显和安装摘要，避免“选择 AI 工具”结果为空或难以判断。
- `harness-quality-gates-fix`: 将安装产物合规检查纳入 TDD 验收，避免质量门只报告配置存在而忽略运行时不可用。

---

## 4. 影响范围

### 4.1 涉及模块
- [x] CLI 初始化向导：影响 AI 工具选择、能力选择、写入策略、Hook 强度与安装摘要。
- [x] Adapter / Skill runtime：影响 `.harness/adapters/**` 源结构、`.claude/skills/**`、`.agents/skills/**` 等运行时投影。
- [x] Hook 安装与安全编排：影响 `.claude/settings.json`、`.claude/hooks/`、`.codex/hooks.json`、`.codex/hooks/` 的生成和校验。
- [x] 根文档同步：影响 `AGENTS.md`、`CLAUDE.md`、Codex 入口文档以及 Harness managed block。
- [x] Workspace config / doctor：影响 `.harness/config/harness.config.json`、状态文件、doctor 诊断输出和 JSON 结构。
- [x] 测试与 fixture：影响安装端到端 fixture、结构快照、doctor 负例和 TDD 回归用例。

### 4.2 依赖关系
```
[实施方案 + Skill/Agent/Hook guide + 实测安装缺口]
  --> [本变更：安装产物合规修复]
  --> [目标项目可通过统一 harness Skill + runtime hooks + doctor 自检使用]
```

### 4.3 数据影响
- 数据库表变更：无。
- 接口变更：不引入新的公开产品命令；可能扩展 `doctor --json` 的诊断项与安装摘要字段。
- 配置变更：补齐默认 safety patterns、AI 工具选择状态、Skill/Hook/Agent 投影状态与 managed document 状态。

---

## 5. 约束与假设

### 5.1 业务约束
- 每个目标项目仍只安装一个用户可见 Skill：`harness`；不得退回“多个能力名 Skill 暴露给用户”的模式。
- 用户日常指令必须发生在 AI 工具 CLI 中，通过 `harness` Skill 路由；README 不应要求用户复制一串命令行参数来完成日常工作流。
- DocSync、GSD、kld-sdd、kld-review 只能作为内部能力来源，不作为用户日常命令名。

### 5.2 技术约束
- 必须遵循 Claude Code 与 Codex 对项目级 Skill、Agent、Hook 的目录识别规则。
- `.harness/adapters/**` 是源文件与完整资料，`.claude/**`、`.agents/**`、`.codex/**` 是所选工具需要识别的运行时薄投影。
- 需要支持 Windows 路径与跨平台脚本执行，避免生成只在单一 shell 下可用的 Hook 指令。
- 本变更采用 TDD：先用失败测试刻画目标安装产物，再实现修复。

### 5.3 前置依赖
- [x] 已有实施方案：《requirements/个人开发工具-harness-实施方案.md》。
- [x] 已有规范参考：《requirements/CLAUDE_CODE_CODEX_SKILLS_AGENTS_HOOKS_GUIDE.md》。
- [x] 已有实测案例：`E:\MyProject\Document-Conversion-Tool` 安装 `@hunterzheng/harness@2.0.4` 后的产物缺口。
- [x] 已有基础能力 specs：`harness-adapter-skill-runtime`、`harness-safety-orchestration`、`harness-sync`、`harness-workspace-config` 等。

---

## 6. 风险评估

| 风险项 | 概率 | 影响 | 应对策略 |
|-------|------|------|---------|
| 运行时投影过多导致目标项目污染 | 中 | 中 | 坚持“源文件在 `.harness`，运行时只写工具必须识别的薄投影”，并按用户选择生成 |
| Claude 与 Codex Hook 规范差异导致误生成 | 中 | 高 | 分工具建立 fixture 和 doctor 校验，未选择的工具不生成运行时投影 |
| 根文档更新覆盖用户内容 | 中 | 高 | 只更新 Harness managed block，保留用户手写内容，并增加回归测试 |
| doctor 诊断变严格后暴露历史项目问题 | 中 | 中 | 区分 error/warning，并给出 repair 建议，避免无提示阻断 |
| Skill 内容变厚导致上下文负担增加 | 低 | 中 | 运行时 `SKILL.md` 保持薄路由，完整资料留在 `references/scripts/assets` |

---

## 7. 相关文档

- 需求文档：`requirements/个人开发工具-harness-实施方案.md`
- 参考文档：`requirements/CLAUDE_CODE_CODEX_SKILLS_AGENTS_HOOKS_GUIDE.md`
- 实测目标项目：`E:\MyProject\Document-Conversion-Tool`
- 相关既有规格：`openspec/specs/harness-adapter-skill-runtime/spec.md`
- 相关既有规格：`openspec/specs/harness-safety-orchestration/spec.md`
- 相关既有规格：`openspec/specs/harness-sync/spec.md`
- 相关既有规格：`openspec/specs/harness-workspace-config/spec.md`
- 相关既有规格：`openspec/specs/harness-cli-entrypoint/spec.md`
- 相关既有规格：`openspec/specs/harness-quality-gates-fix/spec.md`

---

> **质量红线检查清单**
> - [x] 逻辑链路已闭环
> - [x] 受影响模块已明确
> - [x] 依赖关系已梳理
> - [x] 若跳过本文档，影响范围已在 specs 中补齐
> - [x] 能力分解章节已明确列出所有能力
