---
# 【用户选择配置 - 由 /opsx:propose 引导填写】
mode: "full"           # full=每个能力域独立文档(specs/<capability>/*), simple=单一文档(spec.md/design.md/tasks.md)
test-strategy: "tdd" # tdd=测试先行, impl-first=实现优先, none=无测试
---

# proposal.md - 业务意图与上下文总览

> **定位**：变更的业务意图（Why）与上下文总览
>
> **可选性**：【可跳过，直入spec】若跳过，必须将"影响范围"在 specs 中补齐

---

## 1. 需求背景

当前 Harness 项目已经具备 npm 包骨架、CLI 入口、部分能力模块、测试用例和构建产物，但按 `requirements/个人开发工具-harness-实施方案.md` 的完成定义和 M1 标准检查后，仍未达到可交付状态。更重要的是，当前 README 将用户引导为 `npm install`、`npm run build` 和命令行执行 `harness <command>`，这与用户明确要求的产品使用方式冲突：Harness 在目标项目中必须通过 `npx @hunterzheng/harness` 由 AI 工具 CLI 触发安装和使用，普通用户不应被引导到手动 npm 安装或独立命令行操作。

### 1.1 现状问题
- README 的“安装”章节仍展示 `npm install` 和 `npm run build`，容易让目标项目用户误以为需要克隆仓库后本地构建。
- README 的“使用”章节直接展示 `harness <command>`，没有明确这是由 Claude Code / Codex 等 AI 工具 CLI 触发的底层调用，不符合“全部指令都在 AI 工具 CLI 中进行”的产品约束。
- 实测 `npm run typecheck` 失败，包含 `Transaction` 类型未导出、review severity 类型不匹配、config 类型转换不安全等问题。
- 实测 `npm run lint` 失败，ESLint 9 找不到 `eslint.config.js`。
- 实测 `node dist/bin/harness.js --help` 无帮助输出，npx 入口体验不完整。
- 实测命令级参数未传入 handler：`develop demo-change --propose` 被 handler 识别为缺少 change，`knowledge --search demo` 被识别为缺少 `--index` 或 `--search`。
- `develop` 的 spec/design/tasks/check/apply/archive 多数阶段仍为 `not yet implemented`，不能支撑 `harness develop <change>` 的完整规格驱动流程。
- `review` 当前是本地启发式扫描和模拟 reviewer，尚未达到多 reviewer、validator 复核、置信度过滤和报告约束的完整要求。
- `knowledge` 当前存在 JSON fallback 写入 `.sqlite` 路径的行为，与第一版“本地 SQLite FTS5”边界和隐私约束不完全一致。
- `safety` 已有危险命令和 Hook 生成思路，但 Hook dispatcher、事件审计、push gate 与 subagent 写入冲突编排尚未形成完整闭环。

### 1.2 业务诉求
- 将 Harness 对外使用口径统一为：目标项目用户只通过 AI 工具 CLI 触发 `npx @hunterzheng/harness`，由 Harness 完成初始化、能力选择、Skill/Hook 投影和后续 CLI 调用。
- README 必须区分“目标项目用户使用方式”和“Harness 仓库开发者贡献方式”；默认首屏和主要路径只讲 AI 工具 CLI + npx，不把 npm 安装作为用户入口。
- 修复真实 CLI 参数透传、help 输出、typecheck、lint 等基础可用性问题，让 M1 验收命令具备可执行基础。
- 把当前缺口拆成可验证能力域，后续通过 specs/design/tasks/apply 按 TDD 推进，而不是继续停留在文档或模拟实现层。
- 所有面向用户的命令说明必须避免暴露 DocSync、GSD、kld-sdd、kld-review 等来源名作为日常命令。

---

## 2. 业务目标

| 目标维度 | 具体描述 | 验收标准 |
|---------|---------|---------|
| 功能目标 | 修复 CLI 主入口的参数透传和帮助输出，使 `npx @hunterzheng/harness` 与 `harness <command>` 的底层调用能真实执行带参数命令 | `node dist/bin/harness.js --help` 有命令帮助；`develop demo-change --propose --dry-run --json` 能识别 change；`knowledge --search demo --json` 能识别 query |
| 功能目标 | 将 README 用户路径改为 AI 工具 CLI 触发 npx 安装和使用，npm 安装只保留为贡献者开发说明 | README 中目标项目用户入口必须是 `npx @hunterzheng/harness`；不得把 `npm install` 写成用户安装步骤；需说明普通指令由 Claude Code / Codex 等 AI 工具内触发 |
| 功能目标 | 修复工程质量门禁，使 M1 基础验证可执行 | `npm run typecheck`、`npm run lint`、`npm test`、`npm run build` 必须通过 |
| 功能目标 | 收敛 M1 能力到真实可验收状态：inspect、sync、review、统一 harness skill、基础 adapter | M1 验收命令在 fixture 上通过，review 输出 Markdown + JSON，dry-run 零写入 |
| 功能目标 | 明确非 M1 深度能力的缺口状态，避免 README 或报告声称已完整完成 | develop apply、完整多 agent review、knowledge 增强、safety orchestration 深度 Hook 若未完成，必须在状态/文档中标记为待实现或受限 |
| 性能目标 | 保持 M1 命令在小型 fixture 上快速反馈 | `inspect/sync/review/status/doctor` 在小型 fixture 上单次运行不超过 60 秒 |
| 体验目标 | 用户无需理解 npm、构建、内部来源项目或底层目录即可在目标项目开始使用 | README 和 CLI 提示均以 AI 工具 CLI + npx + 统一 harness skill 为主路径 |
| 质量目标 | 后续 tasks 必须采用 TDD，先补失败用例再修实现 | tasks 阶段需生成“失败测试 → 实现修复 → 验证命令”的依赖 DAG |

---

## 3. 能力分解

### 3.1 新增能力
- `harness-readme-ai-cli-usage`: 修正 README 和用户文档口径，明确目标项目只通过 AI 工具 CLI 触发 npx 使用，npm 仅作为贡献者开发说明。
- `harness-cli-argument-and-help-fix`: 修复 CLI 参数透传、help 输出和真实命令路由，确保带参数命令在 dist 入口下可执行。
- `harness-quality-gates-fix`: 修复 typecheck、lint、build、test、pack dry-run 等基础工程门禁，使 M1 验收具备可信证据。
- `harness-m1-command-readiness`: 聚焦 M1 命令 inspect、sync、review、status、doctor、adapter/skill 的可运行验收与限制说明。

### 3.2 修改能力
- `harness-cli-entrypoint`: 修改入口契约，确保 npx/AI 工具 CLI 使用路径、help 输出和命令参数透传一致。
- `harness-adapter-skill-runtime`: 修改 Skill/adapter 口径，让用户自然语言和 AI 工具 CLI 触发统一 Harness CLI，而不是引导用户直接操作 shell。
- `harness-review`: 修改 M1 review 验收边界，明确本地报告版必须真实输出 Markdown + JSON；多 agent/validator 若未完全实现需标记阶段。
- `harness-develop`: 修改状态呈现和 README 声明，避免把未实现阶段包装成已完成能力。
- `harness-knowledge`: 修改第一版本地索引边界，避免 JSON fallback 冒充 SQLite FTS5 完整实现。
- `harness-safety-orchestration`: 修改 Hook 和事件审计验收边界，确保危险命令、push 门禁和事件路径说到做到。

---

## 4. 影响范围

### 4.1 涉及模块
- [ ] README 与用户文档：调整安装、使用、AI 工具 CLI、开发者说明的层级和措辞。
- [ ] CLI 入口：影响 `src/bin/harness.ts`、`src/cli/main.ts`、`src/cli/global-options.ts`、`src/cli/command-registry.ts` 和输出层。
- [ ] 质量配置：影响 TypeScript 类型、ESLint 9 配置、package scripts 和 CI/M1 验收命令。
- [ ] inspect/sync/review M1 能力：影响 fixture 验收、dry-run、JSON 输出和报告路径。
- [ ] adapter/skill runtime：影响 Claude/Codex 运行时投影、统一 harness skill 的说明和修复命令。
- [ ] develop/knowledge/safety 能力状态：影响未完成功能的状态展示、错误码和文档声明。
- [ ] 发布包：影响 `npm pack --dry-run` 的发布内容检查和用户入口说明。

### 4.2 依赖关系
```
[需求文档完成定义 + 当前实现缺口 + 用户 npx/AI 工具 CLI 约束]
        --> [本变更：readme 口径 + CLI 参数/help + 质量门禁 + M1 可验收性]
        --> [后续 specs/design/tasks/apply 修复实现与验证命令]
        --> [目标项目通过 AI 工具 CLI 使用 npx @hunterzheng/harness]
```

### 4.3 数据影响
- 数据库表变更：无服务端数据库变更；knowledge 相关本地索引行为需在后续 spec 中明确 SQLite FTS5 与 fallback 边界。
- 接口变更：CLI 参数透传、help 输出、JSON 输出、错误响应和 AI 工具 CLI 调用说明需要修正。
- 配置变更：可能新增 ESLint 9 配置；可能调整 `.harness/config` 默认值、adapter 投影说明和 package scripts。

---

## 5. 约束与假设

### 5.1 业务约束
- 目标项目用户只通过 AI 工具 CLI 触发 `npx @hunterzheng/harness`，不要求用户手动进入普通命令行执行 npm 安装。
- README 的默认用户路径不得写成 `npm install`、`npm run build`；这些只能放在“开发者贡献”或“本仓库开发”章节。
- 所有日常能力对外只暴露 `harness inspect/sync/develop/review/knowledge/status/doctor/config`，不暴露内部来源项目名作为命令。
- Skill 只做意图识别、CLI 路由和摘要展示，不承载大段业务逻辑。
- 未完成或受限功能必须明确标注状态，不能让用户误以为已经达到完整完成定义。

### 5.2 技术约束
- 当前阶段只生成 proposal.md，不修改代码或 README；具体修复必须在后续 apply 阶段完成。
- 所有修复必须有测试先行任务，尤其是 CLI 参数透传、help 输出、README 内容断言和 M1 验收命令。
- typecheck、lint、build、test、pack dry-run 必须作为完成前硬验证。
- 目标项目写文件必须支持 dry-run、transaction、rollback 和 protected content。
- 发布包不得包含 cache、secret、本地 context 或巨大调试文件。

### 5.3 前置依赖
- [ ] 当前缺口检查结论：已由人工审查确认，项目未达到全部 requirements/M1。
- [ ] 当前 README：已确认仍展示 npm 安装和命令行使用口径。
- [ ] 当前测试基线：`npm test` 通过 275 项。
- [ ] 当前失败基线：`npm run typecheck` 和 `npm run lint` 失败。
- [ ] 当前 CLI 抽查：带参数命令未传入 handler，`--help` 无输出。

---

## 6. 风险评估

| 风险项 | 概率 | 影响 | 应对策略 |
|-------|------|------|---------|
| 继续把开发者安装方式写成用户安装方式 | 高 | 高 | README 拆分“目标项目用户路径”和“本仓库贡献者路径”，首要入口只保留 AI 工具 CLI + npx |
| CLI 参数修复影响现有单元测试假设 | 中 | 中 | 先补集成测试覆盖 dist/bin 或 main(argv)，再调整上下文传参 |
| lint/typecheck 修复暴露更多类型问题 | 中 | 中 | 先固定 ESLint 配置与 TS 类型边界，再逐项修复 |
| M1 与完整完成定义混淆 | 中 | 高 | 文档和 status/doctor 必须区分 M1 已完成、受限可用、后续阶段待实现 |
| review/knowledge/safety 继续以模拟实现通过测试 | 中 | 高 | tasks 阶段增加契约测试和端到端验收命令，避免仅测函数内部 happy path |
| npx 入口在目标项目中依赖包发布内容不完整 | 中 | 高 | `npm pack --dry-run` 与本地 tarball npx/exec 验收必须纳入完成定义 |

---

## 7. 相关文档

- 需求文档：`requirements/个人开发工具-harness-实施方案.md`
- 当前 README：`README.md`
- 当前 CLI 入口：`src/bin/harness.ts`
- 当前 CLI 主流程：`src/cli/main.ts`
- 当前全局参数解析：`src/cli/global-options.ts`
- 当前包配置：`package.json`
- 参考变更归档：`openspec/changes/archive/2026-05-29-harness-impl-gap-fix/`

---

> **质量红线检查清单**
> - [x] 逻辑链路已闭环
> - [x] 受影响模块已明确
> - [x] 依赖关系已梳理
> - [x] 若跳过本文档，影响范围已在 specs 中补齐
> - [x] 能力分解章节已明确列出所有能力
