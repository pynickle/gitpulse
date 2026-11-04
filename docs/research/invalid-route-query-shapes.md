# 缺少必需查询参数的路由：Nuxt 4.6 框架行为研究

评估日期：2026-11-04。依据本仓库已安装的 `nuxt` 4.6.3、`vue-router` 5.4.0、`@nuxtjs/i18n` 10.6.0、`vue` 3.5.44、`@unhead/vue` 3.4.3、`h3` 1.15.11 源码，以及 nuxt.com / router.vuejs.org / i18n.nuxtjs.org 官方文档。下文只陈述框架事实，不替产品做取舍；所有未实测之处在最后一节列出。

## 结论

Nuxt 4.6.3 里唯一"页面级"的准入闸门是 `definePageMeta({ validate })`，它在 SSR 上确实生效，返回 `false` 时整条请求以错误页 + 该错误的 `statusCode`（默认 404）结束，而不是把页面渲染成空状态。[`validate.js:4-14`](../../node_modules/nuxt/dist/pages/runtime/validate.js) 但它**不能**用来重定向：它只认 `=== true` 为通过，其它任何返回值（包括返回一个 route location、或在其中 `await navigateTo()`）都会被转换成错误，内部跳转不会产生 302。[`validate.js:7-13`](../../node_modules/nuxt/dist/pages/runtime/validate.js)、[`router.js:175-187`](../../node_modules/nuxt/dist/app/composables/router.js)

同一次校验若改用路由中间件表达，`return navigateTo(...)` 在 SSR 上写出 302 + `location` 头（[`router.js:164-174`](../../node_modules/nuxt/dist/app/composables/router.js)），`return false`/`abortNavigation()` 在 SSR 上变成 404 错误页（[`router.js:190-198`](../../node_modules/nuxt/dist/pages/runtime/plugins/router.js)），但在**客户端**同样的 `return false` 只是取消导航、不显示错误页（[`router.js:200-208`](../../node_modules/nuxt/dist/pages/runtime/plugins/router.js)）——服务端与客户端行为不对称，这是选型时最容易踩空的一处。

Nuxt 4.6 没有针对"必需查询参数"的一等设施：`routeRules` 只按 path 匹配（服务端甚至把 query 直接切掉，[`route-rules.mjs:25`](../../node_modules/@nuxt/nitro-server/dist/runtime/utils/route-rules.mjs)），`experimental.early404` 同样只看 pathname（[`early-404.js:12-39`](../../node_modules/nuxt/dist/runtime/server/renderer/early-404.js)），`experimental.routeTypedFetch`/`strictRouteTypes` 只约束 `$fetch`/`useFetch` 的目标服务端路由，与页面 URL 的查询参数无关。[实验特性文档](https://nuxt.com/docs/4.x/guide/going-further/experimental-features#strictroutetypes)

## 版本与研究对象

| 包             | 安装版本  | 依据                                                                  |
| -------------- | --------- | --------------------------------------------------------------------- |
| `nuxt`         | 4.6.3     | `nuxt.config.ts` 声明 `^4.6.3`；`node_modules/nuxt/package.json`      |
| `vue-router`   | **5.4.0** | `package.json` 声明 `^5.4.0`；`node_modules/vue-router/package.json`  |
| `@nuxtjs/i18n` | 10.6.0    | `nuxt.config.ts:251`、`nuxt.config.ts:295-304`                        |
| `h3`           | 1.15.11   | `node_modules/h3/package.json`（`nuxt` 经 `@nuxt/nitro-server` 转出） |

需要更正一个前提：本仓库当前的 `vue-router` 是 **5.4.0**，不是 4.x。下文的 vue-router 行为全部对着 5.4.0 的安装源码核对，不引用 vue-router 4 的文档断言。

本仓库现状（仅作上下文，不是结论）：`app/pages/dashboard/wiki.vue:47-60` 在 `?repo` 缺失时 `repoTarget` 为 `null`，取数函数直接 `return`（`app/pages/dashboard/wiki.vue:111-123`），`pageTitle` 为空串，`usePageMeta` 把空串视为"不设置标题"（`app/composables/usePageMeta.ts`）。实测（同一份 unhead 3.4.3 + 本仓库 `usePageMeta`，两个互不相关的 head entry）：子级标题为空时，`<title>` 与 `og:title` 取到的是**父路由** `app/pages/dashboard.vue:891` 的 `usePageMeta(currentTabTitle)` 的值，不是全局 `titleTemplate` 的默认值——空串在这里意味着"让位给上层 entry"，这是 `usePageMeta.ts:62-66` 归一化的真实后果。

## 1. `definePageMeta({ validate })` 的精确语义

**它是编译器宏，运行时的 `definePageMeta` 是空函数**（`node_modules/nuxt/dist/pages/runtime/composables.js:9-20`）。构建期把页面的 `validate` 注册成一条**全局**路由中间件，并被 `unshift` 到 `app.middleware` 首位，[`index.mjs:2314-2321`](../../node_modules/nuxt/dist/index.mjs)；因此它落在 `globalMiddleware` 数组第一个，进入每次导航的 middleware 集合开头（[`router.js:167`](../../node_modules/nuxt/dist/pages/runtime/plugins/router.js)）。

运行时代码只有 11 行，语义完全由它决定：

```js
// node_modules/nuxt/dist/pages/runtime/validate.js:4-14
const middleware = defineNuxtRouteMiddleware(async (to) => {
  if (!to.meta?.validate) return;
  const result = await Promise.resolve(to.meta.validate(to));
  if (result === true) return;
  return createError({
    fatal: import.meta.client,
    status: (result && (result.status || result.statusCode)) || 404,
    statusText:
      (result && (result.statusText || result.statusMessage)) || `Page Not Found: ${to.fullPath}`,
    data: { path: to.fullPath },
  });
});
```

由此得到的事实：

- **允许的返回值**：只有 `=== true` 表示通过。文档签名是 `boolean | Promise<boolean> | Partial<NuxtError> | Promise<Partial<NuxtError>>`，[definePageMeta 文档](https://nuxt.com/docs/4.x/api/utils/define-page-meta)。**route location 不在契约内**：`{ path: '/x' }` 会被当作"带 `status`/`statusText` 的错误描述对象"，两者都没有，于是 status 落到 404、statusText 落到 `Page Not Found: <fullPath>`。
- **`undefined` 等于失败**：`validate` 忘记 `return true` 会直接 404。
- **status 可定制**：返回 `{ status: 410, statusText: 'Gone' }`（或 `statusCode`/`statusMessage` 同义字段）会把这个状态带到响应上；`h3` 的 `createError` 同时接受 `statusCode` 与 `status`，[`index.mjs:91-96`](../../node_modules/h3/dist/index.mjs)。
- **`fatal` 服务端为 `false`、客户端为 `true`**（`import.meta.client`）。这一条决定了客户端重复校验时一定会弹错误页（见第 2 节）。

**运行时机**：服务端与客户端都会跑。

- 服务端：`nuxt:router` 插件先做一次 `router.push(initialURL)`（[`router.js:120-125`](../../node_modules/nuxt/dist/pages/runtime/plugins/router.js)），但 Nuxt 的 middleware `beforeEach` 直到 [`router.js:151`](../../node_modules/nuxt/dist/pages/runtime/plugins/router.js) 才注册；真正跑 `validate` 的是 `app:created` 钩子里的 `router.replace({ ..., force: true })`（[`router.js:239-267`](../../node_modules/nuxt/dist/pages/runtime/plugins/router.js)）。该钩子在所有插件 setup 完成后触发（[`entry.js:28-34`](../../node_modules/nuxt/dist/app/entry.js)），所以 `validate` 在 SSR 上拿到的是完整初始化过的 Nuxt 上下文（`$i18n`、session 等可用）。
- 客户端：同一份 middleware 集合在每次导航执行（[`router.js:166-176`](../../node_modules/nuxt/dist/pages/runtime/plugins/router.js)）。水合（hydration）期间仍会执行，只是"失败处理"分支不同：`import.meta.server || (!payload.serverRendered && isHydrating)` 才走"转 404 错误页"的短路（[`router.js:190-198`](../../node_modules/nuxt/dist/pages/runtime/plugins/router.js)）；否则落到 [`router.js:202-208`](../../node_modules/nuxt/dist/pages/runtime/plugins/router.js)，因为 `fatal` 为 `true`，会 `showError()` 并让导航携带该 Error 失败。

**SSR 上返回 `false` 的 HTTP 结果**：错误页 + 该错误的 `statusCode`（默认 404）。链路是：middleware 返回 Error → [`router.js:191-198`](../../node_modules/nuxt/dist/pages/runtime/plugins/router.js) 调 `showError()` 并 `return false`（中止导航）→ `showError()` 写入 `payload.error` 且不抛（[`error.js:11-21`](../../node_modules/nuxt/dist/app/composables/error.js)）→ 渲染器在渲染结束后抛 `payload.error`（[`renderer/index.js:263-264`](../../node_modules/nuxt/dist/runtime/server/renderer/index.js)）→ Nitro 错误处理器把请求交给独立的 `/__nuxt_error` 渲染（[`error.mjs:65-72`](../../node_modules/@nuxt/nitro-server/dist/runtime/handlers/error.mjs)）→ 最终状态码为 `res.status !== 200 ? res.status : defaultRes.status`（[`error.mjs:94`](../../node_modules/@nuxt/nitro-server/dist/runtime/handlers/error.mjs)），即该错误的 status。

这里走的是"错误页另起一次请求"的路径，因为本仓库没有开 `future.compatibilityVersion: 5`（默认 4，[`index.mjs:630`](../../node_modules/@nuxt/schema/dist/index.mjs)），`experimental.inlineErrorRendering` 因此为 `false`（[`index.mjs:712-715`](../../node_modules/@nuxt/schema/dist/index.mjs)）。开启后错误页会在同一次请求内渲染（[`renderer/index.js:73-101`](../../node_modules/nuxt/dist/runtime/server/renderer/index.js)），状态码语义相同，但响应头与 cookie 的处理不同。

**重定向？** 两条路都不成立：

1. `return { path: '/x' }` / `return '/x'` —— 按上文被当错误处理，404，**没有 `location` 头**。
2. `await navigateTo('/x')` 写在 `validate` 内部 —— 服务端此时 `isProcessingMiddleware()` 为真，`navigateTo` 只是注册一个 `router.afterEach` 并**返回目标 route location**，[`router.js:175-187`](../../node_modules/nuxt/dist/app/composables/router.js)；`validate` 再把这个 location 变成错误，导航被中止，那个 `afterEach` 永远等不到匹配的 `fullPath`，于是**不会写 302**。也就是说：在 `validate` 里做内部重定向会静默退化成 404。

## 2. 错误路径：`showError()` / `createError({ fatal: true })`

**SSR（`<script setup>` 内，两种写法）**

- `showError(err)` 只是把错误写进 `payload.error`，不抛异常（[`error.js:11-21`](../../node_modules/nuxt/dist/app/composables/error.js)）；渲染器在 [`renderer/index.js:264`](../../node_modules/nuxt/dist/runtime/server/renderer/index.js) 抛出它，随后按第 1 节同样的链路交给 Nitro 错误处理器，**渲染 app 的错误页**（本仓库有 `app/error.vue`）。
- `throw createError({ status: 404, fatal: true })`：`NuxtRoot` 的 `onErrorCaptured` 在**服务端对任何被捕获的错误**都调 `showError`（[`nuxt-root.vue:77-82`](../../node_modules/nuxt/dist/app/components/nuxt-root.vue)），结果同上。`showError` 期间服务端会先渲染一个空 `<div>`（`abortRender`，[`nuxt-root.vue:58`](../../node_modules/nuxt/dist/app/components/nuxt-root.vue)），因为此时还没进入错误页渲染。
- 响应状态码 = 该错误的 status（默认 500；`{ status: 404 }` 时 404）。文档同样表述为"服务端会触发全屏错误页"，[错误处理文档](https://nuxt.com/docs/4.x/getting-started/error-handling#error-utils)。

**客户端（水合之后）**

- 这里**没有 HTTP 状态码可改**：文档早已以 SSR 结果返回。错误页是客户端渲染的（[`nuxt-root.vue:4-7`](../../node_modules/nuxt/dist/app/components/nuxt-root.vue) 的 `v-else-if="error"`）。
- `throw createError({ fatal: false })` 在客户端**不会**显示错误页：`onErrorCaptured` 的门槛是 `isNuxtError(err) && (err.fatal || err.unhandled)`（[`nuxt-root.vue:77`](../../node_modules/nuxt/dist/app/components/nuxt-root.vue)）。`fatal: true` 才会显示。
- 直接调 `showError()` 不受 `fatal` 影响，一定显示错误页（它直接写 `payload.error`）。
- **水合时的重复**：SSR 的 `payload.error` 经 reviver 还原成 Nuxt 错误对象（[`revive-payload.client.js:18-19`](../../node_modules/nuxt/dist/app/plugins/revive-payload.client.js)），因此水合后错误页立刻在场；同时路由中间件（含 `validate`）会在浏览器里再跑一遍。文档也明确"渲染错误页是一次独立的页面加载，注册的中间件会再次运行"，[middleware 文档](https://nuxt.com/docs/4.x/directory-structure/app/middleware#when-middleware-runs)。源码层面这是真的：错误页是同一个 Nitro 实例内的 `localFetch('/__nuxt_error')`，[`error.mjs:65-72`](../../node_modules/@nuxt/nitro-server/dist/runtime/handlers/error.mjs)。

## 3. 路由中间件能否基于 `to.query` 在 SSR 重定向

能。middleware 收到的 `to` 就是本次目标路由（[`router.js:184`](../../node_modules/nuxt/dist/pages/runtime/plugins/router.js)），返回 `navigateTo(...)` 即在服务端写出重定向：

```js
// node_modules/nuxt/dist/app/composables/router.js:160-190
if (import.meta.server) {
  if (nuxtApp.ssrContext) {
    ...
    nuxtApp.ssrContext['~renderResponse'] = {
      statusCode: sanitizeStatusCode(options?.redirectCode || 302, 302),
      body: '<!DOCTYPE html>...<meta http-equiv="refresh" ...>',
      headers: { location: encodedHeader },
    }
    ...
    if (!isExternal && inMiddleware) { router.afterEach(...); return to }   // 内部跳转：交给 vue-router，落地后由 afterEach 写响应
    return redirect(!inMiddleware ? undefined : false)                      // 外部跳转：立即写响应
  }
}
```

默认 302，可用 `{ redirectCode: 301 }` 覆盖；响应体是一个 `<meta http-equiv="refresh">` 页面（[`router.js:164-174`](../../node_modules/nuxt/dist/app/composables/router.js)），与 [navigateTo 文档](https://nuxt.com/docs/4.x/api/utils/navigate-to) 的 `redirectCode` 说明一致。

文档化的限制：

- 不传 `next()`，重定向/中止靠**返回值**；必须 `return navigateTo(...)`，只调用不返回"不会按预期工作"。[middleware 文档](https://nuxt.com/docs/4.x/directory-structure/app/middleware#usage)
- 中间件里没有"当前路由"概念，**不要**在中间件里用 `useRoute()`；间接用到 `useRoute()` 的组合式函数同样不可靠。[middleware 文档](https://nuxt.com/docs/4.x/directory-structure/app/middleware#accessing-route-in-middleware)
- 顺序：先全局后页面级；全局按文件名排序，可用 `01.` 前缀定序。[middleware 文档](https://nuxt.com/docs/4.x/directory-structure/app/middleware#middleware-order)
- 中间件在 SSR 和客户端都会跑，需要自己决定是否跳过某一侧。[middleware 文档](https://nuxt.com/docs/4.x/directory-structure/app/middleware#when-middleware-runs)
- 文档建议优先使用 `navigateTo` / `abortNavigation`；其它 vue-router 返回值"可能可用，但未来可能破坏性变更"。[middleware 文档](https://nuxt.com/docs/4.x/directory-structure/app/middleware#usage)

本仓库已有的同构用法：[`app/middleware/auth.global.ts:15-18`](../../app/middleware/auth.global.ts) 返回 `navigateTo({ path: localePath('/'), query: ... })`，`04` 的升级记录实测到 `302 /?returnTo=/dashboard`（[`nuxt-4.6-upgrade.md:65`](nuxt-4.6-upgrade.md)）。

补充一条顺序事实：`validate` 被 `unshift` 到全局中间件首位（[`index.mjs:2314-2321`](../../node_modules/nuxt/dist/index.mjs)），而 `@nuxtjs/i18n` 自带的 `locale-changing` 是通过 `addRouteMiddleware(..., { global: true })` 追加到 `nuxtApp._middleware.global`（[`route-locale-detect.js:20-28`](../../node_modules/@nuxtjs/i18n/dist/runtime/plugins/route-locale-detect.js)），在 [`router.js:167`](../../node_modules/nuxt/dist/pages/runtime/plugins/router.js) 的集合里排在 `globalMiddleware` **之后**。因此同一路由上 `validate` 先于 `auth.global.ts` 与 i18n 的 `locale-changing` 执行——一个未登录、又缺 `?repo` 的请求会先拿到 404，而不是登录跳转。

## 4. 在 `<script setup>` 里无条件调用 `navigateTo()`

服务端会**写 302 并丢弃页面 HTML**，但**不会中断 setup**：

- `navigateTo` 在 setup（非中间件）里同步进入 `redirect(undefined)` 分支，写入 `~renderResponse`（`statusCode: 302` 默认、`location` 头、meta-refresh body）并返回已 resolve 的 promise（[`router.js:164-174, 188`](../../node_modules/nuxt/dist/app/composables/router.js)）。
- 后续 setup 代码继续执行；渲染结束后渲染器优先返回 `~renderResponse`，不返回 HTML（[`renderer/index.js:263`](../../node_modules/nuxt/dist/runtime/server/renderer/index.js)）。若重定向发生在渲染开始前（插件 / `app:created`），`entry.js` 会抛 `Error('skipping render')`，渲染器识别该信号并返回重定向响应（[`entry.js:35`](../../node_modules/nuxt/dist/app/entry.js)、[`renderer/index.js:249`](../../node_modules/nuxt/dist/runtime/server/renderer/index.js)）。
- 官方文档明确："调用 `navigateTo` 不会阻止 `<script setup>` 其余代码执行"，要提前返回需开启 `experimental.navigateToEarlyReturn`（[navigateTo 文档](https://nuxt.com/docs/4.x/api/utils/navigate-to)；[实验特性](https://nuxt.com/docs/4.x/guide/going-further/experimental-features#navigatetoearlyreturn)）。该选项在 `compatibilityVersion` < 5 时默认 `false`（[`index.mjs:808-810`](../../node_modules/@nuxt/schema/dist/index.mjs)），本仓库即此情况（`nuxt.config.ts:306-309` 未开启）。
- 状态码由 `redirectCode` 决定（默认 302），不是 301/303/307。[navigateTo 文档](https://nuxt.com/docs/4.x/api/utils/navigate-to)

本仓库 `auth.global.ts` 走的是**中间件**路径（返回 route location 由 vue-router 落地、再由 `afterEach` 写响应，[`router.js:114`](../../node_modules/nuxt/dist/pages/runtime/plugins/router.js)），不是在 setup 里裸调，因此不受"setup 继续执行"的影响。

## 5. vue-router：如何表达"这个位置不是有效页面"

对安装版本（5.4.0）而言，守卫返回值只有三类被识别（[`devtools-CxgSYwGp.js:549-566`](../../node_modules/vue-router/dist/devtools-CxgSYwGp.js)）：

| 返回值                      | vue-router 处理                     | 产生的东西                                                         |
| --------------------------- | ----------------------------------- | ------------------------------------------------------------------ |
| `false`（或 `next(false)`） | `reject(createRouterError(4, ...))` | `NavigationFailureType.aborted`（=4）                              |
| 一个 Error                  | `reject(err)`                       | 普通 router error（不是 NavigationFailure），交给 `router.onError` |
| route location / string     | `reject(createRouterError(2, ...))` | 内部 redirect failure（type 2），`pushWithRedirect` 递归跟随       |
| 其它/`undefined`/`true`     | `resolve()`                         | 继续导航                                                           |

- Failure 类型常量：`aborted = 4`、`cancelled = 8`、`duplicated = 16`（[`useApi-CUWMwLLw.js:77-94`](../../node_modules/vue-router/dist/useApi-CUWMwLLw.js)）；redirect 用的 type 2 只存在于内部错误文案表，没有导出成枚举成员（同文件 `:99-101`）。
- 官方语义：`false` 取消当前导航并把地址栏复位到 `from`；返回 route location 等于发起一次新的 `push`。[导航守卫文档](https://router.vuejs.org/guide/advanced/navigation-guards.md)

在 Nuxt SSR 下，这些 failure **本身不产生任何状态码**：

- `aborted` 被显式忽略：`if (import.meta.server && failure?.type === 4) return`（[`router.js:113`](../../node_modules/nuxt/dist/pages/runtime/plugins/router.js)）。
- 只有"零匹配"才转 404：`afterEach` 中 `to.matched.length === 0` 时 `showError(createError({ status: 404, fatal: false, ... }))`（[`router.js:231-238`](../../node_modules/nuxt/dist/pages/runtime/plugins/router.js)）。
- 因此**路由记录级的 `beforeEnter: () => false` 在 Nuxt SSR 上是静默的**：导航被取消、目标有匹配记录、`payload.error` 未被设置，响应仍是 200，渲染的是取消后的当前路由。想要"不是有效页面"的 404，必须走 Nuxt 的中间件（`return false` / 抛错）或 `validate`，而不是记录级守卫。

两个 Nuxt 层面的分支差异（同一份代码、同一份意图，服务端和客户端结果不同）：

| 写法                                        | SSR                                                                                                                                         | 客户端导航                                                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 中间件 `return false` / `abortNavigation()` | `showError(createError({status: 404}))` → 404 错误页（[`router.js:191-198`](../../node_modules/nuxt/dist/pages/runtime/plugins/router.js)） | `return false` → abort failure，**不显示错误页**（[`router.js:200-201`](../../node_modules/nuxt/dist/pages/runtime/plugins/router.js)） |
| 中间件 `throw createError({ fatal: true })` | 同上，状态取错误 status（[`router.js:209-216`](../../node_modules/nuxt/dist/pages/runtime/plugins/router.js)）                              | `showError()` + 携带错误失败（[`router.js:202-208`](../../node_modules/nuxt/dist/pages/runtime/plugins/router.js)）                     |
| `validate` 返回非 `true`                    | 404（或自定义 status）（[`validate.js:8-13`](../../node_modules/nuxt/dist/pages/runtime/validate.js)）                                      | `fatal` 为 true → 错误页（同上 `:202-208`）                                                                                             |

## 6. Nuxt 4.6 有没有"必需查询参数"的一等设施

没有。逐项排除：

- **`routeRules`**：客户端取规则只接受 path（`getRouteRules(arg)` 里 `typeof arg === 'string' ? arg : arg.path`，[`manifest.js:37-41`](../../node_modules/nuxt/dist/app/composables/manifest.js)）；服务端匹配前显式切掉 query：`matchRouteRules(withoutBase(event.path.split('?')[0], ...))`（[`route-rules.mjs:25`](../../node_modules/@nuxt/nitro-server/dist/runtime/utils/route-rules.mjs)）。规则键是 radix3 路径树（同文件 `:8-14`），没有 query 维度。[混合渲染文档](https://nuxt.com/docs/4.x/guide/concepts/rendering#hybrid-rendering)
- **`experimental.early404`**：只用构建期编译好的**路径**匹配器，且刻意比 vue-router 宽松（忽略尾斜杠、忽略大小写、解 `%` 编码），文档也把"route middleware 把未知路径重定向到已有页面"列为不兼容场景。[`early-404.js:12-39`](../../node_modules/nuxt/dist/runtime/server/renderer/early-404.js)、[实验特性文档](https://nuxt.com/docs/4.x/guide/going-further/experimental-features#early404)
- **`experimental.routeTypedFetch` / `strictRouteTypes`**：类型层面约束 `$fetch`/`useFetch` 指向的服务端路由与方法，`'isomorphic'` 只是把页面当成返回 `string` 的 `GET` 路由纳入类型检查，与页面 URL 上带不带 `?repo=` 无关。[实验特性文档](https://nuxt.com/docs/4.x/guide/going-further/experimental-features#strictroutetypes)
- **`definePageMeta({ validate })`**：是运行时断言，不是声明式 schema，也不参与文档生成或类型校验（签名见 [definePageMeta 文档](https://nuxt.com/docs/4.x/api/utils/define-page-meta)）。
- `definePageMeta` 允许自定义 meta 键（文档 `[key: string]: unknown`），但 `validate` 的执行只读 `to.meta.validate`（[`validate.js:5-6`](../../node_modules/nuxt/dist/pages/runtime/validate.js)），没有第二个内置钩子会读 query 形状。

## 7. `@nuxtjs/i18n` 的 `localePath` 在 validate / middleware 里的注意事项

**没有官方文档页谈这件事**。我下载了 `https://i18n.nuxtjs.org/llms-full.txt`（约 22 万字符）逐行检索，全文没有任何 `middleware` 出现；`localePath` 相关文档只描述用法与参数，[i18n Usage 文档](https://i18n.nuxtjs.org/docs/getting-started/usage)。所以下文的约束来自 Nuxt 官方文档 + 已安装的 i18n 源码，而非 i18n 文档。

源码事实：

- `localePath(ctx, route, locale = ctx.getLocale())` —— 不传 locale 时用**当前 locale**，[`routing.js:3`](../../node_modules/@nuxtjs/i18n/dist/runtime/routing/routing.js)；而 `getLocale: () => unref(i18n.locale)` 是 vue-i18n 的 locale ref，[`context.js:148`](../../node_modules/@nuxtjs/i18n/dist/runtime/context.js)。文档同样写 "defaults to the current locale"。
- 这个"当前 locale"在 SSR 上由 `i18n:plugin:route-locale-detect` 在插件 setup 期间按 `nuxt.$router.currentRoute.value` 设定（[`route-locale-detect.js:11-16`](../../node_modules/@nuxtjs/i18n/dist/runtime/plugins/route-locale-detect.js)）。由于 Nuxt 的中间件是在 `app:created` 里跑的、晚于 `applyPlugins`（[`entry.js:28-34`](../../node_modules/nuxt/dist/app/entry.js)），**中间件里调用 `useLocalePath()` 是安全的**：i18n 上下文此时已初始化。反过来说，`useComposableContext` 在上下文缺失时是抛错而不是降级（[`composable-context.js:3-11`](../../node_modules/@nuxtjs/i18n/dist/runtime/composable-context.js)），所以任何更早执行的位置（例如插件 setup 内的首次导航、路由记录级 `beforeEnter`）不应依赖它。
- 由此推出的组合式注意点：`auth.global.ts:12` 的 `useLocalePath()` 返回的是**当前 locale 前缀**的路径，与本次 `to` 的 locale 前缀未做交叉校验；`strategy: 'prefix_except_default'`（`nuxt.config.ts:303`）下默认 locale 无前缀，跨 locale 的 `to`（如 `/zh/dashboard/wiki` → `localePath('/')`）会跳到默认 locale 的首页。这是 i18n 的行为事实，是否符合产品预期属于决策。
- Nuxt 侧的文档化限制同样适用：中间件里没有"当前路由"，`useRoute()` 一律不可信，会间接调用 `useRoute()` 的组合式函数也不可用。[middleware 文档](https://nuxt.com/docs/4.x/directory-structure/app/middleware#accessing-route-in-middleware)（`useLocalePath` 本身不读 `useRoute`，它读 i18n 的 locale ref。）

## 机制对比

"客户端重复"指客户端再次导航到同一 URL 时是否也拦住。

| 机制                                                | SSR 的 HTTP 结果                                             | 客户端重复                            | 代码成本                                | 框架注意事项                                                                                                                                                                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `definePageMeta({ validate })`                      | 错误页 + status（默认 404）；HTML 不渲染                     | 是（`fatal` 客户端为 true，弹错误页） | 每页 3-6 行；组件级、就近               | 只认 `=== true`；不能重定向（内部跳转会退化成 404）；先于其它全局中间件执行（[`validate.js:4-14`](../../node_modules/nuxt/dist/pages/runtime/validate.js)、[`index.mjs:2314-2321`](../../node_modules/nuxt/dist/index.mjs)）              |
| 命名/页面中间件 `return navigateTo(...)`            | 302 + `location` + meta-refresh body；可用 `redirectCode` 改 | 是                                    | 一个中间件文件 + 每页 `middleware: 'x'` | 必须 `return`；文档警告不要在中间件里用 `useRoute()`；服务端/客户端都跑（[`router.js:160-190`](../../node_modules/nuxt/dist/app/composables/router.js)、[middleware 文档](https://nuxt.com/docs/4.x/directory-structure/app/middleware)） |
| 中间件 `return false` / `abortNavigation()`         | 404 错误页（`showError(createError({status:404}))`）         | 否 —— 客户端只是取消导航，无错误页    | 同上                                    | 服务端/客户端不对称（[`router.js:191-201`](../../node_modules/nuxt/dist/pages/runtime/plugins/router.js)）                                                                                                                                |
| 中间件 `throw createError({ fatal: true, status })` | 错误页 + 自定义 status                                       | 是（`fatal` 触发 `showError`）        | 同上                                    | 与上一条同一分支逻辑，仅 `fatal` 不同（[`router.js:202-216`](../../node_modules/nuxt/dist/pages/runtime/plugins/router.js)）                                                                                                              |
| `<script setup>` 里 `throw createError(...)`        | 错误页 + status；水合后重复执行                              | 赋值/渲染阶段才抛，客户端靠 `fatal`   | 每页几行                                | 抛在 `await` 之前才不会先做完数据请求；客户端 `fatal: false` 静默（[`nuxt-root.vue:77-82`](../../node_modules/nuxt/dist/app/components/nuxt-root.vue)）                                                                                   |
| `<script setup>` 里 `showError(...)`                | 错误页 + status                                              | 是（直接写 `payload.error`）          | 每页 2 行                               | 不抛异常，setup 继续跑完；对 crawler 有单独分支（[`error.js:11-21`](../../node_modules/nuxt/dist/app/composables/error.js)、[`error.js:42-48`](../../node_modules/nuxt/dist/app/composables/error.js)）                                   |
| 路由记录 `beforeEnter: () => false`                 | **无变化（200 + 取消后的当前路由）**                         | 是（静默取消）                        | 低                                      | Nuxt 显式忽略 abort failure（[`router.js:113`](../../node_modules/nuxt/dist/pages/runtime/plugins/router.js)）                                                                                                                            |
| `<script setup>` 里无条件 `navigateTo()`            | 302（默认）+ 丢弃 HTML，setup 继续                           | 是                                    | 最低                                    | 不中断 setup（除非开 `navigateToEarlyReturn`）；可能被后续代码覆盖（[navigateTo 文档](https://nuxt.com/docs/4.x/api/utils/navigate-to)）                                                                                                  |
| `routeRules.redirect`                               | 302（由规则产生）                                            | 是                                    | 配置一行                                | 只按 path 匹配，无法看 query（[`route-rules.mjs:25`](../../node_modules/@nuxt/nitro-server/dist/runtime/utils/route-rules.mjs)）                                                                                                          |
| `experimental.early404`                             | 404（路径无法匹配任何页面时）                                | 不适用                                | 配置一行                                | 只会提前 404 **未知路径**，对"存在但参数不全"的路径无效（[`early-404.js:12-39`](../../node_modules/nuxt/dist/runtime/server/renderer/early-404.js)）                                                                                      |

## 仍属产品决策

以下问题本次未做判断：

1. 缺参数时应当是 404、302 回首页、还是保留当前的空状态？三种都能实现，代价与语义不同（404 失去可索引的空页；302 会把"坏链接"变成"首页"，并让 CDN/监控看不到 404）。
2. 用 `validate`（就地声明、404）还是独立中间件（可重定向、可统一覆盖 `/dashboard/*`）？前者把规则散在各页，后者集中但要维护一份路由到参数形状的映射。
3. 需要 404 还是 400？语义上"请求缺少必需参数"更接近 400，但 `validate` 默认给 404，改成 400 需要显式返回 `{ status: 400 }`；是否需要为它单独写 `app/error.vue` 文案。
4. 客户端与服务端是否必须同构？如果选 `return false`，需要接受"服务端 404、客户端静默取消"的不对称，或改用 `throw createError({ fatal: true })` 统一。
5. `validate` 与 `auth.global.ts` 的先后（`validate` 先）。未登录用户访问缺参 URL 时，是先看到 404 还是先去登录？这决定是否要把参数校验挪到中间件并放在 auth 之后。
6. 空状态是否保留：404 之后这些页面体里的 "no repository" 空状态（如 `app/pages/dashboard/wiki.vue:107-123`）还要不要存在，还是只在"有 repo 但该 repo 无 wiki"时使用。
7. 标题回退行为：当前空标题会落到全局 `titleTemplate`（`app/composables/usePageMeta.ts`）。若采纳 404，则 `<title>` 由错误页决定，需要确认错误页的标题文案。
8. 是否顺带纳入 `nuxt.config.ts` 的 `robots.disallow`（`:291-293`）与 sitemap 策略；以及 i18n 下"重定向到哪个 locale 的哪一页"（默认 locale 还是 `to` 的 locale）。

## 未能验证的部分

- 未启动 dev server、未构建、未跑测试（按要求），因此**所有 HTTP 状态结论都来自源码路径推导，没有实测响应**。特别是"最终状态码 = 错误 statusCode"依赖 Nitro `defaultHandler` 的返回值，我只核对了 Nuxt 侧读取它的两处（[`error.mjs:38-41`](../../node_modules/@nuxt/nitro-server/dist/runtime/handlers/error.mjs)、[`:94`](../../node_modules/@nuxt/nitro-server/dist/runtime/handlers/error.mjs)），没有读到 Nitro 内部 `defaultHandler` 的实现。
- 先前审计称这些页面"永远停在 loading"。我只核对了页面代码（缺 `?repo` 时取数函数直接 `return`，`initialLoading` 依赖 `pagesLoading`），**没有在浏览器里复现**。页面侧的数据流可以静态证明它一定卡住：三个 composable 的 loading 初值都是 `true`（`app/composables/useRepoWiki.ts:13`、`app/composables/useRepoReleases.ts:31`、`app/composables/useRepoBranches.ts:8`），只在取数函数体内才置 `false`，而缺 `?repo` 时页面直接 `return` 从不发请求（如 `app/pages/dashboard/wiki.vue:111-116`），于是 `initialLoading` 恒为 `true`，`app/components/dashboard/overlay/DashboardOverlayFrame.vue:18-39` 用加载框替换整个 slot——那三段 `noRepo` 空状态因此不可达。`contributors.vue:65-70` 显式 `if (!repoTarget.value) return false`、`package.vue` 的 `loadingDetail` 初值为 `false`，这两页不在其列。框架层面缺参数与 loading 状态无关，这一点仍然成立。
- 路由记录级 `beforeEnter` 在首次 SSR `push`（[`router.js:120-125`](../../node_modules/nuxt/dist/pages/runtime/plugins/router.js)）期间执行、早于其它插件 setup，这一点是从插件 `order` 值（`nuxt:router` 为 `enforce: 'pre'` → `-20`，[`router.js:32-34`](../../node_modules/nuxt/dist/pages/runtime/plugins/router.js)、[`index.mjs:3579-3595`](../../node_modules/nuxt/dist/index.mjs)）与 `applyPlugins` 顺序推断的，未实测。
- `vue-router` 5.4.0 与 router.vuejs.org 文档版本的对应关系未核实；守卫返回值语义我按安装源码（`devtools-CxgSYwGp.js:549-566`）为准，文档只作旁证。
- 未验证 `future.compatibilityVersion: 5` 或 `experimental.inlineErrorRendering: true` 下上述状态码与错误页行为是否完全一致（只读了两个分支的源码，未实测）。
- 未验证 `@nuxtjs/i18n` 在 `detectBrowserLanguage.redirectOn` 等开启时的服务端 locale 重定向与本议题的交互（`nuxt.config.ts` 未配置该项）。
