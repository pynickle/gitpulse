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

**下一轮从这里开始：批 0。**

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

- [ ] 批 0 完成
- [ ] 实跑命令记录：<!-- 粘贴 --> 

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

- [ ] 批 1 完成
- [ ] 实跑命令记录：<!-- 粘贴 -->

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
