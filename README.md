# @hunterzheng/harness

个人开发工具统一 CLI 入口（Personal Development Tool Harness）。

## 安装

```bash
npm install
npm run build
```

## 使用

```bash
harness <command>
```

### 可用命令

| 命令 | 描述 | 需要工作空间初始化 |
| --- | --- | --- |
| `inspect` | 扫描项目结构并生成事实 | 是 |
| `sync` | 与知识库同步文档 | 是 |
| `develop` | 执行开发工作流 | 是 |
| `review` | 执行代码审查 | 是 |
| `knowledge` | 管理知识索引 | 是 |
| `status` | 显示工作空间和项目状态 | 否 |
| `doctor` | 诊断环境和依赖 | 否 |
| `config` | 管理 harness 配置 | 否 |

### 全局选项

- `--cwd <path>` — 指定项目根目录
- `--dry-run` — 预览模式，不写入文件
- `--json` — 纯 JSON 输出
- `--no-color` — 禁用 ANSI 颜色

运行 `harness --help` 查看可用命令。

## 开发

```bash
npm run build      # 构建
npm run test       # 运行测试
npm run lint       # lint 检查
npm run typecheck  # 类型检查
```

## 架构

- **CLI 入口**: `src/bin/harness.ts` — 基于 commander 的统一命令解析
- **命令注册**: `src/cli/command-registry.ts` — 能力命令动态注册
- **核心模块**: `src/core/` — 配置、状态、工作空间管理
- **能力层**: `src/capabilities/` — develop / inspect / knowledge / review /
  safety / sync
- **适配器层**: `src/adapters/` — 外部源适配
- **测试**: `test/` — vitest 单元测试

## 依赖

- Node.js >= 20.0.0
- npm >= 10.0.0
