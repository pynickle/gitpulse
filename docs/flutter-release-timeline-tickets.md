# Flutter Release Timeline：已发布子票

状态：用户已确认拆分并完成发布。父规格：[GitHub #95](https://github.com/pynickle/gitpulse/issues/95)。已创建 **17 个原生子 Issue**，均标记 `ready-for-agent`，并核对 **24 条原生阻塞关系**。

最后核对时间：2026-10-17T09:44:21.0637495Z。逐票核对了正文、标题、标签、父子关联和直接阻塞集合；父规格的正文、标题、标签、状态及评论数量保持不变。

每票是包含所需接口/存储/界面和行为测试的纵向切片。T 编号保留审批时的计划编号，实际 GitHub Issue 号见链接。

1. **[T01 · 连接后端并识别可用登录方式](https://github.com/pynickle/gitpulse/issues/96)**。直接阻塞：无，可立即开始。交付：启动五平台项目，输入后端地址，显示连接结果、能力兼容情况和可用登录方式。

2. **[T02 · 密码／PAT 登录与安全会话](https://github.com/pynickle/gitpulse/issues/97)**。直接阻塞：[#96](https://github.com/pynickle/gitpulse/issues/96)。交付：完成密码和 PAT 登录、记住会话、退出和身份切换，并明确区分认证失效与断网。

3. **[T03 · 浏览器 OAuth 登录交接](https://github.com/pynickle/gitpulse/issues/98)**。直接阻塞：[#97](https://github.com/pynickle/gitpulse/issues/97)。交付：系统浏览器完成 GitHub 授权，切回 App 后领取本次授权并建立自己的会话。

4. **[T04 · 在线时间线与共享刷新参考点](https://github.com/pynickle/gitpulse/issues/99)**。直接阻塞：[#97](https://github.com/pynickle/gitpulse/issues/97)。交付：读取已有关注仓库的发布，按日期和列数展示，刷新并正确使用账号共享参考点。

5. **[T05 · 手动补页与部分失败重试](https://github.com/pynickle/gitpulse/issues/100)**。直接阻塞：[#99](https://github.com/pynickle/gitpulse/issues/99)。交付：每次操作推进一轮各仓库分页，保留失败游标，并支持定向重试。

6. **[T06 · 搜索仓库并管理共享关注](https://github.com/pynickle/gitpulse/issues/101)**。直接阻塞：[#99](https://github.com/pynickle/gitpulse/issues/99)。交付：搜索或粘贴仓库 URL 来关注，查看和取消关注；网页和 App 使用同一列表。

7. **[T07 · 打开发布详情与基础富文本](https://github.com/pynickle/gitpulse/issues/102)**。直接阻塞：[#99](https://github.com/pynickle/gitpulse/issues/99)。交付：桌面抽屉／手机面板阅读发布正文，展示附件外链，并保留返回和滚动上下文。

8. **[T08 · Shiki 代码高亮与 SVG](https://github.com/pynickle/gitpulse/issues/103)**。直接阻塞：[#102](https://github.com/pynickle/gitpulse/issues/102)。交付：正文中支持代码着色、选择复制、横向滚动、SVG 徽章及未知语言降级。

9. **[T09 · 仓库发布列表与入口发布返回](https://github.com/pynickle/gitpulse/issues/104)**。直接阻塞：[#102](https://github.com/pynickle/gitpulse/issues/102)。交付：从发布抽屉查看同仓库的发布列表、分页筛选，并一步回到入口发布。

10. **[T10 · 仓库简介、README 与发布入口](https://github.com/pynickle/gitpulse/issues/105)**。直接阻塞：[#104](https://github.com/pynickle/gitpulse/issues/104)。交付：查看仓库简介、指标和 README，进入发布列表；不引入 Issue/PR、文件或提交浏览。

11. **[T11 · 保存历史并支持离线重启阅读](https://github.com/pynickle/gitpulse/issues/106)**。直接阻塞：[#100](https://github.com/pynickle/gitpulse/issues/100)、[#102](https://github.com/pynickle/gitpulse/issues/102)。交付：按账号期限保存时间线与正文，重启离线恢复上次已开放窗口；在线暂不复用未验证历史。

12. **[T12 · 验证分页连接并统一开放缓存](https://github.com/pynickle/gitpulse/issues/107)**。直接阻塞：[#106](https://github.com/pynickle/gitpulse/issues/106)。交付：逐仓库沿分页接回缓存，所有必要仓库满足条件后才扩展；支持断层和末尾无锚点恢复。

13. **[T13 · 同步保留期限与清理本机缓存](https://github.com/pynickle/gitpulse/issues/108)**。直接阻塞：[#106](https://github.com/pynickle/gitpulse/issues/106)。交付：在设置中调整 1–90 天并跨设备同步，清理本机缓存，同时保留登录和服务器状态。

14. **[T14 · 缓存竞态、写入失败与损坏恢复](https://github.com/pynickle/gitpulse/issues/109)**。直接阻塞：[#101](https://github.com/pynickle/gitpulse/issues/101)、[#107](https://github.com/pynickle/gitpulse/issues/107)、[#108](https://github.com/pynickle/gitpulse/issues/108)。交付：处理中途取消关注、清理、切换身份及磁盘故障，避免旧响应复活数据，并提供可操作的恢复提示。

15. **[T15 · 只搜索筛选当前已开放历史](https://github.com/pynickle/gitpulse/issues/110)**。直接阻塞：[#107](https://github.com/pynickle/gitpulse/issues/107)。交付：搜索仓库、标题、标签及可选正文，按仓库／日期／预发布筛选；断开缓存不参与结果和新增计数。

16. **[T16 · 中英文与浅深色主题偏好](https://github.com/pynickle/gitpulse/issues/111)**。直接阻塞：[#96](https://github.com/pynickle/gitpulse/issues/96)。交付：提供跟随系统或手动中英文、浅深色主题切换，并持久保存偏好。

17. **[T17 · 独立打包、平台配置与最终验收](https://github.com/pynickle/gitpulse/issues/112)**。直接阻塞：[#98](https://github.com/pynickle/gitpulse/issues/98)、[#103](https://github.com/pynickle/gitpulse/issues/103)、[#105](https://github.com/pynickle/gitpulse/issues/105)、[#109](https://github.com/pynickle/gitpulse/issues/109)、[#110](https://github.com/pynickle/gitpulse/issues/110)、[#111](https://github.com/pynickle/gitpulse/issues/111)。交付：产出完整 Windows ZIP 和正式签名 APK 构建流程，核对其他平台配置并完成整体验收。

## 执行与依赖原则

- 发布时唯一无阻塞的起点是 [T01 / #96](https://github.com/pynickle/gitpulse/issues/96)；之后按 GitHub 原生依赖关系推进当前可开始的票。
- 所列仅为直接且必要的前置；已检查无环，未重复列入传递依赖。
- OAuth 与在线时间线可在会话完成后独立推进；代码/SVG 与发布列表可独立推进；缓存重连与期限设置可在持久保存完成后独立推进。
- 语言/主题配置只依赖连接壳，不被认证或缓存人为阻塞。
- 每票自带测试；最后的打包票不承担补齐前序功能测试的职责。
- 该发布仅建立子票和依赖，不启动应用实现，也不发布应用或部署生产后端。

## 本地记录

审批时的逐票草稿、实际发布正文与可恢复发布记录保留在本地工作草稿中。GitHub Issue 是当前执行入口；本清单保留已经核对的发布快照。
