# Harness Review — 6 个 Reviewer 详细规范

> 本文档是 `SKILL.md` 的辅助参考文件，仅在需要了解具体检测逻辑时读取。
> 详见 SKILL.md → **Supporting Files** 章节的渐进披露规则。

---

## Reviewer 1: rules-reviewer（规则审查）

**职责**：扫描代码中的临时标记和待办事项。

**检测正则**：
```
TODO|FIXME|HACK|XXX|WORKAROUND|TEMP|KLUDGE
```

**置信度计算**：
- 匹配 `TODO` → confidence: 50（低优先级，常见）
- 匹配 `FIXME` → confidence: 70
- 匹配 `HACK` / `WORKAROUND` → confidence: 85
- 匹配 `XXX` / `TEMP` → confidence: 80

**严重度**：P2（建议）

**输出格式**：
```json
{
  "file": "src/core/config.ts",
  "line": 42,
  "category": "todo",
  "confidence": 50,
  "message": "TODO: refactor this validation logic",
  "severity": "P2"
}
```

---

## Reviewer 2: bug-scanner（Bug 扫描）

**职责**：检测非测试代码中的调试输出和潜在 Bug。

**检测正则**：
```
console\.(log|warn|error|debug|info|trace)\s*\(
```

**过滤规则**：
- 跳过 `*.test.ts`、`*.spec.ts`、`*.test.js` 等测试文件
- 跳过 `node_modules/`、`dist/`、`build/` 目录

**置信度计算**：
- `console.log` → confidence: 60
- `console.warn` → confidence: 40
- `console.error`（非 catch 块） → confidence: 70
- `console.debug` / `console.trace` → confidence: 75

**严重度**：P2（建议）

---

## Reviewer 3: deep-bug-analyzer（深度分析）

**职责**：检测硬编码密钥和敏感信息。

**检测正则**：
```
(password|secret|token|api[_-]?key|apiSecret)\s*[:=]\s*["'][^"']{8,}["']
```

**置信度计算**：
- 匹配但值为占位符（`your-*`、`xxx`、`TODO`） → confidence: 30（丢弃）
- 匹配真实值（长度 > 16，含特殊字符） → confidence: 95
- 匹配中等值（长度 8-16） → confidence: 85

**严重度**：
- confidence >= 90 → P0（阻断）
- confidence >= 80 → P1（重要）

**启用条件**：`--full` 模式 或 文件数 > 3

---

## Reviewer 4: history-reviewer（历史分析）

**职责**：通过 Git 历史识别高频修改/高风险文件。

**分析逻辑**：
1. 对每个待审查文件，执行 `git log --oneline --follow <file> | wc -l`
2. 计算修改频率：commits / days_since_first_commit
3. 识别最近 30 天内集中修改的文件

**置信度计算**：
- 修改频率 > 0.5/天 → confidence: 85
- 修改频率 > 0.2/天 → confidence: 70
- 最近 7 天内有 5+ 次提交 → confidence: 90

**严重度**：P1（重要）

**启用条件**：`--full` 模式 或 文件数 > 3

---

## Reviewer 5: standards-reviewer（规范审查）

**职责**：检查代码风格和命名规范。

**检测内容**：
- 函数名是否使用 camelCase（TS/JS）
- 类名是否使用 PascalCase
- 常量是否使用 UPPER_SNAKE_CASE
- 文件命名是否一致

**检测正则**：
- `function [a-z]+_[a-z]+` → 疑似 snake_case 函数名
- `const [a-z]+ =` → 非大写常量

**置信度计算**：
- 明确的命名违规 → confidence: 80
- 风格不一致 → confidence: 65

**严重度**：P2（建议）

**启用条件**：`--full` 模式 或 文件数 > 3

---

## Reviewer 6: contract-reviewer（契约审查）

**职责**：检查导出的公开 API 是否有恰当的文档注释。

**检测逻辑**：
- 扫描 `export function`、`export class`、`export const` 声明
- 检查前一行是否有 JSDoc 注释（`/** ... */`）
- 检查是否缺少 `@contract` 标签

**置信度计算**：
- 导出但无任何注释 → confidence: 75
- 有 JSDoc 但缺少 `@contract` → confidence: 50
- 导出接口/类型但无注释 → confidence: 70

**严重度**：P1（重要）

---

## Reviewer 选择规则

| 模式 | 启用的 Reviewer | 适用场景 |
|------|----------------|----------|
| `--lite` | contract-reviewer, bug-scanner（2 个） | 快速检查 |
| `--full` | 全部 6 个 reviewer | 深度审查 |
| 默认（文件数 > 3） | 全部 6 个 reviewer | 自动判断 |
| 默认（文件数 <= 3） | 全部 6 个 reviewer | 自动判断 |

---

## 严重度分类

| 等级 | 含义 | 定义 |
|------|------|------|
| P0（阻断） | 必须修复 | security 类别且 confidence >= 90 |
| P1（重要） | 建议修复 | security 或 contract 类别 |
| P2（建议） | 可选修复 | 其他类别（logging、todo） |
| discarded | 已丢弃 | confidence < 80 的低质量发现 |

---

## 文件类型过滤

仅审查以下类型文件：
- `.ts`、`.tsx`、`.js`、`.jsx`
- `.py`、`.java`
- `.go`、`.rs`