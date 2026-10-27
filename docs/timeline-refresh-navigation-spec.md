## Problem Statement

Flutter 的 Release Timeline 将“目前已加载 N 个新版本”单独放在一行，辅助信息挤占了用户阅读版本卡片的空间。
手机用户需要点击顶部按钮才能刷新，阅读较早版本后也缺少一键返回最新内容的入口。

增加手势和快捷操作时，用户希望保留清晰、稳定的视觉体验：刷新期间仍可阅读旧内容，失败后不丢失
Timeline Reading Position，控件不会遮挡底部操作，时间文字在窄屏上仍完整显示。

## Solution

仅调整 Flutter Release Timeline：将新版本计数并入既有刷新信息行，在列表真正顶部增加下拉刷新，
并在向下滚动超过一屏后显示右下角回顶部按钮。保留工具栏刷新入口，使触控、鼠标和键盘用户都能刷新。

下拉与按钮刷新采用相同的内容、搜索、筛选和结果处理规则；根据触发方式，仅在一处展示主要进度指示。
刷新获得可用结果后返回顶部；完全失败时保留旧内容和阅读位置。回顶部按钮只改变阅读位置，不请求数据。

视觉沿用仓库既有的 Flutter 令牌与主题的字阶、语义色、尺寸、间距、边框、交互状态和动效档位。
确有必要的规范扩展必须先说明理由与替代方案，并由用户明确审核后再落地。

## User Stories

1. As a Flutter Release Timeline user, I want the new-release count beside the previous refresh information, so that more vertical space is available for release cards.
2. As a user on a narrow phone, I want the complete refresh-time wording, so that I can understand its reference point without opening a tooltip.
3. As a user with enlarged text, I want the information to remain readable and controls reachable, so that accessibility settings do not hide information or actions.
4. As a user of either supported language, I want localized time and number formatting, so that the compact information remains natural to read.
5. As a Release Timeline user, I want the count to describe loaded releases matching my current search and filters after the Timeline Refresh Baseline, so that I do not mistake it for an unread count or a complete remote total.
6. As a Release Timeline user, I want zero counts and counts without a refresh baseline to stay hidden, so that the information line stays concise.
7. As a screen-reader user, I want a changed count announced with its complete meaning, so that I can understand the update without losing focus.
8. As a touch user, I want to pull down at the actual top of the timeline to refresh, so that I can request fresh releases using a familiar gesture.
9. As a user with a short list or refreshable empty results, I want pull-to-refresh to remain available, so that I do not need enough content to fill the screen before refreshing.
10. As a touch user, I want releasing a small uncommitted pull to cancel it, so that incidental movement does not send a refresh request.
11. As a user reading older releases, I want downward movement away from the actual top to remain ordinary scrolling, so that reading does not accidentally refresh the timeline.
12. As a mouse or keyboard user, I want to keep the toolbar refresh button, so that refreshing does not depend on a touch gesture.
13. As a user with an active Release Timeline Search and Active Timeline Filter, I want both preserved through refresh, so that requesting fresh data does not reset my selection.
14. As a user waiting for refresh, I want existing cards to stay visible at their normal brightness and remain readable and scrollable, so that a slow response does not interrupt reading.
15. As a user refreshing the timeline, I want one clear progress indicator associated with my action, so that the interface communicates activity without competing spinners.
16. As a user who repeats a gesture or click while refresh is pending, I want only one refresh to be accepted, so that repeated input does not restart the operation.
17. As a user receiving usable refresh results, I want the latest matching releases at the top, so that I can immediately review new content.
18. As a user receiving refresh results, I want stable controls and a continuous picture without blank frames or staged card entrances, so that the update is easy to follow.
19. As a user whose refresh completely fails, I want my old cards and reading position preserved with an error and retry action, so that I can continue reading and recover deliberately.
20. As a user whose refresh succeeds for only some Followed Repositories, I want usable results and the existing repository-failure indication, so that I can distinguish partial coverage from complete failure.
21. As a user retrying failed repositories or loading earlier releases, I want those operations to keep their existing Timeline Refresh Baseline semantics, so that they do not change which releases count as new.
22. As a user who has scrolled more than one viewport below the top, I want a persistent return-to-top button, so that I can reach the latest releases without repeated swipes.
23. As a user near the top, I want that button hidden, so that it does not occupy attention when unnecessary.
24. As a user tapping return to top, I want the actual first date group and matching release shown even after reading-position restoration, so that the action does not stop at an internal scroll anchor.
25. As a user tapping return to top, I want no refresh request or filter change, so that navigation alone does not alter the timeline data or its reference point.
26. As a user watching the return movement, I want a brief decelerating animation that I can interrupt by scrolling, so that the transition is understandable and stays under my control.
27. As a user who requests reduced motion, I want direct positioning and immediate button visibility changes, so that the feature respects my system preference.
28. As a user reaching the end of the timeline, I want the last card and load-earlier action fully reachable above the floating button, so that navigation controls do not obstruct content or pagination.
29. As a user with system navigation or an app navigation bar, I want the floating button above those areas, so that it stays reachable and does not overlap system controls.
30. As a light- or dark-theme user, I want the new controls to use the existing theme and contrast rules, so that the feature looks consistent in either appearance.
31. As a keyboard or screen-reader user, I want an accessible return-to-top name and visible keyboard focus, so that the new action works without visual gesture discovery.
32. As a user switching away from the timeline and returning, I want existing reading-position restoration preserved, so that the new actions do not disrupt ordinary reading continuity.
33. As a user opening the timeline with no previous content, I want the existing initial loading and empty-state presentation, so that first load remains understandable.
34. As the product owner, I want this change limited to the Release Timeline, so that other pages and the Release Drawer retain their existing interactions.
35. As the product owner, I want proposed design-system extensions submitted for review before implementation, so that approved feature behavior does not silently authorize new visual rules.

## Implementation Decisions

1. **范围与模块职责**：调整 Release Timeline 的工具栏、列表滚动协调、刷新呈现和现有会话刷新状态。
   复用既有会话、服务、主题、本地化和阅读位置能力，不建立第二套分页、计数或数据请求实现。
2. **计数含义**：统计当前已加载 Shared Timeline Window 内、符合当前搜索和筛选、发布时间晚于
   Timeline Refresh Baseline 的去重新版本数。它不是未读数、远端全部新版本数，也不是刚收到的响应条数。
   沿用零计数隐藏行为；没有刷新基准时不显示该计数。
3. **顶部排版**：保持搜索及操作按钮一排、完整刷新信息与计数及筛选入口一排；移除固定的计数第三排。
   窄屏不主动缩短或省略时间。大字号导致空间不足时允许同一信息段自然换行，不恢复固定独立计数行。
4. **文字与本地化**：时间和计数均使用 Dense Chrome 的 meta 角色，即 12 / 1.33、w400 和
   onSurfaceVariant；不另行加粗数字，不增加徽标底色或未读红点。沿用时间语义与本地化格式，
   补充中英文本地化和完整的计数无障碍描述。
5. **下拉边界**：只有在列表真正顶部向下继续拖动才进入刷新手势，采用标准触发阈值与释放手感。
   未达到阈值就松手不发请求；短列表和可刷新的空结果也可触发。顶部搜索和信息区域固定，
   仅列表区域响应手势，不自定义拉伸、弹跳或页面整体位移。
6. **共用刷新行为**：下拉和工具栏操作进入同一刷新流程，保留当前搜索和筛选。刷新期间禁用重复提交，
   不允许两个入口互相重启当前操作。保留原有会话生命周期与过期响应处理机制。
7. **保留阅读连续性**：有旧内容时，刷新期间保留当前卡片、阅读位置和正常亮度，允许阅读与滚动。
   不用遮罩或页面级加载替换已有列表。首次没有任何内容时仍使用既有页面级加载组件。
8. **单一进度位置**：下拉触发时在列表上沿显示圆形进度，工具栏刷新按钮禁用且不再旋转；
   工具栏触发时只在按钮原位显示进度。控件尺寸和工具栏布局稳定，进度使用主题色和容器底色且无阴影。
9. **可用结果**：获得可用结果，包括部分成功结果后，呈现新列表及对应计数并返回当前结果顶部。
   用户已在顶部时直接呈现更新；从深处通过工具栏发起刷新时使用 240ms 减速移动。
   不出现中间空白帧、卡片逐个入场、计数闪动或额外成功提示；保留现有刷新分界标记的语义。
10. **完全失败与部分失败**：完全失败保留旧内容和 Timeline Reading Position，恢复刷新入口并提供紧凑错误和重试。
    错误区域出现不应抢走焦点或移走正在阅读的卡片。部分成功继续使用已有仓库失败提示，
    不把仍可用的结果整体替换成错误页。
11. **真正顶部与阅读锚点**：列表采用基于内容身份和卡片内偏移的阅读位置，不可假定滚动偏移零就是顶部。
    计算手势边界、离顶距离和回顶目标时，需考虑阅读锚点之前的内容以及可能的负滚动范围。
    回顶部后保存的阅读位置应与实际顶部一致，切换页面后不能恢复到已离开的旧位置。
    正常切页恢复阅读、历史加载和列表变化时维持阅读稳定的能力必须保留。
12. **出现条件**：以列表实际可视区域高度为一屏，距离真正顶部超过一屏时显示按钮，回到一屏以内时隐藏。
    达到显示条件后不因滚动方向或停顿隐藏。按钮显隐为 120ms 淡入淡出，不缩放、不弹跳。
13. **按钮外观**：48dp 圆形点击区域、20dp Material vertical_align_top 图标；底色 surfaceContainerHigh，
    图标 onSurface，1dp outline 外边框，无阴影。右侧和底部复用 16dp gutter，底部从应用导航栏与系统安全区上方计算。
14. **回顶行为**：点击仅执行 240ms 减速滚动，抵达当前筛选结果的最新日期分组及第一条结果，
    不刷新、不修改搜索或筛选、不推进刷新基准。手动滚动可中断；减少动画模式下直接定位并即时切换按钮显隐。
15. **避免遮挡与无障碍**：为列表末尾预留按钮所需空间，使最后卡片和“加载更早”可以完整滚至按钮上方。
    保留按钮的可读名称、提示和键盘可达性；焦点、悬停、按压和禁用态复用全局主题，不新增局部按压底色。
    计数变化以完整语句播报，避免在刷新中间过程反复宣布不稳定数值。
16. **领域及数据契约**：沿用 Shared Timeline Window 的有界覆盖、Partial Timeline Window、
    Connected Cached History 和 Saved Visible Timeline 的既有规则。不得把展示中的旧卡片误当成
    新一轮已确认的缓存成员；可用结果接入和失败保留应与现有缓存保存边界一致。
    无需新服务器端点、数据库结构、用户设置或新的刷新基准。分页和失败仓库重试保持原有基准语义。
17. **设计规范与扩展**：遵守仓库既有的 Flutter 视觉令牌及当前有效的交互 ADR；后续按压规则覆盖旧版有色按压反馈。
    此前数字稍加粗的建议已因 meta 角色要求修正为 w400。当前方案无需新字号、颜色、间距、线宽、
    动效时长或规范例外。如实现确需扩展，先列用途、原因和替代方案，由用户明确审核后才修改规范和实现。

## Testing Decisions

- **主要测试入口，已获用户确认**：以现有挂载真实 Flutter 应用的 widget 测试作为唯一主要新增测试边界，
  通过已有可控后端测试替身及内存缓存驱动真实时间线流程。复用现有 mountApp、FollowsServer 和
  可延迟响应能力，不为刷新控制器、滚动控制器或内部状态字段增加专用测试接口。
- **好测试的标准**：实际挂载应用、拖动、点击、输入和切换页面，断言可见文字、几何位置、焦点与无障碍语义、
  请求次数及公开请求合同。不能通过读取源码、匹配字符、检查私有变量或复制算法证明行为。
- **现有先例**：时间线阅读位置测试已通过应用挂载覆盖手机及多列布局、真实拖动、延迟刷新、
  切页恢复和请求次数；工具栏测试已覆盖中英文、320dp 窄屏、大字号、操作可见性和加载状态。
  在这些先例上复用测试支持；不把为本功能新增多个底层单元测试入口作为前提。
- **计数和排版**：在真实界面验证完整时间与计数同排、正常宽度没有固定第三排、零计数及无基准隐藏、
  搜索与筛选影响计数、计数格式与语义。覆盖中英文、窄屏、长日期和大字号，断言文本完整呈现与
  控件可达，而非仅断言 Text 中存在完整字符串。
- **下拉**：验证实际顶部足量拖动恰好发起一次刷新、不足阈值不发请求、非顶部不触发、
  短列表及可刷新空结果可触发、刷新中两入口不会重复提交。
- **刷新结果**：用可延迟、失败和部分失败的后端响应验证旧内容持续可见且可滚动、只有一处主要进度、
  搜索筛选保留、成功返回最新结果顶部、完全失败保持原可见卡片及其位置、部分成功仍显示可用结果。
  对有旧数据的刷新在响应前、中、后分别断言，避免只看最终结果遗漏中间白屏。
- **回顶部**：验证一屏阈值、方向与停顿不影响应显示状态、120ms 显隐、240ms 回顶、
  点击不增加请求、负滚动范围或恢复锚点后仍抵达真正顶部、之后切页不恢复旧锚点。
  验证手动中断、减少动画、末尾卡片及“加载更早”的可见性和点击可达性。
- **主题及无障碍**：覆盖亮暗主题、触控与键盘入口、提示和可访问名称、计数状态播报，以及错误提示不夺取焦点。
  通过实际布局和交互结果验证控件尺寸、边界和无溢出；必要时复用既有工具栏挂载先例做定向排版检查。
- **回归与检查**：运行 Flutter 静态分析、格式检查及 Flutter 测试，维持分页、阅读位置、筛选、缓存和会话回归。
  本规格的产出不等于已实现或已运行这些检查；设备或 Marionette 交互验收仅在用户明确要求时执行。

## Out of Scope

- Web 应用、浏览器扩展及其他 Flutter 页面上的相同控件。
- 为关注仓库、Repository Release List、README 或 Release 正文增加下拉刷新或回顶部。
- 修改 Release Drawer 的下拉缩小和关闭手势，或在抽屉中叠加下拉刷新。
- 自动无限滚动、自动扫描历史、修改“加载更早”的显式分页方式或提高覆盖完整性保证。
- 把新版本计数变成未读状态、远端总量、Recovered Release History 或新的通知机制。
- 修改认证、后端 API 合同、账户共享 Timeline Refresh Baseline、缓存保留策略或存储结构。
- 新设置、新字体、配色重设计、局部按压反馈、未经批准的规范扩展或额外动效系统。
- 发布 Flutter 安装包、启动开发服务器或执行未经要求的浏览器与设备自动化。

## Further Notes

- 产品选择已在对话中确认：Q1 A（计数并入信息行）、Q2 A（仅时间线）、Q3 A（右下角浮动按钮）；
  完整时间文案、Q5 的显隐和回顶规则、Q6 的刷新行为及 Q7 的视觉方案均已确认。
- 用户提到 DESIGN.md，但当前仓库中未找到该文件；本轮只依据仓库内既有实现核对，未声称已经符合尚未读取的文件。
  若用户提供另一份设计文件，应在实现前补充核对。
- 当前实现会在刷新入口提前清除阅读锚点并重建列表；本规格要求将失败保留位置及旧内容的保证落实到实际行为，
  不能只在现有刷新外围添加手势和按钮。滚动偏移零不一定为顶部，是另一个已确认的实现注意点。
- 产品方案及上述测试入口均已获得用户明确确认；发布到 pynickle/gitpulse 的 GitHub Issues，
  使用唯一 triage 标签 ready-for-agent。此确认不代替对未来设计规范扩展的单独审核。
- 已发布：[GitHub Issue #130](https://github.com/pynickle/gitpulse/issues/130)。
