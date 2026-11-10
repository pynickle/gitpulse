# comark / @comark/nuxt 0.8.1 → 0.9.0 升级评估

评估日期：2026-11-10。依据 [comark v0.9.0 发布说明](https://github.com/comarkdown/comark/releases/tag/v0.9.0)、npm registry 元数据（[comark](https://registry.npmjs.org/comark)、[@comark/nuxt](https://registry.npmjs.org/@comark%2Fnuxt)、[@comark/vue](https://registry.npmjs.org/@comark%2Fvue)、[markdown-exit](https://registry.npmjs.org/markdown-exit)）、0.8.1 与 0.9.0 的发布包本身（`https://registry.npmjs.org/comark/-/comark-0.9.0.tgz` 等，下文以「tarball 内 `<路径>`」引用），以及本仓库工作树的实际内容。凡标「确认」的条目都在发布包代码/d.ts 或本仓库文件里直接读到；标「推断」的条目是按规则推导、未在 GitPulse 上运行验证。

**注意**：评估期间工作树里已存在一套未提交的升级改动（`package.json`、`app/components/ui/MarkdownRenderer.vue`、`shared/utils/release-note-search-text.ts`）。本文以**工作树当前内容**为准，在「工作树现状」一节逐项复核这些改动；复核之后已执行安装与验证，实测结果记在「是否适合升级」一节。

## 结论

**升级成立，且已完成安装与验证：类型检查与 lint 通过，1298 个测试全绿，`markdown-exit` 只装一份 2.1.0。** 决定性因素有两个。

其一是 `markdown-exit`：`comark@0.9.0` 把它从 `1.3.0` 改成精确 pin `2.1.0`（因为 `dist/types.d.ts` 要 `import type … from 'markdown-exit/core'`，而该子入口是 2.1.0 才有的），本仓库又把它作为直接依赖精确锁在 `1.3.0`。工作树已把直接依赖改成 `"2.1.0"` —— 正好与 comark 的 pin 同版本，因此只会装一份；若改成 `"2.1.3"` 则**不能**去重，comark 仍会嵌套自己的 2.1.0。

其二是实际 API 面：本仓库用到的 `parseMarkdown`、`Node`/`ElementNode`/`MarkdownDocument` 形状、`comark/plugins/security` 的选项、`comark/plugins/shiki` 的 `highlightCodeBlocks` 选项与返回类型、`<MarkdownDocument :value :components>`，在 0.9.0 全部逐字节未变或仅新增可选字段，业务代码零改动风险；唯一的行为变化是 linkify 默认值（`linkify-it` 6 关掉 fuzzy），工作树已用 `linkify({ fuzzyLink: true })` 显式恢复。

收益不是新功能而是安全：0.9.0 修掉了 comark 自带 shiki 语法的正则指数回溯（#523），而本仓库正是用这套语法渲染不可信的 README。

`^0.8.1` 在 0.x 下等价于 `>=0.8.1 <0.9.0`（[node-semver caret 规则](https://github.com/npm/node-semver#caret-ranges-123-025-004)），`package.json` 必须显式改写，`bun install` 不会自己跨到 0.9.0 —— 工作树已改。

## 0.8.1 与 0.9.0 事实对照

| 项目                        | 0.8.1                                                                                                  | 0.9.0                                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `comark` 发布时间           | 2026-10-21T12:49:59Z                                                                                   | 2026-11-06T14:15:10Z（`dist-tags.latest`）                                                                                                                 |
| `@comark/nuxt` 发布时间     | 2026-10-21T13:01:31Z                                                                                   | 2026-11-06T14:19:45Z                                                                                                                                       |
| `@comark/vue` 发布时间      | 2026-10-21T12:51:34Z                                                                                   | 2026-11-06T14:15:42Z                                                                                                                                       |
| `comark` dependencies       | `entities ^8.1.0`、`js-yaml ^5.4.2`、`markdown-exit 1.3.0`                                             | `character-entities ^2.0.2`、`character-entities-legacy ^3.0.0`、`js-yaml ^5.5.0`、`linkify-it ^6.0.0`、`markdown-exit 2.1.0`                              |
| `comark` peerDependencies   | `shiki ^4.4.3`、`katex ^0.18.7`、`rangi ^2.2.0`、`beautiful-mermaid ^1.1.3`（均 optional）             | `shiki ^4.5.0`、`katex ^0.19.1`、`rangi ^2.2.0`、`beautiful-mermaid ^1.1.3`（均 optional）                                                                 |
| `comark` exports            | `.`、`./plugins/*`、`./utils`、`./utils/trace`、`./parse`→`dist/parse.js`、`./render`→`dist/render.js` | 新增 `./core`、`./auto-close`、`./context`、`./render/html`；`./parse`→`dist/index.js`、`./render`→`dist/render/index.js`；`./utils` 与 `./plugins/*` 不变 |
| `@comark/nuxt` dependencies | `comark 0.8.1`、`@comark/vue ^0.8.1`、`@nuxt/kit 4.6.1`                                                | `comark 0.9.0`、`@comark/vue 0.9.0`、`@nuxt/kit 4.6.4`                                                                                                     |
| `@comark/nuxt` peer         | `nuxt ^4.0.0`                                                                                          | `nuxt ^4.6.3`（本仓库装的是 `nuxt 4.6.4`，满足）                                                                                                           |
| `comark` 体积（unpacked）   | 496,946 B / 180 文件（tgz 126,368 B）                                                                  | 433,765 B / 169 文件（tgz 110,167 B）——变小，因为不再发布 `skills/`                                                                                        |
| `@comark/nuxt` 体积         | 13,143 B / 59 文件                                                                                     | 13,737 B / 65 文件（多出 3 个插件再导出桩）                                                                                                                |

每版元数据可直接查：[comark@0.8.1](https://registry.npmjs.org/comark/0.8.1)、[comark@0.9.0](https://registry.npmjs.org/comark/0.9.0)、[@comark/nuxt@0.9.0](https://registry.npmjs.org/@comark%2Fnuxt/0.9.0)、[@comark/vue@0.9.0](https://registry.npmjs.org/@comark%2Fvue/0.9.0)。

## 工作树现状

工作树已有三处未提交改动；复核时 `node_modules` 与 `bun.lock` 仍是 0.8.1，随后已安装，结果见本节末尾。

### `package.json`

```diff
-    "@comark/nuxt": "^0.8.1",
+    "@comark/nuxt": "^0.9.0",
-    "comark": "^0.8.1",
+    "comark": "^0.9.0",
-    "markdown-exit": "1.3.0",
+    "markdown-exit": "2.1.0",
```

复核：**正确，且是唯一能去重的写法**。comark 的 pin 是精确 `"2.1.0"`，两者同版本才会只装一份（推断：未执行安装，按「每个解析后版本一份」的规则推导）。写成 `"2.1.3"` 会得到两份。

### `app/components/ui/MarkdownRenderer.vue`

```diff
+import linkify from 'comark/plugins/linkify';
 import security from 'comark/plugins/security';
 ...
 function createMarkdownPlugins() {
   return [
+    // linkify-it 6 turns fuzzy matching off, which would stop `www.` links and bare
+    // domains from being linked. Keep fuzzy on; `urlAuth` stays off so `user:pass@`
+    // URLs are not linked.
+    linkify({ fuzzyLink: true }),
     security({
-      blockedTags: ['script', 'style', 'iframe', 'object', 'embed'],
+      blockedTags: ['script', 'style', 'iframe', 'object', 'embed', 'link', 'base', 'meta'],
       allowedProtocols: ['http', 'https', 'mailto', 'tel'],
       allowDataImages: false,
     }),
```

复核三点：

1. **`linkify({ fuzzyLink: true })` 会生效，不会被默认插件顶掉。** `comark@0.9.0` tarball 内 `dist/utils/helpers.js` 的 `dedupePlugins` 先放默认插件、再按 `name` 覆盖：

   ```js
   for (const plugin of defaultPlugins) plugins.set(plugin.name, plugin);
   for (const plugin of userPlugins) {
     if (seenUserPlugins.has(plugin.name)) continue;
     seenUserPlugins.add(plugin.name);
     plugins.delete(plugin.name);
     plugins.set(plugin.name, plugin);
   }
   ```

   用户插件 `linkify` 与默认插件同名，会被 `delete` 后重新 `set`，因此 `fuzzyLink: true` 覆盖默认值。「确认」。

2. **新增的三个 `blockedTags` 合法。** `SecurityOptions.blockedTags?: string[]`，语义是「整棵子树移除」，`link`/`base`/`meta` 属 HTML 文档级标签，README 里本不该出现，挡住无害。
3. **行为结果**：`www.example.com` 等裸域名恢复成链（与 0.8.1 及 GitHub GFM 的 autolink 扩展一致），`user:pass@host` 形式仍不链（`urlAuth` 保持关闭）——这是对 GitHub 的一处刻意偏离，可接受。

### `shared/utils/release-note-search-text.ts`

```diff
-// The default image-alt renderer omits inline code. Keep that readable content.
-const renderImageText = markdown.renderer.renderInlineAsText.bind(markdown.renderer);
-markdown.renderer.renderInlineAsText = (tokens, options, env) => {
-  for (const token of tokens) {
-    if (token.type === 'code_inline') token.type = 'text';
-  }
-  return renderImageText(tokens, options, env);
-};
```

复核：**正确，因为 `markdown-exit` 2.1.0 自己处理了 `code_inline`。** 两个版本 `renderInlineAsText` 的 `switch` 差别正在这里（tarball 内 `dist/index.js` 与 `dist/index.core-*.js`）：

```js
// 1.3.0
case "text":
    result += token.content;
    break;
// 2.1.0
case "text":
case "code_inline":
    result += token.content;
    break;
```

1.3.0 的 `code_inline` 落进 `default`（不输出），所以当初需要在调用前把 token 改写成 `text`；2.1.0 已内置，覆盖层成为死代码，删除后输出不变。`tests/release-note-search-text.test.ts:28` 用 `![*strong* **alt** \`code\`](…)`→`'strong alt code'` 钉住了这条行为。

### `bun.lock` 与 `node_modules`（已安装）

安装后实测：`comark@0.9.0`、`@comark/nuxt@0.9.0`、`@comark/vue@0.9.0`、`markdown-exit@2.1.0`、`linkify-it@6.1.0`。`bun.lock` 里 `markdown-exit` 只有一条 `2.1.0` 记录，`node_modules/comark/node_modules` 下也没有副本 —— 即「精确 `2.1.0` 与 comark 的 pin 同版本 → 只装一份」这条推断成立。

`katex` 仍是 `0.18.11`（由 `mermaid@12.3.0` 的 `katex ^0.18.0` 带入），与 comark/vue 的 optional peer `^0.19.1` 不匹配；`bun install` 未因此报错，也没有额外装一份 0.19。math 插件未注册，运行时不涉及。

## 上游变更

总表。状态「不相关」= 变更成立，但本仓库没有使用该入口。

| #   | 变更                                                            | 0.8.1 → 0.9.0 的具体差异                                                                                   | 状态   |
| --- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------ |
| 1   | linkify 改为默认插件，`linkify-it` 6，fuzzy 默认关              | 默认插件数组新增 `linkify()`；`linkify-it` 5 → 6                                                           | 确认   |
| 2   | 移除 `ParserOptions.html`                                       | `types.d.ts` 删除 `html?: boolean`；默认插件仍含 `html()`                                                  | 确认   |
| 3   | HTML 属性值按浏览器属性语义解码                                 | `internal/parse/utils.js`：`decodeHTML(value)` → `decodeHTMLAttribute(value)`，新增 `internal/entities.js` | 确认   |
| 4   | `comark/utils` 移除 `decodeHTML` 再导出；`textContent` 选项改名 | `textContent(node, { decodeUnicodeEntities })` → `textContent(node, { decodeHTML })`                       | 确认   |
| 5   | `@comark/html/render` 不再整体再导出 `comark/render`            | 发布说明与 `@comark/html` 包                                                                               | 不相关 |
| 6   | `markdown-exit` 1.3.0 → 精确 `2.1.0`                            | `package.json` dependencies；2.1.0 才提供 `markdown-exit/core`                                             | 确认   |
| 7   | `headings` 插件改名 `title-description`                         | `plugins/headings.js` 退化为 3 行再导出并标 `@deprecated`                                                  | 确认   |
| 8   | 新增 `comark/core` 入口                                         | 无默认插件、无内置 auto-closer 的解析器                                                                    | 确认   |
| 9   | 新增 `transformNode` 渲染钩子                                   | `RendererOptions.transformNode?`；`@comark/vue` 的 `MarkdownDocument` 增加同名可选 prop                    | 确认   |
| 10  | 新增 `heading-links` 插件                                       | tarball 新增 `plugins/heading-links.{js,d.ts}`                                                             | 不相关 |
| 11  | math：`\(…\)`、`\[…\]` 定界符；弃用 `renderMath`/`validateMath` | `plugins/math.js`、`internal/parse/tree.js`（`mathAttributes` 增加 `$: { markup }`）                       | 不相关 |
| 12  | shiki：合并 transformer 加到行上的 class                        | `hastToNode` 增加 `if (Array.isArray(props.class)) props.class = props.class.join(' ')`，消费点随之简化    | 确认   |
| 13  | shiki：组件属性正则指数回溯修复（#523）                         | `plugins/shiki/language-comark.js`：`(?:[^{}'"]+\|…)` → `(?:[^{}'"]\|…)`                                   | 确认   |
| 14  | parse：保留组件与强调内部的内联 HTML                            | `internal/parse/tree.js` 引入 `htmlStack` 深度追踪与 `closeHtmlFrames()`，替换 `insideMarkdownContainer`   | 确认   |
| 15  | `AutoCloseFunction` 增加 `streaming` 第二参数                   | `(markdown: string) => string` → `(markdown, streaming?: boolean) => string`                               | 不相关 |
| 16  | 不再随包发布 agent skills（#569）                               | `files: ["dist","skills"]` → `["dist"]`                                                                    | 不相关 |

### 1. linkify：默认插件化 + `linkify-it` 6

0.9.0 `dist/index.js` 的默认插件数组：

```js
const defaultPlugins = [
  ...((linkifyOption ?? registerDefaults) ? [linkify()] : []),
  ...(registerDefaults
    ? [frontmatterPlugin(), html(), alert(), taskList(), components(), attributes()]
    : []),
];
```

`dist/plugins/linkify.d.ts` 的注释写明：「Converts URLs with a scheme (`https://comark.dev`) and emails into links. Bare domains (`www.example.com`) need `fuzzyLink: true`」，选项类型直接复用 linkify-it 的 `LinkifyOptions`。

关键细节：0.8.1 `dist/parse.js` 里是 `const linkify = options.linkify ?? true` + `new MarkdownExit({ linkify })`，即**旧版本来就默认自动链接**，只是走 `linkify-it` 5。所以 0.9.0 不是「新增自动链接」，而是「同一行为换了 `linkify-it` 6 的默认值」；发布说明把它列为 breaking 是准确的。

### 2. `markdown-exit` 精确 pin 到 2.1.0（决定性）

`comark@0.9.0` 的 `dependencies.markdown-exit` 是 `"2.1.0"`（无 caret）。原因在类型里：`dist/types.d.ts` 第 2–3 行的导入从 `'markdown-exit'` 改成 `'markdown-exit/core'`。

`markdown-exit` 的导出表（[registry](https://registry.npmjs.org/markdown-exit/2.1.0)）证实了这个大版本的必要性：

| 版本  | 导出                                | dependencies                                                                        |
| ----- | ----------------------------------- | ----------------------------------------------------------------------------------- |
| 1.3.0 | `.`、`./package.json`               | `mdurl ^2.0.0`、`entities ^7.0.0`、`uc.micro ^2.1.0`、`linkify-it ^5.0.1`…          |
| 2.0.0 | `.`、`./package.json`               | `mdurl ^2.1.0`、`entities ^8.0.0`、`uc.micro ^3.0.0`、`linkify-it ^6.0.0`…          |
| 2.1.0 | `.`、**`./core`**、`./package.json` | `mdurl ^2.1.0`、`uc.micro ^3.0.0`、`linkify-it ^6.0.0`、`character-entities ^2.0.2` |

`markdown-exit/core` 是 2.1.0 才有的入口，所以 `>= 2.1.0` 是硬要求。2.1.0 还额外要求 `md.linkify = new LinkifyIt()` 才能用 linkify（core 不带 linkify-it，会抛 `markdown-exit/core does not include linkify-it`），但 comark 只用 `markdown-exit/core` 的**类型**，实际解析走 `markdown-exit` 主入口，该入口自带 factory。

### 3. `comark/plugins/security` 未变（本仓库最关键的一条「无需改动」）

`dist/plugins/security.d.ts` 在两个版本之间**零差异**；`dist/internal/sanitize.d.ts` 与 `dist/internal/sanitize.js` 的哈希也完全相同（后者 SHA-256 为 `D14DCBEE…9FC890`）。`SecurityOptions` 仍是 `blockedTags`、`allowedTags`、`tagFallback`、`frontmatter`，加上从 `PropsValidationOptions` 继承的 `allowedLinkPrefixes`、`allowedImagePrefixes`、`allowedProtocols`、`defaultOrigin`、`allowDataImages`。`PropsValidationOptions` 的来源在 0.9.0 从被删除的 `internal/props-validation.js`（0.8.1 里只是个指向 `../../src/...` 的死文件）迁到 `internal/sanitize.ts`，而 `security.js` 引用的正是 `sanitize`。

结论：`security({ blockedTags, allowedProtocols, allowDataImages })` 的参数名、默认值与执行时机都不需要因升级而调整，0.8.x 的安全修复也不会失效。

### 4. `comark/plugins/shiki` 的选项、返回类型与实例模型未变

`dist/plugins/shiki.d.ts` 零差异：仍导出 `getHighlighter`、`highlightCodeBlocks`、`resetHighlighter`、`comarkLanguage(s)`，签名仍是 `highlightCodeBlocks(tree: MarkdownDocument, options?: ShikiOptions) => Promise<MarkdownDocument>`；`ShikiOptions` 仍是 `themes`、`languages`、`registerDefaultLanguages`、`registerDefaultThemes`、`preStyles`、`transformers`、`inlineCode`。

实例模型也没变：`internal/shiki.js` 顶部仍是模块级 `let highlighter = null` 单例 + `loadedThemes`/`loadedLanguages` 两个 Set，两版逐行相同。**`MarkdownRenderer.vue` 里用 `highlightQueue` 串行化注册的 workaround 仍然必要**，0.9.0 没有引入「每调用一个高亮实例」的新 API。

`internal/shiki.js` 的真实差异只有 #565 的 class 归一化：新版在 `hastToNode` 里先把数组形态的 `class` join 成字符串，原先在两处消费点各自 join 的防御代码随之删除。对 `MarkdownRendererProseMermaidWrapper.vue` 无影响 —— 本仓库不传 `transformers`，走 `codeToTokens` 分支，`classStr` 由 `'shiki ' + themeName` 拼出，标记高亮行仍是 `child[1].class = \`${child[1].class ?? ''} highlight\``，`.line.highlight` 的 CSS 依旧命中。

### 5. shiki 语法 ReDoS 修复（#523）

`plugins/shiki/language-comark.js` 里四处 `$` 正则的属性片段由 `(?:[^{}'"]+|\'[^\']*\'|"[^"]*")*` 改为 `(?:[^{}'"]|\'[^\']*\'|"[^"]*")*`，去掉「可重复分支本身又可重复」造成的指数回溯。`internal/shiki.js` 的 `resolveRegistrations` 无条件 `languages.push(comarkLanguages)`，所以每个渲染 Markdown 的页面都加载了这套语法（`mdc`/`markdown`/`comark` 别名）。GitPulse 渲染的是 GitHub 上不可信的 README，这条修复是本次升级最实在的收益。

### 6. `transformNode` 是什么、谁能用

`dist/types.d.ts` 新增：

```ts
export type NodeTransform = (
  context: NodeTransformContext
) => NodeTransformResult | null | undefined | void;
```

它在每个元素节点**即将被渲染的那一刻**运行，可返回 `{ tag?, props? }`；类型注释明确写着「It must be synchronous and must not mutate its input」、「The returned tag and props are rendered as-is. They are not sanitized, and the security plugin runs at parse time」。`@comark/vue@0.9.0` 给 `MarkdownDocument` 增加了同名可选 prop（`MarkdownDocument.d.ts` 只多出这一项）与 `useMarkdown` 配置项。

对本仓库：**不是 `useGitHubAutolinks` 的替代，也不会与之冲突**。它是同步的、逐节点的渲染期钩子，无法 await `/api/issues/{owner}/{repo}/{n}` 的存在性查询；本仓库的 AST 改写发生在 `<MarkdownDocument :value="ast">` 之前，早于渲染阶段。

## 需要改动的代码

### 已改动（工作树）

| 文件                                       | 改动                                                                         | 复核结论                                             |
| ------------------------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| `package.json`                             | `comark`/`@comark/nuxt` → `^0.9.0`；`markdown-exit` → `2.1.0`                | 正确，且 `2.1.0` 是唯一能与其 pin 去重的写法         |
| `app/components/ui/MarkdownRenderer.vue`   | 新增 `linkify({ fuzzyLink: true })`；`blockedTags` 增加 `link`/`base`/`meta` | 正确；用户插件按 name 覆盖默认插件，参数会生效       |
| `shared/utils/release-note-search-text.ts` | 删除 `renderInlineAsText` 覆盖层                                             | 正确；`markdown-exit` 2.1.0 已原生输出 `code_inline` |

### `bun.lock` 实际变化

与上面的推断一致，无意外：`comark` 条目换成 0.9.0 的依赖集合（新增 `linkify-it ^6.0.0`、`character-entities`、`character-entities-legacy`，不再有 `entities`）；`@comark/nuxt`、`@comark/vue` 升 0.9.0 并换上 `@nuxt/kit 4.6.4`；`markdown-exit` 只有一条 `2.1.0`。`linkify-it` 由 comark 与 markdown-exit 共同依赖，hoist 成 `6.1.0` 一份。

### 明确「无需改动」的调用点

| 文件                                                         | 依赖的 comark 表面                                                                            | 为什么不用改                                                                                                                                                                                                                                       |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/components/ui/MarkdownRenderer.vue`（除已改的两处）     | `parseMarkdown`、`MarkdownDocument`/`Node` 类型、`comark/plugins/shiki`、`<MarkdownDocument>` | `parseMarkdown` 签名不变（`(markdown, options?) => Promise<MarkdownDocument>`）；`highlightCodeBlocks` 的 d.ts 零差异且仍是模块级单例；组件仍由 `@comark/nuxt` 自动注册                                                                            |
| `app/composables/useGitHubAutolinks.ts`                      | `ElementNode`、`MarkdownDocument`、`Node`                                                     | 三个类型与节点形状（`[tag, props, ...children]` + 字符串文本节点）在 `types.d.ts` 中未变                                                                                                                                                           |
| `app/components/ui/MarkdownRendererProseA.vue`               | 无 comark 导入                                                                                | 只消费 `href`/`target` prop，`href` 仍是字符串                                                                                                                                                                                                     |
| `app/components/ui/MarkdownRendererProseMedia.vue`           | `ElementNode`（`__node`）                                                                     | `@comark/vue` 传 `props.__node = node` 的逻辑两版相同（`MarkdownDocument.js` 中 `if (component?.props?.__node …)`）                                                                                                                                |
| `app/components/ui/MarkdownRendererProseMermaidWrapper.vue`  | `Node`（`__node`）、`code`/`language`/`class`/`style`                                         | `pre` 的 props 形状未变；#565 只影响数组 class 的归一化时机，`class` 仍是字符串、仍产出 `.line.highlight`                                                                                                                                          |
| `nuxt.config.ts`                                             | `modules: ['@comark/nuxt', …]`（第 256 行，无选项）                                           | `@comark/nuxt@0.9.0` 的 `dist/module.js` 与 `module.d.ts` 逐字节未变：仍 `addComponent` 注册 `Markdown`/`MarkdownDocument`、`addImports` 两个 helper、注入 `@comark/vue/vite` 插件、扫描 `<srcDir>/components/prose`（本仓库无该目录，保持 no-op） |
| `shared/utils/release-note-search-text.ts`（除已删的覆盖层） | `createMarkdownExit`、`core.ruler.before`                                                     | 两者在 2.1.0 仍导出且语义不变                                                                                                                                                                                                                      |

运行时说明，均不要求改代码：

- 本仓库从未传 `html` 选项，0.9.0 移除它不影响；默认插件集里 `html()` 仍在，README 的内联 HTML 继续被解析成节点。
- `@comark/html` 未安装，其 `render` 再导出变化与本仓库无关。

## 可以优化的地方

| 优化                                       | 内容                                                                                          | 工作量  | 风险 | 现在做吗                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- | ------- | ---- | ------------------------------------------------------------------------ |
| `markdown-exit` 去重                       | 已在工作树完成（直接依赖 `"2.1.0"` == comark 的 pin）                                         | 一行    | 中   | **已做**；剩下的是用测试证明 2.1.0 下 search-text 行为不变               |
| 删除 `renderInlineAsText` 覆盖层           | 已在工作树完成                                                                                | 删 8 行 | 低   | **已做**；`tests/release-note-search-text.test.ts` 是它的回归网          |
| 恢复 `www.` 自动链接                       | 已在工作树用 `linkify({ fuzzyLink: true })` 完成                                              | 一行    | 低   | **已做**                                                                 |
| 用 `transformNode` 替代 AST 改写           | 不成立：钩子同步，无法等待 issue 存在性查询                                                   | —       | —    | **不做**                                                                 |
| 改用 `comark/core` 精简默认插件            | 本仓库依赖 `html`、`attributes`、`components`、`frontmatter`、`alert`、`task-list` 的默认行为 | 大      | 高   | **不做**，等于手工重建默认值                                             |
| `heading-links` 插件（标题锚点）           | 新能力，README 标题没有锚点需求                                                               | 小      | 低   | 不做，符合「不做没被要求的配置」                                         |
| 恢复 `urlAuth: true`                       | 让 `user:pass@host` 也成链，与 GitHub 一致                                                    | 一行    | 低   | 不做；工作树的注释已明确这是刻意保留的偏离，且这类 URL 极少出现在 README |
| 把 `blockedTags` 换成 `allowedTags` 白名单 | 更严，但会改变现有 README 的渲染（表格/`details` 等要逐个放行）                               | 中      | 中   | 不做；要收紧应另立改动并单独验证                                         |
| 共享 Shiki highlighter 实例                | 与 `RepoFileView.vue` 的 `createHighlighter` 合并，省一次 WASM 加载                           | 中      | 中   | 不做；牵动 `MarkdownRenderer.vue` 的模块级单例与并发注册契约             |

一句话：0.9.0 的新能力（`comark/core`、`heading-links`、`transformNode`、数学定界符）对本仓库全用不上，值得做的三件事工作树里已经做完。

## 是否适合升级

**适合，且已验证通过。**

| 步骤                  | 实测结果                                                                                                                                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun install`         | 依赖落地：`comark`/`@comark/nuxt`/`@comark/vue` 0.9.0、`markdown-exit` 单份 `2.1.0`、`linkify-it` 单份 `6.1.0`。**退出码非 0**，但失败点是 `prepare` 里的 `prek install`（打不开 `C:\Users\…\prek\prek.log`），本机权限问题，与依赖无关 |
| `bunx nuxi typecheck` | 通过（exit 0）：`comark/plugins/linkify` 可解析，`parseMarkdown` 返回值可赋给 `shallowRef<MarkdownDocument \| null>`，`useGitHubAutolinks` 里 `Node`/`ElementNode` 的收窄不受影响                                                       |
| `bun run lint`        | 通过（exit 0）                                                                                                                                                                                                                          |
| `bun test --parallel` | 1298 pass / 0 fail / 3822 expect，164 个文件。`tests/release-note-search-text.test.ts` 的 20 条断言全绿，含 `![*strong* **alt** \`code\`](…)`→`'strong alt code'` 这条覆盖层删除后的回归网                                              |
| `bun run generate`    | 未执行：本机当时已有 dev server 占用 `.nuxt`，静态导出会与它抢同一目录                                                                                                                                                                  |

按仓库约定不跑 `bun run build`（CI 保留），也不主动起 dev server。

### 浏览器人工检查清单（需要用户自己确认）

`AGENTS.md` 禁止未经请求启动开发服务器，以下每项都要由用户在自己起的页面上确认：

1. **代码高亮**：README 围栏代码块在浅/深主题下都有 token 颜色，`pre` 背景与内联样式正常；行高亮（`{1,3}`）仍显示为 `.line.highlight`。
2. **Mermaid**：` ```mermaid ` 仍渲染成图，懒加载前的骨架占位出现，复制按钮工作。
3. **图片与链接**：相对路径图片走 raw 代理、`srcset` 的浅深色切换、外链/内链（`NuxtLinkLocale` vs `<a>`）行为不变；不安全协议链接退回 `<span>`。
4. **GitHub 自动链接**：`#123`、`GH-123`、`owner/repo#123`、`@user` 仍被改写为链接，查询失败的 issue 号保持纯文本。
5. **linkify 行为**：`https://…` 与 `www.example.com` 都成链（工作树的 `fuzzyLink: true`），`user:pass@host` 不成链。
6. **XSS 用例**：`<script>alert(1)</script>`、`<img src=x onerror=alert(1)>`、`[x](javascript:alert(1))`、`![](data:text/html;base64,…)` 四种都被拦掉；新增的 `link`/`base`/`meta` 不应影响正常 README。
7. **内联 HTML 嵌套**（#539）：`**<b>bold</b>**`、`::alert` 组件内带 HTML 的段落，层级符合预期。

## 未确认的事项

1. **~~bun 是否只装一份 `markdown-exit`~~** —— 已实测：单份 `2.1.0`（`bun.lock` 只有一条记录，`node_modules/comark/node_modules` 下没有副本）。
2. **~~`katex` 可选 peer 冲突~~** —— 已实测：`bun install` 未报错，`katex` 维持 `0.18.11`（mermaid 带入），未额外装 0.19；math 插件未注册，运行时不涉及。
3. **~~工作树改动是否通过类型检查~~** —— 已实测：`nuxi typecheck` exit 0。
4. **HTML 属性解码语义变化对 XSS 面的影响。** `security` 依赖的 `internal/sanitize.js` 两版字节相同，协议校验读到的都是解码后的值，未见新的绕过面；但「浏览器式属性解码」覆盖了哪些无分号/legacy 实体未做对抗性验证。
5. **#539（组件/强调内联 HTML 保留）在 GitPulse 真实 README 上的可见差异。** 只读到 `internal/parse/tree.js` 的重构，未实际对比渲染结果。
6. **#565 与 `MarkdownRendererProseMermaidWrapper.vue` 的相互作用。** 结论来自对无 `transformers` 分支的代码阅读，未跑浏览器确认。
7. **shiki 高亮结果是否逐字节相同。** 只 diff 到 class 归一化一处；#523 的语法改动会改变 `mdc`/`markdown` 语言的 token 切分，是否影响某些代码块着色未实测。
8. **`build` 产物与客户端体积变化。** 未构建，无法量化去重后客户端是否真的少了约 119 KB（1.3.0 `dist/index.js` 116,847 B vs 2.1.0 `index.core` chunk 118,893 B）。
9. **浏览器可见行为未验证。** 自动化只覆盖到类型、lint 与 `release-note-search-text` 的纯文本提取；代码高亮、Mermaid、图片/链接改写、GitHub 自动链接、linkify 与新增 `blockedTags` 的实际观感，仍需按上一节清单人工过一遍。

## 附：发布包比对方法（可复现）

```powershell
$base="$env:TEMP\comarkdiff"
Invoke-WebRequest https://registry.npmjs.org/comark/-/comark-0.9.0.tgz -OutFile "$base\comark-0.9.0.tgz"
New-Item -ItemType Directory -Force "$base\comark-0.9.0" | Out-Null
tar -xzf "$base\comark-0.9.0.tgz" -C "$base\comark-0.9.0"
# 0.8.1 同法；@comark/nuxt、@comark/vue 的 tarball 为
#   https://registry.npmjs.org/@comark%2Fnuxt/-/nuxt-0.9.0.tgz
#   https://registry.npmjs.org/@comark%2Fvue/-/vue-0.9.0.tgz
```

比对对象分四类：`package.json` 的 `dependencies`/`peerDependencies`/`exports`；`dist/**/*.d.ts`；`dist/**/*.js` 的逐文件哈希；以及「声称未变」的关键文件单独核对（`dist/plugins/security.d.ts`、`dist/internal/sanitize.{js,d.ts}`、`dist/plugins/shiki.d.ts`、`@comark/nuxt` 的 `dist/module.{js,d.ts}`）。
