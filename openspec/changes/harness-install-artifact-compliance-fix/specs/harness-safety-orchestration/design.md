# 局部技术实现方案 - harness-safety-orchestration

> **定位**：单一 Capability 的业务维度技术实现方案  
> **边界声明**：本设计只覆盖安装产物合规修复中的安全编排与 Hook 运行时投影，不设计 Skill runtime、根文档同步、CLI 摘要或质量门的完整实现细节。  
> **质量红线专注**：确保完整质量门生成的 Hook 能被所选 AI 工具实际识别，并能被 `harness doctor` 诊断。

---

## 1. 字段完整性追溯表

### 1.1 字段映射表

| 序号 | 用户输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | 完整质量门 runtime hook projection | `HookProjectionPlan` 与 `writeHookRuntimeProjections()` | 行为契约 | 保留 | 将 source hook 与 AI 工具实际运行时目录分开建模 |
| 2 | `.harness/adapters/claude/settings.json` | Claude source config path | 文件路径 | 保留 | 继续作为 Harness 管理源文件 |
| 3 | `.harness/adapters/claude/hooks/*.sh` | Claude source hook scripts | 文件路径 | 保留 | 继续作为完整模板与校验基准 |
| 4 | `.claude/settings.json` | Claude runtime config path | 文件路径 | 保留 | Claude Code 实际识别入口 |
| 5 | `.claude/hooks/*.sh` | Claude runtime hook scripts | 文件路径 | 保留 | Claude Code settings 必须引用运行时脚本 |
| 6 | `.harness/adapters/codex/hooks.json` | Codex source config path | 文件路径 | 保留 | 继续作为 Harness 管理源文件 |
| 7 | `.harness/adapters/codex/hooks/*.sh` | Codex source hook scripts | 文件路径 | 保留 | 继续作为完整模板与校验基准 |
| 8 | `.codex/hooks.json` | Codex runtime config path | 文件路径 | 保留 | Codex 实际识别入口 |
| 9 | `.codex/hooks/*.sh` | Codex runtime hook scripts | 文件路径 | 保留 | Codex hooks.json 必须引用运行时脚本 |
| 10 | source-only hooks are diagnosed | `diagnoseHookProjection()` | 诊断项 | 保留 | 防止 `.harness/adapters/**` 存在但运行时不生效 |
| 11 | 默认 secret patterns | `BASELINE_SECRET_PATTERNS` | 配置基线 | 保留 | 统一 `main.ts` 与 `createDefaultConfig()` 默认值 |
| 12 | dangerous command policy | `DANGEROUS_COMMAND_RULES` | 安全策略 | 保留 | 从字符串列表升级为带策略名的规则集合 |
| 13 | POSIX shebang | hook template header | 脚本格式 | 保留 | 每个 `.sh` 必须可被 POSIX shell 解释 |
| 14 | managed marker | `# harness-managed` 与 source hash comment | 脚本元数据 | 保留 | 用于 drift 校验与覆盖保护 |
| 15 | 用途注释 | hook template purpose comment | 脚本元数据 | 保留 | doctor 与人工排查可读 |
| 16 | 项目根目录解析 | `resolve_project_root()` shell 片段 | 脚本逻辑 | 保留 | Windows/Git Bash/macOS/Linux 下减少 cwd 偏差 |
| 17 | 非 POSIX shell 降级提示 | `detectPosixShellAvailability()` | 诊断项 | 保留 | Windows 无 shell 时给 warning，不伪装为 hooks 已可执行 |
| 18 | runtime 与 source hash 一致 | `sourceHash` 与 `compareHookProjection()` | 校验项 | 保留 | drift 时提示 repair |
| 19 | Codex hook trust reminder | `HookActivationGuidance.codex` | 安装和 doctor 提示 | 保留 | 明确 `.codex/hooks.json` 需在 Codex 中检查并信任 |
| 20 | Claude hook activation summary | `HookActivationGuidance.claude` | 安装和 doctor 提示 | 保留 | 列出事件、脚本路径、启用状态 |
| 21 | CLI path `harness init` | interactive init post wizard integration | CLI 行为 | 保留 | 无显式命令时仍作为交互式 init |
| 22 | CLI path `harness doctor` | `runDoctorCommand()` safety diagnostics | CLI 行为 | 保留 | doctor 必须报告 hooks 生效状态 |
| 23 | 输出类型 Hook source files | `HookWriteResult.sourceArtifacts` | 输出结构 | 保留 | 安装摘要继续列出源文件 |
| 24 | 输出类型 runtime projection | `HookWriteResult.runtimeArtifacts` | 输出结构 | 保留 | 安装摘要新增运行时文件 |
| 25 | 输出类型 doctor diagnostics | `SafetyDoctorCheck[]` | 输出结构 | 保留 | doctor JSON 可被测试断言 |
| 26 | Node.js `>=20.0.0` | doctor nodeVersion check 保持 | 版本依赖 | 保留 | 复用现有检查 |
| 27 | Git `>=2.30.0` | `detectGitVersion()` warning/error | 版本依赖 | 保留 | 安全检查中涉及 Git 命令语义 |
| 28 | Error 2701 | `HOOK_RUNTIME_PROJECTION_MISSING` | 错误码 | 保留 | 已选完整质量门但 runtime 缺失 |
| 29 | Error 2702 | `SAFETY_DEFAULTS_INCOMPLETE` | 错误码 | 保留 | secret 或危险命令基线不足 |
| 30 | Error 2703 | `HOOK_PROJECTION_DRIFT` | 错误码 | 保留 | source 与 runtime hash 不一致 |

### 1.2 完整性自检

- **用户输入字段总数**：30 个
- **设计输出字段总数**：30 个
- **差异说明**：无字段移除；部分原始字符串字段被合并为结构化模型，但所有路径、规则、错误码与提示均保留。
- **完整性确认**：[x] 已确认所有字段都有对应处理

---

## 2. 现有代码锚点

### 2.1 需修改的现有文件

| 文件路径 | 类/模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|----------|----------------|---------|------|
| `src/capabilities/safety/command.ts` | safety command module | `BLOCKED_COMMANDS`、`DEFAULT_SECRET_PATTERNS` | 替换实现 | 抽出统一安全默认值，并补齐 secret 与危险命令基线 |
| `src/capabilities/safety/command.ts` | safety command module | `generateDangerousCommandHook()` 等 hook template 函数 | 扩展逻辑 | 增加 managed marker、用途注释、project root 解析、策略名称和 source hash |
| `src/capabilities/safety/command.ts` | safety command module | `generateHooks()` | 扩展逻辑 | 保持现有 source 写入能力，同时返回写入清单，供 runtime 投影复用 |
| `src/capabilities/safety/command.ts` | safety command module | `generateHookConfigs()` | 扩展逻辑 | 支持 source config 与 runtime config 两种 command path 渲染 |
| `src/capabilities/safety/types.ts` | safety types | `SafetyPolicy`、`SafetyViolation` | 新增类型 | 增加 hook projection、doctor check、危险命令规则、hook guidance 类型 |
| `src/cli/main.ts` | CLI main | `buildConfigFromAnswers()` | 替换实现 | 使用统一 `BASELINE_SECRET_PATTERNS`，避免 init 与默认配置不一致 |
| `src/cli/main.ts` | CLI main | `executePostWizardIntegration()` | 扩展逻辑 | 在选择完整质量门时生成所选工具的 runtime hooks/config，并把 artifacts 与 warnings 写入响应 |
| `src/commands/doctor.ts` | doctor command | `runDoctorCommand()` | 扩展逻辑 | 加入 Hook runtime、secret baseline、dangerous policy、shell、trust/activation 诊断 |
| `src/core/config-schema.ts` | config schema | `createDefaultConfig()`、`validateHarnessConfig()` | 扩展逻辑 | 统一安全基线，并校验 `secretPatterns` 至少覆盖 baseline |
| `src/core/types.ts` | core config types | `HarnessConfig.safety` | 新增字段 | 可选记录 hookStrength、hookProjection 与 selected runtime tool 状态 |
| `test/capabilities/safety.test.ts` | safety tests | hook generation tests | 扩展测试 | 从 source-only 测试扩展到 runtime 投影、路径引用、hash drift |
| `test/safety-template-markers.test.ts` | marker tests | marker assertions | 扩展测试 | 验证 shebang、managed marker、用途注释与 project root 解析 |
| `test/commands/commands.test.ts` | doctor tests | doctor test cases | 扩展测试 | 增加 source-only hooks、runtime 缺失、baseline 不完整、trust reminder 断言 |

### 2.2 需新建的文件

| 文件路径（建议） | 模块名 | 职责 | 继承/实现 | 说明 |
|------------|----------|------|---------|------|
| `src/capabilities/safety/safety-defaults.ts` | safety defaults | 统一导出 secret baseline 与危险命令规则 | 被 config、hook、doctor 复用 | 避免 `main.ts`、`config-schema.ts`、hook template 三处漂移 |
| `src/capabilities/safety/hook-templates.ts` | hook templates | 生成带 marker/hash/root 解析的 hook 脚本 | 被 `command.ts` 调用 | 将模板从 command 文件拆出，便于测试 |
| `src/capabilities/safety/hook-projection.ts` | hook projection | 规划并写入 source/runtime hooks 与 configs | 被 init 和 doctor 复用 | 负责 `.harness/adapters/**` 到 `.claude/**`、`.codex/**` 的薄投影 |
| `src/capabilities/safety/doctor.ts` | safety doctor | 输出结构化 safety diagnostics | 被 `commands/doctor.ts` 调用 | 保持 doctor command 薄，安全检查集中维护 |
| `test/capabilities/safety-runtime-projection.test.ts` | runtime projection tests | TDD 覆盖 full quality gate 产物 | vitest | 以临时项目断言 `.claude/**`、`.codex/**` 真正生成并引用 runtime path |

### 2.3 现有逻辑约束

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| 现有 hook 只写 source | `generateHooks()` 只写 `.harness/adapters/claude|codex/hooks/*.sh` | 安装报告看似成功但 AI 工具不会触发 | 新增 runtime projection，保留 source 作为模板基线 |
| 现有 config 指向 source path | `generateHookConfigs()` 中 command 指向 `.harness/adapters/**` | 不符合 runtime path 要求 | config 渲染接收 `pathMode: "source" | "runtime"` |
| init 无所选工具过滤 | hook 生成目前同时生成 Claude/Codex source | 用户只选某工具时 runtime 不应污染另一工具目录 | source 可全量或按工具生成，runtime 必须按 selectedTools 过滤 |
| doctor 始终 code 0 | 当前只返回 warnings | 无法对 2701/2702/2703 形成质量门 | doctor 聚合 ERROR 时返回对应非零 code，WARN 仍保持 code 0 |
| Windows 目标项目常见 | Hook 是 `.sh`，但 PowerShell 环境可能无 POSIX shell | 需要明确降级提示 | doctor 检测 `bash` 或 `sh`，缺失时 warning 并说明 hooks 可能不触发 |
| 事务写入已存在 | adapter projection 使用 `beginTransaction()` 和 `stageWrite()` | hook runtime 写入也应避免半写 | runtime projection 使用同一事务接口或内部原子写入策略 |

---

## 3. 局部前端设计

本 Capability 不包含 Web 前端、页面组件、路由或浏览器交互。安装摘要与 doctor 输出属于 CLI 文本/JSON 输出，设计放在第 4 节。

### 3.1 页面/组件结构

| 组件名 | 类型 | 职责 | 依赖组件 |
|-------|------|------|---------|
| 不适用 | CLI capability | 无浏览器 UI | 无 |

### 3.2 状态管理

| 状态名 | 数据类型 | 初始值 | 更新时机 |
|-------|---------|-------|---------|
| 不适用 | N/A | N/A | N/A |

### 3.3 路由设计

| 路由路径 | 页面组件 | 权限要求 | 说明 |
|---------|---------|---------|------|
| 不适用 | N/A | N/A | N/A |

### 3.4 前后端交互

| 前端操作 | 调用接口 | 请求参数 | 响应处理 |
|---------|---------|---------|---------|
| 不适用 | N/A | N/A | N/A |

---

## 4. 局部后端接口设计

### 4.1 接口清单

| 接口名称 | 路径 | 方法 | 说明 |
|---------|------|------|------|
| Hook source 生成 | `generateHooks(cwd, options?)` | 函数调用 | 生成 `.harness/adapters/<tool>/hooks/*.sh` |
| Hook config 生成 | `generateHookConfigs(cwd, options?)` | 函数调用 | 生成 source 或 runtime hooks 配置 |
| Hook runtime 投影 | `writeHookRuntimeProjections(cwd, request)` | 函数调用 | 生成 `.claude/**`、`.codex/**` runtime hooks/config |
| Safety doctor | `diagnoseSafety(cwd, config)` | 函数调用 | 返回 hooks、安全默认值、shell、trust 诊断 |
| CLI init 集成 | `executePostWizardIntegration()` | CLI 内部调用 | 在交互式安装结束后写入 runtime artifacts |
| CLI doctor 集成 | `harness doctor` | 命令 | 输出 safety diagnostics，必要时返回 2701/2702/2703 |

### 4.2 接口详细设计

#### 接口 1：Hook source 生成

**基本信息**：
- 路径：`src/capabilities/safety/command.ts`
- 方法：`generateHooks(cwd: string, options?: GenerateHookOptions): HookWriteResult`
- 认证：不需要

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `cwd` | string | 是 | 目标项目根目录 | 必须是绝对或可解析路径 |
| `options.tools` | `HookTool[]` | 否 | 生成的工具集合 | 默认 `["claude", "codex"]` |
| `options.pathMode` | `"source"` | 否 | source 生成模式 | source hooks 只写 `.harness/adapters/**` |

**响应结构**：

```ts
interface HookWriteResult {
  sourceArtifacts: string[];
  runtimeArtifacts: string[];
  warnings: string[];
  projections: HookProjectionPlan[];
}
```

**业务逻辑**：
1. 从 `HOOK_DEFINITIONS` 生成五个 hook：`dangerous-command`、`sync-after-doc-change`、`review-before-push`、`session-summary`、`compact-state`。
2. 每个脚本以 `#!/usr/bin/env bash` 开头，包含 `# harness-managed`、`# purpose:`、`# source-hash:` 与项目根目录解析片段。
3. 只写入 `.harness/adapters/<tool>/hooks/*.sh`，不在该函数内写 runtime path。

#### 接口 2：Hook runtime 投影

**基本信息**：
- 路径：`src/capabilities/safety/hook-projection.ts`
- 方法：`writeHookRuntimeProjections(cwd: string, request: HookProjectionRequest): HookWriteResult`
- 认证：不需要

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `cwd` | string | 是 | 目标项目根目录 | 与 init 的 `globalOptions.cwd` 一致 |
| `request.tools` | `HookTool[]` | 是 | 用户选择的 AI 工具 | 只允许 `claude`、`codex` 写 runtime hooks |
| `request.hookStrength` | `HookStrength` | 是 | Hook 强度 | `full` 时必须写 runtime；`none` 不写 |
| `request.dryRun` | boolean | 否 | 是否预览 | true 时只返回 planned artifacts |
| `request.config` | `HarnessConfig` | 是 | 初始化后的配置 | 用于校验 safety baseline |

**响应结构**：

```ts
interface HookProjectionPlan {
  tool: HookTool;
  hookStrength: HookStrength;
  sourceConfigPath: string;
  runtimeConfigPath: string;
  sourceHooksDir: string;
  runtimeHooksDir: string;
  hooks: HookScriptProjection[];
  status: "planned" | "written" | "skipped" | "error";
  message?: string;
}
```

**业务逻辑**：
1. `hookStrength === "none"` 时返回 skipped，不写 runtime。
2. 对 `claude`：
   - 写 source：`.harness/adapters/claude/settings.json` 与 `.harness/adapters/claude/hooks/*.sh`。
   - 写 runtime：`.claude/settings.json` 与 `.claude/hooks/*.sh`。
   - `.claude/settings.json` 中所有 command 必须包含 `.claude/hooks/`。
3. 对 `codex`：
   - 写 source：`.harness/adapters/codex/hooks.json` 与 `.harness/adapters/codex/hooks/*.sh`。
   - 写 runtime：`.codex/hooks.json` 与 `.codex/hooks/*.sh`。
   - `.codex/hooks.json` 中所有 command 必须包含 `.codex/hooks/`。
4. runtime 脚本内容与 source 内容必须携带相同 `source-hash`，doctor 用该 hash 判断 drift。
5. 未选择的工具不得写入对应 runtime 目录，避免目标项目污染。

#### 接口 3：Safety doctor

**基本信息**：
- 路径：`src/capabilities/safety/doctor.ts`
- 方法：`diagnoseSafety(cwd: string, config: HarnessConfig): SafetyDoctorResult`
- 认证：不需要

**响应结构**：

```ts
interface SafetyDoctorResult {
  checks: SafetyDoctorCheck[];
  warnings: string[];
  errors: SafetyDoctorCheck[];
}

interface SafetyDoctorCheck {
  id: string;
  status: "OK" | "WARN" | "ERROR";
  code?: 2701 | 2702 | 2703;
  message: string;
  paths: string[];
  repairCommand?: string;
}
```

**业务逻辑**：
1. 读取 `.harness/config/harness.config.json`，根据 `aiTools` 与 `safety.hookStrength` 推导需要检查的 runtime paths。
2. source hooks 存在但 runtime config 或 runtime hooks 缺失时，返回 `ERROR 2701`。
3. `safety.secretPatterns` 未覆盖 baseline 或危险命令规则少于 baseline 时，返回 `ERROR 2702`。
4. source/runtime 同名 hook 的 `source-hash` 不一致时，返回 `ERROR 2703`。
5. Windows/macOS/Linux 上检测 `bash` 或 `sh` 是否可用；不可用时返回 WARN，并说明 `.sh` hooks 可能不会触发。
6. Codex 被选中时输出 `.codex/hooks.json` trust reminder；Claude 被选中时输出已注册事件、脚本路径和 enabled 状态。

---

## 5. 局部数据模型

### 5.1 数据结构设计

#### 模型：HookTool

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 | 索引 |
|-------|---------|------|--------|------|------|
| value | `"claude" \| "codex"` | 是 | 无 | 支持 runtime hooks 的 AI 工具 | N/A |

#### 模型：HookScriptProjection

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 | 索引 |
|-------|---------|------|--------|------|------|
| name | string | 是 | 无 | hook 名称，如 `dangerous-command` | N/A |
| event | string | 是 | 无 | AI 工具 hook 事件名 | N/A |
| sourcePath | string | 是 | 无 | `.harness/adapters/<tool>/hooks/<name>.sh` | N/A |
| runtimePath | string | 是 | 无 | `.<tool>/hooks/<name>.sh` | N/A |
| contentHash | string | 是 | 无 | 脚本内容 hash | N/A |
| policyNames | string[] | 否 | `[]` | 该 hook 涉及的安全策略名 | N/A |

#### 模型：DangerousCommandRule

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 | 索引 |
|-------|---------|------|--------|------|------|
| name | string | 是 | 无 | 策略名称，如 `recursive-delete` | N/A |
| patterns | string[] | 是 | 无 | 命令匹配片段或正则源 | N/A |
| severity | `"block" \| "warn"` | 是 | `block` | 阻断或提示 | N/A |
| description | string | 是 | 无 | 写入 hook 文档的说明 | N/A |

#### 模型：SafetyDoctorCheck

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 | 索引 |
|-------|---------|------|--------|------|------|
| id | string | 是 | 无 | 检查项 ID | N/A |
| status | `"OK" \| "WARN" \| "ERROR"` | 是 | 无 | 检查结果 | N/A |
| code | number | 否 | 无 | 2701/2702/2703 | N/A |
| message | string | 是 | 无 | 用户可读说明 | N/A |
| paths | string[] | 否 | `[]` | 相关文件路径 | N/A |
| repairCommand | string | 否 | 无 | 建议修复命令，如 `npx @hunterzheng/harness doctor --repair` | N/A |

### 5.2 缓存设计

| 缓存 Key 模式 | 数据类型 | 过期时间 | 更新策略 | 说明 |
|--------------|---------|---------|---------|------|
| 不使用缓存 | N/A | N/A | 每次 init/doctor 实时读取文件 | Hook 与安全配置必须反映当前磁盘状态 |

### 5.3 数据流转图

```text
[WizardAnswers]
  --> [buildConfigFromAnswers]
  --> [ensureWorkspace writes harness.config.json]
  --> [generate source hooks/configs]
  --> [write runtime projections for selected tools]
  --> [install summary artifacts + activation guidance]

[harness doctor]
  --> [loadHarnessConfig]
  --> [diagnoseSafety]
  --> [checks: projection + baseline + shell + trust]
  --> [CliResponse code/warnings/data]
```

---

## 6. 模块内部逻辑

### 6.1 核心流程

#### 安装流程

```text
[用户选择 AI tools + hookStrength]
  --> [buildConfigFromAnswers 使用统一 safety baseline]
  --> [ensureWorkspace 创建 .harness/config]
  --> [generateHooks 写 .harness/adapters/<tool>/hooks]
  --> [generateHookConfigs 写 .harness/adapters/<tool> config]
  --> [writeHookRuntimeProjections 写所选工具 runtime]
  --> [生成 activation guidance]
  --> [artifacts 列出 source + runtime 文件]
```

关键规则：
- `hookStrength === "full"` 且选中 Claude 时，缺少 `.claude/settings.json` 或 `.claude/hooks/*.sh` 属于安装失败或 doctor error。
- `hookStrength === "full"` 且选中 Codex 时，缺少 `.codex/hooks.json` 或 `.codex/hooks/*.sh` 属于安装失败或 doctor error。
- source config 可以引用 source hooks；runtime config 必须引用 runtime hooks。
- runtime 投影只写所选工具；source 目录可保留完整模板，但安装摘要必须区分 source 与 runtime。

#### doctor 流程

```text
[runDoctorCommand]
  --> [基础 workspace/config/node checks]
  --> [load config]
  --> [diagnoseSafety]
      --> [check runtime projection]
      --> [check source/runtime hash]
      --> [check safety defaults]
      --> [check POSIX shell availability]
      --> [build trust/activation guidance]
  --> [merge checks]
  --> [ERROR 则返回 2701/2702/2703，否则 code 0]
```

### 6.2 状态机

```text
[not-selected] --tool selected + hook full--> [source-generated]
[source-generated] --runtime written--> [runtime-active-pending-trust]
[runtime-active-pending-trust] --doctor ok--> [diagnosed-ok]
[source-generated] --runtime missing--> [projection-missing:2701]
[runtime-active-pending-trust] --hash mismatch--> [projection-drift:2703]
[diagnosed-ok] --config baseline removed--> [defaults-incomplete:2702]
```

状态说明：
- `runtime-active-pending-trust` 对 Codex 仍需要提示用户在 Codex 中检查并信任本地 hooks。
- Claude 的 enabled 状态来自 `.claude/settings.json` 是否存在对应 event 与 command。

### 6.3 关键算法

#### source hash 生成

```text
canonicalContent = normalizeLineEndings(scriptContentWithoutSourceHash)
contentHash = sha256(canonicalContent).slice(0, 16)
scriptContent = header(sourceHash=contentHash) + canonicalContent
```

要点：
- hash 计算前统一换行为 `\n`。
- runtime 与 source 使用同一 canonical 内容，只允许路径配置文件不同。
- doctor 先读取 `# source-hash:`，缺失时退化为 managed marker 比对并返回 WARN。

#### 安全默认值覆盖判断

```text
missingSecretPatterns = BASELINE_SECRET_PATTERNS - config.safety.secretPatterns
missingDangerousRules = BASELINE_DANGEROUS_RULE_NAMES - generatedHookPolicyNames
if missingSecretPatterns or missingDangerousRules:
  return ERROR 2702
```

基线：
- `BASELINE_SECRET_PATTERNS = [".env", ".env.*", ".env*", "*.pem", "*.key", "*.p12", "*.jks", "*token*", "*secret*"]`
- 危险命令策略必须覆盖：递归删除、强制 reset/clean、凭据输出、密钥文件读取、未确认发布或推送。

---

## 7. 外部依赖与集成

### 7.1 外部服务依赖

| 依赖服务 | 用途 | 调用方式 | 超时设置 | 失败影响 | 降级方案 |
|---------|------|---------|---------|---------|--------|
| 无 | 本 Capability 完全本地执行 | N/A | N/A | N/A | N/A |

### 7.2 第三方 API / SDK

| 名称 | 版本/文档链接 | 用途 | 鉴权方式 | 费用/限流 | 备注 |
|------|-------------|------|---------|----------|------|
| Node.js `node:fs`、`node:path`、`node:crypto` | Node.js `>=20.0.0` | 文件写入、路径解析、hash 计算 | 无 | 无 | 已是项目运行时基础 |
| Git CLI | `>=2.30.0` | doctor 版本与部分危险命令语义参考 | 无 | 无 | 缺失时 warning，涉及 Git hook 语义的检查降级 |
| POSIX shell (`bash` 或 `sh`) | 环境提供 | 执行 `.sh` hooks | 无 | 无 | 缺失时 warning，提示 hooks 可能不可执行 |

### 7.3 中间件 & 基础设施

| 组件 | 用途 | 使用方式 | 关键配置 | 备注 |
|------|------|---------|---------|------|
| 本地文件系统 | 写入 source/runtime hooks | `writeFileSync` 或 transaction `stageWrite` | 目标项目 cwd | 需要保护非 managed 文件 |
| Harness transaction | 降低半写风险 | `beginTransaction`、`stageWrite`、`commitTransaction` | `dryRun` | runtime projection 应尽量复用 |

### 7.4 内部跨模块依赖

| 依赖模块 | 调用接口/方法 | 输入 | 预期输出 | 当前状态 |
|---------|-------------|------|---------|--------|
| CLI main | `executePostWizardIntegration()` | cwd、wizard answers | 安装 artifacts 与 warnings | 已有，需扩展 |
| Workspace config | `ensureWorkspace()`、`loadHarnessConfig()` | config path | `.harness/config/harness.config.json` | 已有 |
| Config schema | `createDefaultConfig()`、`validateHarnessConfig()` | project/config | 默认配置与校验结果 | 已有，需扩展 baseline 校验 |
| Doctor command | `runDoctorCommand()` | command context | CliResponse | 已有，需集成 safety doctor |
| Adapter projection writer | `stageWrite()` 事务能力 | projection path/content | 原子写入计划 | 已有，可复用写入模式 |

### 7.5 环境 & 权限要求

| 依赖项 | 说明 | 获取方式 |
|-------|------|--------|
| 文件写权限 | 需要写 `.harness/**`、`.claude/**`、`.codex/**` | 用户在目标项目执行 `npx @hunterzheng/harness` |
| POSIX shell | 运行 `.sh` hook | Git Bash、WSL、macOS/Linux shell 或系统 PATH |
| Codex hook trust | Codex 可能要求用户信任项目 hooks | 安装摘要与 doctor 提示 `.codex/hooks.json` |
| Claude hook activation | Claude 通过 `.claude/settings.json` 注册 hooks | doctor 输出事件、脚本路径、启用状态 |

---

## 8. 异常处理

### 8.1 异常分类

| 异常类型 | 触发条件 | 处理策略 | 用户感知 |
|---------|---------|---------|---------|
| Hook runtime projection missing | 完整质量门已启用，source hooks 存在但 runtime config/hooks 缺失 | doctor 返回 `2701`；init 写入失败时 warning 并列出缺失路径 | 明确提示 hooks 不会被 AI 工具实际触发 |
| Safety defaults incomplete | `secretPatterns` 或危险命令策略少于 baseline | doctor 返回 `2702`；config 默认生成时直接使用完整 baseline | 提示缺失的 pattern 或 rule name |
| Hook projection drift | source 与 runtime hook hash 不一致 | doctor 返回 `2703`；建议 repair 重新投影 | 提示 source/runtime 不一致及相关路径 |
| Runtime file conflict | `.claude/settings.json`、`.codex/hooks.json` 或 hook script 已存在且无 managed marker | 不覆盖，返回 WARN 或 ERROR，给出人工处理路径 | 用户知道哪些文件被保留 |
| POSIX shell unavailable | Windows 等环境无法找到 `bash` 或 `sh` | doctor 返回 WARN，不阻断 init | 提示 hooks 可能无法执行 |
| Codex trust pending | Codex 被选中但无法自动确认 trust 状态 | doctor 返回 WARN 或 guidance | 提示检查并信任 `.codex/hooks.json` |
| Git version unavailable | `git --version` 不可用或低于 2.30 | doctor 返回 WARN | 与 Git 相关策略可能降级 |

### 8.2 重试与降级

- **重试次数**：文件写入不自动循环重试；失败即返回路径与错误信息，避免隐藏权限问题。
- **重试间隔**：不适用。
- **降级策略**：
  - `hookStrength === "none"`：不生成 runtime hooks，不产生 2701。
  - POSIX shell 不可用：保留文件生成，doctor warning。
  - Codex trust 状态不可自动判断：输出 guidance，不阻断安装。
  - runtime 文件存在且非 managed：不覆盖，doctor 提示 repair 前需人工确认。

---

## 9. 局部配置

### 9.1 业务配置

| 配置项 | 配置 Key | 默认值 | 说明 |
|-------|---------|-------|------|
| 危险命令阻断 | `safety.dangerousCommandsBlocked` | `hookStrength !== "none"` | 与用户 Hook 强度选择一致 |
| secret patterns | `safety.secretPatterns` | `[".env", ".env.*", ".env*", "*.pem", "*.key", "*.p12", "*.jks", "*token*", "*secret*"]` | 必须至少覆盖 baseline |
| Hook 强度 | `safety.hookStrength`（建议新增） | wizard answer | doctor 推导是否要求 runtime projection |
| Hook 投影工具 | `safety.hookProjection.tools`（建议新增） | selected AI tools 中支持 hooks 的工具 | 只对 `claude`、`codex` 生效 |
| Hook projection version | `safety.hookProjection.version`（建议新增） | `1` | 后续模板升级可用于 doctor 提示 |

### 9.2 开关配置

| 开关 | 用途 | 默认状态 |
|-----|------|---------|
| `hookStrength=none` | 禁用 hook runtime 生成和 2701 检查 | 用户选择决定 |
| `hookStrength=full` | 启用完整质量门 runtime projection | 用户选择决定 |
| `aiTools.claude` | 是否写 `.claude/**` runtime hooks | 用户选择决定 |
| `aiTools.codex` | 是否写 `.codex/**` runtime hooks | 用户选择决定 |
| `doctor --json` | 输出结构化 safety diagnostics | 已支持 JSON 输出，需扩展 data 字段 |

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：需修改的文件、模块、方法已明确。
> - [x] **现有约束已识别**：source-only hooks、runtime path、doctor code、Windows shell 等约束已列出。
> - [x] **字段完整性**：字段追溯表已覆盖 spec 的路径、规则、提示、错误码与接口契约。
> - [x] **边界遵守**：本设计只覆盖 safety orchestration，不设计其他 capability 的内部实现。
> - [x] **全局遵守**：CLI 输出仍遵循 `code/msg/data/warnings/artifacts` 结构，错误码使用 spec 定义的 2701/2702/2703。
> - [x] 前端设计已完成：确认本 Capability 无前端 UI。
> - [x] 后端接口已完成：定义 source 生成、runtime 投影、doctor 诊断接口。
> - [x] 数据模型已完成：定义 HookProjectionPlan、HookScriptProjection、DangerousCommandRule、SafetyDoctorCheck。
> - [x] **外部依赖已明确**：Node.js、Git、POSIX shell 与本地文件系统依赖已列出。
> - [x] **环境权限已确认**：目标项目文件写权限、Codex trust、Claude activation 已说明。
> - [x] 异常处理策略已定义：包含 2701/2702/2703、shell 降级、文件冲突与 trust pending。
> - [x] 包含足够的局部细节支持任务拆解。
