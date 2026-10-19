# ISZY Nuxt 认证 Layer

[![Nuxt 4.x](https://img.shields.io/badge/Nuxt-4.x-brightgreen)](https://nuxt.com/) [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/ZvonimirSun/iszy-nuxt-auth-layer)

用于 ISZY Nuxt 应用的共享认证 layer，抽取前端 BFF、Redis session、登录登出、登录态检查、OAuth 回调和 SSO 账户完成等通用能力。

## 功能

- 基于 Redis 的 httpOnly session cookie。
- 后端 API 代理与 token 刷新。
- 本地登录、登出、登录态检查、OAuth 和 SSO 流程。
- 通用用户 store、公开认证类型和用户信息裁剪工具。

## 使用方式

```bash
pnpm add @zvonimirsun/iszy-nuxt-auth-layer
```

```ts
export default defineNuxtConfig({
  extends: ['@zvonimirsun/iszy-nuxt-auth-layer'],
  runtimeConfig: {
    apiOrigin: '',
    public: {
      apiOrigin: '',
    },
  },
})
```

消费方应用需要按部署环境配置 API origin、Redis 连接信息和 session cookie 选项。服务端请求优先使用私有的 `apiOrigin`，未配置时回退到 `public.apiOrigin`；OAuth 浏览器跳转和客户端直连仍使用公开地址。

### 公开页面缓存

`runtimeConfig.session.renewalScope` 默认为 `all`，保持所有响应续期 session 的行为。
采用共享 HTML 缓存的应用应设置为 `api`：仅 `/api` 及其子路径续期，页面和静态资源响应不访问 Redis、不写 session cookie。API 响应使用 `private, no-store`。
消费方还必须将用户资料加载移到客户端，禁止将用户资料序列化进共享页面；需要权限的页面须等待认证和权限检查完成。layer 不自动更改消费方的认证启动时机。

## 文档

详细架构、运行时配置和接入说明请查看 [DeepWiki](https://deepwiki.com/ZvonimirSun/iszy-nuxt-auth-layer)。
