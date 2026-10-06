# Nuxt 4.6 升级与 GitPulse 适配评估

评估日期：2026-10-06。依据 Nuxt 4.6 官方公告、Nuxt 4.x 文档及当前 GitPulse 源码。下文区分框架能力与项目适用性；性能数字未在 GitPulse 上实测。

## 结论

适合此次同步采用的是新的路由请求类型推断，并移除能够由服务端响应推断的重复类型声明。现有 SSR 请求上下文、CSRF、认证会话和 Nitro 存储应继续使用。Nuxt 4.6 的预取、链接 SSR、cookie 解析和开发工具优化会随升级生效，无需改写业务组件。[Nuxt 4.6 公告](https://nuxt.com/blog/v4-6)

不建议此次启用 `early404` 或 `future.compatibilityVersion: 5`，也不建议迁移到实验性的 Vite 服务端、新会话系统或 Vapor。原因是当前代码存在具体依赖与行为差异，而不是所有实验功能都不适用。

## 更新内容与适用性

| Nuxt 4.6 更新                                                               | GitPulse 现状与建议                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLI v4、开发错误页面和源码定位改进                                          | 随 Nuxt 升级获得。终端自动化可按需使用 `--no-tui`；无需改 app 页面。[公告](https://nuxt.com/blog/v4-6)。Nuxt 包自身要求 Node.js `^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0`，比公告中的 CLI 最低版本更严格；本机 Node 26.3.1 满足要求。[Nuxt 4.6 包声明](https://github.com/nuxt/nuxt/blob/v4.6.0/packages/nuxt/package.json)                                   |
| `experimental.routeTypedFetch`，基于生成的路由树重建请求类型                | 本次已启用。路径、方法及服务端声明的请求/响应类型可参与推断；显式指定响应泛型会放弃部分路径推断。无需先迁移全部 H3 handlers。[类型选项文档](https://nuxt.com/docs/4.x/guide/going-further/experimental-features#routetypedfetch)                                                                                                                           |
| `nuxt/server` 提供跨 Nitro/H3 版本的事件和工具接口                          | 适合未来分阶段迁移。当前 `github-auth-utils.ts`、`api-cache-utils.ts`、路由参数工具依赖 `H3Event`；不能仅替换某一个 helper 的 import。Nuxt 4 中自动导入的同名 helper 仍使用 H3 事件。[服务端导入指南](https://nuxt.com/docs/4.x/guide/going-further/server-imports)                                                                                        |
| `runtimeConfig.appSecret`、`deriveSecret` 和 cookie session helpers         | 当前 `nuxt-auth-utils`、`establishGitHubSession()`、personal-mode 启动校验已形成完整契约。新 helpers 不等同于现有登录、OAuth/PAT、客户端 session API 的直接替代；此次保留原体系。[会话文档](https://nuxt.com/docs/4.x/guide/going-further/server-imports#sessions)                                                                                         |
| 统一客户端预取调度、NuxtLink SSR 优化、cookie 解析复用                      | 随升级获得。项目已有 NuxtLink/NuxtLinkLocale，且 CSRF wrapper 使用 `useCookie`，因此相关框架路径会受益；具体速度、流量节省需单独测量。[公告](https://nuxt.com/blog/v4-6#performance)                                                                                                                                                                       |
| `useFetch`/`useAsyncData` 的 `serialize: false` 与 `stripNeverHydratedData` | 首页认证 provider 数据需要客户端继续驱动登录界面，不能为了减小 payload 删除它。当前没有发现 `hydrate-never` 组件，因此不启用全局剥离选项。[选项文档](https://nuxt.com/docs/4.x/guide/going-further/experimental-features#stripneverhydrateddata)                                                                                                           |
| `createUseFetch`/`createUseAsyncData` addons                                | 可用于今后新增的可复用数据获取能力。现有 dashboard 获取逻辑包含分页缓存、请求代次和通知差异检测；迁移成通用轮询 addon 并不能直接保留这些业务语义。本次不重写。[addon 文档](https://nuxt.com/docs/4.x/api/utils/define-use-fetch-addon)                                                                                                                     |
| `experimental.early404`                                                     | 不采用。全局认证 middleware 会把未登录访问的非首页路径重定向到首页；提前 404 跳过 middleware，会改变未知路径的现有处理。[early404 文档](https://nuxt.com/docs/4.x/guide/going-further/experimental-features#early404)                                                                                                                                      |
| 顶层 `prerender`、按上下文生成 TS 配置、types 目录识别等 DX 改进            | 现有配置没有 `nitro.prerender` 或相应 TS 覆写，暂无必要添加空配置或调整类型文件位置。[公告](https://nuxt.com/blog/v4-6#developer-experience)                                                                                                                                                                                                               |
| 实验性 `@nuxt/vite-server`、Vue Vapor 支持及 Nuxt 5 兼容选项                | Vite 服务端目前缺少 Nitro storage、缓存、tasks、server plugins；GitPulse 明确依赖 storage 和 server plugins。Vapor 需要独立评估 Vue 版本、组件与第三方模块兼容性。Nuxt 5 兼容选项同时改变多个默认行为，不作为普通依赖升级附带启用。[公告](https://nuxt.com/blog/v4-6)、[Nuxt 5 试用清单](https://nuxt.com/docs/4.x/getting-started/upgrade#testing-nuxt-5) |

## 可落地的请求类型改进

本次在 [nuxt.config.ts](../../nuxt.config.ts) 开启 `experimental.routeTypedFetch`，并将首页 [app/pages/index.vue](../../app/pages/index.vue) 的请求改为 `useFetch('/api/auth/providers')`，删除原来的 `<AuthProviderState>` 泛型。服务端 handler 的返回类型成为类型来源，个人模式、provider warnings 和登录界面的调用点通过类型检查。

没有开启 `strictRouteTypes`。它是另一个独立选项，负责拒绝无法匹配的静态路径；不影响此次首页响应推断。Nuxt 4 仍可能存在 Nitro 声明的全局 `$fetch`，直接调用若需新类型应按官方文档使用 `#build/fetch`；此次调整使用的是 `useFetch`，不受该全局声明影响。[选项说明](https://nuxt.com/docs/4.x/guide/going-further/experimental-features#routetypedfetch)

[useGitPulseApiFetch](../../app/composables/useGitPulseApiFetch.ts) 当前将 `useRequestFetch()` 转成手写的 `<T> => Promise<T>`，所以仅打开配置不能让经此封装的所有 API 调用自动获得路由推断。官方的 `useRequestFetch` 保留 SSR 请求头与上下文，封装必须继续调用这个请求实例。[useRequestFetch 文档](https://nuxt.com/docs/4.x/api/composables/use-request-fetch)

若扩展封装类型，应同时满足：

- 保留安全方法直接调用、同源写请求附加 CSRF header、外部地址透传和缺少 token 的现有行为。
- 保留 SSR 的 `event.$fetch` 绑定，避免新建 fetch 实例时丢失认证上下文。
- 返回值只声明实际支持的接口。Nuxt 的 `$Fetch` 类型包含 `raw`、`create`，普通包装函数没有这些成员，不能直接断言成完整 `$Fetch`。
- 覆盖动态 URL、显式响应泛型和非 JSON 响应；不要用 `Parameters<$Fetch>`/`ReturnType<$Fetch>` 擦掉路由泛型。

这些约束来自现有封装与本次安装的 Nuxt 4.6 类型定义核对。完整 `$Fetch` 的路由校验是编译时能力；手工断言一个类型并不能验证服务端真实响应。

## 预取策略

[nuxt.config.ts](../../nuxt.config.ts) 已启用 `prefetchPreloadTags`。4.6 调度器会管理 Nuxt 自己的路由、layout、middleware、payload、island 和资源提示，无需另外打开调度开关。保留当前配置是此次改动最小的选择。

不过 `prefetchPreloadTags` 只对目标页有提取 payload 的场景转发资源提示；它不是普遍加速开关。官方提示，可见性预取可能提前下载不会访问页面的图片，图片提示还会按普通请求计入 CDN 流量。未来若实测发现头像或图片预取浪费，可以对相关链接使用交互预取，或重新评估此开关。[prefetchPreloadTags 文档](https://nuxt.com/docs/4.x/guide/going-further/experimental-features#prefetchpreloadtags)

[dashboard.vue](../../app/pages/dashboard.vue) 的 `prefetchDashboardInteractionChunks()` 直接执行动态 `import()`，并通过 idle callback 提前加载详情和弹窗；已有省流量与 2G 判断。这些业务动态导入并不会仅因升级自动进入 Nuxt 的路由预取队列。本次保留；若以后优化，应测量请求瀑布与首次打开面板的耗时再调整。

## 保留现有行为的原因

- [auth.global.ts](../../app/middleware/auth.global.ts) 的认证重定向涵盖未知页面；`early404` 官方也明确将此类 middleware 列为不兼容场景。
- [nuxt.config.ts](../../nuxt.config.ts) 使用 Nitro 的 `storage`/`devStorage` 挂载用户设置；认证与 CSRF 又依赖 server plugins，因此 Vite 服务端缺少当前所需能力。
- `future.compatibilityVersion: 5` 不只是预览性能优化：它还会关闭 Nitro 自动导入、改变路由大小写、开启 typed pages、改变 `clearNuxtState`、PostCSS、错误格式与 TypeScript 默认项。项目大量依赖服务端自动导入，应另立迁移工作。[完整清单](https://nuxt.com/docs/4.x/getting-started/upgrade#testing-nuxt-5)

## 本次验证记录

### Windows 开发服务器兼容修复

Nuxt 4.6.0 在 Windows 上可能出现 `Either manifest or precomputed data must be provided`。Nitro 的 `nuxt/dist` 字符串内联规则没有匹配反斜杠路径，导致 Nuxt renderer 被外部导入，`import.meta.dev` 未被编译替换，进而读取到空的预计算数据。[上游问题 #36467](https://github.com/nuxt/nuxt/issues/36467)

本次在 `nitro.externals.inline` 添加同时匹配 Windows/POSIX 路径的规则 `/[\\/]node_modules[\\/]nuxt[\\/]dist[\\/]/`。它只覆盖 Nuxt 自身的运行时代码；上游发布修复后可移除该兼容规则。

使用当前 `localhost:3000` 开发服务器验证：修复前 `/` 和 `/dashboard` 均返回包含该错误的 500，API 正常；修复后 `/` 返回 200，未登录的 `/dashboard` 返回 `302 /?returnTo=/dashboard`，原错误消失。此项验证使用 HTTP 请求，没有进行浏览器测试；没有验证已登录后的页面交互。

### 依赖与静态检查

主应用升级 16 项直接依赖，扩展升级 1 项；两个 Bun lockfile 均已更新。其余直接依赖已是查询时的最新稳定版。Vue 运行时、编译器及 override 保持同一版本。

| 依赖                        | 升级前   | 升级后   |
| --------------------------- | -------- | -------- |
| `nuxt`                      | 4.5.2    | 4.6.0    |
| `vue` / `@vue/compiler-sfc` | 3.5.40   | 3.5.43   |
| `@lucide/vue`               | 1.47.0   | 1.52.0   |
| `@nuxtjs/robots`            | 6.2.3    | 6.2.4    |
| `@primer/css`               | 22.3.1   | 22.3.2   |
| `mermaid`                   | 12.0.0   | 12.1.0   |
| `nuxt-seo-utils`            | 8.5.1    | 8.6.1    |
| `redis`                     | 6.2.1    | 6.3.0    |
| `shiki`                     | 4.4.3    | 4.5.0    |
| `@j178/prek`                | 0.5.3    | 0.5.5    |
| `@types/node`               | 26.6.2   | 26.6.4   |
| `oxfmt`                     | 0.70.0   | 0.72.0   |
| `oxlint`                    | 1.85.0   | 1.87.0   |
| `oxlint-tsgolint`           | 7.0.2002 | 7.0.2003 |
| `vue-tsc`                   | 3.3.11   | 3.3.12   |
| 扩展 `@types/bun`           | 1.4.1    | 1.4.2    |

按要求保留 `sass-embedded` 1.100.0、主应用和扩展的 `typescript` 6.0.3；manifest 版本约束也未改变。`bun outdated` 复查仅剩这些排除项。

- `bun run fmt:check`：通过。
- `bun run lint`：通过。
- `bunx nuxi typecheck`：通过。
- `bun test`：796 通过、0 失败。
- `bun run extension:test`：16 通过、0 失败。
- `bun run extension:typecheck`：通过。

按仓库约定未运行本地 production build，也未进行浏览器测试。上述检查验证依赖和类型兼容性，不代表测量了运行时性能提升。
