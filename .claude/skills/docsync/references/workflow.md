# DocSync Workflow

## 前置校验

1. 检查 `.docsync/state/install.json` 是否存在。缺失则提示 `ERR_NO_INSTALL`。
2. 检查 `.docsync/config/`、`.docsync/context/`、`.docsync/rules/` 是否存在。缺失则提示 `ERR_WORKSPACE_INCOMPLETE`。

## 完整同步流程

```
npx @hunterzheng/docsync sync [--cwd <path>] [target1] [target2]
```

- 无参数：同步全部三份核心文档
- 指定文件：仅同步指定文件
- 同步后可根据用户额外要求手动补充内容

## 快速同步流程

```
npx @hunterzheng/docsync sync --fast [target1]
```

- 使用轻量 git 事实推断影响范围
- 信息不足或高风险时自动升级为完整同步

## 上下文准备

```bash
repomix --config .docsync/config/repomix.config.json --ignore-file .docsync/config/repomixignore
```

## 格式修复

```bash
markdownlint-cli2 --config .docsync/config/markdownlint-cli2.jsonc
```
