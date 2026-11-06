# GitPulse 迭代日志

> 本文档记录 `self-iteration` 分支上每次提交的简洁中文功能说明,按时间倒序排列(最新在前)。

## 2026-11-06 — fix(dashboard): 右滑确认的停留从松手时开始计时

成功加入/移出后的停留此前要等 `PUT /api/settings` 返回才开始计时,所以本地 fs 存储看起来约 800ms,Vercel + Upstash Redis 上同样的停留会多出一次写入往返(以及保存队列里排在它前面的写入),显得明显更长。现在成功态从松手时倒计时,总停留稳定在 600ms(写入本身慢于 600ms 时至少等到真实结果);失败态仍从失败出现起完整停留 1000ms。计时决策抽到 resolveNotificationTodoSwipeHold 并由测试覆盖。

## 2026-11-06 — feat(dashboard): 右滑引导改为列表顶部的常驻卡片

首次进入的右滑引导不再用卡片下方那条会自动消失的黑色 pill:窄屏通知列表顶部现在是一张与下方通知卡片左右边界对齐的引导条,左起一个手势图标、一行简短说明「右滑卡片加入待办」,右侧是关闭按钮。它随列表加载淡入,演示结束后仍然留在原地,只有读者点关闭才收起。演示本身从 1420ms 延长到 2200ms(440ms 滑出 + 1320ms 停留 + 440ms 回位),图标与文字在卡片开始回位前先淡出(与松手未达阈值/加入或移出待办后的处理一致,卡片不会压在标签上滑回);演示仍由任何触摸/按键/滚轮、切换标签或跨到宽屏终止。引导条与被引导的行解耦:行还没完成信息补全时引导条也能先出现,列表为空时不会出现(通知模板根本不渲染)。进入和关闭用同一条网格轨道 `grid-template-rows: 0fr → 1fr` 折叠高度,引导条自身只动 opacity 与 6px 位移;行内容不参与动画、也不会各自提升合成层,代价由这一个盒子的尺寸变化带动下方内容的常规回流,而不是逐行动画或测量高度,`prefers-reduced-motion` 下全部关掉过渡。首次访问标记仍按原语义在窄屏通知列表就绪时消费,关闭引导条不会二次写入。

## 2026-11-06 — feat(dashboard): 窄屏通知行改用右滑加入待办

窄屏通知列表右侧的"加入待办"按钮(26px)与已读按钮挤在 30px 一列里,点击目标偏小。现在窄屏触摸视口移除该按钮,改由通知卡片本身承载:按住卡片右滑露出背后的绿色操作面,松开超过行宽 25% 执行与按钮相同的切换,跟手上限为行宽的 35%,起手判定 8px 且必须横向明显大于纵向,纵向滚动仍由浏览器负责(touch-action: pan-y)。已在待办的行右滑同样可移出,操作面改用危险色并以「移出待办」区分;成功后在露出位置停留约 800ms 显示对勾与「已加入待办」,再用 200ms 回位;保存失败会显示「未能加入待办」而不是静默回滚(useNotificationTodos 现在如实返回失败)。

操作面铺满整行、垫在整张卡片下面(卡片自带一层与自身同尺寸的不透明衬底),让露出的绿色是"卡片压在色块上"而不是左侧一条色带;因为未读卡片底色是半透明的,没有衬底的话整张卡都会被染上绿/粉。已在待办的行只在边框上标记(accent 描边 + 1px 内环),卡片本体、未读底纹与左侧 4px 未读竖条完全不变。触摸端不再有加入按钮,仍可从详情侧栏加入/移出;窄窗口用鼠标时按钮保留,宽屏布局与改动前一致。

首次进入的右滑引导改存为用户设置 onboarding.notificationTodoSwipeSeen:窄屏首次打开通知页且列表就绪即消费该标记(列表为空也消费),同一次页面加载内之后出现的通知仍可播放一次。引导在 500ms 后把首张"未在待办"的卡片右移 56px 停住并显示「右滑加入待办」,全程不写入任何待办;任何触摸/按键/滚轮、切到其它标签或跨到宽屏都会立即取消,prefers-reduced-motion 下不平移、只显示静态提示。

## 2026-07-27 — fix(repo): star/关注操作失败不再静默

仓库详情的 Star 与关注(watch)切换此前失败时只做乐观回滚、无任何提示,在 token 权限不足或限流时表现为"按钮点了没反应"。现在失败会在标题行下方显示内联错误(优先展示服务端错误信息,5 秒后自动消失,带 role=alert),状态照常回滚;新增 repoDetail.starError/watchError 中英文案。已用注入的 403 响应实测回滚与提示。

## 2026-07-27 — fix(server): 用户设置读取接入请求合并处理器

/api/settings 是全部私有数据 GET 端点中唯一仍用裸 defineEventHandler 的(违反 AGENTS.md 约定),现改用 definePrivateApiCoalescedEventHandler,使并发的设置读取合并为一次存储访问,缓存头行为与其他端点一致。

## 2026-07-27 — fix(timeline): 清理假头像回退与不随语言的日期格式

Markdown 评论编辑器(含延迟加载版本)在会话缺少头像时回退到会 404 的 https://github.com/placeholder.png 假图和英文 "You" 昵称,现改为空值以触发 GitHubAvatar 的占位图标;议题侧栏"创建/更新"时间此前用 toLocaleString()(跟随浏览器而非应用语言),现改用 Intl.DateTimeFormat 按应用当前 locale 格式化,与其余日期展示保持一致。

## 2026-07-27 — fix(i18n): 详情加载失败文案本地化并优化错误提取

useDashboardDetails 中五类详情(议题/PR/讨论/发布/仓库)的加载失败兜底文案此前硬编码英文,且错误面板直接显示 ofetch 原始报错(形如 [GET] "/api/..." 500);现改用 getFetchErrorMessage 优先提取服务端 statusMessage、兜底走 detailOverlay.loadError.* 中英文案,PRDetail 中孤立的英文兜底一并接入,相关测试补充 useI18n mock。

## 2026-07-27 — fix(i18n): RepoDetail 内联双语文案迁入 locale 文件

仓库详情组件此前用一个约 35 键的手写双语 copy 对象(按 locale 前缀二选一)与 i18n 系统并行,翻译人员在 locale 文件中完全看不到这些文案,新增语言也会静默回退英文。现将全部键迁入 en/zh-cn 的 repoDetail 段并通过 t() 解析,模板调用点不变。迁移中发现并修复一个隐蔽陷阱:文案"仅被@时"中的裸 @ 是 intlify 链接语法,会导致整个 zh-cn locale 编译失败、所有翻译回退为键名,已按项目惯例转义为 \\@。

## 2026-07-27 — fix(ui): 详情与子页面外框在窄屏收窄内边距

DashboardOverlayFrame 与详情面板此前固定 2rem/4rem 内边距且无任何响应式断点,在手机(约 375px)视口下左右各浪费 64px,内容被压缩到约 240px 宽。现在与移动端筛选弹层一致以 860px 为断点,窄屏下收窄为 1.25rem,所有详情 overlay 与仪表盘子页面(profile/wiki/starred/releases/package/settings)同时受益。已在 375px 模拟视口实测。

## 2026-07-27 — refactor(server): 统一 involves 搜索查询构建,删除死代码

仪表盘议题/PR 列表与对应 freshness 轮询端点此前各自手写相同的 GitHub 搜索串(共 4 处重复),一旦有人只改列表不改 freshness,freshness 签名将悄悄失真。现提取 buildInvolvesSearchQuery 到 server/utils 作为唯一构建点,四个端点统一复用,并改用共享的 normalizeSearchTotalCount;同时删除从未被调用的 buildIssueSearchRequestParams(约 120 行死代码)及其无用依赖。

## 2026-07-27 — feat(detail): 支持在应用内关闭/重新打开议题与拉取请求

补上最常用的分诊操作:新增两个 CSRF 保护的 PATCH 状态路由(issues/{n}/state 与 pulls/{n}/state,复用 executeGitHubRequest 错误处理),权限端点新增 canManageItemState(triage 及以上),前端在议题与 PR 详情侧栏新增"关闭/重新打开"按钮——仓库协作者或条目作者可见;已合并的 PR 不显示。议题侧乐观更新状态并在时间线插入 closed/reopened 事件,PR 侧成功后重新拉取详情与时间线;顺带将锁定/解锁的乐观事件假头像(placeholder.png)换成真实会话用户信息。新增中英文案 8 组,浏览器实测关闭→重开完整闭环。

## 2026-07-27 — fix(a11y): 补齐三个弹窗的焦点陷阱与焦点恢复

人员选择弹窗(reviewer/assignee)、字体选择弹窗和 Mermaid 图表查看器此前缺少焦点管理:Tab 会穿透到弹窗背后的页面,关闭后焦点丢失。现统一接入现有的 createFocusTrapController:打开时记录触发元素、Tab 在弹窗内循环、关闭后焦点还原到触发按钮,与 FilterModal/筛选抽屉行为保持一致。

## 2026-07-27 — fix(a11y): 仪表盘列表行支持键盘打开

待办/通知/议题/PR/自定义视图五类列表行此前是仅响应鼠标点击的普通 div,键盘和读屏用户无法打开任何条目。现在列表行带有 role="button" 与 tabindex,可用 Tab 聚焦、Enter/空格打开,并带可见的焦点环;卡片内部的"标记已读/加入待办"等按钮通过事件目标判定不会误触行打开。因通知卡片内含真实按钮,不能改用原生 button 包裹,故采用 role 方案。

## 2026-07-27 — fix(a11y): 胶囊筛选组支持方向键切换

修复 5 处使用 role=tablist + roving tabindex 但没有键盘处理的筛选组(发布页类型筛选、包详情版本筛选、个人资料包类型筛选、仓库详情面板切换与状态筛选):此前 Tab 键会跳过 tabindex=-1 的未选中项,键盘用户完全无法切换这些筛选。新增共享工具 handleRovingTablistKeydown(支持 ←/→/Home/End,选中后焦点跟随,不循环),五处统一接线,并补充 6 个单元测试。

## 2026-07-27 — fix(i18n): 内置仪表盘标签名跟随界面语言

内置视图标签(待办/通知/议题/拉取请求/仓库)此前在 useTabMigration 中硬编码英文,导致中文界面下侧栏、活动栏提示、Manage Views 列表和浏览器标题全部显示英文。现在 TabItem 支持 nameKey 字段,内置标签名通过 i18n 键在 composable 内解析为当前语言,徽章计数等状态维护在底层原始列表上不受影响。

## 2026-07-27 — fix(i18n): 修补一批绕过 i18n 的硬编码英文文案

批量修复散落的 i18n 缺口:活动栏"设置/退出登录"提示与"视图分组"aria-label、标签侧栏与贡献图的英文 aria-label、仓库卡片"Private"徽章与"Open repository"悬浮提示、搜索查询 token 的英文 tooltip、仪表盘文档标题的英文回退表、筛选自动补全下拉未接线的"未找到结果"文案;同时补全 zh-cn 中残留的英文值(repoDetail 议题/拉取请求标签与空状态、releaseDetail 与详情加载文案),新增 logout/tabs/tokenizedQuery/repoItem 等文案键,中英文键位保持完全对齐。

## 2026-07-27 — feat(dashboard): 议题/PR/仓库/自定义视图列表补充空状态

此前仪表盘中只有待办与通知两个列表有空状态提示,议题、拉取请求、仓库和自定义搜索视图在列表为空时直接白屏。现在四类列表在空列表时都会显示与现有模式一致的提示文案,并区分"确实没有数据"与"当前筛选条件下无匹配"两种情况,新增 8 组中英文案(dashboard.issues/pulls/repos/customTab 的 empty 与 emptyFiltered)。

## 2026-07-27 — fix(dashboard): PR 详情加载失败可见错误并支持重试

修复 PR 详情加载失败时永远停留在加载动画的问题:loadPRData 此前未配置 fallbackError,详情 overlay 对 pull-request 面板也硬编码了空错误串,导致 404/限流/网络错误时 loading=false、hasData=false、error='' 而无限转圈。现在 PR 面板错误会正常传递到 overlay,并且所有详情类型(issue/PR/discussion/release/repo)的错误面板都新增了"重试"按钮(走 refreshCurrentDetail 强制重载),新增 detailOverlay.retry 中英文案。

## 2026-07-27 — fix(server): GitHub 上游错误状态码不再统一坍缩为 500

修复 12 个 server 路由的错误处理:此前用 `'statusCode' in error` 判断可透传错误,而 Octokit 错误携带的是 `status` 字段,导致 GitHub 返回的 401(token 失效)、403(权限/限流)、404 等全部被映射成 500,客户端无法针对性处理。现统一改用 `throwGitHubRouteError`(保留上游状态码),搜索类端点(issues/pulls 列表与 freshness)改走 `translateGitHubSearchError`(搜索限流正确映射为 429),并让该函数的兜底分支也保留上游状态码。涉及:issues/pulls/repos/starred/notifications 列表、4 个 freshness 轮询端点、user、通知已读标记与 subject-states。

## 2026-07-27 — refactor(navigation): settings 与 tabs 页接入逻辑导航历史

将 /dashboard/settings 与 /dashboard/tabs 从硬编码的"返回仪表盘"迁移到通用 Back + Home 导航头:新增 settings / tabs-settings 导航入口类型并接入路由与入口的双向解析,返回时可恢复进入前的页面状态(例如所在的 tab),不再固定跳回仪表盘根页;删除两处不再使用的 backToDashboard 文案键,并补充导航路由 round-trip 测试。
