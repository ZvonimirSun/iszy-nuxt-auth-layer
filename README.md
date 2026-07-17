# ISZY Nuxt 认证 Layer

用于 ISZY Nuxt 应用的共享认证 layer，抽取前端 BFF、Redis session、登录登出、认证检查和 OAuth 回调等通用能力。

## 功能

- 基于 Redis 的 httpOnly session cookie。
- session 轮换与短 TTL tombstone，降低并发刷新 token 时的竞态影响。
- 后端 API 代理工具，自动注入 access token，并在 401 时尝试 refresh token。
- 本地登录、登出、登录态检查和 OAuth 回调路由。
- SSO 首次登录账户完成流程：可验证并绑定已有账户，或创建并绑定新账户。
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

## SSO 首次登录

当 SSO subject 尚未关联本地用户时，回调不会直接创建账户，而是进入短期的账户完成流程：

- 选择“绑定已有账户”时，通过用户名或 SSO 建议邮箱及密码验证本地账户，验证成功后绑定 SSO。
- 选择“创建新账户”时，可以使用 SSO 建议的用户名、昵称和邮箱创建账户，并同时绑定 SSO。
- SSO 创建的账户始终为启用状态，不受 `publicRegister` 配置影响。
- 待完成凭证只保存在服务端 Redis 中；浏览器只持有独立的 opaque flow ID 与对应的 httpOnly 流程 cookie，多个并发登录流程不会相互覆盖。
- 当前流程不包含邮箱验证码、邀请码或头像同步。
