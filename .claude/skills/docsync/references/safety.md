# 安全约束

## 禁止操作

- 不读取或输出 `.env`、token、密钥文件
- 不执行 `git commit`、`git push`、`npm publish`
- 不使用 `curl`/`wget` 下载外部资源
- 不修改凭证或认证文件
- 不编造命令、端口、环境变量、API、模块、凭据或部署步骤

## 标记规则

- 不确定的内容必须标记为 `TODO(review)`
- 禁止猜测不存在的事实

## 内容保护

- 保留已有非 DocSync 内容
- 保留已有 marker blocks
- 不覆盖 override.md 中已有的规则内容，仅追加或替换
