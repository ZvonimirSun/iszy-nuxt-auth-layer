# ISZY Nuxt Auth Layer Agent Guide

本仓库是 ISZY Nuxt 应用共享认证 layer，目标是复用 `iszy-tools-next` 与
`iszy-admin` 中重复的 Nuxt BFF、Redis session、登录登出和 OAuth 回调逻辑。

## 约定

- 本仓库只提供通用认证能力，不承载具体应用的业务权限。
- `iszy-admin` 的 admin/superadmin 403 语义由消费方覆盖或扩展。
- `iszy-tools-next` 的工具权限、设置页和第三方绑定展示由消费方保留。
- 不要提交 `.npmrc`、token、`.env`、`.output`、`node_modules` 或打包产物。

## 常用命令

```bash
pnpm install
pnpm typecheck
pnpm pack --dry-run
pnpm publish --access public
```
