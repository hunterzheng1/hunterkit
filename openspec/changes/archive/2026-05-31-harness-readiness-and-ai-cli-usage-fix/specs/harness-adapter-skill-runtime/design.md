# 局部技术实现方案 - harness-adapter-skill-runtime（增量）

> **⚠️ 边界声明**：本设计仅服务于 `harness-adapter-skill-runtime` 增量修改，聚焦内部来源名称屏蔽和 AI CLI 触发口径统一。

---

## 1. 字段完整性追溯表

### 1.1 字段映射表

| 序号 | 用户输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | Skill frontmatter 不含内部名 | description/when_to_use 文本 | string | ⚠️ 重命名 | 替换为对外名称 |
| 2 | Skill body AI CLI 口径 | body 示例格式 | string | ✅ 保留 | 重写示例格式 |
| 3 | references 文件审计 | references/*.md 内容 | string | ⚠️ 重命名 | 替换内部来源名 |
| 4 | Copilot/Cursor 名称屏蔽 | copilot-instructions.md | string | ✅ 保留 | 同上规则应用 |

### 1.2 完整性自检

- **用户输入字段总数**：4 个
- **设计输出字段总数**：4 个
- **差异说明**：重命名类操作为文本替换，非结构变更
- **完整性确认**：[x] 已确认所有字段都有对应处理

---

## 2. 现有代码锚点

### 2.1 需修改的现有文件

| 文件路径 | 类/模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|----------|----------------|---------|------|
| `.harness/adapters/shared/skills/harness/references/command-contract.md` | - | 全文 | 文本替换 | 内部来源名 → 对外命令名 |
| `.harness/adapters/shared/skills/harness/references/safety.md` | - | 全文 | 文本替换 | 同上 |
| `.harness/adapters/shared/skills/harness/references/document-contract.md` | - | 全文 | 文本替换 | 同上 |
| `.harness/adapters/shared/skills/harness/references/agent-orchestration.md` | - | 全文 | 文本替换 | 同上 |
| `.harness/adapters/shared/skills/harness/assets/AGENTS.block.md` | - | 全文 | 文本替换 | 同上 |
| `.harness/adapters/shared/skills/harness/assets/CLAUDE.template.md` | - | 全文 | 文本替换 | 同上 |
| `src/adapters/projection-renderer.ts` | - | `renderFrontmatter()` | 扩展逻辑 | 增加名称过滤逻辑 |

### 2.2 需新建的文件

无。

### 2.3 名称屏蔽映射表

| 屏蔽词 | 替换词 | 适用范围 |
|-------|-------|---------|
| `docsync` | `sync`（文档同步） | 所有投影文件 |
| `gsd` | （删除，不可出现） | 所有投影文件 |
| `kld-sdd` | `develop`（规格驱动开发） | 所有投影文件 |
| `kld-review` | `review`（代码审查） | 所有投影文件 |

---

## 3. 局部前端设计

N/A。

---

## 4. 局部后端接口设计

### 4.1 名称过滤函数设计

```typescript
// src/adapters/projection-renderer.ts — 新增工具函数

const INTERNAL_NAME_MAP: Record<string, string> = {
  'docsync': 'sync',
  'gsd': '',          // 完全删除
  'kld-sdd': 'develop',
  'kld-review': 'review',
};

function sanitizeInternalNames(text: string): string {
  let result = text;
  for (const [internal, external] of Object.entries(INTERNAL_NAME_MAP)) {
    if (external === '') {
      // gsd — 完全删除（避免留空白）
      result = result.replace(new RegExp(`\\b${internal}\\b`, 'gi'), '');
    } else {
      result = result.replace(new RegExp(`\\b${internal}\\b`, 'gi'), external);
    }
  }
  // 清理多余空白
  return result.replace(/\s{2,}/g, ' ').trim();
}
```

### 4.2 投影生成流程增强

```
[原有流程]
  template → renderFrontmatter() → writeProjection()

[增强流程]
  template → renderFrontmatter()
           → sanitizeInternalNames()  ← 新增：名称过滤
           → writeProjection()
```

---

## 5. 局部数据模型

N/A — 文本替换，无数据结构变更。

---

## 6. 模块内部逻辑

### 6.1 核心流程

```
[1. 源模板审计]
  → 读取 .harness/adapters/shared/skills/harness/references/*.md
  → 搜索内部来源名（docsync/gsd/kld-sdd/kld-review）
  → 逐文件替换

[2. 投影渲染器增强]
  → projection-renderer.ts 新增 sanitizeInternalNames()
  → 在 renderFrontmatter() 和 renderBody() 中调用过滤

[3. Skill body AI CLI 口径重写]
  → 原示例："在终端输入 harness review --local"
  → 新示例："当用户说「审查代码」时，AI 工具执行 harness review --local"

[4. 全量投影重生成]
  → harness config --repair-adapters
  → 验证生成的 SKILL.md 不含内部来源名
```

### 6.2 修改点汇总

| 序号 | 文件 | 修改 | 代码量估算 |
|-----|------|------|-----------|
| 1 | `src/adapters/projection-renderer.ts` | 新增 sanitizeInternalNames() | ~20 行 |
| 2 | `.harness/adapters/shared/skills/harness/references/*.md` (4 文件) | 文本替换 | ~40 行 |
| 3 | `.harness/adapters/shared/skills/harness/assets/*.md` (2 文件) | 文本替换 | ~20 行 |

---

## 7. 外部依赖与集成

无新增外部依赖。

---

## 8. 异常处理

| 异常类型 | 触发条件 | 处理策略 |
|---------|---------|---------|
| 模板文件不存在 | references/assets 目录为空 | 警告 "模板文件缺失，跳过名称过滤" |
| 过滤规则误伤 | 正常文本含 "sync" | 正则使用 `\b` 词边界，仅匹配完整单词 |

---

## 9. 局部配置

无新增配置。

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：1 个 TypeScript + 6 个 Markdown 文件
> - [x] **现有约束已识别**：名称屏蔽映射表
> - [x] **字段完整性**：4 输入 → 4 输出
> - [x] **边界遵守**：仅文本替换，不涉及逻辑变更
> - [x] 包含足够的局部细节支持任务拆解：4 步流程 + 3 个修改点