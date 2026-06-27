# ISZY Nuxt 认证 Layer

用于 ISZY Nuxt 应用的共享认证 layer，抽取前端 BFF、Redis session、登录登出、认证检查和 OAuth 回调等通用能力。

## 功能

- 基于 Redis 的 httpOnly session cookie。
- session 轮换与短 TTL tombstone，降低并发刷新 token 时的竞态影响。
- 后端 API 代理工具，自动注入 access token，并在 401 时尝试 refresh token。
- 本地登录、登出、登录态检查和 OAuth 回调路由。
- 通用用户 store、公开用户类型和用户信息裁剪工具。

## 使用方式

安装依赖：

```bash
pnpm add @zvonimirsun/iszy-nuxt-auth-layer
```

在 Nuxt 应用中继承该 layer：

```ts
export default defineNuxtConfig({
  extends: ['@zvonimirsun/iszy-nuxt-auth-layer'],
})
```

消费方应用需要按部署环境配置 `runtimeConfig.public.apiOrigin`、Redis 连接信息和 session cookie 选项。

## 运行时配置

```ts
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      apiOrigin: '',
      title: '',
      features: {
        publicRegister: false,
      },
    },
    redis: {
      host: '',
      port: 6379,
      password: undefined,
    },
    session: {
      cookieName: 'NUXT_SESSION_ID',
      maxAge: '7d',
      domain: '',
    },
  },
})
```

## 应用差异

该 layer 只提供通用认证链路，不接管具体应用的业务权限：

- `iszy-admin` 仍应在消费方保留 admin/superadmin 鉴权和 403 页面语义。
- `iszy-tools-next` 仍应在消费方保留工具权限、工具目录刷新和设置页展示逻辑。
- authentik 接入会在后续版本扩展，本首版只保留现有本地登录与 OAuth 基础能力。
