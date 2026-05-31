# 实施任务拆解 - harness-safety-orchestration

> **定位**：单一 Capability 的 AI 编码引擎执行单元
> 
> **⚠️ 边界声明**：本任务清单仅服务于当前 Capability，严禁跨模块任务。
> 
> **【质量红线】颗粒度必须达到"AI能在5分钟内实现"；且拆解的任务和验证逻辑必须 100% 覆盖 spec 和 design

---

## 1. 任务总览

### 1.1 关联文档

| 文档 | 路径 | 说明 |
|-----|------|------|
| 全局契约 | `openspec/specs/overview.md` | 全局约束基线 |
| 业务意图 | `proposal.md` | 变更背景 |
| 技术契约 | `specs/harness-safety-orchestration/spec.md` | 当前能力规格 |
| 技术方案 | `specs/harness-safety-orchestration/design.md` | 当前能力设计 |

### 1.2 实现范围

- 完整质量门 Hook 运行时投影：Claude settings.json + hooks、Codex hooks.json + hooks
- Safety 默认规则：secretPatterns 基线、危险命令策略
- Hook 脚本合规：shebang、managed marker、跨平台
- Hook source/runtime 一致性：hash 校验
- Hook 信任与激活提示

### 1.3 技术栈

- 语言：TypeScript 5.5+、Bash（Hook 脚本）
- 测试：vitest ^2.0.0

---

## 2. 任务执行拓扑图

### 2.0 测试策略

**当前测试策略**：`测试驱动`

### 2.1 拓扑图

```
┌──────────────────────────────────────────────────────────────────┐
│  层级 1 (无依赖，可并行)                                            │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────────────┐   │
│  │ TASK-SAF-01   │  │ TASK-SAF-02   │  │ TASK-SAF-03          │   │
│  │ Hook 投影测试  │  │ Safety 默认    │  │ Hook 脚本合规测试     │   │
│  │ (骨架)        │  │ 测试 (骨架)    │  │ (骨架)               │   │
│  └───────┬───────┘  └───────┬───────┘  └──────────┬───────────┘   │
│          │                  │                      │               │
│          v                  v                      v               │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  层级 2 (依赖层级 1)                                            │ │
│  │  ┌───────────────┐  ┌───────────────┐  ┌──────────────────┐  │ │
│  │  │ TASK-SAF-04   │  │ TASK-SAF-05   │  │ TASK-SAF-06      │  │ │
│  │  │ Hook 投影实现  │  │ Safety 默认    │  │ Hook 脚本模板     │  │ │
│  │  │ 依赖: 01      │  │ 实现           │  │ 实现              │  │ │
│  │  └───────┬───────┘  │ 依赖: 02      │  │ 依赖: 03          │  │ │
│  │          │          └───────┬───────┘  └────────┬─────────┘  │ │
│  │          │                  │                    │             │ │
│  │          v                  v                    v             │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │  层级 3 (依赖层级 2)                                       │ │ │
│  │  │  ┌──────────────────────────────────────────────────────┐ │ │ │
│  │  │  │ TASK-SAF-07                                           │ │ │ │
│  │  │  │ Hook source/runtime 一致性校验实现                      │ │ │ │
│  │  │  │ 依赖: 04,06                                           │ │ │ │
│  │  │  └──────────────────────────┬───────────────────────────┘ │ │ │
│  │  │                              │                              │ │ │
│  │  │                              v                              │ │ │
│  │  │  ┌──────────────────────────────────────────────────────┐ │ │ │
│  │  │  │  层级 4 (依赖层级 3)                                   │ │ │ │
│  │  │  │  ┌──────────────────────────────────────────────────┐ │ │ │ │
│  │  │  │  │ TASK-SAF-08                                       │ │ │ │ │
│  │  │  │  │ Hook 信任/激活提示实现                              │ │ │ │ │
│  │  │  │  │ 依赖: 07                                         │ │ │ │ │
│  │  │  │  └──────────────────────┬───────────────────────────┘ │ │ │ │
│  │  │  │                          │                              │ │ │ │
│  │  │  │                          v                              │ │ │ │
│  │  │  │  ┌──────────────────────────────────────────────────┐ │ │ │ │
│  │  │  │  │  层级 5 (依赖层级 4)                               │ │ │ │ │
│  │  │  │  │  ┌──────────────────────────────────────────────┐ │ │ │ │ │
│  │  │  │  │  │ TASK-SAF-09                                   │ │ │ │ │ │
│  │  │  │  │  │ 全量测试验证                                   │ │ │ │ │ │
│  │  │  │  │  │ 依赖: 08                                     │ │ │ │ │ │
│  │  │  │  │  └──────────────────────────────────────────────┘ │ │ │ │ │
│  │  │  │  └──────────────────────────────────────────────────┘ │ │ │ │
│  │  │  └──────────────────────────────────────────────────────┘ │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 层级汇总

| 层级 | 任务列表 | 可并行 | 前置依赖 |
|-----|---------|-------|--------|
| 层级 1 | TASK-SAF-01, TASK-SAF-02, TASK-SAF-03 | ✅ 是 | 无 |
| 层级 2 | TASK-SAF-04, TASK-SAF-05, TASK-SAF-06 | ✅ 是 | 层级 1 |
| 层级 3 | TASK-SAF-07 | - | 层级 2 |
| 层级 4 | TASK-SAF-08 | - | 层级 3 |
| 层级 5 | TASK-SAF-09 | - | 层级 4 |

---

## 3. 原子任务清单

### [TASK-SAF-01] Hook 运行时投影测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
编写完整质量门 Hook 运行时投影测试骨架，验证 Claude 和 Codex 的 Hook 文件和配置生成。

#### 实现步骤
1. 在 `test/capabilities/safety-template-markers.test.ts` 新增测试骨架
2. 编写 `full quality gate generates Claude settings.json with hooks` 测试
3. 编写 `full quality gate generates Codex hooks.json with hooks` 测试
4. 编写 `source-only hooks without runtime trigger doctor warning` 测试
5. 编写 `unselected tool hooks not written to runtime` 测试
6. 测试预期失败

#### 验收标准
- [x] 4 个测试骨架已创建
- [x] 测试已验证通过（实现已完成）

#### 关联设计
- spec.md 章节：Full quality gate runtime hook projection
- design.md 章节：2.1 safety hooks 相关修改

---

### [TASK-SAF-02] Safety 默认规则测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
编写 safety 默认 secret patterns 和危险命令策略测试骨架。

#### 实现步骤
1. 在 `test/capabilities/safety-template-markers.test.ts` 新增测试
2. 编写 `default secretPatterns cover baseline entries` 测试
3. 编写 `dangerous command policy covers recursive delete` 测试
4. 编写 `dangerous command policy covers force reset and credential output` 测试
5. 测试预期失败

#### 验收标准
- [x] 3 个测试骨架已创建
- [x] 测试已验证通过（实现已完成）

#### 关联设计
- spec.md 章节：Safety defaults match implementation plan
- design.md 章节：2.2 safety baseline 相关

---

### [TASK-SAF-03] Hook 脚本合规测试骨架

- **类型**: 测试-骨架
- **依赖**: 无
- **状态**: [x] 已完成

#### 任务描述
编写 Hook 脚本合规性测试骨架，验证 shebang、managed marker、跨平台降级。

#### 实现步骤
1. 在 `test/capabilities/safety-template-markers.test.ts` 新增测试
2. 编写 `hook script has shebang and managed marker` 测试
3. 编写 `hook scripts match between source and runtime via hash` 测试
4. 编写 `hook trust reminder in install summary and doctor` 测试
5. 测试预期失败

#### 验收标准
- [x] 3 个测试骨架已创建
- [x] 测试已验证通过（实现已完成）

#### 关联设计
- spec.md 章节：Hook scripts are executable and cross-platform aware
- design.md 章节：2.1 hook generation 相关

---

### [TASK-SAF-04] Hook 运行时投影实现

- **类型**: 接口层
- **依赖**: TASK-SAF-01
- **状态**: [x] 已完成

#### 任务描述
扩展 safety capability 的 hook 生成器，实现完整质量门运行时投影。

#### 实现步骤
1. 修改 `src/capabilities/safety/` 下的 hook 生成逻辑
2. Claude 完整质量门：生成 `.harness/adapters/claude/settings.json`、`.harness/adapters/claude/hooks/*.sh`
3. Claude 运行时：生成 `.claude/settings.json`、`.claude/hooks/*.sh`（从源投影）
4. Codex 完整质量门：生成 `.harness/adapters/codex/hooks.json`、`.harness/adapters/codex/hooks/*.sh`
5. Codex 运行时：生成 `.codex/hooks.json`、`.codex/hooks/*.sh`（从源投影）
6. 未选择工具的 hook 运行时不生成
7. 运行 TASK-SAF-01 测试确认

#### 验收标准
- [x] Claude settings.json 引用 .claude/hooks/ 运行时脚本
- [x] Codex hooks.json 引用 .codex/hooks/ 运行时脚本
- [x] 未选择工具不生成 hook runtime
- [x] TASK-SAF-01 测试通过

#### 关联设计
- spec.md 章节：Full quality gate runtime hook projection
- design.md 章节：2.1 safety hooks 相关

---

### [TASK-SAF-05] Safety 默认规则实现

- **类型**: 接口层
- **依赖**: TASK-SAF-02
- **状态**: [x] 已完成

#### 任务描述
实现完整的 safety 默认规则：secret patterns 基线和危险命令策略。

#### 实现步骤
1. 修改 config 默认值：`safety.secretPatterns` 至少包含 `.env`、`.env.*`、`*.pem`、`*.key`、`*.p12`、`*.jks`、`*token*`、`*secret*`
2. 实现 dangerous command 阻断策略：覆盖递归删除、强制 reset、凭据输出、密钥文件读取、未确认发布/推送
3. Hook 文档中列出策略名称和说明
4. 运行 TASK-SAF-02 测试确认

#### 验收标准
- [x] secretPatterns 覆盖基线 9 项
- [x] 危险命令策略覆盖递归删除、强制 reset、凭据输出等
- [x] TASK-SAF-02 测试通过

#### 关联设计
- spec.md 章节：Safety defaults match implementation plan
- design.md 章节：2.2 safety baseline 相关

---

### [TASK-SAF-06] Hook 脚本模板实现

- **类型**: 接口层
- **依赖**: TASK-SAF-03
- **状态**: [x] 已完成

#### 任务描述
实现合规的 Hook 脚本模板：shebang、managed marker、跨平台降级。

#### 实现步骤
1. 创建 Hook 脚本模板，每个 `.sh` 包含：
   - `#!/usr/bin/env bash` shebang
   - `# @managed-by: harness install` managed marker
   - 用途注释
   - 项目根目录解析逻辑
2. 确保 Windows 非 POSIX shell 降级提示
3. 运行 TASK-SAF-03 测试确认

#### 验收标准
- [x] 每个 .sh 有 shebang、managed marker、用途注释、根目录解析
- [x] 跨平台降级提示清晰
- [x] TASK-SAF-03 测试通过

#### 关联设计
- spec.md 章节：Hook scripts are executable and cross-platform aware
- design.md 章节：2.1 hook script 相关

---

### [TASK-SAF-07] Hook Source/Runtime 一致性校验

- **类型**: 接口层
- **依赖**: TASK-SAF-04, TASK-SAF-06
- **状态**: [x] 已完成

#### 任务描述
实现 Hook source 和 runtime 文件的一致性校验（hash 或 managed marker）。

#### 实现步骤
1. 修改 safety 模块的 hook 校验逻辑
2. 通过 hash 校验 source 和 runtime 一致性
3. 漂移时要求 repair，返回 2703
4. doctor 集成 Hook 一致性诊断
5. 运行测试确认

#### 验收标准
- [x] Hook source 和 runtime 一致性校验生效
- [x] 漂移时返回 2703
- [x] repair 可修复漂移

#### 关联设计
- spec.md 章节：Hook runtime scripts match source scripts
- design.md 章节：2.1 drift/repair 相关

---

### [TASK-SAF-08] Hook 信任/激活提示

- **类型**: 接口层
- **依赖**: TASK-SAF-07
- **状态**: [x] 已完成

#### 任务描述
在安装摘要和 doctor 中明确 Hook 信任/激活提示。

#### 实现步骤
1. 修改安装摘要：Claude hook 展示 `.claude/settings.json` 中注册的 Hook 事件
2. 修改安装摘要：Codex hook 提示需要信任项目本地 hooks
3. 修改 doctor：展示 Hook 激活状态
4. 运行测试确认

#### 验收标准
- [x] Claude hook 激活摘要展示事件名称、脚本路径、启用状态
- [x] Codex hook 信任提示指向 `.codex/hooks.json` 路径
- [x] doctor 展示 Hook 激活状态

#### 关联设计
- spec.md 章节：Hook trust and activation guidance
- design.md 章节：2.1 hook trust 相关

---

### [TASK-SAF-09] 全量测试验证

- **类型**: 测试-验证
- **依赖**: TASK-SAF-08
- **状态**: [x] 已完成

#### 任务描述
运行全量测试，确认 safety 相关测试全部通过。

#### 实现步骤
1. 运行 `npm run test`
2. 运行 `npm run typecheck`
3. 运行 `npm run lint`
4. 修复任何失败

#### 验收标准
- [x] `npm run test` 全部通过
- [x] `npm run typecheck` 无错误
- [x] `npm run lint` 无错误

#### 关联设计
- spec.md 章节：全部（4 个 Requirement，10 个 Scenario）

---

## 4. 验证方式

### 4.1 单元测试要求

| 任务 ID | 测试类型 | 测试场景 | 断言内容 |
|--------|---------|---------|---------|
| TASK-SAF-01 | 单元测试 | Hook 投影 | settings/hooks.json 生成 |
| TASK-SAF-02 | 单元测试 | Safety 默认 | baseline 覆盖 |
| TASK-SAF-03 | 单元测试 | 脚本合规 | shebang/marker |
| TASK-SAF-04 | 单元测试 | Hook 实现 | runtime projection |
| TASK-SAF-05 | 单元测试 | 默认规则 | patterns/policy |
| TASK-SAF-06 | 单元测试 | 模板 | 合规字段 |
| TASK-SAF-07 | 单元测试 | 一致性 | hash 校验 |
| TASK-SAF-08 | 单元测试 | 提示 | 信任/激活 |
| TASK-SAF-09 | 全量测试 | 端到端 | 全部通过 |

---

## 5. 交付物

### 5.1 代码文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `src/capabilities/safety/command.ts` | Hook 生成扩展 | TASK-SAF-04 |
| `src/capabilities/safety/hooks.ts` | Hook 模板/一致性 | TASK-SAF-04,06,07 |
| `src/core/config-schema.ts` | Safety 默认值 | TASK-SAF-05 |

### 5.2 测试文件

| 文件路径 | 说明 | 对应任务 |
|---------|------|---------|
| `test/capabilities/safety-template-markers.test.ts` | 核心测试扩展 | TASK-SAF-01,02,03 |

---

> **质量红线检查清单**
> - [x] 每个任务颗粒度符合"5分钟可实现"标准
> - [x] 任务清单 100% 覆盖 spec.md 定义（4 个 Requirement，10 个 Scenario）
> - [x] 每个任务都有明确的验收标准
> - [x] 每个任务都有对应的单元测试要求
> - [x] **依赖拓扑已明确**
> - [x] **任务执行拓扑图已绘制**
> - [x] 无循环依赖