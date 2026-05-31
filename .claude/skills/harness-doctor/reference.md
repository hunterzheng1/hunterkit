# Harness Doctor — 8 大类诊断详细说明

> 本文档是 `SKILL.md` 的辅助参考文件，仅在需要了解具体诊断逻辑时读取。
> 详见 SKILL.md → **Supporting Files** 章节的渐进披露规则。

---

## 1. base.nodeVersion（Node.js 版本检查）

**检查内容**：Node.js 运行时版本 >= 20.0.0

**检查逻辑**：
```bash
node -v | cut -d'v' -f2 | cut -d'.' -f1
```

**状态判定**：
- 主版本 >= 20 → `OK`
- 主版本 >= 18 且 < 20 → `WARN`（兼容但建议升级）
- 主版本 < 18 → `ERROR`（不兼容）

**修复命令**：升级到 Node.js >= 20.0.0（推荐使用 nvm/fnm/volta）

---

## 2. base.harnessDir（工作空间目录检查）

**检查内容**：`.harness/` 目录存在且结构完整

**检查项**：
- `.harness/` 目录存在
- `.harness/config/` 子目录存在
- `.harness/config/harness.config.json` 文件存在

**状态判定**：
- 全部存在 → `OK`
- `.harness/` 存在但 config 缺失 → `WARN`
- `.harness/` 不存在 → `ERROR`

**修复命令**：运行 `harness`（不带参数）进入交互式向导

---

## 3. projection.runtimeSkills（运行时 Skill 投影）

**检查内容**：已选 AI 工具的 Skill 运行时投影是否完整

**检查逻辑**：
- 读取 `harness.config.json` 中的 `aiTools` 配置
- 对每个已选工具，检查 `.harness/adapters/<tool>/skills/` 目录
- 验证每个 SKILL.md 的完整性

**状态判定**：
- 所有已选工具的 Skill 投影完整 → `OK`
- 部分工具投影缺失 → `WARN`
- 全部工具投影缺失 → `ERROR`

**修复命令**：`harness config --repair-adapters`

---

## 4. projection.runtimeHooks（运行时 Hook 投影）

**检查内容**：Hook 源文件存在但运行时投影缺失

**检查逻辑**：
- 检查 `harness.config.json` 中 `safety.hooks` 配置
- 对于已选完整质量门的工具，验证 `.harness/adapters/<tool>/hooks/` 目录
- 验证 Hook 脚本的 shebang 和 `@managed-by` 标记

**状态判定**：
- Hook 投影完整 → `OK`
- 源文件存在但投影缺失 → `WARN`
- 源文件缺失 → `ERROR`

**修复命令**：`harness config --repair-adapters`

---

## 5. skillSource（Skill 源结构检查）

**检查内容**：`.harness/adapters/**` 下的 shared Skill 源结构完整

**检查逻辑**：
- 检查 `.harness/adapters/shared/` 目录
- 验证每个 Skill 模板的 frontmatter 和 body 结构
- 验证 `allowed-tools` 和 `description` 字段

**状态判定**：
- 所有源结构完整 → `OK`
- 部分字段缺失 → `WARN`
- 目录不存在或完全损坏 → `ERROR`

**修复命令**：`harness config --repair-adapters`

---

## 6. managedDocs（根文档 Managed Block）

**检查内容**：根文档（README/AGENTS/CLAUDE）包含 Harness managed block

**检查逻辑**：
- 检查 `README.md` 是否包含 `<!-- harness:start -->` ... `<!-- harness:end -->`
- 检查 `AGENTS.md` 是否包含 managed block
- 检查 `CLAUDE.md` 是否包含 managed block

**状态判定**：
- 所有目标文档包含 managed block → `OK`
- 部分文档缺失 → `WARN`（该文档可能不需要）
- 全部文档缺失 → `WARN`（首次安装时正常）

**修复命令**：`harness sync`

---

## 7. safetyBaseline（安全基线检查）

**检查内容**：`harness.config.json` 中的安全配置是否达到基线

**检查项**：
- `safety.secretPatterns` 包含至少 3 个模式
- `safety.dangerousCommands` 包含至少 5 个模式
- `safety.hookStrength` 设置为 `strict` 或 `standard`

**状态判定**：
- 安全配置达到基线 → `OK`
- 部分配置不足 → `WARN`
- 完全缺失安全配置 → `ERROR`

**修复命令**：检查并更新 `.harness/config/harness.config.json` 中的 `safety` 配置

---

## 8. localConfigPrivacy（本地配置隐私检查）

**检查内容**：`.harness/config/*.local.json` 不会被提交到 Git

**检查逻辑**：
- 检查 `.gitignore` 是否包含 `.harness/config/*.local.json`
- 检查 `git status` 中是否有未跟踪的 `.local.json` 文件
- 检查是否已有 `.local.json` 被意外提交

**状态判定**：
- `.gitignore` 正确配置且无泄露 → `OK`
- `.gitignore` 缺失该规则 → `WARN`
- 检测到 `.local.json` 已被提交 → `ERROR`

**修复命令**：在 `.gitignore` 中添加 `.harness/config/*.local.json`

---

## 诊断输出格式

每个诊断项输出为：

```json
{
  "id": "projection.runtimeHooks",
  "status": "WARN",
  "severity": "warn",
  "message": "Claude Code hook 运行时投影缺失",
  "paths": [".harness/adapters/claude/hooks/"],
  "repairCommand": "harness config --repair-adapters"
}
```

**退出码**：
- 存在 `ERROR` → 退出码 1
- 仅 `WARN` 或 `OK` → 退出码 0