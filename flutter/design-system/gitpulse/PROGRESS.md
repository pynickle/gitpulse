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

**批 0–5 均已落地。** 剩下的是批 5 末尾登记的 4 项"需要新角色或新批次"的活（`controlEdge` 控件描边、
§2.1 的 7 个排版角色接线、§15 的旧结论、320 的面板下限），以及**连续 5 批未做的人眼复核**。

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
4. **高 DPI 设备上线的粗细**（dpr ≥ 2，即 Android/真机）：本批之前这些规则线的
   `thickness` 是缺省的 `0`，Flutter 画成**一个设备像素**（dpr 2 上等于 0.5 逻辑像素）；
   现在一律一个逻辑像素。日期头、notes 上下边界、资产模块边界、Follows 行、抽屉 chrome
   下分隔在这些设备上会**变粗约一倍**。这是 §12 E14 要求的方向，但它是本批第二处可见变化，
   必须看一眼"是否读成加粗而不是错位"。
5. Follows 页头分隔、Follows 宽布局竖分隔、抽屉 chrome 下分隔（表格外补的三处 `toneRule`）：
   与设置页横线同步变浅，两栏之间仍读得出一条分区。
6. 抽屉底部 sheet 的抓取把手：仍是一根 40×4 的短棒，只是颜色从 `outline` 降到 `outlineVariant`
   （表格外补的取色，见下）。

- [x] 批 2 完成（代码与自动验证；**人眼复核待设备端**，见下）
- [x] 实跑命令记录：

  ```
  $ flutter analyze
  Analyzing flutter...
  No issues found! (ran in 8.8s)

  $ dart format --output=none --set-exit-if-changed lib test
  Formatted 126 files (0 changed) in 1.16 seconds.   # exit 0

  $ flutter test --timeout 30s
  00:43 +393: All tests passed!
  ```

  （批 1 之后 391 个测试，本批新增 2 个 = 1 个用例 × 亮/暗，共 393。点名的
  `timeline/release_timeline_card_test.dart`、`settings/settings_layout_test.dart`、
  `releases/release_details_view_test.dart`、`timeline/timeline_screen_test.dart`、
  `timeline/timeline_toolbar_test.dart` 均在该全量跑内并通过。）

  **表格之外多改的 8 处，每处都由代码证据判定**（表格只点名"该改什么"，没点全"同类还有谁"）：

  1. 仍读 `theme.dividerColor` 的另外三处内部线（表格外的遗漏，不是例外）：
     `follows/release_follows_widgets.dart`（`FollowRowDivider`）、
     `timeline/timeline_filter_panel.dart`（仓库列表分隔）、`follows/release_follows_screen.dart`
     的竖向分隔。表格已把设置页的竖向分隔判为 `toneRule`（"列边界是内部线"），Follows 页
     那条同构，必须同判；另两条与 `GitPulseSettingsDivider` 同构。改完后全库 **0 处**
     读 `theme.dividerColor`（`gitpulse_tokens.dart` 的 doc 注释除外），§7 规则 1 才成立。
  2. 四处缺 `thickness` 的规则线：`follows/followed_repositories_panel.dart`、
     `follows/release_follows_screen.dart`（两处，含一条 `VerticalDivider`）、
     `releases/release_drawer.dart` 的 chrome 下分隔。缺省 `thickness` 是 `0`，Flutter 把它画成
     一个设备像素——在 dpr ≥ 2 上正是 §12 E14 禁掉的 0.5px 线。四处补 `GitPulseStroke.hairline`。
     本批点名的两条 notes 边界（`Divider(height: 1)`）同理；日头两侧的 `Divider` 把 `height`
     也从缺省 16 写成 1（那一行的高度由日期文字决定、文字远高于 16，故零视觉差）。
     至此**每条规则线**的 `height`/`thickness` 都是 `GitPulseStroke.hairline`，
     `GitPulseSettingsDivider` 与 `FollowRowDivider` 里原来的字面 `1` 也一并接上。
  3. 抽屉抓取把手（`release_drawer.dart` 里唯一一条 `Divider`，厚度收进局部命名常量
     `_sheetGrabThickness`）补 `toneRule`：它原来继承 `theme.dividerColor`（= `outline`，
     面边界的色调），是全库最后一处"内部图形用了 edge 色调"。厚度 4 不变（它是 affordance，
     §7 规则 2 与 §12 E4 已写明）。
  4. 五处半径接线（值不变，与批 0 同一理由：字面值与令牌成对存在会让一次改动变成多处编辑）：
     时间线卡片 12（ink + 描边，本来就在本批要改的卡片上）；错误横幅 12 → `surface`
     （§6 已登记"横幅 = 12"）；`release_details_view.dart` 两处资产行 ink 8 → `row`。

  **按表格明确留下的两处未动**：`followed_repositories_panel.dart` 的 `Radius.circular(1)`
  （E8 图形几何）与 `release_drawer.dart:193` 的 sheet 顶 `20`（E4 已点名"保持不动"）。
  后者的字面值因此仍是 `20`，`GitPulseRadius.sheetTop` 目前**没有使用点**——不是遗漏，
  是谁拥有 E4 几何谁再改它；见"批 5"的可选项。

  新增测试 `test/timeline/release_timeline_card_test.dart` 的一条用例（`_pumpCard` 加
  `brightness` 参数，亮/暗各跑一次）：`tester.widget<Ink>` 读卡片交给框架的 `BoxDecoration`，
  断言描边是**当场所用 ColorScheme 的 `outline`**、宽 1；徽章的 `BoxDecoration` 描边是
  `outlineVariant`、宽 1。开工时先红（徽章宽 `0.5 ≠ 1`，卡片那半当时已绿——M3 下
  `dividerColor` 本就等于 `outline`），改完再绿。卡片那半是防回归的守卫：谁把卡片改成
  `toneRule`，它就红。

  **人眼复核：未做，留给设备端**（与批 1 同一处理）。上面 6 个复核点都要真机或 Marionette；
  `AGENTS.md` 规定只在用户明确要求时才驱动真机/浏览器，本轮未启动。§16.4 要求的
  "验收命令 + 人眼复核点"已经落在本文（命令与 6 个点都在），但**点还没人看过**——
  "批 2 完成"按批 1 的先例读作"代码与自动验证完成"，感官确认是唯一未闭合项。
  自动验证能给出的替代证据是上面那条 `edge`/`rule` 断言，它不能替代对"变浅/变粗多少"的判断。
  回滚点：`lib/presentation/gitpulse_setting_rows.dart`、`lib/timeline/release_timeline_card.dart`、
  `lib/timeline/timeline_screen.dart`、`lib/timeline/timeline_filter_panel.dart`、
  `lib/timeline/timeline_toolbar.dart`、`lib/releases/release_details_view.dart`、
  `lib/releases/release_drawer.dart`、`lib/releases/repository_releases_view.dart`、
  `lib/settings/settings_screen.dart`、`lib/settings/timeline_cache_settings.dart`、
  `lib/follows/release_follows_screen.dart`、`lib/follows/release_follows_widgets.dart`、
  `lib/follows/followed_repositories_panel.dart`，以及
  `test/timeline/release_timeline_card_test.dart` 与本文。

  **同类但本批不碰的两处（登记，不顺手改）**：`settings/timeline_cache_settings.dart` 与
  `timeline/timeline_filter_panel.dart` 的 `OutlinedButton.styleFrom(side: BorderSide(color:
  scheme.outlineVariant))`。§3.2 把"面的边界"给 `edge`，这两个控件的描边却在 rule 色调上；
  但它们既不是面边界（`OutlinedButton` 没有面）也不是内部线，MASTER 目前没给"控件描边"分配
  色调。改它会让两个按钮变深——属于观感变化，需要 MASTER 先给角色，故留给下一轮。

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

- [x] 批 3 完成（代码与自动验证；**人眼复核待设备端**，见下）
- [x] 实跑命令记录：

  ```
  $ flutter analyze
  Analyzing flutter...
  No issues found! (ran in 11.2s)

  $ dart format --output=none --set-exit-if-changed lib test
  Formatted 126 files (0 changed) in 1.35 seconds.   # exit 0

  $ flutter test test/settings test/releases test/timeline/timeline_toolbar_test.dart \
      test/timeline/timeline_filter_controls_test.dart test/follows --timeout 30s
  00:36 +132: All tests passed!

  $ flutter test --timeout 30s
  01:05 +394: All tests passed!
  ```

  （批 2 之后 393 个测试，本批新增 1 个，共 394。点名的 `follows/*`、`settings/*`、
  `timeline_toolbar_test.dart`、`timeline_filter_controls_test.dart` 均在该全量跑内并通过。）

  **有视觉变化的两处**——都不是表格之外的额外决定，而是规则本身的要求：

  1. `release_follows_screen.dart` 搜索框内的清除/搜索图标 20 → 18。它们是**控件内的图形**，与工具栏
     里独立的图标按钮（`action` = 20）不同职责，这正是本批要立的规则。两处从 `Icon(size: 20)` 改为
     `IconButton(iconSize: …)`：尺寸本来就是按钮的属性，图标不该自带一个。同一形状在
     `timeline_toolbar.dart`、`timeline_filter_panel.dart`、`native_code_block.dart` 三处清除/复制
     按钮上一并对齐（字形不变，按钮内槽位 24 → 18）。
  2. `settings/timeline_cache_settings.dart` 保留天数的输入框 36 → 40。§9 规则 1 说任何可点控件不得
     低于 40，而本批正在改这一行的图标；把一个已知的规则违反留在原地再宣称"完成"说不过去，故在本批
     收口。这是**第二个可见变化**（该控件高 4 像素）。

  **表格之外多接的令牌（全部同值，零视觉变化）**，理由与批 0 相同：字面值与令牌成对存在会让
  一次改动变成多处编辑。

  | 位置 | 接上 |
  | --- | --- |
  | `timeline_toolbar.dart`、`timeline_filter_panel.dart` 的 4 条 `minHeight: 40`，以及工具栏第二条行在没有基线文字时的占位 `SizedBox(height: 40)` | `GitPulseHeight.compact` |
  | `timeline_filter_panel.dart` 日期清除按钮的 `BoxConstraints(40/40)`、`follows/release_follows_widgets.dart` 关注动作按钮的同款约束 | `minHeight: GitPulseHeight.compact`（宽度仍写字面值：§5/§9 没有给控件宽度定义角色，编一个就是新角色） |
  | `release_drawer.dart` chrome 行 `height: 48` | `GitPulseHeight.standard`（§12 E10 点名 48 的那一行，本批才第一次用上这个令牌） |
  | `repository_releases_view.dart` 的 `_metaFactIconExtent = 14.0` | `GitPulseIconSize.fact`（与仓库页 `_factIconExtent` 同一职责：图形替代名词，E7） |
  | `repository_releases_view.dart` 行尾 chevron `size: 20` | `GitPulseIconSize.action`（§15 的 18/20 分界是"输入框内 18、其余 20"，它不是输入框内） |

  `GitPulseIconSize.page` 与 `GitPulseHeight.standard` 在本批之前都没有使用点；接上之后 §16.2
  要求的"每个新角色至少一个使用点"才成立。接完的结果：`Icon` 的字面 `size` 只剩
  `follows/release_follows_widgets.dart` 的 `_starGlyph = 12`（登记 3），控件高度不再有字面值
  （`release_drawer.dart` 抓取把手的 `width: 40` 是 E4 的 affordance 几何，不是控件高；各输入框还留着
  `minWidth`，因为 §5/§9 没有给控件宽度定义角色，编一个就是新角色）。

  新增测试 `test/follows/release_follows_screen_test.dart` 的一条用例（与批 2 同一手法：挂载真实
  页面后读**渲染出来的盒子**，不是读源码文本）：搜索框内的清除与搜索图形必须是
  `GitPulseIconSize.inControl`（18×18），工具栏里独立的排序按钮必须是 `action`（20×20）。
  开工时先红（`Expected: Size(18,18) / Actual: Size(20,20)`），改完再绿。它是本批唯一可见变化的
  守卫：谁把输入框内的图形改回 `action`，它就红。

  **人眼复核：未做，留给设备端**（与批 1、批 2 同一处理）。复核点：
  (1) Follows 搜索框里的两个图标小 2 像素后仍与输入文字平衡；
  (2) 工具栏里独立的图标按钮没有跟着变小；
  (3) 设置页保留天数的输入框高了 4 像素后，那一行仍读得出"标签 + 控件"，没有变胖。
  `AGENTS.md` 规定只在用户明确要求时才驱动真机/浏览器，本轮未启动。
  回滚点：上面 12 个 `lib/` 文件 + `test/follows/release_follows_screen_test.dart` + 本文。

  **需要先改 MASTER、或属于下一批的四项（登记，不顺手改）**：

  1. **图标按钮的默认尺寸是 24，不是 20。** `IconButton` 的 `effectiveIconSize = iconSize ??
     IconTheme.of(context).size ?? 24.0`（SDK `icon_button.dart`），而
     `gitPulseTheme.iconButtonTheme` 不设 `iconSize`。全库只有 5 处写死了 20（本批接完的那几个），
     其余十几处（`connection_screen.dart`、`followed_repositories_panel.dart`、
     `repository_releases_view.dart` 的表头、`timeline_toolbar.dart` 的文章/筛选/刷新、
     `repository_navigation.dart` 的返回键…）都画 24。§8 的 `iconAction = 20` 因此描述的是"已经写死的
     那些"，不是全应用现状。统一到 20 是**全应用可见**的缩小（24→20），该进一次带人眼复核的批次，
     做法是在 `gitPulseTheme` 给 `IconButtonThemeData` 的 `ButtonStyle.iconSize` 设一次，而不是改
     十几处调用点。（评审曾建议给 §8 加一条"本表只描述调用点声明过的尺寸"的规则——没有采纳：
     §16 只允许改值、加角色、写 ADR 三种动法，给表加一个自我限定不属于任何一种。）
  2. **§12 E15 的光学 `3` 其实有三处**：`repository_screen.dart` 的 `_factIconGap`、
     `repository_releases_view.dart` 的 `_metaFactIconGap`、`follows/release_follows_widgets.dart`
     的 `_starGap`。三处都留在局部命名常量里没动（本批只把 14 接上令牌）；E15 的措辞可以补一句
     "同类还有两处"，免得下一位评审把其中一处当漏改。
  3. **`follows/release_follows_widgets.dart` 的 `_starGlyph = 12.0`**：星形代替"stars"这个名词，
     职责与 `iconFact` 相同，值却小 2，§8 的五个角色里没有它。改 12 → 14 会让 Follows 行的语言列宽
     （`44 * scale + _starGlyph + _starGap`）一起变，是可见变化，需要 MASTER 先决定"这一行用不用
     `fact`"，故本批只接 14 那一处。
  4. **§15 的"同一职责图标 18 vs 20 … 零视觉变化"一行，现在要读作"当时的结论"**：本批把 Follows
     输入框内的那对 20 明确判给 `inControl`（18），所以那一行不再是对本批之后的描述。§15 是"本轮
     结论"的快照，§16 没有给"修正一条审计结论"的动法，故只在这里登记，不改 §15。
     （行尾 chevron 取 `action` 而非 `inControl` 的理由见上面表格最后一行：它是整行的下钻图形，
     不在输入框内，值也不变；若评审认为应与抽屉里的 chevron 同判，改一个词即可。）

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

- [x] 批 4 完成（代码与自动验证；**人眼复核待设备端**，见下）
- [x] 实跑命令记录：

  ```
  $ flutter analyze
  Analyzing flutter...
  No issues found! (ran in 11.0s)

  $ dart format --output=none --set-exit-if-changed lib test
  Formatted 126 files (0 changed) in 1.24 seconds.   # exit 0

  $ flutter test --timeout 30s
  00:56 +396: All tests passed!
  ```

  （批 3 之后 394 个测试，本批新增 2 个，共 396。点名的
  `test/releases/release_document_typography_test.dart` **原有 4 条用例一条未改**，在该全量跑内
  通过——那 4 条（正文 15sp、正文行高 24px、标题单调递减、标题下间距 <16、列表 16–36 /
  引用 8–20 缩进）就是"零回归"的证据。本批在该文件**末尾追加** 2 条，理由见下。）

  **表格之外多接的三组令牌（全部同值，零视觉变化）**，理由与批 0/批 3 相同：字面值与令牌成对
  存在会让一次改动变成多处编辑。

  | 位置 | 接上 | 依据 |
  | --- | --- | --- |
  | `_notesStyles` 的 `h3`–`h6` | `GitPulseType.readingHeading3Size` | 表格写"20 / 17 / 15 引用 `readingHeading1/2/3`"，第三个档就是这一支；原来它写的是 `_notesBodySize`（同值 15），接上角色名后 h3 不再借用正文的名字 |
  | `ul` / `ol` 的 `padding-inline-start` | `GitPulseType.readingListIndent` | §2.2 登记的"列表缩进 20"，本批之前**没有使用点**；§16.2 要求每个角色至少一个使用点，接上才成立 |
  | `blockquote` 的 `padding-inline-start` | `GitPulseType.readingQuoteIndent` | 同上（引用缩进 12） |

  接完的结果：`GitPulseType` 的阅读档数值令牌**全部**有使用点，`release_document.dart` 里
  不再有字号、行高、缩进的字面数值。标题直接写令牌、正文经 `_notesBodySize` 之类的别名，
  两种写法并存不是随手混用：表格第一行要求"常量保留名称"，第二行要求"标题引用令牌"。

  **刻意留作字面值的块间距（6 处声明，不是 4 处）**——它们的值逐个等于 §5 的某个距离令牌，
  但那全是数值巧合，职责不同：

  | 元素 | 字面值 | §5 里数值相同的那一行 | 职责差别 |
  | --- | --- | --- | --- |
  | `p` / `blockquote` 的 `margin` | 12 | `rowInsetV` | 表格行的上下内距 vs. 段落之间的块间距 |
  | `h1` 的 `margin` | 10 | `meta` | 卡片正文与 meta 之间 vs. 标题与它所引导的正文之间（§2.2 要求 <16） |
  | `h2` 的 `margin` | 8 | `inline` | 同一行内并列元素 vs. 阅读档块间距 |
  | `h3`–`h6` 的 `margin` | 6 | `tight` | 同一块内相邻行 vs. 阅读档块间距 |
  | `hr` 的 `margin` | 20 | `factGap` | 仓库页数据行项间距 vs. 规则线上下的留白（§2.2 要 ≥30，由 hr 的 20 加段落 12 提供） |

  接到 §5 上去等于宣称"段落下间距就是表格行内距"，是给两个职责制造假等式，所以不接。
  这条说明**只写在这里、不写进 MASTER**：批 3 已判定"给表补一句自我限定不属于 §16 的三种动法"
  （见批 3 登记第 1 项），本批评审把同一条判给了 MASTER §2.2 的一稿补写，已撤回。

  **新增守卫（追加在 typography 套件末尾的 2 条用例）**：挂载真实 `ReleaseDocument` 后读
  **渲染出来的** `RichText` 样式——每个标题档、正文、标题 line box 比例、列表缩进、引用缩进，
  每一项都同时断言"等于文档读的令牌"和"等于 MASTER §2.2 登记的数字"。两种断言各管一头：
  前者防"某档改回字面值"（原 4 条只断言单调递减，`h1` 改成 22 也通过），后者防"令牌和文档
  一起滑到一个 MASTER 没登记过的尺度"。缩进是量 `RenderParagraph` 的位置得到的真实值
  （列表 20、引用 12 + 引用条 3），不是读源码文本。

  它是**守卫，不是本批的证据**：改之前这些值全等，所以本批前后都绿。本批"零回归"的证据只有
  两条——`git diff -- lib` 里没有一处数值改动，以及上面那 4 条原有用例原样通过。把它写进同一个
  文件而不是新开一个：新文件会与 typography 套件重复一份 `_source` 与三个测量 helper（本批评审
  指出的重复），而原文件的 4 条用例保持逐字不变，"零回归"的证据因此不受影响。

  **登记、不顺手改的三项**：

  1. `gitPulseTypeReadingBody`（`readingBody` 的角色函数）至今**没有调用点**——`ReleaseDocument`
     的 `textStyle` 自己算 `24/15`，与那个函数同一个式子（"同一角色两个定义"，批 0 曾用"改为转调"
     消掉过一次）。本批不改，因为表格要求两个常量"保留名称"，而改为转调会让它们失去使用者被删。
     收口动作是"转调该函数 + 删两常量 + MASTER 改引用"，三处同批。
  2. **MASTER §1 第 50–51 行现在是一句旧引用**：它仍写 `_notesBodySize = 15.0` /
     `_notesBodyLineHeight = 24.0`，而这两个常量现在赋的是令牌（值仍是 15/24）。§16 只给了改值、
     加角色、写 ADR 三种动法，没有"改写一条引用"这一种，故**只登记、不改**——与批 3 处理 §15
     那句"当时的结论"同一手法。
  3. **§2.2 的缩进两行没有英文令牌名**：表里写"列表缩进 20 / 引用缩进 12"（值 + 职责），
     `readingListIndent` / `readingQuoteIndent` 这两个名字是批 0 在令牌文件里起的。§16.2 的原文是
     "先登记**名字**、值、职责和至少一个使用点"，若"名字"必须落在 §2.2 的行里，动作是给那两行补
     一个代码名；本批按上一项同样的理由没有动 MASTER，代码侧已接令牌、值未变。

  **人眼复核：未做，留给设备端**（与批 1–3 同一处理）。本批的点是"notes 外观不得有任何变化，
  有变化即失败、回滚"，而它恰恰最难用眼睛证明"没变"：`git diff -- lib` 里只有常量指向，
  没有可渲染的差值，按批 0 的先例不启动应用。**这是连续第 4 批把感官确认留给设备端**；
  建议下一次真机/设备端检查一次性覆盖批 1–4 各自末尾的复核点，否则这条债务只会继续累积。

  回滚点：`lib/releases/release_document.dart`、
  `test/releases/release_document_typography_test.dart`（只看末尾追加的两条）与本文。
  **`MASTER.md` 本批零改动**——评审撤回了最初那稿 §2.2 补写。

---

## 批 5 — 文档收尾与长期维持

**目标**：把前四批欠下的两类债收口——"文档指向已经不在的代码"和"令牌/角色函数没有使用点"。
**本批零视觉变化**：两处常量/函数指向、三处文档修正（`../AGENTS.md`、§1、§2.2）、一条 §16 动法、一份重审登记。

- [x] 仓库根 `../AGENTS.md` 加入口
- [x] `AGENTS.md`（包根）加操作性要求
- [x] `../docs/adr/0023-flutter-press-feedback-scope.md`
- [x] `../CONTEXT.md` 的 `Flutter Presentation` 补 **Band / Gutter / Dense Chrome / Reading Surface / Reading Measure**
- [x] 仓库根 `../AGENTS.md` 的 git-ignored 错句（实测两者**都被跟踪**）
- [x] `GitPulseRadius.sheetTop` 接上使用点（批 2 遗留）
- [x] `gitPulseTypeReadingBody` 接上使用点并删掉两个同义常量（批 4 遗留）
- [x] `700/1100` / `1120/1040` 重审：值不改，改成登记两处仍未接令牌的字面量
- [x] 批 5 完成（代码与自动验证；**人眼复核待设备端**，见下）
- [x] 实跑命令记录：

  ```
  $ flutter analyze
  Analyzing flutter...
  No issues found! (ran in 8.6s)

  $ dart format --output=none --set-exit-if-changed lib test
  Formatted 126 files (0 changed) in 1.28 seconds.   # exit 0

  $ flutter test --timeout 30s
  00:45 +398: All tests passed!
  ```

  （批 4 之后 396 个测试，本批新增 2 个，共 398。评审后按同一组命令复跑，三项结果不变。）

**本批改了什么**

| 位置 | 改动 | 依据 |
| --- | --- | --- |
| `../AGENTS.md`（Domain docs 段） | 把"`CONTEXT.md` 与 `docs/adr/` 可能被 git 忽略"改成"两者是受跟踪的源码" | `git ls-files --error-unmatch CONTEXT.md docs/adr/0023-…` 两处都成功；`git ls-files docs/adr` 数出 **23** 个 ADR（原条目自己写的 22 也不准）。`git check-ignore -v` 退出码 1 = 没有任何规则命中 |
| `lib/releases/release_drawer.dart:202` | sheet 顶角 `Radius.circular(20)` → `GitPulseRadius.sheetTop` | E4 只把几何判给 ADR 0010，圆角归 §6；`sheetTop` 至此有了使用点 |
| `lib/releases/release_document.dart` | `textStyle` 转调 `gitPulseTypeReadingBody(context)`，删 `_notesBodySize`/`_notesBodyLineHeight` | 同一角色曾有两个定义（批 0 就是用"改为转调"消掉过一次另一处）。零像素的理由：那个函数返回 `bodyMedium.copyWith(fontSize 15, w400, height 24/15)`，而原写法返回 `bodyMedium.copyWith(fontSize 15, height 24/15)`；`gitPulseTheme` 不覆写 `textTheme` 的字重，M3 的 `bodyMedium` 本来就是 w400，故显式再写一次 w400 不改变任何字形 |
| `MASTER.md` §1 | 旧引用 `_notesBodySize = 15.0` / `_notesBodyLineHeight = 24.0` 改为指向 `GitPulseType.readingBodySize/LineHeight` | 上一条删了那两个常量，这句引用会指向不存在的代码（这正是批 4 登记第 2 项留下的债） |
| `MASTER.md` §2.2 | 缩进行补上代码名：`readingListIndent` 20 / `readingQuoteIndent` 12 | 批 4 登记第 3 项：§16.2 要求角色有名字，而这两个名字此前只存在于令牌文件 |
| `MASTER.md` §16 | 新增第 3 条动法"**修正一条指向**：只改指向、不改数值、不新增角色" | 上一行与再上一行都是"文档指着一处代码已经不再做的事"。批 3 与批 4 都遇到过同一类债，当时 §16 只有改值 / 加角色 / 写 ADR 三条，所以只能登记不改。**本批要动 §1 与 §2.2，就必须先把这条动法补进去**——否则本批自己就越过了 §16，评审在这一点上判得对 |

**新增 2 条守卫**（`test/releases/release_drawer_test.dart`；共用一个 `openReleaseDrawer` 帮手，挂载真实页面、
点开一张卡片后读抽屉交给框架的那个 `Material`）：

1. 手机 sheet 的顶角必须是 `BorderRadius.vertical(top: Radius.circular(20))`——**20 直接写成数字**，
   因为 MASTER §6 登记的就是数值。写成令牌会变成镜像断言（实现与测试一起漂移，谁都不红）。
2. 宽面板的 `borderRadius` 必须是 `null`：20 是 sheet 的几何，跑到顶边上的面板没有角可圆。
   缺这一条，把 20 套到宽面板上也不会有测试变红。

**变红验证**：把 `GitPulseRadius.sheetTop` 临时改成 `24`，`flutter test --plain-name "rounds its top corners"`
立即红（`+0 -1`）；还原后恢复绿。所以第 1 条确实在守"令牌与 §6 那个 20 一致"，不是一句同义反复。

它们是**守卫，不是本批的证据**：本批前后这两处的值完全相同，所以改之前也绿。本批"零视觉变化"的证据
是 `git diff -- flutter/lib` 里没有任何数值改动，加上点名套件（`release_document_typography_test.dart`
的 4 条原有排版用例逐字未改）原样通过。

**评审后修正**（code-review 两轴，Standards 与 Spec 各一个子代理，均只看本批 diff）：

1. **§16 缺一条动法**（两轴同时指出）：本批改 §1 与 §2.2 属于"文档指着一处代码已经不再做的事"，
   而 §16 原来只有改值 / 加角色 / 写 ADR 三条——批 4 正是因此把这件活登记为"不改"。已补 §16 第 3 条
   "修正一条指向"，本批两处文档修正从此有据。
2. **§1 措辞仍不准**（Spec 轴）：初稿写"由 `release_document.dart` 应用"，而该文件现在只调用
   `gitPulseTypeReadingBody`、不再读那两个数值。改为"经 `gitPulseTypeReadingBody` 落到 …"。
3. **§2.2 行形状与全表不一致**（Standards 轴）：初稿把角色名塞进"字号/行高"列。改成角色列
   `readingListIndent` / `readingQuoteIndent`、字号列 `20` / `12`，与其它行同形。
4. **守卫里有同义反复**（Standards 轴）：初稿既断言控件等于令牌、又断言令牌等于 20，且第一条是镜像断言
   （实现与测试一起漂移）。改为直接断言控件等于 20（MASTER §6 登记的数），并补了上面那条变红验证；
   两条新用例共用一个 `openReleaseDrawer` 帮手，免得与相邻用例各抄一遍挂载流程。
5. **摘要与行号**（Spec 轴）：摘要行漏数了一处文档修正、`release_drawer.dart` 行号写作 201（实为 202）、
   重审段落的"五个数字"与它自己的六行表格矛盾——均已改正。

**重审结论（`700/1100`、`1120/1040`）——值不改，只登记**

| 数字 | 归属 | 回答的问题 |
| --- | --- | --- |
| 700 / 1100 | `GitPulseWidth.timelinePhone/Tablet` → `resolveTimelineColumnCount` | 时间线在 1 列 / 2 列 / 3 列之间破位 |
| 960 | `GitPulseWidth.readingMeasure` | README 的阅读量尺 |
| 1120 | `GitPulseWidth.settingsTable` | 设置表格的扫描上限 |
| **1040** | `lib/settings/settings_screen.dart:30` 的 `_wideMinimumWidth`，**仍是字面值** | 账户从滚动区挪到独立尾列的那一刻；只在 1040–1120 之间可达（页面本身封顶 1120） |
| **360** | `settings_screen.dart:33` 的 `_accountColumnWidth` 与 `follows/release_follows_screen.dart:378` 的 `width: 360`，**两处同值字面量** | 尾列宽度。`settings_screen.dart` 的注释明说它"matching the Followed Repositories panel"，所以一次改动要改两处 |

表里六个数字的来历：`700/1100` 与 `1120/1040` 是原条目点名的两组；`960`（阅读量尺）与 `360`（尾列宽度）
是同一个问题的另外两面——E11 本来就把 1120 与 960 并排登记，而 360 只有在那条 1040 破位成立之后才有意义。
不列全，就等于把"这个数是谁的"继续留给下一位评审。

结论：四个已登记令牌各回答一个问题（1/2/3 列破位、阅读量尺、表格上限），1040 回答"账户列何时独立"，
360 是那条列自己的宽度。**本批不改任何值，也不新增角色**：新增角色是 §16.2 的动作（先在 MASTER 登记名字、
值、职责与至少一个使用点，再改代码），而 1040 与 360 目前都只有单一使用点、都已经是带注释的局部命名常量，
还没有出现"一次改动要改多处"的重复；360 虽然两处同值，但第二处（`follows/release_follows_screen.dart:378`）
是"另一页的同一块面板"，登记它得先决定两页是否共用同一条宽度角色。**下一次有人动 Settings 或 Follows 的列宽时，
动作就是给 1040 与 360 各登记一个角色，并把这张表里的字面值换掉。**

**登记、本批不动**（这些是批 2/3/4 各自记过的同一批债，此处只做"当前状态"的合并摘要，不重复论证；
逐条理由见各批记录）：

1. `OutlinedButton` 的描边色调仍无处可依：`settings/timeline_cache_settings.dart:238` 与
   `timeline/timeline_filter_panel.dart:713` 用 `scheme.outlineVariant`（`toneRule` 的色调），而 §3.2 把
   面的边界给 `edge`、§7 没有"控件描边"这个角色。改完是**可见的加深**，需要先在 MASTER 登记角色
   （`controlEdge`？）再进一次带人眼复核点的批次。
2. §2.1 的 7 个字体角色函数（`pageTitle` / `surfaceTitle` / `brandName` / `sectionLabel` / `meta` /
   `metaTight` / `description`）仍无调用点，卡片、抽屉、仓库页各自 `copyWith`。这是一次"排版角色接线"批次，
   且 Previous Refresh 标记该用 `primary` 还是 `onSurfaceVariant` 得先定（§3.2 只把 `primary` 登记给
   `brandLink`）。
3. §15 里"同一职责图标 18 vs 20 …零视觉变化"一行是**当时的结论**，批 3 已把 Follows 输入框内那对判给
   `inControl`（可见小 2 像素）。§15 是"本轮结论"的快照，不是指向（§16 新第 3 条只管指向），
   本批仍不改它，与批 3 的处置一致。
4. `lib/timeline/timeline_layout.dart:21` 的 `releaseDrawerMinimumPanelWidth = 320.0` 是唯一没有 MASTER
   角色的面板下限。它是局部命名常量、单次使用，按 §5 规则 2 的"光学值留局部"处理，未接令牌。

**人眼复核：本批显式跳过。** `git diff -- flutter/lib` 里没有数值改动，没有可渲染的差值（批 0 同一理由）。
但**批 1–5 的复核点累计 5 批全部未做**——这是本项目的最大欠账，下一次设备端检查必须一次性覆盖
批 1（按下无底色、hover 仍有浅色、Tab 焦点可见、Retry 仍有 M3 反馈）、批 2（线变浅/变粗、卡片边框没跟着变浅）、
批 3（输入框内图形小 2 像素后仍平衡、控件高 4 像素）、批 4（notes 外观无变化）与批 5（无变化即通过）的全部点。

回滚点：`../AGENTS.md`、`MASTER.md` §1/§2.2、`lib/releases/release_document.dart`、
`lib/releases/release_drawer.dart`、`test/releases/release_drawer_test.dart` 末尾两条、本文。

---

## 评审门槛（每个 PR 自查）

1. 新数值有没有进 `MASTER.md`？进了令牌文件吗？两处同批吗？
2. 有没有直接读 `theme.dividerColor`？有没有新增字面 `Color` 或 `.withValues(alpha:)`？
3. 改动的 surface 属于 Dense Chrome 还是 Reading Surface？有没有跨档混用？
4. 有没有碰 §12 的 E1–E14？碰了就要有 ADR。
5. 视觉有变化 → 有没有留下人眼复核记录？
6. 设置页有没有新增"描述行"、有没有新增解释性副标签（仓库根 `../AGENTS.md` 硬要求）？
