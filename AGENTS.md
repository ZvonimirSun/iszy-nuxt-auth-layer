# ISZY Nuxt Auth Layer Agent Guide

本文档用于帮助协作 Agent 快速理解 `@zvonimirsun/iszy-nuxt-auth-layer`。本仓库是 ISZY Nuxt 应用共享认证 layer，目标是复用 `iszy-tools-next` 与 `iszy-admin` 中重复的 Nuxt BFF、Redis session、登录登出、登录态检查、OAuth 回调和 SSO 首次登录账户完成逻辑。

## 项目定位

- 技术栈：Nuxt 4 layer、Vue 3、TypeScript、Nitro server、unstorage/Redis、Pinia。
- 包名：`@zvonimirsun/iszy-nuxt-auth-layer`。
- 导出入口：`nuxt.config.ts`，消费方通过 `extends` 继承。
- 本仓库只提供通用认证能力，不承载具体应用的业务权限。
- `iszy-admin` 的 admin/superadmin 403 语义由消费方覆盖或扩展。
- `iszy-tools-next` 的工具权限、设置页和第三方绑定展示由消费方保留。

## 常用命令

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm pack --dry-run
```

说明：
- `pnpm dev` 使用 `.playground` 启动 Nuxt 调试环境。
- 发布前至少跑 `pnpm typecheck` 和 `pnpm pack --dry-run`。
- 发布时使用 `pnpm publish --access public`，只在确认版本、产物和 npm 登录状态后执行。

## 目录索引

```text
app/
  pages/
    login.vue                       # 登录页
    logout.vue                      # 登出页
    sso/complete.vue                # SSO 首次登录账户完成页
  stores/user.ts                    # 通用用户状态
  utils/authEvents.ts               # 登录态事件广播
  components/AccountSecurityPanel.vue
server/
  middleware/session.ts             # httpOnly session 读取、写入与轮换
  plugins/redisStorage.ts           # Redis/unstorage 服务端存储装配
  api/
    [...].ts                        # 可选后端 API 代理兜底
    auth/                           # 登录、登出、登录态检查
    oauth/                          # OAuth、SSO、绑定和账户完成接口
  utils/
    authFetch.ts                    # 注入 access token 并处理 refresh 的后端请求工具
    sessionStore.ts                 # session 存取封装
    stateStore.ts                   # OAuth state 存储
    ssoCompletionStore.ts           # SSO 账户完成短期凭证存储
    oauthProviderFlow.ts            # Provider 流程封装
shared/
  types/auth.ts                     # 公开认证类型
  types/fetcher.ts                  # fetch 相关类型
  utils/user.ts                     # 用户信息裁剪和公共用户工具
  utils/usePublicConfig.ts          # 公开运行时配置读取辅助
nuxt.config.ts                      # Layer 导出入口
```

## 关键文件索引

### 登录态与 session

- `server/middleware/session.ts`：session cookie 解析、Redis session 读取、轮换和 tombstone 处理。
- `server/utils/sessionStore.ts`：服务端 session CRUD，改 TTL 或 key 结构时先读这里。
- `server/plugins/redisStorage.ts`：Redis storage 初始化；消费方应通过 runtimeConfig 提供连接信息。
- `app/stores/user.ts`：通用用户 store，只保存可暴露给浏览器的用户信息。
- `app/utils/authEvents.ts`：跨组件/页面的认证事件通知。

### 本地认证接口

- `server/api/auth/login.post.ts`：本地账号登录代理。
- `server/api/auth/logout.post.ts`：登出和 session 清理。
- `server/api/auth/check.get.ts`：登录态检查与用户信息刷新。
- `server/utils/authFetch.ts`：服务端请求后端 API 的统一入口，会注入 access token，并在 401 时尝试 refresh token。

### OAuth 与 SSO

- `server/api/oauth/[provider]/index.get.ts`：Provider 授权入口。
- `server/api/oauth/[provider]/callback.get.ts`：Provider 回调。
- `server/api/oauth/[provider]/bind.get.ts`：绑定 Provider。
- `server/api/oauth/sso/index.get.ts`：SSO 入口。
- `server/api/oauth/sso/callback.get.ts`：SSO 回调。
- `server/api/oauth/sso/completion/create.post.ts`：SSO 首次登录创建并绑定本地账户。
- `server/api/oauth/sso/completion/bind.post.ts`：SSO 首次登录绑定已有本地账户。
- `server/api/oauth/sso/completion.get.ts`：账户完成流程状态查询。
- `server/utils/stateStore.ts`：OAuth state 防 CSRF 存储。
- `server/utils/ssoCompletionStore.ts`：SSO completion 短期凭证存储。
- `server/utils/ssoCompletionError.ts`：账户完成流程错误封装。
- `server/utils/oauthProviderFlow.ts`：OAuth provider 共同流程。

### 页面、组件与共享类型

- `app/pages/login.vue`：通用登录页；消费方可覆盖页面或配置展示差异。
- `app/pages/logout.vue`：通用登出页。
- `app/pages/sso/complete.vue`：SSO 首次登录账户完成页面。
- `app/components/AccountSecurityPanel.vue`：账号安全/第三方绑定展示组件。
- `shared/types/auth.ts`：认证、用户、session 暴露类型。
- `shared/types/fetcher.ts`：认证 fetch 类型。
- `shared/utils/user.ts`：用户信息裁剪，避免向浏览器暴露敏感字段。

## 运行时配置与敏感信息

- 消费方通过 `runtimeConfig.public.apiOrigin`、Redis 配置和 session cookie 配置接入实际环境。
- AGENTS/README/示例配置只能写变量名、用途、默认空值或占位符；不要写线上实际 API 地址、Redis 地址、OAuth client secret、JWT secret、npm token 或任何本地不提交环境变量值。
- 排查问题时使用脱敏占位，例如 `<API_ORIGIN>`、`<REDIS_HOST>`、`<SECRET>`。
- 不要提交 `.npmrc`、token、`.env`、`.env.local`、`.output`、`node_modules`、打包产物或包含真实运行时配置的临时文件。
- 后端 access token、refresh token、provider token 只能保存在服务端 session/Redis 中，不要写入 Pinia、localStorage、URL query 或可被浏览器脚本读取的位置。

## 开发约定

- 修改认证流程时，同时检查 `server/api/auth/*`、`server/utils/authFetch.ts`、`server/middleware/session.ts` 和 `app/stores/user.ts` 的契约是否一致。
- 修改 OAuth/SSO 流程时，同时检查 state、completion store、cookie、回调重定向和错误页体验。
- 共享用户类型优先从 `@zvonimirsun/iszy-common` 复用；layer 只补充 Nuxt 侧需要的认证类型。
- 新增能力默认保持通用，不把 `iszy-admin` 或 `iszy-tools-next` 的具体业务权限写死到 layer。
- 需要给消费方差异化的逻辑，优先设计为可覆盖页面、可配置 runtimeConfig 或可复用 composable/server util。
- 改 session key、cookie 名、TTL、refresh 竞态处理时，要考虑并发请求、旧 session 兼容和消费方正在登录的用户。

## 验证建议

- 普通类型或工具改动：跑 `pnpm typecheck`。
- 发布前：跑 `pnpm typecheck` 和 `pnpm pack --dry-run`，确认 `files` 白名单产物符合预期。
- 登录/OAuth/SSO 流程改动：用 `.playground` 启动 `pnpm dev`，至少手动检查登录、登出、check、OAuth 回调失败路径和 SSO completion 主要分支。
- 只改文档时通常不需要启动开发服务。

## Git 与 Commit 规范

- 本仓库可能有用户未提交改动，修改前先看 `git status`。
- 不要回滚用户改动；如果无关，保持不动。
- 避免无关格式化、批量整理或更新 lockfile 元数据。
- Commit 使用常见前缀：`feat`、`fix`、`chore`、`docs`、`refactor`、`test`、`perf`、`style`、`build`、`ci`。
- Commit 格式建议：`<type>: <中文提交内容>`，例如 `feat: 增加 SSO 账户完成流程`、`fix: 修复 session 轮换竞态`、`docs: 补充 layer 接入说明`。
- 提交内容使用中文说明本次变更，不要只写英文或含糊的 `update`、`misc`。
- 涉及消费方同步改动时，按仓库边界拆分提交，并在提交内容中说明关联关系。
