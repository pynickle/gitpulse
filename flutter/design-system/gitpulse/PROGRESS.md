# GitPulse Flutter — 视觉规范迁移进度

> 配套 `MASTER.md`。本文是**执行清单**：谁改哪个文件、改法、验收命令、人眼复核点。
> 一个批次做完才开下一批；每批结束在下面勾掉，并把实际执行的命令贴在该批次末尾。
> **路径约定**：代码路径相对于 `flutter/` 包根，测试路径相对于 `test/`，仓库级文件写作 `../…`。
> **注意**：`PROGRESS.md` 是本项目自加的迁移清单；ui-ux-pro-max 只规定 `MASTER.md` 与 `pages/`。

**总验收命令**（每批都跑，不再重复写全）：

```bash
cd flutter
flutter analyze
dart format --output=none --set-exit-if-changed lib test
flutter test --timeout 30s      # 渲染/布局套件挂住时会带行号失败
```

**本轮已交付（无 Dart 改动）**

- [x] `design-system/gitpulse/MASTER.md`
- [x] `design-system/gitpulse/PROGRESS.md`（本文）
- [x] 仓库根 `../AGENTS.md` 入口
- [x] `AGENTS.md`（包根）入口
- [x] `../docs/adr/0023-flutter-press-feedback-scope.md`
- [x] `../CONTEXT.md` 补 5 个视觉领域词

**下一轮从这里开始：批 2。**

---

## 批 0 — 令牌文件落地（**零视觉变化**）

**目标**：让后四批有地方写，且本批不改任何像素。这是"没改坏"的可证明起点。

**新建** `lib/presentation/gitpulse_tokens.dart`，按 MASTER §5–§9 定义：
`GitPulseSpace`、`GitPulseRadius`、`GitPulseStroke`（含 `toneEdge`/`toneRule` 取色函数）、
`GitPulseIconSize`、`GitPulseHeight`、`GitPulseWidth`，以及 §2 的字体角色函数
（`gitPulseTypePageTitle`、`gitPulseTypeSurfaceTitle`、`gitPulseTypeRowLabel`、
`gitPulseTypeGroupHeader`、`gitPulseTypeBrandName`、`gitPulseTypeSectionLabel`、
`gitPulseTypeMeta`、`gitPulseTypeMetaTight`、`gitPulseTypeDescription`、
`gitPulseTypeReadingBody`）。每个 token 的 doc 注释里写它对应的 MASTER 小节和来源 ADR。

**改为引用令牌（值不变）**

| 文件                                               | 现状                                                                        | 改法                                                                                                                                        |
|----------------------------------------------------|-----------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| `lib/presentation/gitpulse_setting_rows.dart:6`    | `const gitPulseSettingsGutter = 16.0`                                       | 改为 `const gitPulseSettingsGutter = GitPulseSpace.gutter;`（保留旧名，AGENTS.md 与测试都引用它）                                           |
| `lib/timeline/timeline_layout.dart:13`             | `releaseTimelineHorizontalPadding = 16.0`                                   | → `GitPulseSpace.gutter`                                                                                                                    |
| `lib/timeline/timeline_layout.dart:17`             | `releaseTimelineColumnGap = 12.0`                                           | 新增 `GitPulseSpace.columnGap`（值 12，时间线专用），再引用                                                                                 |
| `lib/repositories/repository_screen.dart:20/35/36` | `_gutter = gitPulseSettingsGutter`、`_factGap = 20`、`_factIconExtent = 14` | 前两者 → 令牌；`_factIconExtent` → `GitPulseIconSize.fact`。**`_factIconGap = 3` 保留为局部命名常量**（单次使用的光学值，MASTER §5 规则 2） |

**验收**：总命令全绿；`git diff` 里除新文件与常量指向外，**不应出现任何数值变化**。

**人眼复核**：截图对比 `git stash` 前后任意三页（时间线、设置、Release 抽屉），应无法分辨。

- [x] 批 0 完成
- [x] 实跑命令记录：

  ```
  $ flutter analyze
  Analyzing flutter...
  No issues found! (ran in 118.5s)

  $ dart format --output=none --set-exit-if-changed lib test
  Formatted 125 files (0 changed) in 1.34 seconds.   # exit 0（首跑格式化新文件后重跑）

  $ flutter test --timeout 30s
  00:58 +385: All tests passed!
  ```

  （评审后的最终改动重跑：`flutter analyze` → No issues found!；`dart format` → 125 files,
  0 changed；`flutter test` → +385 All tests passed!）

  **零数值变化证据**：`git status --short` 里只有新文件
  `lib/presentation/gitpulse_tokens.dart`（未跟踪，`git diff` 看不到它）与五个被改文件；
  `git diff -- lib` 的每一处都是常量指向，无一处数值改动。共 9 个常量接上令牌：

  | 位置 | 改为 |
  | --- | --- |
  | `presentation/gitpulse_setting_rows.dart` | `gitPulseSettingsGutter = GitPulseSpace.gutter` |
  | `timeline/timeline_layout.dart` | `releaseTimelineHorizontalPadding = GitPulseSpace.gutter`、`releaseTimelineColumnGap = GitPulseSpace.columnGap` |
  | `timeline/timeline_layout.dart` | `releaseTimelinePhoneMaxWidth = GitPulseWidth.timelinePhone`、`releaseTimelineTabletMaxWidth = GitPulseWidth.timelineTablet` |
  | `repositories/repository_screen.dart` | `_factGap = GitPulseSpace.factGap`、`_factIconExtent = GitPulseIconSize.fact`、`_maximumContentWidth = GitPulseWidth.readingMeasure` |
  | `settings/settings_screen.dart` | `_maximumContentWidth = GitPulseWidth.settingsTable` |

  批 0 文本只点名前三处；`GitPulseWidth` 的四处一并接上，理由是 MASTER §16.2 要求新角色
  有"至少一个使用点"，且四个字面值与令牌成对存在会让一次断点改动变成四处编辑。值完全相同，
  验收不变。

  另外两处为消除文档/代码分叉：`gitPulseSettingLabelStyle` 改为转调
  `gitPulseTypeRowLabel`（同一角色两个定义）；`MASTER.md` 补三条登记——
  §5 的 `columnGap` 行、§2.1 关于 `controlLabel` 不设函数的说明、§12 的 E15（仓库页
  fact 图形间距 3）与 E11 指向 `GitPulseWidth` 四令牌。

  `GitPulseType`（阅读档数值 15/24/1.35、20/17/15、缩进 20/12）在本批落地：
  它属于令牌文件，而令牌文件只在本批新建；批 4 只做"改为引用"，数值一字不改。

  **人眼复核：本批显式跳过。** 三页截图对比的前提是"有东西可能变"；`git diff` 里没有任何
  数值改动，没有可渲染的差值，故未启动应用。若评审仍要求，回滚点即 `git stash`。

---

## 批 1 — 按压策略：按压无背景（视觉变化，ADR 0023）

**目标**：按 ADR 0023 让全应用按压不留底色，只保留 hover/focus 的浅色调。

| 文件                                             | 改法                                                                                                                                                                                                                                                                                                  |
|--------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `lib/presentation/gitpulse_theme.dart`           | `highlightColor: Colors.transparent`、`splashColor: Colors.transparent`；删除 `gitPulsePressTint`（已无使用者）；保留 `gitPulseHoverTint`，同时供给 `hoverColor` 与 `focusColor`                                                                                                                      |
| 同文件                                           | 新增 `_gitPulseOverlay(scheme)`：`WidgetStateProperty.resolveWith` —— `pressed → transparent`，`hovered/focused → gitPulseHoverTint`，其余 `null`。装到 `iconButtonTheme`、`textButtonTheme`、`outlinedButtonTheme`、`listTileTheme.overlayColor`（后者若字段不存在则跳过，ListTile 走 InkWell 回落） |
| 同文件                                           | `filledButtonTheme`、`elevatedButtonTheme` **不动**（MASTER §3.3 例外 E9）                                                                                                                                                                                                                            |
| `lib/releases/repository_releases_view.dart:229` | 删除 `StadiumBorder` 上的冗余 `borderRadius: BorderRadius.circular(16)`（MASTER §15：它不是圆角配置，是重复声明；按压已无背景后更无意义）                                                                                                                                                             |

**验证**：`flutter test` 里按压/点击相关的套件必须原样通过——
`test/timeline/timeline_screen_test.dart`、`test/releases/release_drawer_test.dart`、
`test/releases/repository_releases_screen_test.dart`、`test/follows/*_test.dart`。

**人眼复核（必须做，本批最容易"感觉坏了"）**：

1. 悬停时间线卡片 → 仍有浅色调（未过头清零）。
2. 按下时间线卡片 → **无底色**，松开后抽屉正常打开。
3. 键盘 Tab 到任一图标按钮 → 焦点仍可见。
4. 按下 `Retry`（`FilledButton.tonal`）→ 仍有 M3 反馈（E9）。
5. Android 上按下卡片 → 无反馈。这是**已接受的代价**；若评审判定"死板"，唯一后手是 MASTER §10 登记的
   "按下时把边框提到 `primary`"，且需新 ADR。

- [x] 批 1 完成（代码与自动验证；**人眼复核待设备端**，见下）
- [x] 实跑命令记录：

  ```
  $ flutter analyze
  Analyzing flutter...
  No issues found! (ran in 11.4s)

  $ dart format --output=none --set-exit-if-changed lib test
  Formatted 126 files (0 changed) in 1.31 seconds.   # exit 0

  $ flutter test --timeout 30s
  00:52 +391: All tests passed!
  ```

  （批 1 之前 385 个测试，本批新增 6 个，共 391。点名套件
  `timeline/timeline_screen_test.dart`、`releases/release_drawer_test.dart`、
  `releases/repository_releases_screen_test.dart`、`follows/*_test.dart` 均在其内并通过。
  首跑 full suite 后残留 `flutter_tester` 进程锁住
  `build/native_assets/windows/sqlite3.dll`，清进程后重跑才得到上面这行——是工具链残留，
  不是测试失败。）

  **实际改动**（表格之外的四项，都是为了兑现本批"全应用"这个目标；每一处都由代码证据判定，
  不是推测）：

  1. `lib/timeline/timeline_filter_panel.dart` 的 `_Pressable` 原本按自己的规则按压：
     `_held → surfaceContainerHighest`（**全强度**底色），并覆盖 `splashFactory: NoSplash`
     与 `highlightColor/hoverColor/focusColor: Colors.transparent`。这是唯一一处"surface 自设
     overlay"的按压底色；ADR 0023 说"No surface is left showing a pressed tint"，不处理它该句
     即为假。现改为 `_TappableRow`（`StatelessWidget` + `Material` + `InkWell(borderRadius)`），
     颜色全部继承主题：按压无底色、hover/focus 得浅色调、focus 由不可见变可见（MASTER §10 要求）。
     副作用：`AnimatedContainer` 的 130ms 淡入消失，悬停变为瞬时——正是 MASTER §10"按压/悬停
     瞬时无过渡"所要的方向。代码净减约 30 行。改名的理由：它已经不再"press"，名字要说出它现在
     是什么（可点的一整行）。
  2. `OutlinedButton.styleFrom(foregroundColor: …)` 会在**调用点**重建 Material 的按压底色
     （`foregroundColor.withOpacity(0.1)`），widget 级 style 优先于主题，主题够不着。
     全库两处这样的按钮：`settings/timeline_cache_settings.dart`（清除缓存）、
     `timeline_filter_panel.dart`（日期范围）。两处各加
     `.copyWith(overlayColor: gitPulseInkOverlay(scheme))`。
  3. `IconButtonThemeData` 对四个变体返回同一个 style（`_IconButtonM3.themeStyleOf`），所以
     共享 overlay 也落到 `.filled`/`.filledTonal`/`.outlined` 上。实测：改前
     `IconButton.filledTonal` 按压 → transparent、hover → 应用浅色调，即把 E9 判给"彩色底"的
     反馈抹掉，还在彩色底上盖一层浅色罩。全库唯一一处是账户保留策略的保存按钮
     （`settings/timeline_cache_settings.dart`），改为 `IconButton.styleFrom(overlayColor:
     scheme.onSecondaryContainer)` 取回自己的色调；并在
     `test/settings/timeline_settings_test.dart` 的编辑流程里断言它按下时**仍有**可见底色。
  4. 边界登记为 MASTER §12 **E16**（不是"顺手修掉"，是写明它们为什么不进本策略）：
     `Switch` 的按压反馈是绕 thumb 的放射光环，不是面底色，且 `SwitchThemeData.overlayColor`
     读不到 `ThemeData.highlightColor`；`SegmentedButton` 的分段由它自己内层的
     `TextButtonTheme` 自带 overlay 覆盖应用级主题（实测：分段按压仍是
     `onSecondaryContainer@0.10`，未受本批影响——所以分段控件无需改动）。MASTER §3.3 的例外段
     与 ADR 0023 的 Consequences 各补一段说明，免得下一位评审把这些当成漏改。

  因此 `_gitPulseOverlay` 改为**公开**的 `gitPulseInkOverlay(ColorScheme)`（表格里写作
  `_gitPulseOverlay`）；doc 注释写明它为什么必须公开、以及调用点该怎么用。三个 button family
  与两处 outlined 调用点共用同一个 resolver，"全应用统一"才有一条代码路径可指。

  **顺手接线**：`_TappableRow._radius` 接上 `GitPulseRadius.row`（同值 8，批 0 先例）。批 2 表格
  里 `timeline_filter_panel.dart:597` 那一行因此可以划掉，只剩 452 行的搜索框。

  **新增测试** `test/presentation/gitpulse_theme_test.dart`（6 个 = 3 个用例 × 亮/暗，均为挂载
  真实控件后读取它交给框架的 ink 契约，不是读源码文本）：三个 button family 在真实按下手势之后
  `overlayColor.resolve(pressed)` 必须是 `transparent`、hover/focus 必须等于主题的 `hoverColor`
  （不是"等于同一个函数的返回值"那种同义反复）；`FilledButton.tonal` 的代表（Retry）解析结果
  必须是**能画出来**的颜色（`alpha > 0`，而不是"不是 transparent"——后者在 null 时也会通过）；
  `ListTile` 因为 `ListTileThemeData` 没有 overlay 字段，`ThemeData.highlightColor/splashColor`
  必须是透明、hover 不透明且 focus 与 hover 同色。这批用例开工时先红（前两个失败），改完再绿；
  两套亮暗都跑，因为 §3.1 要求新颜色规则两套都验。

  **人眼复核：未做，留给设备端。** 本批 5 个复核点（悬停仍有浅色、按下无底色、Tab 焦点可见、
  Retry 仍有 M3 反馈、Android 按下无反馈）都要真机或 Marionette；`AGENTS.md` 规定只在你明确
  要求时才驱动真机/浏览器，本轮未启动。**这是本批唯一未闭合的验收项**，勾选状态请按此理解：
  代码与自动验证已完成，感官确认待设备端。
  回滚点：`lib/presentation/gitpulse_theme.dart`、`lib/timeline/timeline_filter_panel.dart`、
  `lib/releases/repository_releases_view.dart`、`lib/settings/timeline_cache_settings.dart`、
  `test/presentation/gitpulse_theme_test.dart`，以及三份文档（MASTER §3.3/§12、ADR 0023、
  本文）。

---

## 批 2 — 规则线与圆角归一（**唯一明显改变观感的一批**）

**目标**：两档线（`edge` / `rule`）+ 唯一线宽 1；圆角归 8 / 12 / 20。

| 文件:行                                           | 现状                                                | 改法                                                                 |
|---------------------------------------------------|-----------------------------------------------------|----------------------------------------------------------------------|
| `lib/timeline/release_timeline_card.dart:42`      | `Border.all(color: theme.dividerColor)`             | → `toneEdge(scheme)`，宽 `GitPulseStroke.hairline`                   |
| `lib/timeline/release_timeline_card.dart:160-161` | 徽章 `outlineVariant@0.5` + `circular(6)`           | → `toneRule(scheme)` + `hairline` + `GitPulseRadius.row`(8)          |
| `lib/presentation/gitpulse_setting_rows.dart:151` | `Divider(color: Theme.of(context).dividerColor)`    | → `toneRule(scheme)`（设置 hairline **变浅**，这是本批唯一明显变化） |
| `lib/timeline/timeline_screen.dart:539/544`       | 日期头两侧 `Divider(color: theme.dividerColor)`     | → `toneRule(scheme)`                                                 |
| `lib/timeline/timeline_screen.dart:514`           | `Container(height:1, color: scheme.outlineVariant)` | → `toneRule(scheme)` + `hairline`（保持"不用 Divider"的原意）        |
| `lib/timeline/timeline_screen.dart:496`           | `fontWeight: FontWeight.w700`                       | → `w600`（MASTER §2.1）                                              |
| `lib/releases/release_details_view.dart:139-142`  | 资产边界 `Divider(height:1)`（默认色 = outline）    | → `toneRule(scheme)`                                                 |
| `lib/releases/release_details_view.dart:77-80`    | 标题与 notes 之间的 `Divider(height:1)`             | → `toneRule(scheme)`（内部线）                                       |
| `lib/settings/settings_screen.dart:75-79`         | 宽布局竖分隔 `dividerColor`                         | → `toneRule(scheme)`（列边界是内部线，不是面边界）                   |
| `lib/releases/repository_releases_view.dart:278`  | 行 ink `circular(8)`                                | → `GitPulseRadius.row`                                               |
| `lib/releases/release_drawer.dart:251`            | chrome 行 ink `circular(8)`                         | → `GitPulseRadius.row`（ADR 0019 点名 8dp）                          |
| `lib/timeline/timeline_filter_panel.dart:88`      | `vertical(top: circular(12))`                       | → `GitPulseRadius.surface`                                           |
| `lib/timeline/timeline_filter_panel.dart:452/597` | `circular(8)` / `_radius = all(circular(8))`        | → `GitPulseRadius.row`                                               |
| `lib/timeline/timeline_toolbar.dart:78`           | `circular(8)`                                       | → `GitPulseRadius.row`                                               |
| `lib/follows/release_follows_screen.dart:19`      | `_searchBorder` 半径 8                              | → `GitPulseRadius.row`                                               |
| `lib/settings/timeline_cache_settings.dart:83`    | `circular(8)`                                       | → `GitPulseRadius.row`                                               |
| `lib/releases/repository_releases_view.dart:293`  | Entry Release 强调条 `circular(2)`                  | → `GitPulseRadius.bar`                                               |

**保持不动**（MASTER §12 例外）：`followed_repositories_panel.dart:192` 的 `Radius.circular(1)`
（图标内部几何）、`release_drawer.dart:193` 的 sheet 顶 `20`（E4）。

**验证**：总命令 + 下列套件必须通过：
`test/timeline/release_timeline_card_test.dart`、`test/settings/settings_layout_test.dart`、
`test/releases/release_details_view_test.dart`、`test/timeline/timeline_screen_test.dart`、
`test/timeline/timeline_toolbar_test.dart`。

**新增回归断言（本批唯一新增测试）**：在 `test/timeline/release_timeline_card_test.dart` 里断言
卡片描边色来自 `colorScheme.outline`、徽章描边来自 `outlineVariant` 且宽度为 1——即"边用 edge、内部用 rule"
这条规则有行为级证据，而不是只写在文档里。

**人眼复核**：

1. 设置页表格的横线变浅、但每行仍可分辨；大字号（1.5×/2×）下仍不溢出。
2. 时间线日期头两侧线变浅，分组仍清晰。
3. 卡片边框**没有**变浅（若变浅，说明误把 `edge` 写成了 `rule`）。

- [ ] 批 2 完成
- [ ] 实跑命令记录：<!-- 粘贴 -->

---

## 批 3 — 图标与控件高度归位（近零视觉变化）

| 文件:行                                                                            | 现状                         | 改法                                                          |
|------------------------------------------------------------------------------------|------------------------------|---------------------------------------------------------------|
| `lib/settings/account_panel.dart:256`                                              | `iconSize: 20`               | → `GitPulseIconSize.action`                                   |
| `lib/follows/release_follows_screen.dart:257/273/504`                              | `size: 20` / `iconSize: 20`  | → `action`（图标按钮）/ `iconInControl`（输入框内）按用途判定 |
| `lib/follows/release_follows_widgets.dart:387`                                     | `iconSize: 20`               | → `action`                                                    |
| `lib/follows/release_follows_widgets.dart:118`                                     | `size: 14`                   | → `GitPulseIconSize.fact`                                     |
| `lib/follows/release_follows_screen.dart:281`                                      | `minHeight: 44`              | → `GitPulseHeight.rowMin`                                     |
| `lib/settings/timeline_cache_settings.dart:164/230`                                | `iconSize/size: 18`          | → `GitPulseIconSize.inControl`（该行是紧凑控件内的图标）      |
| `lib/timeline/timeline_toolbar.dart:101/120/104/124/130`                           | `size: 18` + `minHeight: 40` | → `iconInControl` + `heightCompact`                           |
| `lib/timeline/timeline_toolbar.dart:161`                                           | `height: 18`                 | 保留（刷新进度指示的尺寸，非图标令牌）                        |
| `lib/timeline/timeline_filter_panel.dart:468/481/555/675/701`                      | 18 / 16 / `iconSize: 18`     | → `inControl` / `inline` 按用途判定                           |
| `lib/timeline/release_timeline_card.dart:124`、`release_details_view.dart:159/242` | `size: 16`                   | → `GitPulseIconSize.inline`                                   |
| `lib/releases/release_details_view.dart:183`                                       | `size: 18`（chevron）        | → `inControl`                                                 |
| `lib/releases/native_code_block.dart:108`                                          | `size: 18`                   | → `inControl`                                                 |
| `lib/presentation/gitpulse_state_views.dart:69`                                    | `size: 32`                   | → `GitPulseIconSize.page`                                     |
| `lib/repositories/repository_screen.dart:218`                                      | `_factIconExtent`            | 批 0 已接 `fact`；此处确认                                    |

**验证**：总命令 + `test/follows/*`、`test/settings/*`、`test/timeline/timeline_toolbar_test.dart`、
`test/timeline/timeline_filter_controls_test.dart`。

**人眼复核**：只有"行内图标按钮"从 18 变 20（或反之）这类 1–2 逻辑像素的差别；若某处明显变大，
说明语义判错（`inControl` 被当成了 `action`）。

- [ ] 批 3 完成
- [ ] 实跑命令记录：<!-- 粘贴 -->

---

## 批 4 — 阅读档显式化（**零视觉变化**）

**目标**：把笔记/README 的字阶从"散落的常量"变成"有名字的阅读档令牌"。

| 文件                                                 | 改法                                                                                                                                                   |
|------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|
| `lib/releases/release_document.dart:8-11`            | `_notesBodySize` / `_notesBodyLineHeight` / `_notesHeadingLineHeight` 保留名称，值改为引用 `GitPulseType.readingBody...` 的令牌（15 / 24 / 1.35 不变） |
| 同文件 heading `customStylesBuilder` 的 20 / 17 / 15 | 引用 `readingHeading1/2/3` 令牌，**数值一字不改**                                                                                                      |

**验证**：`test/releases/release_document_typography_test.dart` **原样通过**——这就是"零回归"的证据
（该测试断言 15sp、24px 行高、标题单调递减、标题下间距 <16、列表 16–36 缩进、引用 8–20 缩进）。

**人眼复核**：Release 抽屉的 notes 外观不得有任何变化；若有，本批失败，回滚。

- [ ] 批 4 完成
- [ ] 实跑命令记录：<!-- 粘贴 -->

---

## 批 5 — 文档收尾与长期维持

- [x] 仓库根 `../AGENTS.md` 加入口
- [x] `AGENTS.md`（包根）加操作性要求
- [x] `../docs/adr/0023-flutter-press-feedback-scope.md`
- [x] `../CONTEXT.md` 的 `Flutter Presentation` 补 **Band / Gutter / Dense Chrome / Reading Surface / Reading Measure**
- [ ] 可选修正：仓库根 `../AGENTS.md` 说 `../CONTEXT.md` 与 `../docs/adr/` "may be git-ignored"，实测两者**都被跟踪**
      （22 个 ADR 在版本库）。建议把该句改成"这些文件是源码的一部分，不要在 fff 里当作不存在"。
- [ ] 可选：把本文两处数字（`700/1100`、`1120/1040`）在后续引入新断点时重审；当前它们分属不同职责（E11）。

---

## 评审门槛（每个 PR 自查）

1. 新数值有没有进 `MASTER.md`？进了令牌文件吗？两处同批吗？
2. 有没有直接读 `theme.dividerColor`？有没有新增字面 `Color` 或 `.withValues(alpha:)`？
3. 改动的 surface 属于 Dense Chrome 还是 Reading Surface？有没有跨档混用？
4. 有没有碰 §12 的 E1–E14？碰了就要有 ADR。
5. 视觉有变化 → 有没有留下人眼复核记录？
6. 设置页有没有新增"描述行"、有没有新增解释性副标签（仓库根 `../AGENTS.md` 硬要求）？
