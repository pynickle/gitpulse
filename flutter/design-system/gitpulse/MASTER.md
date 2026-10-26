# GitPulse Flutter — 视觉规范 Master

> **地位**：`flutter/` 原生客户端界面的**唯一视觉规范**。任何 UI 改动前先读本文。
> **范围**：只约束 Flutter APP。Nuxt 网页不进本文（见 §13），网页只作为参考来源。
> **位置与检索**：本文件在 `flutter/design-system/gitpulse/`，即 ui-ux-pro-max 规定的
> `design-system/<project-slug>/MASTER.md`，此处子项目根是 `flutter/`（等价于 `--output-dir flutter`）。
> 做某个具体页面前，先查同目录 `pages/<page>.md`：**存在则以该页面文件为准**，不存在则只用本文。
> **路径约定**：本文代码路径相对于 `flutter/` 包根，仓库级文件写作 `../…`。
> **命题**（引自 `../docs/research/flutter-release-timeline-dependencies.md` "Visual directions"）：
> "Unified GitPulse theme / SDK Material 3 with customized density, typography, cards, and colors"，
> 代价栏写明 `Needs deliberate desktop styling and interaction work to avoid default mobile density`。
> 问题从来不是 Material 3 太松，而是**桌面层的决定没人显式做过**。本文就是那层决定。
> **目标**：紧凑、品牌化 Material 3。保留现有审美（时间线卡片、设置表格、Release 阅读器、
> 关注仓库详细显示），把它们已有的选择**变成有名字、可执行、可审查的规则**。

---

## 0. 本文不拥有什么

单一来源，不在此重复。以下规则**不在本文**，去看原处：

| 规则 | 归属 |
| --- | --- |
| 界面文案精简、不写解释性副标签 | 仓库根 `../AGENTS.md` §Interface copy |
| 设置页是表格不是文档；一行描述即 review defect | `AGENTS.md`（包根，UI conventions 段） |
| 账户动作用 tooltip 命名的图标按钮 | `AGENTS.md`（包根，UI conventions 段） |
| 空/错/加载只用 `GitPulseLoadingView` / `GitPulseMessageView` | `AGENTS.md`（包根，UI conventions 段） |
| 主题只有 `gitPulseTheme` 一个来源；字体族与中文回退策略 | `AGENTS.md` + `lib/presentation/gitpulse_theme.dart` |
| 日期/数字的本地化与紧凑计数 | `AGENTS.md` + `lib/presentation/gitpulse_formatting.dart` |
| 导航返回/Home 契约 | 仓库根 `../AGENTS.md` §Layout & Wiring |

术语（Band / Gutter / Dense Chrome / Reading Surface / Reading Measure）以 `../CONTEXT.md`
的 `Flutter Presentation` 为准，本文只给数值与规则。

---

## 1. 两档排版节奏（本文的第一原则）

全应用只有两种节奏，任何界面必须属于其中一档。**混用即为缺陷**。

| 档 | 用于 | 节奏 |
| --- | --- | --- |
| **Dense Chrome** | 时间线卡片、设置表格、Follows 列表、工具栏/筛选、抽屉 chrome 行、错误横幅、仓库页身份带 | 内容紧凑：字阶 11/12/14/16，间距走 §5 的紧凑步，控件高 40，圆角 8/12 |
| **Reading Surface** | Release notes 正文、README 正文 | 可读优先：正文 15/24，标题 20/17/15（官方 1.35 行高），量尺上限 960，块间距 24 |

一个页面可以**同时**包含两档（Release 抽屉 = Dense Chrome 的 chrome 行 + Reading Surface 的 notes；
仓库页 = Dense 身份带 + Reading README），但**同一个 surface 内部不许跨档**。

Reading 档是既有事实，不是本文发明：`GitPulseType.readingBodySize = 15` /
`GitPulseType.readingBodyLineHeight = 24`（`lib/presentation/gitpulse_tokens.dart`），
经 `gitPulseTypeReadingBody` 落到 `lib/releases/release_document.dart`，
并由 `test/releases/release_document_typography_test.dart` 钉死。本文的作用是给它名字和边界。

---

## 2. 字体角色（Font roles）

不新增字阶。所有字号来自 Material 3 2021 版 `TextTheme`，本文只规定**哪个角色用哪个身份**。

### 2.1 Dense Chrome 角色表

| 角色 | M3 角色 | 字号/行高 | 字重 | 颜色 | 用在哪 |
| --- | --- | --- | --- | --- | --- |
| `pageTitle` | `headlineSmall` | 24 / 1.33 | **w600** | `onSurface` | 仓库页身份名（owner 用 w400 + `onSurfaceVariant`） |
| `surfaceTitle` | `titleMedium` | 16 / 1.50 | **w600** | `onSurface` | 时间线卡片标题、空/错状态标题 |
| `groupHeader` | `titleSmall` | 14 / 1.43 | w500（M3 默认，**不加粗**） | `onSurface` | 时间线日期分组头（夹在两条规则线之间） |
| `rowLabel` | `titleSmall` | 14 / 1.43 | **w600** | `onSurface` | 设置行标签、Follows 仓库名 |
| `brandName` | `labelMedium` | 12 / 1.33 | **w600** | `primary` | 时间线卡片里的仓库全名（卡片内唯一彩色文字） |
| `sectionLabel` | `labelSmall` | 11 / 1.45 | **w600** + `letterSpacing 0.6` | `onSurfaceVariant` | 资产折行、Previous Refresh 标记 |
| `meta` | `bodySmall` | 12 / 1.33 | w400 | `onSurfaceVariant` | 卡片摘要、设置 note、meta 行 |
| `metaTight` | `labelSmall` | 11 / 1.45 | w400 | `onSurfaceVariant` | 卡片时间戳、资产尺寸/下载数 |
| `description` | `bodyLarge` | 16 / 1.50 | w400 | `onSurfaceVariant` | 仓库描述 |
| `controlLabel` | `labelLarge` | 14 / 1.43 | w500（M3 默认） | 由控件决定 | 芯片/分段控件标签 |

**字重只有三档**：`w400` 正文、`w500` M3 控件默认、`w600` 强调。**w700 禁用**（Previous Refresh 标记已从 w700 归一到 w600，全库现无 w700），`w300` 及以下禁用。

除 `controlLabel` 外，本表每个角色在 `lib/presentation/gitpulse_tokens.dart` 有一个
`gitPulseType*` 函数。`controlLabel` 不设函数：它就是控件自己的 `labelLarge`，字号字重取 M3
默认，颜色由那个控件（芯片、分段控件）决定——包一层函数只会把"由控件决定"变成一句谎。

### 2.2 Reading Surface 角色表

| 角色 | 字号/行高 | 字重 | 备注 |
| --- | --- | --- | --- |
| `readingBody` | **15** / **24**（1.6） | w400 | `bodyMedium` 上覆盖 size/height；读者之单位 |
| `readingHeading1` | 20 / 1.35 | w600 | |
| `readingHeading2` | 17 / 1.35 | w600 | |
| `readingHeading3` | 15 / 1.35 | w600 | 与正文同号，靠字重区分；四级及以下折叠到本档 |
| `readingListIndent` / `readingQuoteIndent` | **20** / **12** | — | 列表缩进 / 引用缩进 |
| 规则线留白 | 上下各 ≥30 的视觉间距 | — | 由 `lib/releases/release_document.dart` 现有 block 间距提供 |
| 标题下间距 | **< 16** | — | 标题必须紧贴它所引导的正文 |

**禁令**（ADR 0018）：不得用 HTML renderer 的浏览器默认标题阶梯替换阅读档——
那一阶梯曾把一级标题推到 65px 下方、并让五级标题小于正文。

### 2.3 行高

Dense 档行高**全部用 M3 自带值**（1.33–1.50），不手写 `height:`。
只有 Reading 档写显式行高（24/15）。除这两处，代码里出现 `height:` 即为可疑。

---

## 3. 颜色

### 3.1 基础

- 唯一种子色：`GitPulseColors.brand = #238636`，经 `ColorScheme.fromSeed` 派生全部 tone。
- 亮/暗两套**同等对待**，每个新颜色规则必须两套都验证对比度 ≥ 4.5:1（正文）/ 3:1（图形）。

### 3.2 已登记的颜色角色

| 角色名 | 取值 | 用在哪 | 备注 |
| --- | --- | --- | --- |
| `brandLink` | `primary` | 时间线卡片的仓库全名、仓库身份名的仓库段 | 卡片内**唯一**允许的彩色文字 |
| `cardSurface` | `surfaceContainerLow` | 时间线卡片、横幅底 | |
| `badgeSurface` | `surfaceContainerHigh` | Prerelease / Draft 徽章底 | 比卡片高一档，靠层级而非按压规避（见 ADR 0023） |
| `errorWash` | `errorContainer.withValues(alpha: 0.35)` | 时间线 lookup 失败横幅 | **全库唯一允许的合成 alpha 底色**；改动需 ADR |
| `muted` | `onSurfaceVariant` | 一切次要文字、图形 | |
| `edge` | `outline` | 面的**边界**：卡片边框、输入框描边、sheet 边 | 见 §7 |
| `rule` | `outlineVariant` | 面**内部**的线：设置 hairline、日期头、资产边界 | 见 §7 |

### 3.3 交互态颜色（决定见 ADR 0023）

| 状态 | 取值 |
| --- | --- |
| `pressed` | **无背景**（`transparent`）。全应用统一 |
| `splash` | **无**（`transparent`） |
| `hover` | `surfaceContainerHighest @ 0.5`（`gitPulseHoverTint`） |
| `focus` | 同 `hover`。**不可移除**——键盘焦点可见性是无障碍要求，不是审美 |
| `disabled` | M3 默认（0.38 不透明度），不手写 |
| `selected` | `secondaryContainer` / `onSecondaryContainer`（芯片、分段控件） |

**例外**：`FilledButton`、`FilledButton.tonal`、`ElevatedButton` 保留 M3 自带 overlay——
它们的底色本身就是彩色，浅色罩不会显脏，且主操作需要反馈（Q17）。同一条理由覆盖
`IconButton.filled` / `.filledTonal` / `.outlined`：`IconButtonThemeData` 无法区分四个变体
（`_IconButtonM3.themeStyleOf` 对四者返回同一个 theme style），所以这类按钮在**调用点**用
`IconButton.styleFrom(overlayColor: …)` 取回自己的色调（见 §12 E16）。

**禁令**：不得新增字面 `Color(0x…)`；不得新增 `.withValues(alpha:)`；不得为单个 surface
自设 overlay 色（继承 ADR 0019）。

**陷阱**：`IconButton` / `TextButton` / `OutlinedButton` 的 `styleFrom` 一旦收到
`foregroundColor`，会在**调用点**用该色重建 Material 的按压底色，widget 级 style 压过主题，
`gitPulseTheme` 够不着。这类控件改用 `copyWith(overlayColor: gitPulseInkOverlay(scheme))`，
共用主题那一个 resolver，不要自己写 overlay。

---

## 4. 主题的实现约束

- **不设** `ThemeData.visualDensity`，**不覆写** M3 组件的默认尺寸/内距。紧凑感只来自
  §5–§9 的令牌与 §10 的控件高度。理由：`visualDensity: compact` 会连带压缩复选框、芯片、
  按钮的点击区域，把"紧凑"变成"难点"。
- `gitPulseTheme` 仍是唯一主题来源；本文新增的组件主题（`IconButtonThemeData` 等）写在它里面。
- 字体族/回退**按应用语言**决定，不改（Windows：Segoe UI / Microsoft YaHei UI；
  Linux：Noto Sans / Noto Sans CJK SC；Android/iOS/macOS：Flutter 平台默认）。**不引入
  打包字体，不引入 Google Fonts。**

---

## 5. 间距（Spacing roles）

按**职责**命名，不按数值命名——所以不鼓励"这里该用几"的推理，而是"这块是干什么的"。

| 令牌 | 值 | 职责 |
| --- | --- | --- |
| `glyphGap` | 4 | 图标与其文字标签之间 |
| `tight` | 6 | 同一块内相邻行（卡片内两行、控件与其 note） |
| `inline` | 8 | 同一行内的并列元素（芯片、图标组、堆叠布局里标签与控件） |
| `meta` | 10 | 卡片正文与 meta 块之间 |
| `rowInsetV` | 12 | 表格行上下内距、设置行 |
| `columnGap` | 12 | 时间线相邻列之间；Release Drawer 的面板宽度由它派生（ADR 0018） |
| `surfaceInset` | 14 | 卡片/横幅内距（四面） |
| `gutter` | **16** | 页面左右 gutter。所有 band、所有页面共用同一个 |
| `factGap` | 20 | 仓库页数据行的项间距 |
| `bandGap` | 24 | band 之间、页面尾部留白 |
| `bandGapLoose` | 32 | 页面收尾（仓库页 README 之后） |
| `nudge` | 2 | 文件名与其 meta 之间这类光学微调 |

规则：
1. `gutter = 16` 是**全应用唯一 gutter**。页面、band、表格行、卡片列表的左右边都对齐它。
   新增页面若用了别的 gutter 值，即缺陷。
2. 出现新数值 → 先问"这是哪个职责"，能归入上表就复用，归不进就开 ADR，**不许直接写数字**。
3. 例外：`_labelBaselineNudge = 6`（设置行标签与控件基线的光学修正）、
   仓库页 `_factIconGap = 3`（fact 图形与数字之间）都已登记为 §12 例外（E12 / E15），
   不进本表。

---

## 6. 圆角

| 令牌 | 值 | 用在哪 |
| --- | --- | --- |
| `radiusRow` | **8** | 行的 ink 形状、资产行、抽屉 chrome 行、输入框/搜索框（ADR 0019 已点名 8dp） |
| `radiusSurface` | **12** | 时间线卡片（ADR 0019 已点名 12dp）、横幅、筛选面板顶部 |
| `radiusSheetTop` | **20** | 移动端底部 sheet 的顶角（几何归 ADR 0010/0018） |
| `radiusBar` | **2** | 装饰条：Entry Release 的 4px 强调条 |

- 徽章圆角 = `radiusRow`（8）。原 6 取消：17px 高的盒子上 6 与 8 肉眼无差，少一个令牌就少一次争论。
- **不许**给 `StadiumBorder`/`CircleBorder` 的组件再配一个 `borderRadius` 数字——形状已由 `shape` 决定。
- 自定义 `CustomPainter` 内部的几何（如 Followed View 图标里 `Radius.circular(1)`）属于图形，不是面圆角，不受本表约束。

---

## 7. 边框与规则线

只有**宽度 1**。只有**两个色调**。

| 令牌 | 取值 | 职责 |
| --- | --- | --- |
| `strokeHairline` | `1.0` | 唯一线宽。禁用 0.5、1.5、2 |
| `toneEdge` | `scheme.outline` | 面的边界：卡片边框、输入框描边、sheet 边 |
| `toneRule` | `scheme.outlineVariant` | 面内部的线：设置 hairline、日期分组头、Previous Refresh 尾线、资产模块边界 |

规则：
1. **禁止直接读 `theme.dividerColor`**。M3 下它等于 `colorScheme.outline`（Flutter 源码
   `theme_data.dart` 已确认），直接用它会让"内部线"和"面的边"混为一谈——这正是现状不一致的根源。
   改用 `toneEdge` / `toneRule`。
2. 规则线一律 `height: GitPulseStroke.hairline, thickness: GitPulseStroke.hairline`
   （`height` 是它自己占的盒高，`thickness` 才是线；两者都取同一个令牌，页面节奏由外层 padding
   决定）。`GitPulseSettingsDivider` 是**设置表格行分隔**的唯一实现，`indent: 0` 表示"贯通整个
   surface"的边界线；别的 surface 内部的规则线直接写一条同参数的 `Divider`（或像 Previous
   Refresh 尾线那样用同高同宽的 `Container`，因为该处刻意不用 `Divider`，见 §12 E5）。
   唯一不是规则线的 `Divider` 是 Release 抽屉的抓取把手（`release_drawer.dart` 里
   `thickness: 4` 的那条），它是 affordance，归 §12 E4，但取色仍是 `toneRule`。
3. 一个 surface 内部**只用 `toneRule`**；一个 surface 的**外轮廓**只用 `toneEdge`。
4. 例外：抽屉里的资产行之间**不画线**，用留白分隔（ADR 0019：31 条 hairline 会读成电子表格）。

---

## 8. 图标

单一图标家族：Material Symbols/Icons。**禁止 emoji 作图**，禁止混搭填充与线性。

| 令牌 | 值 | 用在哪 |
| --- | --- | --- |
| `iconFact` | **14** | 替代名词的图形（仓库数据行的 ★/⑂/👁 位置、`LanguageSwatch`） |
| `iconInline` | **16** | surface 内与标签并排的图形（卡片回形针、资产类型图标） |
| `iconInControl` | **18** | 输入框内的前缀/清除、芯片内图标、紧凑 chrome 控件内的图标 |
| `iconAction` | **20** | 行/工具栏/app bar 里的图标按钮 |
| `iconPage` | **32** | 页面级空/错状态的图标 |

规则：
1. 语义按**用途**判定，不按字形：与可见文字并排的装饰图标 `ExcludeSemantics`；承载信息的
   独立图标要有文本替代；图标按钮要有无障碍名（`tooltip` 或 `Semantics.label`）。
2. 图标**不单独承担状态**——颜色不是唯一信息通道（选中态同时有 `selected` 语义与底色）。
3. 同一视觉层内线宽一致：全用 Material Icons 的默认（filled 与 outlined 不在同一层混用）。

---

## 9. 组件密度与控件高度

| 令牌 | 值 | 用在哪 |
| --- | --- | --- |
| `heightCompact` | **40** | 工具栏控件、搜索框、筛选芯片、工具条里的下拉 |
| `heightRowMin` | **44** | 可点列表行的最小高度 |
| `heightStandard` | **48** | M3 图标按钮（默认 `padded` 触控尺寸）、抽屉 chrome 行（ADR 0018） |

规则：
1. **任何可点击控件自身高度不得低于 40**。
2. 视觉小于 44/48 时，**扩点击区域**（`constraints` / `Padding` + `InkWell`），不许把控件撑高破坏行高节奏。
3. `splashFactory` 保持平台默认，不换成 `InkSparkle` 之类（会引入新的动效语言）。
4. 列表虚拟化、`ListView` 的 `itemExtent` 等性能参数不属于本文，按需在代码里定。

---

## 10. 交互状态

| 状态 | 规则 |
| --- | --- |
| pressed | 无背景（§3.3）。反馈由 hover / 内容本身 / 页面切换承担 |
| hover | 浅色调 `@0.5`，只出现在可点面上，且**不是唯一交互线索**（必须能点，不能只悬停） |
| focus | 与 hover 同色。键盘可达的控件焦点必须可见；弹层/固定条不得遮住焦点控件 |
| disabled | M3 默认不透明度 + 语义禁用，无点击响应 |
| selected | `secondaryContainer` 底 + `selected` 语义 |
| loading | 页面级用 `GitPulseLoadingView`；控件级禁用 + 进度指示，不用重复骨架屏 |
| motion | 只有既有 `AnimatedRotation 180ms`；新增动效时长取 120/180/240 三档之一；按压/悬停**瞬时无过渡**；遵循 `MediaQuery.disableAnimations` |

---

## 11. 截断与溢出

| 类别 | 规则 |
| --- | --- |
| **值**（计数、标签名、时间戳、卡片内的仓库全名） | 允许 `maxLines: 1` + `TextOverflow.ellipsis`；全值另经 tooltip 或详情页可达 |
| **读者用来比对的名字**（Release Asset 文件名） | **必须换行，永不省略**（ADR 0019）。禁止"顺手加个 ellipsis" |
| 紧凑徽章/标签 | 只约束不可预测的值；标签本体保持完整；不可避免的截断要对指针与键盘用户可展开 |
| 长 URL/ID | 允许在任意处换行，不对正常散文用 `break-all` |

---

## 12. 场景例外（Scenario Exceptions）

以下**不是**不一致，是刻意的决定。改动时**不许"顺手修掉"**。新增例外必须先进本表。

| # | 例外 | 位置 | 理由 |
| --- | --- | --- | --- |
| E1 | Notes/README 用独立字阶，不套 Dense 档 | `lib/releases/release_document.dart` | ADR 0018：`the notes document gets its own type scale`；浏览器默认阶梯曾把一级标题推到 65px 下方 |
| E2 | Release 抽屉宽面板宽度**派生自时间线列宽**，不是固定令牌 | ADR 0018 | `should not "fix" the panel back to a fixed pixel width` |
| E3 | 资产文件名不截断、必须换行 | `lib/releases/release_details_view.dart` 的 `_ReleaseAssetRow` | ADR 0019：`x86_64` vs `arm64` 正是读者要比对的部分 |
| E4 | 移动端 sheet：70% 开合、40% 最小、0.7 吸附、顶角 20、抓取把手 4 厚 | ADR 0010 / 0018；把手厚度写在 `release_drawer.dart` 的 `_sheetGrabThickness` | 手势几何归 ADR 0010，视觉只借用圆角；把手是 affordance、不是规则线，但它取 `toneRule`（§7 规则 2） |
| E5 | Previous Refresh 标记与日期分组头**刻意不同形** | `lib/timeline/timeline_screen.dart` 的 `_PreviousRefreshMark` 与 `_DateHeader` | 标记若长得像日期头，读者会误读为一天的分组 |
| E6 | 抽屉资产行之间**不画线**，用留白分隔 | ADR 0019 | 31 条 hairline 在手机宽度会读成电子表格 |
| E7 | 14px 图标出现在"名词位"（替代星/叉/眼/语言圆点） | `lib/repositories/repository_screen.dart`、`lib/presentation/gitpulse_language_colors.dart` | 图形替代名词、名词留在 `Semantics` 里，是该页的信息设计 |
| E8 | `radiusBar = 2` 与图形内部圆角 | Entry Release 强调条、Followed View 图标 | 装饰条与图形几何，不是面圆角 |
| E9 | `FilledButton*` / `ElevatedButton` 保留 M3 自带 overlay | ADR 0023 | 彩色底 + 主操作反馈需要 |
| E10 | 抽屉 chrome 行固定 48 高 | ADR 0018 | 它是"一行 chrome 换回一整屏阅读空间"的那一行 |
| E11 | 设置表格上限 1120 vs 阅读量尺 960 vs 时间线 700/1100 | `GitPulseWidth` 的四个令牌 | 四者职责不同：**扫描宽度**、**阅读量尺**、**列数分档**（700 一列 / 1100 两列以上），不是同一件事的四个值；所以是四个令牌而不是一个"内容宽度" |
| E12 | 设置行标签与控件基线的 `6` 光学修正 | `lib/presentation/gitpulse_setting_rows.dart` | 芯片行比输入框矮，居中会同时"不像对齐" |
| E13 | `errorWash` 的 0.35 合成 alpha | `lib/timeline/timeline_screen.dart` 的 `_LookupFailureBanner` | 全库唯一的合成底色；错误横幅需要"在卡片之上、在 surface 之下"的档位。它的外轮廓因此是 `errorContainer` 而不是 `toneEdge`——横幅的边界要说出"这是错误"，§7 规则 3 在此让位给本例外 |
| E14 | 禁止 0.5px 线（原徽章描边改为 1px） | — | 0.5 在高 DPI 下渲染不一致，且它是错的层级信号 |
| E15 | 仓库页 fact 图形与其数字之间的 `3` | `lib/repositories/repository_screen.dart` | 单次使用的光学值：14px 图形旁 2 太紧、4 太松；只有这一行需要，故留在局部命名常量而不进 §5 角色表 |
| E16 | `Switch` 的 radial reaction 保留 M3 自带色；`SegmentedButton` 的分段保留自己的 overlay | `lib/timeline/timeline_filter_panel.dart`（唯一一处 Switch）、`lib/follows/release_follows_screen.dart`（分段控件） | 两者都不是"面底色"：Switch 的按压反馈是绕 thumb 的放射光环，`SwitchThemeData.overlayColor` 也读不到 `ThemeData.highlightColor`，清零只会连 hover/focus 唯一的指针提示一起删掉；分段控件由内层 `TextButtonTheme` 自带 overlay 覆盖应用级主题，其彩色段属于 §3.3 的 E9 理由 |

---

## 13. 与网页的关系

| 参照什么 | 不参照什么 |
| --- | --- |
| 紧凑的信息层级与低饱和 surface 层次 | 网页基础字号 16px 与 rem 单位 |
| "细边框 + 小圆角"的克制感 | 网页的 860 / 1024 断点（ADR 0015/0018 已声明两端互不绑定） |
| 列表密度与"让布局解释"的文案经济 | Bulma / CSS 自定义属性 / `@lucide/vue` 组件基础 |
| 时间线按日期分组的卡片结构 | 网页动画时长与缓动曲线 |
| | hover 作为唯一交互线索 |

---

## 14. 通用检索建议如何转换成 Flutter 规则

检索结果的通用网页规则**不直接采纳**，逐条转换后落位如下。未列出的通用建议默认不适用。

| 通用建议 | 本项目转换 |
| --- | --- |
| 正文最小 16px | **不采纳**。Flutter 是 sp + M3 角色：操作界面 12/14，阅读档 15/24。16px 是网页防 iOS 自动缩放的理由，不适用于原生 |
| 行高 1.5–1.75 | 只在 Reading 档落实（24/15 = 1.6）；Dense 档用 M3 自带 1.33–1.50 |
| 每行 65–75 字符 | 转成**量尺上限 960** + 列数分档（700/1100），不写字数规则 |
| 4/8 间距网格 | 采纳为节奏基线，但保留 6/10/14 三个有归属的光学步（§5） |
| 点击目标 44/48 | 分成 40 紧凑控件 / 44 行最小 / 48 标准动作三层（§9） |
| 动效 150–300ms | **不采纳统一时长**。只用 120/180/240 三档，按压与悬停瞬时；页面转场交给平台 |
| `prefers-reduced-motion` | 转成 `MediaQuery.disableAnimations`，只作用于 `AnimatedRotation` |
| 单一 SVG 图标家族、禁 emoji | 采纳：Material Icons 单一家族、单一填充风格（§8） |
| 语义色 token、禁字面 hex | 采纳：`ColorScheme` + §3.2 角色表，禁新增字面色与 alpha |
| 暗色版用降饱和 tonal 变体 | 已由 `ColorScheme.fromSeed` 提供；只需保证两套分别验对比度 |
| 卡片阴影分级、玻璃拟态、渐变 | **不采纳**。本项目用"surface 台阶 + 1px 线"表达层级，不用阴影 |

---

## 15. 现状审计（规则来源）

### 已经合理，必须保留

1. **零硬编码字号**：全库只用 M3 角色，唯一数值例外是被测试锁定的阅读档。这是能"只命名、不改像素"的前提。
2. **唯一 gutter 16** 已被 3 个页面共用，且 `GitPulseSettingsDivider` 已跨页复用（设置、仓库页）。
3. **按压/悬停色调集中在主题层**，没有 surface 自设 overlay（ADR 0019 已把这条变成规则）。
4. **阅读档与设置表格都被测试钉住**（字号/行高/标题阶梯/标签列 140/折行阈值 520/大字号不溢出）。
5. **平台字体 + 中文回退按应用语言切换**，并有逐平台测试。
6. **surface 层级用容器台阶而非阴影**，方向正确且在 ADR 0019 有理由。

### 真正的不一致（本文已给出结论）

| 不一致 | 结论 |
| --- | --- |
| 规则线三种深度（`dividerColor`=outline、`outlineVariant`、`outlineVariant@0.5`） | `toneEdge` / `toneRule` 两档 + 唯一线宽 1（§7） |
| 圆角 6/8/12/16/20 并存 | 归到 8/12/20 + `radiusBar`。其中 `lib/releases/repository_releases_view.dart:229` 的 16 **是冗余**：该处 `shape: StadiumBorder()` 已决定形状，再给 ink 配 16 属于重复声明，删除而非改值 |
| 同一职责图标 18 vs 20 | 语义拆分：输入框内 18、图标按钮 20（§8）。**零视觉变化** |
| 控件高 40/44/48 无规则 | 三层规则（§9） |
| 节标签 w500 vs w700 | 统一 w600（§2.1） |
| 强调字重无定义（w600 散落 8 处） | 定义 w600 = 唯一强调，w700 禁用 |
| 仓库名用 `primary` 无出处 | 登记为 `brandLink`（§3.2） |
| 两个不同性质的上限（960 / 1120）无解释 | E11：扫描宽度 vs 阅读量尺 |

### 已修正的认知（勘察中发现，避免下轮误"修"）

- `lib/releases/repository_releases_view.dart:229` 的 `BorderRadius.circular(16)` 不是卡片圆角，是
  `StadiumBorder` 芯片上的冗余 ink 半径；在"按压无背景"之后它已无渲染意义。
- `lib/follows/followed_repositories_panel.dart:193` 的 `Radius.circular(1)` 是自定义图标绘制的一部分，
  不属于面的圆角。
- `theme.dividerColor` 在 M3 下等于 `colorScheme.outline`（不是 `outlineVariant`）——这是"内部线
  与面边界同色"的技术根源。

---

## 16. 怎么改这套规范

1. 只改**值**：直接改本文 + `lib/presentation/gitpulse_tokens.dart`，两处必须同一次改动里落地。
2. 加**新角色**：先在本文登记名字、值、职责和至少一个使用点，再写代码。
3. 修正一条**指向**：本文或代码引用了已经改名、删除或换了实现的符号时，只改那处指向（名字、所在文件、
   函数名），**不改任何数值、不新增角色**。过去几轮留下过这类债——"文档指着一处代码已经不再做的事"，
   而当时本节只有改值、加角色、写 ADR 三条动法，于是只能登记不改。这类修正要在当次改动的提交说明里点名。
4. 要**违反**本文：先写 ADR（三条门槛：难以回退、外人会问为什么、真实取舍），合入前登进 §12。
5. 任何有视觉变化的改动，必须在提交说明（或 ADR）里留下"验收命令 + 人眼复核点"。
