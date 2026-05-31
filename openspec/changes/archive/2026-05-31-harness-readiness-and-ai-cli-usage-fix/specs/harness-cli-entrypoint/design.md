# 局部技术实现方案 - harness-cli-entrypoint（增量）

> **⚠️ 边界声明**：本设计仅服务于 `harness-cli-entrypoint` 增量修改，不重复设计已存在逻辑。

---

## 1. 字段完整性追溯表

### 1.1 字段映射表

| 序号 | 用户输入字段 | 设计输出字段 | 字段类型 | 状态 | 理由说明 |
|-----|-------------|-------------|---------|------|---------|
| 1 | dist 入口 help 输出 | main() help 检测分支 | code | ✅ 保留 | 新增逻辑 |
| 2 | --help --json 行为 | JSON commands 数组 | data | ✅ 保留 | 补充原 spec 缺失 |
| 3 | AI CLI 类型检测 | aiToolContext | string | ✅ 保留 | 环境变量检测 |

### 1.2 完整性自检

- **用户输入字段总数**：3 个
- **设计输出字段总数**：3 个
- **差异说明**：无差异，全为增量补充
- **完整性确认**：[x] 已确认所有字段都有对应处理

---

## 2. 现有代码锚点

### 2.1 需修改的现有文件

| 文件路径 | 类/模块名 | 需修改的方法/函数 | 修改类型 | 说明 |
|---------|----------|----------------|---------|------|
| `src/cli/main.ts` | - | `main()` | 扩展逻辑 | 增加 help 检测 + AI CLI 感知 |
| `src/cli/global-options.ts` | - | `parseGlobalOptions()` | 扩展逻辑 | --help 标志正确传递 |
| `src/cli/interactive.ts` | - | `runInitWizard()` | 扩展逻辑 | 向导/菜单增加 AI CLI 提示 |

### 2.2 现有逻辑约束

| 约束项 | 当前现状 | 对本设计的影响 | 应对策略 |
|-------|---------|-------------|--------|
| commander suppress output | `configureOutput({ writeOut: () => {} })` | help 文字被抑制 | 在 main() 第 1 步检测 --help |
| 交互式入口无 AI 工具感知 | 向导/菜单不区分 Claude/Codex | 无法展示 AI CLI 上下文 | 通过环境变量检测 |

---

## 3. 局部前端设计

N/A — CLI 工具。

---

## 4. 局部后端接口设计

### 4.1 help 输出分支设计

```typescript
// src/cli/main.ts — 在 parseGlobalOptions 之后立即插入

// 检测 --help / -h
const isHelp = argv.includes('--help') || argv.includes('-h');

if (isHelp) {
  if (globalOptions.json) {
    // JSON 模式：输出命令列表
    const commands = registry.list().map(h => ({
      name: h.name,
      description: h.description,
      requiresInitializedWorkspace: h.requiresInitializedWorkspace,
    }));
    writeCliResponse({
      code: 0, msg: 'success',
      data: { commands },
      warnings: [],
    }, { json: true, noColor: globalOptions.noColor, io });
    return 0;
  }

  // 文本模式：手动构建 help 文本
  const commands = registry.list();
  let helpText = `Usage: harness <command> [options]\n\n`;
  helpText += `Commands:\n`;
  for (const c of commands) {
    helpText += `  ${c.name.padEnd(15)} ${c.description}`;
    helpText += c.requiresInitializedWorkspace ? ' (requires init)\n' : '\n';
  }
  helpText += `\nGlobal Options:\n`;
  helpText += `  --cwd <path>     Project root directory\n`;
  helpText += `  --dry-run        Preview mode - no actual file writes\n`;
  helpText += `  --json           Output as pure JSON\n`;
  helpText += `  --no-color       Disable ANSI color codes\n`;
  io.stdout.write(helpText);
  return 0;
}
```

### 4.2 AI CLI 环境变量检测

```typescript
// src/cli/interactive.ts — 向导/菜单入口

function detectAiTool(env: NodeJS.ProcessEnv): string {
  if (env.CLAUDE_CODE_SESSION_ID) return 'claude';
  if (env.CODEX_SESSION_ID || env.OPENAI_API_KEY) return 'codex';
  return 'unknown';
}

// 向导首屏
function renderWizardHeader(aiTool: string): void {
  if (aiTool !== 'unknown') {
    console.log(`由 ${aiTool === 'claude' ? 'Claude Code' : 'Codex'} 触发`);
  }
  console.log('欢迎使用 @hunterzheng/harness 初始化向导');
}
```

---

## 5. 局部数据模型

N/A — 无数据存储变更。

---

## 6. 模块内部逻辑

### 6.1 核心流程 — help 和 AI CLI 感知

```
main(argv, env, io)
  ├─ parseGlobalOptions(argv)
  │   └─ 注入 --help 标记（若命令行含 --help/-h）
  │
  ├─ createCommandRegistry() + registerAllHandlers()
  │
  ├─ [新增] 检测 isHelp
  │   ├─ true + json → 输出 JSON 命令列表 → return 0
  │   └─ true + text → 输出文本 help → return 0
  │
  └─ [原有] 路由到 handler 或交互模式
      └─ [新增] 交互模式入口检测 AI 工具环境变量
```

### 6.2 修改点汇总

| 序号 | 文件 | 修改 | 代码量估算 |
|-----|------|------|-----------|
| 1 | `src/cli/main.ts` | help 检测 + AI CLI 感知 | ~30 行 |
| 2 | `src/cli/interactive.ts` | 向导/菜单 AI CLI 提示 | ~15 行 |

---

## 7. 外部依赖与集成

无新增依赖。

---

## 8. 异常处理

| 异常类型 | 触发条件 | 处理策略 |
|---------|---------|---------|
| help 渲染异常 | registry 为空 | 输出最小 help "No commands registered" |
| AI CLI 检测失败 | 环境变量不可用 | 不展示 AI 工具名，正常进入交互模式 |

---

## 9. 局部配置

无新增配置。

---

> **质量红线检查清单**
> - [x] **现有代码锚点已标注**：3 个文件 + 2 个修改点
> - [x] **现有约束已识别**：commander suppress output
> - [x] **字段完整性**：3 输入 → 3 输出
> - [x] **边界遵守**：仅为增量修改
> - [x] 包含足够的局部细节支持任务拆解：核心流程 + 2 个修改点