# GitPulse 迭代日志

> 本文档记录 `self-iteration` 分支上每次提交的简洁中文功能说明,按时间倒序排列(最新在前)。

## 2026-07-27 — fix(server): GitHub 上游错误状态码不再统一坍缩为 500

修复 12 个 server 路由的错误处理:此前用 `'statusCode' in error` 判断可透传错误,而 Octokit 错误携带的是 `status` 字段,导致 GitHub 返回的 401(token 失效)、403(权限/限流)、404 等全部被映射成 500,客户端无法针对性处理。现统一改用 `throwGitHubRouteError`(保留上游状态码),搜索类端点(issues/pulls 列表与 freshness)改走 `translateGitHubSearchError`(搜索限流正确映射为 429),并让该函数的兜底分支也保留上游状态码。涉及:issues/pulls/repos/starred/notifications 列表、4 个 freshness 轮询端点、user、通知已读标记与 subject-states。

## 2026-07-27 — refactor(navigation): settings 与 tabs 页接入逻辑导航历史

将 /dashboard/settings 与 /dashboard/tabs 从硬编码的"返回仪表盘"迁移到通用 Back + Home 导航头:新增 settings / tabs-settings 导航入口类型并接入路由与入口的双向解析,返回时可恢复进入前的页面状态(例如所在的 tab),不再固定跳回仪表盘根页;删除两处不再使用的 backToDashboard 文案键,并补充导航路由 round-trip 测试。
