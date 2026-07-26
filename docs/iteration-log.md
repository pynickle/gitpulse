# GitPulse 迭代日志

> 本文档记录 `self-iteration` 分支上每次提交的简洁中文功能说明,按时间倒序排列(最新在前)。

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
