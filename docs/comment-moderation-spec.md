# Web 评论隐藏、取消隐藏与删除

状态：交互设计与 Testing Decisions 中的两个测试边界均已获用户确认，已发布为 [Issue #170](https://github.com/pynickle/gitpulse/issues/170)，标签为 `ready-for-agent`。

## Problem Statement

GitPulse 已展示 Issue、Pull Request、Discussion 及部分 Commit 评论，但读者无法直接执行 GitHub 已允许其执行的隐藏、取消隐藏和删除操作，必须离开当前阅读位置前往 GitHub。不同位置的评论具有不同资源类型与权限；仅凭评论作者或仓库角色推断操作权限，会暴露不可执行的操作或遗漏合法操作。

## Solution

在现有 Web 评论头部提供统一的常驻 `⋯` 菜单，仅显示当前 GitHub 身份和 token 可执行的操作。桌面使用锚定菜单，窄屏使用短操作面板。

隐藏通过与当前 Web App 的 assignee、label 编辑弹窗风格一致的原因选择弹窗完成。每次重新选择原因，不预选；选择后点击“隐藏”才提交。隐藏后保留评论头部，以原因和“展开”替换正文。Comment Expansion 仅供当前读者阅读，不改变 GitHub 上 Hidden Comment 的共享状态。

隐藏 Discussion 父评论不连带折叠子回复，每条回复独立尊重自身隐藏状态。具有权限的读者可以从菜单直接执行 Comment Unhiding，无需二次确认。删除只显示简洁二次确认，不附作者信息、正文预览或输入确认文字。

## User Stories

1. 作为 Issue 读者，我希望在评论原位找到可用操作，以便不离开 Detail Overlay 就能管理评论。
2. 作为 PR 读者，我希望在普通会话回复上使用相同菜单，以便跨 Issue 和 PR 保持一致操作习惯。
3. 作为 PR 读者，我希望在时间线行内评论及回复上管理目标评论，以便处理具体代码讨论。
4. 作为 PR 审阅者，我希望在 PR Review Workspace 使用相同操作，以便保持 Diff Viewer 中的阅读位置。
5. 作为 PR 读者，我希望 review 摘要有针对其真实资源的操作，以便不会把整次 review 与普通回复混淆。
6. 作为 PR 读者，我希望时间线中的 Commit 评论也能被正确管理，以便不同来源的评论不会调用错误接口。
7. 作为 Discussion 读者，我希望顶层评论、子回复和答案位置都提供一致操作，以便无需寻找同一评论的另一处展示。
8. 作为评论作者，我希望能删除 GitHub 允许我删除的自己的评论，以便清理不再需要的内容。
9. 作为具有管理权限的读者，我希望能对 GitHub 允许我管理的他人评论执行操作，以便维护讨论质量。
10. 作为只读用户，我希望看不到无权执行的管理操作，以便菜单不会误导我。
11. 作为使用受限 token 的用户，我希望可用操作尊重 token 的实际能力，以便不会仅因账号角色较高就得到错误承诺。
12. 作为桌面用户，我希望操作入口无需悬停就能看到，以便容易发现评论操作。
13. 作为窄屏用户，我希望通过短操作面板完成相同操作，以便不依赖鼠标悬停。
14. 作为键盘用户，我希望能打开菜单、选择原因、确认或取消操作，以便无需指针也能完成流程。
15. 作为准备隐藏评论的用户，我希望原因弹窗与当前 Web App 风格一致，以便继续使用熟悉的控件。
16. 作为准备隐藏评论的用户，我希望每次明确选择原因，以便不会静默沿用不适合当前评论的理由。
17. 作为准备隐藏评论的用户，我希望选择原因后仍需点击“隐藏”，以便选择本身不会立即修改 GitHub。
18. 作为准备隐藏评论的用户，我希望取消弹窗不产生写请求，以便可以放心退出操作。
19. 作为读者，我希望 Hidden Comment 保留头部并显示隐藏原因，以便理解为何正文被折叠。
20. 作为有阅读权限的用户，我希望能展开 Hidden Comment，以便查看需要的上下文。
21. 作为展开评论的读者，我希望 Comment Expansion 不会取消共享隐藏状态，以便个人阅读不改变其他人的呈现。
22. 作为 Discussion 读者，我希望隐藏父评论后仍能阅读子回复，以便其他参与者的内容不被连带遮住。
23. 作为 Discussion 读者，我希望每条已隐藏回复独立显示隐藏提示，以便父子评论的状态不会混在一起。
24. 作为有权限的读者，我希望直接执行 Comment Unhiding，以便快速恢复普通评论呈现。
25. 作为准备删除评论的用户，我希望有简洁二次确认，以便避免误删。
26. 作为准备删除评论的用户，我希望确认框只有必要文案和取消、删除按钮，以便不被作者预览、正文预览或输入要求打断。
27. 作为准备删除评论的用户，我希望取消确认不会执行删除，以便能安全放弃。
28. 作为正在提交操作的用户，我希望同一操作不会重复提交，以便不会产生重复请求。
29. 作为遇到失败的用户，我希望评论保持可读并看到错误，以便失败不会被伪装成成功或导致内容消失。
30. 作为跨多个位置阅读同一评论的用户，我希望成功操作同步反映在已有展示中，以便时间线、Workspace 和答案位置不会互相矛盾。
31. 作为重新打开详情的读者，我希望看到已在 GitHub 隐藏的评论状态，以便首次加载就尊重已有审核结果。
32. 作为删除有回复的 Discussion 评论的用户，我希望子回复按 GitHub 实际结果保留，以便删除父评论不会在 GitPulse 中错误移除整段讨论。
33. 作为 PR 读者，我希望隐藏、取消隐藏不会冒充解决会话或撤销 review，以便评论可见性与审阅状态保持清楚区分。

## Implementation Decisions

- **覆盖范围**：现有 Issue 和 PR 普通会话评论、PR 时间线与 PR Review Workspace 中的行内评论及回复、review 摘要、PR 时间线中的 Commit 评论，以及 Discussion 顶层评论、回复和答案展示。
- **入口与权限**：在现有评论头部提供常驻菜单触发器；没有可用操作时不显示空菜单。根据真实 GitHub 对象的删除、隐藏和取消隐藏能力决定可见项，不能使用评论作者的 association 或仓库角色作为唯一授权依据。未知能力不视为授权，实际写操作由 GitHub 最终判权。
- **最小复用**：普通 Issue/PR 评论接入现有共享评论卡片与头部；review、Workspace、Discussion 的现有展示接入同一操作行为。只复用确实共享的交互，不新建通用审核平台、复杂状态框架或批量操作设施。
- **数据契约**：评论读取、分页和新增评论返回的数据应保留原始 GitHub 对象类型、GraphQL node ID、需要时的数值 ID、隐藏状态、隐藏原因及三项操作能力。既有评论身份不因新增字段而改变。CommitComment 不能因为展示分类与 review comment 相同而被路由到 review comment 的 API。
- **GitHub 写入**：隐藏与取消隐藏使用 GraphQL 对应操作和 node ID。删除按真实资源类型调用对应的 GraphQL mutation 或 REST 端点。客户端提交目标与操作，不提交可被服务端当作授权依据的能力判断。
- **隐藏原因**：支持 GitHub 当前七项原因：辱骂或骚扰、重复内容、低质量内容、偏离主题、已过时、已解决、垃圾信息。API 枚举为 ABUSE、DUPLICATE、LOW_QUALITY、OFF_TOPIC、OUTDATED、RESOLVED、SPAM；正确映射返回的隐藏原因字符串。每次打开均无预选，未选择时不能提交。
- **隐藏弹窗**：沿用现有 Web App 的 assignee、label 等编辑弹窗视觉语言，包括遮罩、标题、间距、选项与底部按钮；不把原因选择设计成新风格的侧栏。选择原因只改变待提交选择，点击“隐藏”才写入 GitHub。
- **Hidden Comment**：保留原评论头部，正文替换为简短隐藏原因和“展开”。已有 GitHub 隐藏状态在首次渲染时即生效；Comment Expansion 只影响当前阅读呈现，不触发 Comment Unhiding。
- **Discussion 层级**：隐藏父评论只折叠其自身正文。子回复继续显示，并独立处理自身的隐藏状态。操作成功后同步更新该评论在普通会话和答案区域的已有展示。
- **Comment Unhiding**：只在具备对应能力时显示，点击后直接执行，不增加确认框；成功后恢复普通评论呈现。
- **删除确认**：只提供针对实际目标的简短确认文案及“取消 / 删除”；不显示作者信息、正文预览，不要求输入文字。取消不发写请求。review 目标必须用能区分整条 review 与普通评论的文案。
- **Review 边界**：review 摘要与其行内评论是独立目标。REST 删除 review 仅支持 pending；该限制不得被直接套用为 GraphQL 的状态限制。GraphQL review 删除按其对象能力处理，并验证实际 mutation 的结果；不得承诺所有 submitted review 都能删除，也不得仅因其已提交就硬编码不可删。不能把删除 review 实现成删除普通 IssueComment。
- **删除结果**：只在 GitHub 成功后应用删除结果。Discussion 评论有回复时，GitHub 可能清空父评论而保留回复；不能直接移除整棵回复树。答案、数量和相关展示以实际返回或重新读取的上游结果更新，不伪造恢复或 Undo。
- **状态同步**：一次成功操作应同步反映在同一评论已加载的时间线、Workspace、Discussion 会话或答案展示中；只更新或刷新受影响资源，不强制全页重载。
- **失败与加载**：提交中禁用重复操作。失败保留评论内容并使用现有错误呈现方式；权限失败重新获取相关能力，不在失败后假装成功。不得默默扩大 OAuth 或 PAT 权限。
- **既有基础设施**：复用现有 GitHub client、session、同源 API 请求及 CSRF 契约；新增私有 GET 如有必要沿用现有缓存和合并策略，不另建授权或客户端工厂。
- **交互一致性**：沿用既有弹窗、键盘焦点、语言与明暗主题惯例。遵守既有 pointer contract：触摸不留下 hover tint，按压不增加移动或缩放；键盘焦点可见。保留 Detail Overlay 和 PR Review Workspace 的既有布局及滚动行为。

## Testing Decisions

- **测试标准**：执行生产代码并断言用户可见结果、HTTP 响应和发给 GitHub 的请求。禁止读取源码做字符串匹配来证明功能，禁止仅凭快照、私有状态或组件内部结构判断正确性。
- **边界一：挂载真实评论展示的交互集成测试**。使用现有 SFC 编译与 DOM 挂载工具，在最高可行的现有评论/详情宿主处执行点击和键盘交互，仅替换网络依赖。验证常驻入口、权限过滤、原因弹窗、无预选及显式提交、取消不写入、隐藏后的正文替换、展开无 mutation、无确认取消隐藏、简洁删除确认、提交中状态和失败后的内容保留。
- **界面覆盖**：以参数化场景覆盖共享普通评论、review/Workspace 和 Discussion 的实际接入点；覆盖同一评论的多处已有展示、父评论及独立隐藏的回复、答案区域。复用一套交互断言，避免为每个薄封装重复相同测试。
- **边界二：实际服务端处理入口的契约集成测试**。沿用现有进程内 HTTP/handler 测试模式，只替换 GitHub 适配依赖。对评论读取及 mutation 断言返回的身份、能力与隐藏状态、各资源类型的真实分发、node ID 和 classifier 参数，以及上游成功或拒绝如何反映在公共响应中。
- **关键服务端场景**：IssueComment 与 PullRequestReviewComment 使用不同删除路径；CommitComment 不因展示分类混同而误发请求；review 的 GraphQL 能力不被 REST pending-only 规则替代；Discussion 父评论清空后仍保留回复；无效操作或原因不产生上游写请求；实际会话和 CSRF 契约不被绕开。
- **边界数量依据**：两个边界分别保护界面行为与 GitHub 请求契约。只测界面并 mock API 会遗漏服务端错误分发；只测服务端无法证明已确认的弹窗与阅读行为。不新增第三套领域测试接口，不为内部辅助函数逐个复制同样场景。
- **现有先例**：Detail Overlay feedback 和 Release Timeline reaction bar 的真实 SFC 挂载测试；raw repository file 的实际 H3 handler/进程内请求测试；timeline/reaction 的实际输入输出 fixture 测试。新增测试优先复用这些已有工具和隔离方式。
- **执行约束**：使用现有 Bun 测试组织方式，遵守并行文件的 mock 隔离约定。实现时运行贡献指南要求的格式、lint、typecheck 和行为测试；修改模板或样式时完成静态生成检查。当前任务不包含启动开发服务器、真实浏览器测试或对用户 GitHub 数据执行删除。

## Out of Scope

- Flutter 和浏览器扩展的评论功能，Gist 评论，以及当前 Web App 未展示的新资源页面。
- 删除 Issue、PR 或 Discussion 主题；修改主楼正文；新增评论编辑、举报、封禁用户、敏感信息清除等管理功能。
- 将隐藏评论等同于解决 review thread、dismiss review、撤销审批或丢弃整次 pending review。
- 批量隐藏/删除、审核队列、管理侧栏、新权限系统、新 token 申请流程或自动扩大授权。
- 删除确认里的作者信息、正文预览、输入确认文字，以及删除后的虚假 Undo。
- 全页布局、导航、评论加载机制或主题系统的无关重构。

## Further Notes

- 以上交互来自已确认的八项设计决定；界面集成与服务端契约两个测试边界也已获用户确认。
- 隐藏与展开的区别见 GitHub 的[评论管理说明](https://docs.github.com/en/communities/moderating-comments-and-conversations/managing-disruptive-comments)。能力和状态依据 [Minimizable](https://docs.github.com/en/graphql/reference/issues#minimizable)。
- 标准组织角色中，Triage 可隐藏 Discussion 评论；隐藏 Issue/PR/Commit 评论通常需要 Write 或更高角色。角色、自定义权限和 token 能力并不等价，不能用一张本地角色表替代对象能力。见[官方角色矩阵](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/repository-roles-for-an-organization#permissions-for-each-role)。
- [REST review 删除](https://docs.github.com/en/rest/pulls/reviews#delete-a-pending-review-for-a-pull-request)明确 pending-only；[GraphQL review 删除](https://docs.github.com/en/graphql/reference/pulls#deletepullrequestreview)没有逐状态展开说明。研究未通过真实账号执行删除，因此实现时保留能力判定和实际失败处理，不能捏造已验证的状态矩阵。
- [Discussion 删除](https://docs.github.com/en/graphql/reference/discussions#deletediscussioncomment)区分删除与有回复时清空评论；需要保留回复上下文。
- 父评论隐藏后保留回复是用户已确认的产品决定。关于 GitHub 页面行为的历史反馈与当前静态 HTML 仅作参考，不冒称已完成当前浏览器交互验证。
