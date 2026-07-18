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
})
```

消费方应用需要按部署环境配置 API origin、Redis 连接信息和 session cookie 选项。

## 文档

详细架构、运行时配置和接入说明请查看 [DeepWiki](https://deepwiki.com/ZvonimirSun/iszy-nuxt-auth-layer)。
