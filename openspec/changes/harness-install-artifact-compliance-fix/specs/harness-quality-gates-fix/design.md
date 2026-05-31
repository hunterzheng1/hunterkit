# 局部技术实现方案 - harness-quality-gates-fix

> **定位**：单一 Capability 的业务维度技术实现方案
>
> **边界声明**：本设计仅服务于 `harness-quality-gates-fix`，聚焦 TDD 验收、安装 fixture、doctor 负例和 npm pack dogfood。它不实现 Skill、Hook、sync、doctor 的业务修复逻辑，只定义这些修复必须被怎样测试和阻断。
>
> **质量红线**：质量门必须能复现用户实测缺口，防止 `.harness` 骨架存在但 runtime projection、Hook、根文档和 doctor 仍不可用的情况再次通过。

---

## 1. 字段完整性追溯表

### 1.1 字段映射表

| 序号 | 用户输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | Claude full install fixture | `InstallComplianceCase.tool = "claude"` | enum | ✅ 保留 | 覆盖 Claude Code + 完整质量门安装 |
| 2 | Codex full install fixture | `InstallComplianceCase.tool = "codex"` | enum | ✅ 保留 | 覆盖 Codex + 完整质量门安装 |
| 3 | unselected tool fixture | `InstallComplianceCase.unselectedTools[]` | enum[] | ✅ 保留 | 验证未选择工具不写 runtime，且摘要/config 明确记录 |
| 4 | `.harness/adapters/shared/skills/harness/SKILL.md` | `ArtifactAssertion.path` | path string | ✅ 保留 | shared Skill 标准源文件必测 |
| 5 | `.claude/skills/harness/SKILL.md` | `ArtifactAssertion.path` | path string | ✅ 保留 | Claude runtime Skill 必测 |
| 6 | `.claude/settings.json` | `ArtifactAssertion.path` | path string | ✅ 保留 | Claude runtime Hook 配置必测 |
| 7 | `.claude/hooks/` | `ArtifactAssertion.path` | path string | ✅ 保留 | Claude runtime Hook 脚本目录必测 |
| 8 | `.agents/skills/harness/SKILL.md` | `ArtifactAssertion.path` | path string | ✅ 保留 | Codex runtime Skill 必测 |
| 9 | `.agents/skills/harness/agents/openai.yaml` | `ArtifactAssertion.path` | path string | ✅ 保留 | Codex Skill metadata 必测 |
| 10 | `.codex/hooks.json` | `ArtifactAssertion.path` | path string | ✅ 保留 | Codex runtime Hook 配置必测 |
| 11 | `.codex/hooks/` | `ArtifactAssertion.path` | path string | ✅ 保留 | Codex runtime Hook 脚本目录必测 |
| 12 | `.codex/agents/` | `ArtifactAssertion.path` | path string | ✅ 保留 | Codex custom agents 必测 |
| 13 | stale DocSync docs | `DoctorNegativeFixture.kind = "stale-docsync-docs"` | enum | ⚠️ 重命名 | 转成可复用 doctor 负例 fixture |
| 14 | missing runtime hook | `DoctorNegativeFixture.kind = "missing-runtime-hooks"` | enum | ⚠️ 重命名 | 转成可复用 doctor 负例 fixture |
| 15 | incomplete Skill structure | `DoctorNegativeFixture.kind = "incomplete-skill-source"` | enum | ⚠️ 重命名 | 转成可复用 doctor 负例 fixture |
| 16 | npm pack contains adapter templates | `PackAssertion.requiredEntries[]` | string[] | ✅ 保留 | 验证发布包包含安装所需资源 |
| 17 | published package dogfood | `PackDogfoodCase` | object | ✅ 保留 | 使用 pack tarball 验证安装入口和资源可用 |

### 1.2 完整性自检

- **用户输入字段总数**：17 个
- **设计输出字段总数**：17 个
- **差异说明**：doctor 负例从自然语言场景重命名为 fixture enum，便于任务拆解和复用；路径字段全部保留。
- **完整性确认**：[x] 已确认所有字段都有对应处理

---

## 2. 现有代码锚点

### 2.1 需修改的现有文件

| 文件路径 | 类/模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|----------|----------------|---------|------|
| `test/quality-gates.test.ts` | quality gates tests | `工程门禁` 测试组 | 扩展逻辑 | 从 dist/pack 存在性升级为安装产物合规入口，保留 pack 基础断言 |
| `test/adapters/adapter-skill-runtime.test.ts` | adapter tests | source/projection 断言 | 扩展测试 | 增加 shared `SKILL.md`、runtime thin projection、Codex unselected 不写入断言 |
| `test/capabilities/safety.test.ts` | safety tests | hook/agent 断言 | 扩展测试 | 增加 runtime Hook projection 断言的辅助输入，避免只测 `.harness/adapters/**` |
| `test/cli/entrypoint.test.ts` | CLI entrypoint tests | `main()` tests | 扩展测试 | 用 mock wizard answers 驱动临时项目初始化，捕获 `CliResponse.artifacts` 和 summary |
| `test/readme-validation.test.ts` | README validation | internal source name tests | 扩展测试 | 继续验证用户文档不暴露旧来源名；新增 AGENTS/CLAUDE fixture 层断言 |
| `src/cli/main.ts` | cli/main | `executePostWizardIntegration()` | 测试性抽取 | 为 fixture 测试提供稳定 install flow seam，避免直接驱动真实交互输入 |
| `src/commands/doctor.ts` | commands/doctor | `runDoctorCommand()` | 测试覆盖 | doctor 负例必须通过该命令输出非 0 与结构化错误 |
| `package.json` | package config | `files`、`scripts.test` | 扩展配置 | 确保 npm pack 包含 dist/README 和安装所需模板或编译资源 |

### 2.2 需新建的文件

| 文件路径（建议） | 类/模块名 | 职责 | 继承/实现 | 说明 |
|------------|----------|------|---------|------|
| `test/helpers/temp-project.ts` | temp-project helper | 创建/清理临时目标项目 | 测试工具 | 统一 mkdtemp、基础 package/README/AGENTS 生成 |
| `test/helpers/install-harness-fixture.ts` | install fixture helper | 以固定 wizard answers 运行安装流 | 测试工具 | 支持 Claude full、Codex full、unselected tool 三类 case |
| `test/helpers/artifact-assertions.ts` | artifact assertions | 路径存在/不存在/内容合规断言 | 测试工具 | 统一 runtime/source/skipped 断言 |
| `test/helpers/doctor-fixtures.ts` | doctor fixtures | 构造 missing hooks、stale docs、incomplete skill source | 测试工具 | 供 doctor negative tests 复用 |
| `test/quality/install-artifact-compliance.test.ts` | install compliance tests | 完整安装产物合规 TDD | vitest | 覆盖 spec 的 3 个安装场景 |
| `test/quality/doctor-negative.test.ts` | doctor negative tests | doctor 负例 TDD | vitest | 覆盖 spec 的 3 个 doctor 负例 |
| `test/quality/package-dogfood.test.ts` | package dogfood tests | npm pack 内容与 tarball smoke | vitest | 覆盖 pack 内容和打包产物入口 |

### 2.3 现有逻辑约束

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| 测试可直接执行 shell | `quality-gates.test.ts` 已用 `execSync('npm pack --dry-run')` | dogfood 可延续 child_process，但要控制超时和输出解析 | 使用 `npm pack --json --dry-run` 或隔离 temp destination，并设置测试超时 |
| 交互向导依赖 inquirer | `runInitWizard()` 需要真实交互或 mock | 安装合规测试不能依赖人工输入 | 抽取 install flow seam 或使用现有 inquirer mock 模式驱动 `main()` |
| post-wizard 集成是私有函数 | `executePostWizardIntegration()` 当前不可直接复用 | fixture 需要稳定触发安装产物生成 | 设计要求抽取到可测试内部模块，例如 `src/cli/install-flow.ts` |
| doctor 当前总是 code 0 | `runDoctorCommand()` 对 projection 缺口不报错 | 负例测试初始应失败，驱动 doctor 修复 | 测试断言非 0 和结构化 check id |
| pack files 仅含 `dist/`、`README.md` | 模板若只存在源码可能丢包 | 需要验证 dist 内包含模板或模板已编译进代码 | pack assertion 检查 tarball 清单和 dogfood smoke |
| 测试不能污染仓库 | fixture 使用临时目录 | 所有安装/pack dogfood 目标必须在 temp 下 | helper 统一 cleanup，失败时保留路径可诊断 |

---

## 3. 局部前端设计

### 3.1 页面/组件结构

| 组件名 | 类型 | 职责 | 依赖组件 |
|-------|------|------|---------|
| N/A | N/A | 本 Capability 为测试/质量门，无浏览器前端 | N/A |

### 3.2 状态管理

| 状态名 | 数据类型 | 初始值 | 更新时机 |
|-------|---------|-------|---------|
| N/A | N/A | N/A | N/A |

### 3.3 路由设计

| 路由路径 | 页面组件 | 权限要求 | 说明 |
|---------|---------|---------|------|
| N/A | N/A | N/A | N/A |

### 3.4 前后端交互

| 前端操作 | 调用接口 | 请求参数 | 响应处理 |
|---------|---------|---------|---------|
| N/A | N/A | N/A | N/A |

---

## 4. 局部后端接口设计

### 4.1 接口清单

| 接口名称 | 路径 | 方法 | 说明 |
|---------|------|------|------|
| 安装 fixture | `test helper: installHarnessFixture(case)` | 测试内部函数 | 在临时目标项目执行等价初始化并返回文件系统断言上下文 |
| artifact 断言 | `test helper: assertInstallArtifacts(ctx, assertions)` | 测试内部函数 | 统一校验路径存在、不存在、内容合规 |
| doctor 负例 | `test helper: runDoctorJson(cwd)` | 测试内部函数 | 执行 doctor 并解析 JSON/响应 |
| pack 清单 | `test helper: collectPackEntries()` | 测试内部函数 | 获取 npm pack dry-run/tarball 清单 |
| package dogfood | `test helper: runPackedHarnessSmoke()` | 测试内部函数 | 使用 pack tarball 验证发布包入口和资源可用 |

### 4.2 接口详细设计

#### 接口 1：安装 fixture

**基本信息**：
- 路径：`test helper: installHarnessFixture(case)`
- 方法：测试内部函数
- 认证：不需要

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `caseName` | string | 是 | fixture 名称 | `claude-full`、`codex-full`、`claude-only` |
| `aiTools` | string[] | 是 | 选择的 AI 工具 | 至少 1 个；枚举 `claude`、`codex` |
| `capabilities` | string[] | 是 | 工作流能力 | 默认 5 个能力全选 |
| `hookStrength` | string | 是 | Hook 强度 | 本 spec 使用 `full` |
| `writeStrategy` | string | 是 | 写入策略 | 本 spec 使用 `write` |

**响应结构**：
```ts
interface InstallFixtureResult {
  cwd: string;
  response: CliResponse;
  config: Record<string, unknown>;
  cleanup: () => void;
}
```

**业务逻辑**：
1. 在 `tmpdir()` 下创建目标项目，写入最小 `package.json` 和 README。
2. 通过 mock wizard answers 或抽取的 install flow seam 执行初始化。
3. 返回 `CliResponse`、目标项目路径、解析后的 `.harness/config/harness.config.json`。
4. 所有断言只访问临时项目，不写当前仓库。

#### 接口 2：artifact 断言

**基本信息**：
- 路径：`test helper: assertInstallArtifacts(ctx, assertions)`
- 方法：测试内部函数
- 认证：不需要

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `ctx.cwd` | path string | 是 | 临时目标项目 | 必须存在 |
| `assertions.exists[]` | string[] | 否 | 必须存在的路径 | 相对 cwd |
| `assertions.notExists[]` | string[] | 否 | 必须不存在的路径 | 相对 cwd |
| `assertions.contains[]` | object[] | 否 | 内容断言 | `{ path, text|regex }` |
| `assertions.summary[]` | object[] | 否 | 安装摘要断言 | 验证 selected/skipped/runtime 分类 |

**响应结构**：无；失败时由 vitest assertion 抛错。

**业务逻辑**：
1. 对每个 exists 路径使用 `existsSync(join(cwd, path))`。
2. 对目录路径验证为目录；对文件路径验证内容。
3. 对 skipped runtime 断言路径不存在，并在 summary/config 中存在 `tool not selected` 或 `codex=false`。
4. 对 runtime/source 分类断言 `.harness/adapters/**` 不可被当成 runtime。

#### 接口 3：doctor 负例

**基本信息**：
- 路径：`test helper: runDoctorJson(cwd)`
- 方法：测试内部函数
- 认证：不需要

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `fixtureKind` | string | 是 | 负例类型 | `missing-runtime-hooks`、`stale-docsync-docs`、`incomplete-skill-source` |
| `cwd` | path string | 是 | 临时项目路径 | 必须已初始化 |

**响应结构**：
```ts
interface DoctorJsonResult {
  exitCode: number;
  body: {
    code: number;
    data: {
      checks: unknown;
    };
    warnings: string[];
  };
}
```

**业务逻辑**：
1. 先用安装 fixture 创建一个正常项目。
2. 按 fixtureKind 删除或写入缺口：
   - 删除 `.claude/hooks/` 与 `.claude/settings.json`。
   - 写入 `AGENTS.md` 的 `<!-- docsync:start -->` 和 `/docsync:sync`。
   - 删除 `.harness/adapters/shared/skills/harness/SKILL.md`。
3. 调用 `main(['doctor', '--json', '--cwd', cwd], env, io)` 或 `runDoctorCommand()`。
4. 断言返回非 0，且 JSON 中包含指定 check id：`projection.runtimeHooks`、`managedDocs`、`skillSource`。

#### 接口 4：pack 与 dogfood

**基本信息**：
- 路径：`test helper: collectPackEntries()` / `runPackedHarnessSmoke()`
- 方法：测试内部函数 + child_process
- 认证：不需要

**请求参数**：
| 参数名 | 类型 | 必填 | 说明 | 约束 |
|-------|------|------|------|------|
| `packDestination` | path string | 是 | npm pack 输出目录 | 临时目录 |
| `timeoutMs` | number | 否 | 子进程超时 | 默认 60000 |

**响应结构**：
```ts
interface PackDogfoodResult {
  tarballPath: string;
  entries: string[];
  helpExitCode: number;
  helpStdout: string;
}
```

**业务逻辑**：
1. 使用 `npm pack --json --pack-destination <tmp>` 获取本地 tarball。
2. 解析 pack JSON 或 dry-run 输出，断言包含：
   - `package/dist/bin/harness.js`
   - `package/dist/cli/main.js`
   - `package/dist/adapters/`
   - `package/README.md`
3. 在临时 runner 中执行 `npm install <tarball> --prefix <runner>`。
4. 执行 `node <runner>/node_modules/@hunterzheng/harness/dist/bin/harness.js --help`，断言退出码 0 且包含 8 个命令。
5. 若后续 install flow seam 已导出，再从安装包 `dist/cli/install-flow.js` 执行非交互初始化 dogfood；否则该用例先以 help + resource availability 作为 pack smoke，下游任务必须补充完整初始化 dogfood。

---

## 5. 局部数据模型

### 5.1 数据表设计

本 Capability 不使用数据库表。

| 字段名 | 数据类型 | 必填 | 默认值 | 说明 | 索引 |
|-------|---------|------|--------|------|------|
| N/A | N/A | N/A | N/A | N/A | N/A |

**索引设计**：
- 主键索引：N/A
- 唯一索引：N/A
- 普通索引：N/A

### 5.2 缓存设计

| 缓存 Key 模式 | 数据类型 | 过期时间 | 更新策略 | 说明 |
|--------------|---------|---------|---------|------|
| N/A | N/A | N/A | N/A | 本能力不使用缓存 |

### 5.3 数据流转图

```text
[Quality spec scenarios]
  --> [Vitest fixture helpers]
  --> [Temp target project]
  --> [Harness install flow / doctor / npm pack]
  --> [Artifact assertions]
  --> [Failing gate when install artifacts are incomplete]
```

### 5.4 核心结构

```ts
type InstallComplianceCaseName = 'claude-full' | 'codex-full' | 'claude-only';
type DoctorNegativeFixtureKind = 'missing-runtime-hooks' | 'stale-docsync-docs' | 'incomplete-skill-source';

interface InstallComplianceCase {
  caseName: InstallComplianceCaseName;
  aiTools: Array<'claude' | 'codex'>;
  capabilities: Array<'inspect' | 'sync' | 'develop' | 'review' | 'knowledge'>;
  hookStrength: 'full';
  writeStrategy: 'write';
}

interface ArtifactAssertions {
  exists: string[];
  notExists: string[];
  contains?: Array<{ path: string; text?: string; regex?: RegExp }>;
  summary?: Array<{ path: string; type: 'source' | 'runtime' | 'skipped'; reason?: string }>;
}

interface PackAssertion {
  requiredEntries: string[];
  forbiddenEntries: string[];
}
```

---

## 6. 模块内部逻辑

### 6.1 核心流程

```text
[test/quality/install-artifact-compliance.test.ts]
  --> [installHarnessFixture(case)]
  --> [assertInstallArtifacts()]
  --> [assert config + summary]

[test/quality/doctor-negative.test.ts]
  --> [installHarnessFixture(base)]
  --> [mutate fixture into known bad state]
  --> [runDoctorJson()]
  --> [assert non-zero + check id]

[test/quality/package-dogfood.test.ts]
  --> [npm pack tarball]
  --> [assert pack entries]
  --> [install tarball into temp runner]
  --> [run dist/bin/harness.js --help]
```

### 6.2 状态机

```text
[fixture clean] --install fixture--> [fixture healthy]
[fixture healthy] --artifact assertion pass--> [compliance pass]
[fixture healthy] --delete runtime hooks--> [doctor negative: runtime hooks]
[fixture healthy] --write docsync block--> [doctor negative: managed docs]
[fixture healthy] --delete shared SKILL.md--> [doctor negative: skill source]
[repo built] --npm pack--> [tarball]
[tarball] --install runner--> [pack dogfood]
```

### 6.3 关键算法

#### 6.3.1 安装 fixture 构建

1. `createTempProject()` 在 `tmpdir()` 下创建隔离目录。
2. 写入最小项目文件：
   - `package.json`：`{"name":"fixture","version":"1.0.0"}`
   - `README.md`：`# Fixture`
3. 通过 `installHarnessFixture()` 执行初始化：
   - 优先使用抽取后的 `runInstallFlow(cwd, answers, options)`。
   - 若尚未抽取，则通过 `vi.doMock('@inquirer/prompts')` 驱动 `main([])`，但任务中必须优先抽取 seam，降低交互脆弱性。
4. 返回 response 和 cwd 给断言函数。

#### 6.3.2 安装产物断言

1. Claude full 必须断言：
   - `.harness/adapters/shared/skills/harness/SKILL.md`
   - `.claude/skills/harness/SKILL.md`
   - `.claude/settings.json`
   - `.claude/hooks/`
   - `AGENTS.md` 中 Harness managed block
2. Codex full 必须断言：
   - `.agents/skills/harness/SKILL.md`
   - `.agents/skills/harness/agents/openai.yaml`
   - `.codex/hooks.json`
   - `.codex/hooks/`
   - `.codex/agents/`
3. Claude-only 必须断言：
   - Codex runtime projection 不存在。
   - `.harness/config/harness.config.json` 中 `aiTools.codex === false`。
   - response summary 中 skipped runtime reason 为 `tool not selected`。

#### 6.3.3 Doctor 负例断言

1. 每个负例从健康 fixture 变异，避免重复搭建脆弱目录。
2. doctor 输出必须满足：
   - exit code 非 0。
   - JSON 可解析。
   - 包含所有 warnings/errors，不只返回第一个。
   - 包含稳定 check id，便于测试断言。
3. 若 doctor 仍返回 code 0，测试必须失败，直接暴露“误报健康”问题。

#### 6.3.4 Pack dogfood

1. pack 测试不得依赖已发布 npm registry 包，只使用本地 `npm pack` 产物。
2. pack 内容断言采用白名单 + 禁止列表：
   - 必须包含 `dist/`、`README.md`、adapter/template 编译产物。
   - 不得包含 `src/`、`test/`、`node_modules/`、`.env*`、cache、本地上下文。
3. dogfood smoke 至少运行 packed `dist/bin/harness.js --help`。
4. 完整初始化 dogfood 通过 install flow seam 执行，避免交互式 stdin 对 CI 不稳定。

---

## 7. 外部依赖与集成

### 7.1 外部服务依赖

| 依赖服务 | 用途 | 调用方式 | 超时设置 | 失败影响 | 降级方案 |
|---------|------|---------|---------|---------|--------|
| N/A | 本能力不调用远程服务 | N/A | N/A | N/A | N/A |

### 7.2 第三方 API / SDK

| 名称 | 版本/文档链接 | 用途 | 鉴权方式 | 费用/限流 | 备注 |
|------|-------------|------|---------|----------|------|
| Node.js | `>=20.0.0` | 临时目录、child_process、路径断言 | 无 | 无 | 必需 |
| npm | `>=10.0.0` | `npm pack` 与本地 tarball dogfood | 无 | 无 | 必需 |
| vitest | `^2.0.0` | TDD 测试框架 | 无 | 无 | 现有测试依赖 |

### 7.3 中间件 & 基础设施

| 组件 | 用途 | 使用方式 | 关键配置 | 备注 |
|------|------|---------|---------|------|
| 本地文件系统 | 临时项目和产物断言 | `fs`、`path`、`os.tmpdir()` | cleanup 必须执行 | 不写用户项目 |
| child_process | npm pack / packed help smoke | `execFileSync` 或 `spawnSync` | timeout 60000ms | 禁止无界阻塞 |

### 7.4 内部跨模块依赖

| 依赖模块 | 调用接口/方法 | 输入 | 预期输出 | 当前状态 |
|---------|-------------|------|---------|--------|
| cli/main | `main()` 或抽取的 install flow seam | wizard answers、cwd | 初始化产物与 response | 已有 main，需抽取 seam |
| commands/doctor | `runDoctorCommand()` 或 `main(['doctor'])` | cwd | doctor JSON | 已有，需增强诊断 |
| adapters | source/projection helpers | cwd、tools | Skill runtime artifacts | 已有，需被 fixture 覆盖 |
| safety | hook/agent generation | cwd、tool | hook/agent artifacts | 已有，需被 fixture 覆盖 |
| sync | managed docs generation | cwd | AGENTS/CLAUDE managed block | 待由对应能力修复，本能力只断言结果 |

### 7.5 环境 & 权限要求

| 依赖项 | 说明 | 获取方式 |
|-------|------|--------|
| 环境变量 | 可设置测试用 `CI=1`，不得依赖真实 AI CLI 环境 | 测试进程 env |
| 密钥/证书 | 不需要 | N/A |
| 网络策略 | 不需要网络；pack dogfood 使用本地 tarball | N/A |
| 权限/角色 | 临时目录写权限、当前仓库读权限 | 当前用户本地权限 |

---

## 8. 异常处理

### 8.1 异常分类

| 异常类型 | 触发条件 | 处理策略 | 用户感知 |
|---------|---------|---------|---------|
| Fixture 创建失败 | 临时目录不可写 | 测试失败并输出 temp root | 开发者看到 fixture setup failure |
| 安装流程失败 | main/install flow 返回非 0 | 测试失败并输出 response JSON | 开发者看到初始化失败原因 |
| Artifact 缺失 | exists 断言失败 | 测试失败并列出缺失路径 | 直接定位缺失投影 |
| Doctor 误报健康 | 负例仍返回 0 | 测试失败 | 暴露 doctor 覆盖不足 |
| Pack 缺资源 | pack 清单缺 required entry | 测试失败 | 阻断发布 |
| 子进程超时 | npm pack 或 packed help 超过 timeout | kill 子进程并失败 | 提示 timeoutMs 和命令 |

### 8.2 重试与降级

- 重试次数：0；测试应确定性失败，不自动重试。
- 重试间隔：N/A。
- 降级策略：
  - pack dogfood 若无法完整非交互初始化，必须至少完成 tarball install + `--help` smoke，并在任务中补齐 install flow seam 后升级为完整初始化 dogfood。
  - cleanup 失败不掩盖原始断言失败；记录临时路径供排查。

---

## 9. 局部配置

### 9.1 业务配置

| 配置项 | 配置 Key | 默认值 | 说明 |
|-------|---------|-------|------|
| 测试超时 | `QUALITY_GATE_TIMEOUT_MS` | `60000` | child_process pack/dogfood 超时 |
| 保留失败 fixture | `HARNESS_KEEP_FAILED_FIXTURE` | `false` | 失败时可保留 temp 项目供调试 |
| Pack 输出目录 | test helper 参数 | 临时目录 | 避免污染仓库根目录 |

### 9.2 开关配置

| 开关 | 用途 | 默认状态 |
|-----|------|---------|
| `--json` | doctor 负例输出 JSON | 开启 |
| `--cwd` | 指向临时目标项目 | 必填 |
| `npm pack --json` | 获取机器可读 pack 清单 | 优先使用 |

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：测试文件、CLI 安装入口、doctor、package 配置已明确
> - [x] **现有约束已识别**：交互向导、私有 install flow、doctor code 0、pack files 限制、临时目录隔离均已列出
> - [x] **字段完整性**：字段追溯表已完成，无无故丢弃字段
> - [x] **边界遵守**：未设计 Skill/Hook/sync/doctor 的业务修复，只设计质量门如何捕获其缺口
> - [x] **全局遵守**：遵循 overview.md 的 CLI JSON 返回体与错误码范围
> - [x] 前端设计已完成（确认 N/A）
> - [x] 后端接口已完成（测试 helper、fixture、doctor、pack dogfood）
> - [x] 数据模型已完成（无数据库，补充测试结构）
> - [x] **外部依赖已明确**：Node.js、npm、vitest、本地文件系统、child_process
> - [x] **环境权限已确认**：只需临时目录写权限，无密钥/网络
> - [x] 异常处理策略已定义（含 fixture、artifact、doctor、pack、timeout）
> - [x] 包含足够的局部细节支持任务拆解
