# 依赖同步升级与优化评估（2026-11-04）

评估日期：2026-11-04。依据各包 GitHub Release / npm registry 元数据、上游 PR 与本仓库源码；版本号均以 `registry.npmjs.org` 查询结果为准。性能相关结论未在 GitPulse 上实测，除注明"实测"的条目外不代表已测量。

## 结论

八项依赖已升级并通过本仓库全部检查：`fmt:check`、`lint`、`nuxi typecheck`、`bun test --parallel`（1159 通过、0 失败）、扩展测试与扩展类型检查。依赖侧改动只有 `package.json` 与 `bun.lock`，没有业务代码改动。

其中 **`nuxt` 4.6.4 是安全版本**（Nuxt 8 条 advisory + Nitro 3 条 advisory），应优先合入，不需要业务代码改动。

本轮升级本身没有引入破坏性改动：[Nuxt 4.6.4 公告](https://github.com/nuxt/nuxt/releases/tag/v4.6.4)、[Shiki 4.6.0](https://github.com/shikijs/shiki/releases/tag/v4.6.0)、[Mermaid 12.3.0](https://github.com/mermaid-js/mermaid/releases/tag/mermaid%4012.3.0)、[Upstash Redis 1.41.0](https://github.com/upstash/redis-js/releases/tag/%40upstash%2Fredis%401.41.0)、[Lucide 1.68.0](https://github.com/lucide-icons/lucide/releases/tag/1.68.0)、[Prek 0.5.10](https://github.com/j178/prek/releases/tag/v0.5.10)、[Oxlint 1.91.0](https://github.com/oxc-project/oxc/releases/tag/oxlint_v1.91.0)、[Oxfmt 0.76.0](https://github.com/oxc-project/oxc/releases/tag/oxfmt_v0.76.0)。只有 Oxfmt 0.76.0 标注了 BREAKING，实测对本仓库无影响（见下）。

真正值得投入的改进不在版本同步，而在三处既有问题：**Oxlint 实际生效 0 条规则**、**原生登录 origin 校验依赖可伪造的 `x-forwarded-proto`**、**pre-commit 每次全量跑格式与 lint**。

## 升级结果

| 依赖                    | 升级前           | 升级后           | 性质                                        |
| ----------------------- | ---------------- | ---------------- | ------------------------------------------- |
| `nuxt`                  | 4.6.3            | 4.6.4            | 安全版本，含行为变更                        |
| `nitropack`（传递依赖） | —                | 2.13.6           | 随 Nuxt 4.6.4 提升，安全版本                |
| `@lucide/vue`           | 1.66.0           | 1.68.0           | 图标重命名（保留别名）+ 新图标              |
| `@upstash/redis`        | 1.40.0           | 1.41.0           | 新增能力（本项目未使用）+ 包体积上升        |
| `mermaid`               | 12.2.0           | 12.3.0           | 新图形能力 + DOMPurify 安全修复             |
| `shiki`                 | 4.5.0            | 4.6.0            | 缺陷修复 + 性能优化                         |
| `@j178/prek`            | 0.5.9            | 0.5.10           | 新增内置 hook、下载逻辑修复                 |
| `oxlint`                | 1.90.0           | 1.91.0           | 规则选项、大量性能优化                      |
| `oxfmt`                 | 0.75.0 → `^0.75` | 0.76.0 → `^0.76` | **BREAKING**（HTML 类文件换用新 formatter） |

`oxfmt` 的 `^0.75.0` 无法跨越到 0.76（0.x 的 caret 锁 minor），因此 `package.json` 区间需显式改为 `^0.76.0`。`oxlint-tsgolint` 未改动：Oxlint 1.91.0 要求 `>=7.0.2005`，仓库已是 7.0.2005，且上游 latest 仍是 7.0.2005（[npm 元数据](https://registry.npmjs.org/oxlint-tsgolint)）。

## 各包变更与对本项目的影响

### nuxt 4.6.4（安全版本）

八条 Nuxt advisory 加上 `nitropack` 2.13.6 的三条 Nitro advisory，覆盖 Vite 开发服务器读取客户端错误报告路径、开发态泄漏生成的 app secret、路径点段处理、页面岛的 redirect 路由规则、缓存处理器跨方法与跨用户复用、`proxy`/`redirect` 路由规则的越界与开放重定向。生产环境报错渲染同时被收紧：未通过 `createError` 创建的错误只保留 `createError` 的 message 与 data，其余内容被剥离。

对本项目：`app/error.vue` 完全由 `error.statusCode` 与 i18n 文案决定展示，不渲染 `error.message` 或 `error.data`，因此该收紧不影响错误页。下文「需要人工确认的行为变化」列出其余四条。

### nitropack 2.13.6

`cache`/`swr`/`isr` 路由规则只缓存 `GET`/`HEAD`，且不再存储设置 Cookie 或声明 `private`/`no-store` 的响应；通配 `proxy`/`redirect` 规则校验最终目标是否仍在规则作用域内。

对本项目：`nuxt.config.ts` 的 `routeRules` 没有 `cache`/`swr`/`isr`，`server/` 下也没有 `defineCachedEventHandler`/`defineCachedFunction`，因此只获得加固，不改变缓存行为。

### shiki 4.6.0

修复：later-loaded grammar 的 injection、rehype 代码块之间的缓存键碰撞、`ShikiStreamTokenizer` 与 `codeToTokens` 的偏移/CRLF 一致性、单主题内联 token 样式转 class。性能：多 decoration 渲染改为线性时间；Oniguruma WASM 改为 gzip 并异步加载（[v4.6.0](https://github.com/shikijs/shiki/releases/tag/v4.6.0)）。

对本项目：有两处高亮引擎。`app/components/ui/MarkdownRenderer.vue` 经 `comark/plugins/shiki` 使用 Comark 的模块级 highlighter，语言与主题按需动态导入并缓存；`app/components/dashboard/repo-files/RepoFileView.vue` 另外 `createHighlighter(...)`（走 Oniguruma WASM）。WASM 异步加载属于升级自动获得的改动，主线程阻塞是否减少需实测。

### mermaid 12.3.0

新增 BPMN 形状、open-arrow/hollow-circle 边标记、流程图 step 动画与 `flowchart.stepDuration`/`stepNumbers`；修复 swimlane 布局、ELK 0.10+ 边交叉等。安全：DOMPurify 升到 3.4.17 修复 GHSA-55q2-fjhq-7xh7 与 GHSA-6688-9rhm-gjv2。其他：移除 `uuid` 依赖与未使用的旧 ER 渲染器，`elkjs` 0.9.3→0.12.0（许可证 `EPL-2.0 OR GPL-3.0-or-later`）。

一处解析收紧：edge ID 不再允许包含 `[ ] ( ) { } |`。本仓库没有手写的 Mermaid 图源（`shared/utils/mermaid-preview-height.ts` 只按图类型首行估算高度），渲染的图来自 wiki 与 Markdown 内容，因此仅当上游/用户内容使用这类 edge ID 时才会受影响。

DOMPurify 升级与本项目直接相关：`app/components/ui/MermaidBlock.vue` 与 `MermaidViewerModal.vue` 都把 `mermaid.render()` 的 SVG 结果交给 `v-html`。

### @lucide/vue 1.68.0

1.68.0 把 `*-warning`、`*-alert` 系列改名为 `*-exclamation-point`；1.67.0 新增 `globe-ban`、`globe-plus`、`diagram-flow-horizontal/vertical` 等（[1.68.0](https://github.com/lucide-icons/lucide/releases/tag/1.68.0)、[1.67.0](https://github.com/lucide-icons/lucide/releases/tag/1.67.0)）。

实测：升级后 `@lucide/vue` 仍导出 6935 个符号，`AlertCircle`/`AlertCircleIcon`/`AlertTriangle`/`AlertTriangleIcon` 全部保留（旧名为别名），因此本仓库使用的 `AlertCircleIcon`、`AlertTriangleIcon` 未失效，`nuxi typecheck` 通过。

图标的规范名取自图标源文件名，别名只是指向同一组件对象的 re-export。`dist/lucide-vue.d.ts` 中的实际映射：

| 别名（旧名）                      | 规范名                     |
| --------------------------------- | -------------------------- |
| `AlertCircle` / `CircleAlert`     | `CircleExclamationPoint`   |
| `AlertTriangle` / `TriangleAlert` | `TriangleExclamationPoint` |
| `AlertOctagon` / `OctagonAlert`   | `OctagonExclamationPoint`  |

（各自带 `Icon` 后缀的形式映射相同。）运行时同一性可验证：`AlertCircleIcon === CircleExclamationPointIcon`、`AlertTriangleIcon === TriangleExclamationPointIcon` 均为 `true`。

### 已执行的别名迁移

仓库原先混用了大量遗留别名。本次按"词根用规范名、统一保留 `Icon` 后缀"一次性迁移，覆盖 71 个文件。`X` 与 `XIcon` 在包内是同一个组件对象（实测 2309 组全部配对、无例外），后缀只是避免与普通词冲突的风格选择，因此保留后缀与周边代码一致。

| 旧写法                       | 迁移后                          |
| ---------------------------- | ------------------------------- |
| `AlertCircleIcon`            | `CircleExclamationPointIcon`    |
| `AlertTriangleIcon`          | `TriangleExclamationPointIcon`  |
| `Loader2Icon`                | `LoaderCircleIcon`              |
| `CheckCircle2Icon`           | `CircleCheckIcon`               |
| `CheckCircleIcon`            | `CircleCheckBigIcon`            |
| `UnlockIcon`                 | `LockOpenIcon`                  |
| `FilterIcon`                 | `FunnelIcon`                    |
| `BookMarkedIcon`             | `BookBookmarkIcon`              |
| `Code2Icon`                  | `CodeXmlIcon`                   |
| `GitCommitIcon`              | `GitCommitHorizontalIcon`       |
| `ShieldAlertIcon`            | `ShieldExclamationPointIcon`    |
| `Users2Icon`                 | `UsersRoundIcon`                |
| `HomeIcon`                   | `HouseIcon`                     |
| `MoreHorizontalIcon`         | `EllipsisIcon`                  |
| `Trash2Icon`                 | `TrashIcon`                     |
| `XCircleIcon`                | `CircleXIcon`                   |
| `SmilePlusIcon`              | `FaceSlightlySmilingPlusIcon`   |
| `HistoryIcon`                | `RotateCcwClockIcon`            |
| `WrapTextIcon`               | `TextWrapIcon`                  |
| `CheckSquareIcon`            | `SquareCheckBigIcon`            |
| `FileAudioIcon`              | `FileHeadphoneIcon`             |
| `FileVideoIcon`              | `FilePlayIcon`                  |
| `Tags`                       | `TagsIcon`（仅补后缀）          |
| `RotateCcw as RotateCcwIcon` | `RotateCcwIcon`（去掉自我别名） |

每组映射都验证了新旧名指向同一组件对象，因此渲染结果不变。测试里按名字 mock `@lucide/vue` 的键同步更新，`bun test --parallel` 1159 项全部通过。

### @upstash/redis 1.41.0

功能上新增 `s.hybrid()` 与 `$ann`/`$rrf`/`$standard` retriever（本项目只用 `eval`/`get`/`set`）。补丁项把 TypeScript 源码与 Redis SDK 文档打进 npm 包，供离线参考与编码代理使用。

代价是包体积：unpacked 由 1184.5 KB（18 个文件）增至 2126.4 KB（476 个文件）（[1.40.0](https://registry.npmjs.org/@upstash/redis/1.40.0)、[1.41.0](https://registry.npmjs.org/@upstash/redis/1.41.0)）。本项目 `server/utils/user-settings-storage-utils.ts` 静态导入该包，self-hosted 镜像与 `bun install` 的 node_modules 体积会随之增加约 1 MB。

### prek 0.5.10

新增内置 `replace-pattern` hook；默认不再下载 Node 预发布版，并跳过没有兼容归档的 Node release（[v0.5.10](https://github.com/j178/prek/releases/tag/v0.5.10)）。`prek.toml` 无需改动。

### oxlint 1.91.0

新增 `react/capitalized-calls` 的 `allow`/`allowPattern`，`unicorn/no-useless-error-capture-stack-trace` 与 `typescript/no-non-null-asserted-nullish-coalescing` 迁到 suspicious 分类，React Compiler 规则只在含顶层组件或 hook 的文件运行；数十条 allocation/dispatch 优化（[oxlint_v1.91.0](https://github.com/oxc-project/oxc/releases/tag/oxlint_v1.91.0)）。规则集合变化未触发本仓库任何诊断。

### oxfmt 0.76.0（BREAKING）

`parser: html` 的文件改由新的 `oxc_formatter_htmlish` 处理，另修复箭头函数体括号、私有字段括号、markdown 指令忽略区间等（[oxfmt_v0.76.0](https://github.com/oxc-project/oxc/releases/tag/oxfmt_v0.76.0)）。

实测无影响：`.oxfmtrc.json` 没有配置 parser 映射，仓库内 `.html` 只有 4 个（`extension/entrypoints/options/index.html`、`extension/entrypoints/popup/index.html`，以及 `.agents/skills/skill-creator` 下 2 个资产），升级后 `bun run fmt:check` 在 878 个文件上通过。

## 需要人工确认的行为变化

以下四条来自 Nuxt 4.6.4 公告，会影响 self-hosted 部署而不是类型或测试结果。

### 1. 原生登录的 origin 校验依赖可伪造的 `x-forwarded-proto`

`server/utils/native-login-handoff.ts:184` 的 `requireOrigin()` 用 `getRequestURL(event).origin` 与浏览器提交的 `origin` 比对。该文件从 `h3` 直接导入 `getRequestURL`，而 h3 v1 的默认行为是**只要请求头带 `x-forwarded-proto: https` 就采信**（`node_modules/h3/dist/index.mjs:319-336`）。

Nuxt 4.6.4 恰好把 `nuxt/server` 的请求 helper 改成默认不采信该头（[PR #36818](https://github.com/nuxt/nuxt/pull/36818)）：`getRequestURL`/`getRequestProtocol` 除非显式传 `{ xForwardedProto: true }`，否则忽略转发头。也就是说，同一份代码里 Nuxt 自己的 helper 已经收紧，本项目这处直接调用 h3 的判定仍是宽松的。

后果有两面：一是服务在 TLS 终止代理之后时，若把这里的调用改成 Nuxt helper 或显式传 `{ xForwardedProto: false }`，`origin` 会退化成 `http://host`，原生登录握手会以 403 失败；二是现状下客户端可以直接伪造该头，让 `origin` 变成 `https://host`。第二条的严重性有限（还有 CSRF 双提交与浏览器批准流程兜底），但它是本次升级明确加固的同类问题。

建议方向：`requireOrigin()` 比对 `NUXT_SITE_URL` 的规范 origin（`shared/utils/canonical-origin.ts`，生产环境缺值即拒绝启动，见 [ADR 0041](../adr/0041-canonical-origin.md)），而不是从请求推导。这既消除了伪造面，也消除了代理部署下 proto/host 推导的不确定性。属行为改动，需先确认多 host 部署场景。

### 2. `devServer.allowedHosts`

Webpack/rspack 开发服务器开始拒绝 `Host` 头不匹配的请求（Vite 此前已如此）。若用隧道或自定义域名跑 `bun run dev`，需要在 `devServer.allowedHosts` 里登记。

### 3. 编码斜杠与 `/api/**` 的匹配

4.6.4 起路由规则匹配带编码斜杠的路径（`/api%2Fadmin` 现在命中 `/api/**`）。而 `server/middleware/csrf.ts:25` 判断"是否是 `/api` 请求"用的仍是原始字符串前缀：`event.path`/`req.url` 以 `/api/` 开头才算。两层对"这是不是一个 `/api` 路径"的定义不再一致。

这是既有实现而非本次升级引入，但升级后两侧语义开始分叉，属于值得单独验证并由测试固定下来的边界：用一个规范化后的 pathname（解码、折叠重复斜杠）判定，比字符串前缀更可靠。

### 4. `workspaceDir` 探测收紧

未设置 `workspaceDir` 时，Nuxt 只在显式 workspace 根或最近的 git 仓库处扩大它。本仓库是单一 git 仓库，位于 `rootDir`，无需配置。

## 可优化项

### 高价值

**1. Oxlint 当前实际生效 0 条规则。**

```
$ bun run lint
Found 0 warnings and 0 errors.
Finished in 2.1s on 748 files with 0 rules using 16 threads.
```

`.oxlintrc.json` 把 `categories.correctness` 设为 `off`、`plugins` 设为 `[]`，`overrides` 里只对 5 条 unicorn 规则写 `off`。插件被启用并不会启用其规则，规则严重度由 category 决定，因此最终生效规则数为 0。实测验证：在 `app/utils/__lint_probe.ts` 写入 `debugger`、`var`、`==`、空语句块后运行 `oxlint --type-aware`，输出 0 条诊断；`oxlint --print-config <绝对路径>` 显示该文件的有效配置为 `plugins: ["unicorn"]`、`rules:` 只有 3 条 `allow`、顶层 `correctness: "allow"`。

也就是说 `bun run lint`、`pre-commit`、CI 的 lint 步骤目前都是空跑。这是全仓库最大的质量门禁缺口，且与 `AGENTS.md` 的描述相反（见下文一致性一节）。

建议：把 `categories.correctness` 改为 `warn` 或显式列出规则集，跑一次统计 backlog 再决定是否 `--fix` 或分批豁免；这属于会新增数百条诊断的改动，需要先看数量与类型再定策略，不适合和其他改动混在一个 PR。

**2. pre-commit 钩子每次全量运行。**

`prek.toml` 的 `oxfmt-check` 与 `oxlint-check` 都是 `pass_filenames = false`、`always_run = true`，于是每次提交都要跑 `bun run fmt:check`（878 个文件，约 3.4s）和 `bun run lint`（748 个文件，约 2.1s），实测合计约 5.5s，与本次改动无关的文件也要重跑。

建议：让 `oxfmt` 只接收暂存文件（`pass_filenames = true` 并使用 `oxfmt --check` 的路径参数），`oxlint` 同理；类型感知检查这类需要全项目的步骤留在推送前或 CI。代价是钩子不再能发现"本次提交之外"的格式漂移——若这是刻意保留的意图，就不必改。

**3. 原生登录 origin 校验改为规范 origin。** 见上文「需要人工确认的行为变化」第 1 条。

### 中等价值

**4. Mermaid 走完整包动态导入。** `MermaidBlock.vue:45` 与 `MermaidViewerModal.vue:229` 都是 `await import('mermaid')`，即完整 `mermaid` 包（unpacked 120.7 MB 的源码树里实际进包的只是其中一部分，但入口是全量）。仓库只渲染 wiki/Markdown 里的 `flowchart`/`sequenceDiagram` 等有限图类型。可行方向是用 core 入口只注册用到的图类型，或改用 `@mermaid-js/tiny`。12.3.0 移除 `uuid` 依赖已经带来一部分体积收益。这属于需要实测 chunk 体积与首渲染耗时的改动，不应凭直觉替换。

**5. Shiki 存在两套 highlighter。** Markdown 走 Comark 的模块级 highlighter（按语言/主题懒加载并缓存），`RepoFileView.vue` 另建 `createHighlighter(...)`。两处都会加载 Oniguruma WASM。若确实存在"先看 Markdown 再看文件"的路径，可考虑共享一个 highlighter 实例，省一次 WASM 加载；需要先确认两者的语言/主题注册策略能共存（Comark 的 highlighter 是模块级、且已被序列化写入，直接复用会牵动并发注册逻辑，`MarkdownRenderer.vue:98-103` 的注释说明了这一点）。

**6. `@upstash/redis` 与 `redis` 同时静态导入。** `server/utils/user-settings-storage-utils.ts:1-2` 顶部同时静态导入两个驱动，运行时只用一个。驱动的实际成本取决于部署 preset（node-server 下两者是 external，不进 bundle），所以收益主要在 serverless/edge 构建与冷启动上；若只面向 node 部署，优先级低于第 1、2 项。另一面是 1.41.0 让该包 unpacked 体积近乎翻倍（见上），这是升级已付出的成本，不回退。

**7. Lucide 别名迁移 —— 已执行。** 全仓库共有 23 组遗留写法（不止最初发现的 alert 两个），已在同一个改动里统一迁移为规范名并保留 `Icon` 后缀，明细见上文「已执行的别名迁移」。别名是历史兼容层而非长期契约，位于 `@lucide/vue` 的 `X as Y` 重导出，未来大版本清理时不会产生集中报错。

### 本轮未处理

`bun outdated` 在八项之外还列出三项，均不属于本次要求范围：

| 依赖            | 当前    | 最新    | 说明                                           |
| --------------- | ------- | ------- | ---------------------------------------------- |
| `markdown-exit` | 1.3.0   | 2.1.3   | 精确锁定的大版本跳跃，需单独评估渲染管线兼容性 |
| `typescript`    | 6.0.3   | 7.0.2   | 此前升级记录中明确保留，未在本轮改动           |
| `sass-embedded` | 1.100.0 | 1.107.1 | 同上，精确锁定并保留                           |

## 与仓库文档不一致之处

1. `AGENTS.md` 的「Linting, Formatting, Hooks」写"source files enable the `unicorn` plugin with a few rules disabled"，给人的印象是 unicorn 规则在生效、另有 5 条被关闭。实际配置下 unicorn 规则一条也不生效（`categories.correctness` 为 `off`），被"关闭"的 5 条本来也不会触发。
2. `CONTRIBUTING.md` 把 `bun run lint` 列为 pre-commit 与 pre-PR 检查，但没有说明它当前不产生任何诊断；按现状执行这些检查会得到"通过"，与"lint 通过"的通常含义不同。

两处都需要在确定 lint 策略后一并更新，而不是先改文档。

## 验证记录

环境：Windows，Node v26.12.1，bun 1.4.4。

- `bun run fmt:check`：通过，878 个文件。
- `bun run lint`：通过，748 个文件，**0 条规则生效**（见可优化项第 1 条）。
- `bunx nuxi typecheck`：通过（exit 0）。
- `bun test --parallel`：1159 通过、0 失败、3449 个断言、145 个文件。
- `bun run extension:test`：16 通过、0 失败。
- `bun run extension:typecheck`：通过。

按仓库约定未运行本地 production build，也未做浏览器测试；因此上述结果证明依赖与类型兼容，不证明运行时行为或性能改进。

安装期有两处环境噪音，与代码无关：`prepare` 脚本的 `prek install` 因 `%LOCALAPPDATA%\prek\prek.log` 拒绝访问而失败；`nuxt-skill-hub` 生成技能目录时出现一次目录 `rename` 的 EPERM。重跑 `nuxi prepare` 后类型生成正常，所有检查基于该次结果。

## 来源

- Nuxt 4.6.4：https://github.com/nuxt/nuxt/releases/tag/v4.6.4 ；行为变更 PR：https://github.com/nuxt/nuxt/pull/36818
- Nitro 2.13.6：https://github.com/nitrojs/nitro/releases/tag/v2.13.6 ；advisory：GHSA-39r7-wfcx-99xg、GHSA-rhhp-7488-3qwf、GHSA-pqxc-r4h5-jc95
- Shiki 4.6.0：https://github.com/shikijs/shiki/releases/tag/v4.6.0
- Mermaid 12.3.0：https://github.com/mermaid-js/mermaid/releases/tag/mermaid%4012.3.0
- Upstash Redis 1.41.0：https://github.com/upstash/redis-js/releases/tag/%40upstash%2Fredis%401.41.0 ；体积：https://registry.npmjs.org/@upstash/redis/1.41.0
- Lucide 1.68.0 / 1.67.0：https://github.com/lucide-icons/lucide/releases/tag/1.68.0 、https://github.com/lucide-icons/lucide/releases/tag/1.67.0
- Prek 0.5.10：https://github.com/j178/prek/releases/tag/v0.5.10
- Oxlint 1.91.0：https://github.com/oxc-project/oxc/releases/tag/oxlint_v1.91.0
- Oxfmt 0.76.0：https://github.com/oxc-project/oxc/releases/tag/oxfmt_v0.76.0
- h3 v1 转发头默认行为：`node_modules/h3/dist/index.mjs:319-336`（`getRequestProtocol` 仅在 `opts.xForwardedProto === false` 时不采信该头）
