# GitHub 评论隐藏与删除：权限及 API 边界

研究日期：2026-11-10。范围为 GitHub.com 当前官方文档；用于评论操作的产品设计，不代表已经实现或完成真实账号权限矩阵测试。Context7 CLI 已先解析 GitHub API 文档库，再分别查询 GraphQL 和 REST；精确限制以直接读取的官方文档为准。Tavily 部分请求遇到 429，随后直接读取 GitHub Docs 补齐。

## 结论

GitHub 的 Hide 是共享的审核状态：评论被 minimize，仍有读取权限的人可以展开。读者临时展开不等于 Unhide；后者会改变 GitHub 上的审核状态。GitPulse 的本地收起若保留，应叫“收起”，并与“隐藏评论”分开。[管理评论](https://docs.github.com/en/communities/moderating-comments-and-conversations/managing-disruptive-comments#hiding-a-comment)

权限不能归结为“只有自己的评论能删”或“仓库 collaborator 都能隐藏”。应返回具体对象的 `viewerCanDelete`、`viewerCanMinimize`、`viewerCanUnminimize`，再结合对象种类及状态决定菜单；实际写操作仍由 GitHub 判权。`authorAssociation` 描述评论作者与仓库的关系，不是当前读者的授权。[GraphQL Issues：权限接口及作者关系](https://docs.github.com/en/graphql/reference/issues#minimizable)

## Discussion 父评论隐藏后的回复呈现

官方管理评论文档说明选中评论会折叠，具有读取权限的人仍可展开，但未明确描述隐藏 Discussion 顶层评论时子回复是否继续显示。[官方隐藏说明](https://docs.github.com/en/communities/moderating-comments-and-conversations/managing-disruptive-comments#hiding-a-comment)

找到直接描述这一界面的第一手反馈：2023-06-26 的 GitHub Community 讨论 #59323，发帖者报告通过 Hide 将顶层评论标为 resolved 时，只有选中评论被隐藏，并请求连带隐藏子评论。这支持当时的 UI 仅折叠父评论、保留回复。该帖子后续非工作人员的 AI 回复不作为依据；2025 年的简短跟帖也不足以独立验证当前实现。[原始使用反馈](https://github.com/orgs/community/discussions/59323)

另通过 HTTP 读取当前 GitHub 渲染的 HTML：讨论 #186435 中，已最小化的父评论 `15712534` 的回复容器位于父评论的 `<details>` 折叠块之外；回复 `15712843` 则有自己独立的 off-topic 最小化提示。这支持父子分别控制呈现的判断，但这个例子里的子回复自身也被隐藏，不能单独证明普通回复正文的可见性。[当前页面实例](https://github.com/orgs/community/discussions/186435#discussioncomment-15712534)

本次未在当前 GitHub 页面用浏览器实测该交互，因此不能将历史第一手观察写成 2026 年所有界面的确定契约。API 对单个评论写入 minimized 状态也不能单独证明后代回复的 UI 可见性。历史反馈和当前 HTML 共同支持只折叠目标评论、保留独立回复的判断；用户已确认 GitPulse 采用这一呈现方式。

## 对象与操作矩阵

以下六种对象全部实现 `Minimizable` 和 `Deletable`；实现接口表示存在能力字段，不保证当前读者能执行，也不保证每个状态都可执行。[Minimizable / Deletable](https://docs.github.com/en/graphql/reference/issues#minimizable)

| 对象                       | 对应内容                             | GitHub 隐藏/恢复                           | 删除路径及限制                                                                                                                                                            |
| -------------------------- | ------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IssueComment`             | Issue 回复、PR Conversation 普通回复 | `minimizeComment` / `unminimizeComment`    | GraphQL `deleteIssueComment`；或 REST `DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}`                                                                         |
| `PullRequestReviewComment` | PR 行内/文件评论及其回复             | 同上                                       | GraphQL `deletePullRequestReviewComment`；或 REST `DELETE /repos/{owner}/{repo}/pulls/comments/{comment_id}`                                                              |
| `PullRequestReview`        | 一次 review 的摘要正文               | 同上；当前 schema **确实实现 Minimizable** | GraphQL 有独立 `deletePullRequestReview`，按对象 `viewerCanDelete` 判入口；其逐状态限制未确认。REST DELETE 则明确仅 pending、禁止 submitted。不能当普通 IssueComment 删除 |
| `DiscussionComment`        | Discussion 顶层评论和回复            | 同上                                       | GraphQL `deleteDiscussionComment`；官方明确：有回复时 wipe 原评论，而不是直接删除整个对象                                                                                 |
| `CommitComment`            | 单个 commit 上的评论                 | 同上                                       | REST `DELETE /repos/{owner}/{repo}/comments/{comment_id}`                                                                                                                 |
| `GistComment`              | Gist 评论；仅为 API 完整性列出       | 同上                                       | Gist 是另一种资源，不能套仓库角色；不建议扩进本次 GitPulse 范围                                                                                                           |

对象依据：[IssueComment](https://docs.github.com/en/graphql/reference/issues#issuecomment)、[review 与行内评论](https://docs.github.com/en/graphql/reference/pulls#pullrequestreview)、[DiscussionComment 与删除语义](https://docs.github.com/en/graphql/reference/discussions#deletediscussioncomment)、[CommitComment](https://docs.github.com/en/graphql/reference/commits#commitcomment)。PR 普通评论与行内评论走不同端点，[REST 评论指南](https://docs.github.com/en/rest/guides/working-with-comments) 明确区分。

Issue / PR 主楼正文不属于可删除的普通评论。不要在主楼复用“删除评论”；删除 Issue、删除 Discussion 是删除主题的另一类动作。[主楼限制](https://docs.github.com/en/communities/moderating-comments-and-conversations/managing-disruptive-comments#deleting-a-comment)

### Review 的三个容易混淆的动作

- **隐藏 review 摘要**：针对 `PullRequestReview` 的 minimize 能力；不能据此声称会撤销批准/请求修改，也不能假设会隐藏全部行内评论。
- **删除 pending review**：`DELETE /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}` 只删未提交 review；published review 不可套用。丢弃 pending review 会同时丢弃其待提交评论。[REST review 删除](https://docs.github.com/en/rest/pulls/reviews#delete-a-pending-review-for-a-pull-request)、[提交前丢弃](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/reviewing-proposed-changes-in-a-pull-request)
- **Resolve conversation**：针对 review thread，写入 resolved 状态并折叠会话；不是隐藏单条评论。PR 作者或仓库 Write 用户可 resolve；GraphQL 提供 `viewerCanResolve` / `viewerCanUnresolve`。[会话完成](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/commenting-on-a-pull-request#resolving-conversations)、[thread 字段](https://docs.github.com/en/graphql/reference/pulls#pullrequestreviewthread)

Dismiss review 还会改变 review 状态，并要求解释；它也不能借用“删除评论”的名称或确认框。[Dismiss review](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/dismissing-a-pull-request-review)

**REST 限制不可直接推广到 GraphQL。** 官方 `deletePullRequestReview` 只描述删除 review，另有对象级 `viewerCanDelete`，没有公开列出 submitted / pending 的完整状态规则。针对 GraphQL 已提交 review 删除行为的额外官方定向检索仍未找到确定说明；因此本研究不声称“任何 API 都不能删 submitted review”，也不声称 GraphQL 一定能删。采用 GraphQL 路径时按其能力字段展示，并处理 mutation 的实际拒绝；不得仅因 `state !== PENDING` 把能力硬编码为 false。[GraphQL review mutation 与能力字段](https://docs.github.com/en/graphql/reference/pulls#deletepullrequestreview)

## 谁能操作

官方组织仓库角色表给出以下基线。这里说的是账号角色，下一节的 token 权限还会进一步限制 API。

| 行为                                        | Read | Triage | Write | Maintain | Admin |
| ------------------------------------------- | ---- | ------ | ----- | -------- | ----- |
| 编辑、删除自己的评论                        | 是   | 是     | 是    | 是       | 是    |
| 编辑、删除任何人的 Issue / PR / Commit 评论 | 否   | 否     | 是    | 是       | 是    |
| 隐藏任何人的 Issue / PR / Commit 评论       | 否   | 否     | 是    | 是       | 是    |
| 隐藏任何人的 Discussion 评论                | 否   | 是     | 是    | 是       | 是    |

依据：[组织仓库角色权限表](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/repository-roles-for-an-organization#permissions-for-each-role)。该表没有单独的“删除 Discussion 评论”行，因此不能从“可管理 Discussion”推断 Triage 可删他人回复。管理评论的通用文档明确 Write 用户可删除 Discussion 评论。

额外例外包括组织 moderator，以及 Enterprise Cloud 自定义角色。自定义仓库角色可在基础角色上增加“隐藏/恢复 Discussion 评论”等权限；因此 UI 不应只判断 `viewerPermission >= WRITE`。[组织 moderator](https://docs.github.com/en/communities/moderating-comments-and-conversations/managing-disruptive-comments#hiding-a-comment)、[自定义仓库角色](https://docs.github.com/en/enterprise-cloud@latest/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/about-custom-repository-roles#additional-permissions-for-custom-roles)

没有找到官方证据证明：仅作为 Issue 作者就能删除别人回复，或仅作为 Discussion 作者就能删除别人回复。设计不得额外授予这种能力；只采信对象能力与 GitHub 的操作结果。

## API 请求与 token

### 隐藏和恢复

`minimizeComment(input: { subjectId, classifier })` 接受 GraphQL node ID；`unminimizeComment(input: { subjectId })` 恢复。读取 `isMinimized`、`minimizedReason` 及两项 viewer 能力；不要将“展开阅读”实现为 unminimize mutation。[mutation 输入](https://docs.github.com/en/graphql/reference/issues#minimizecomment)

当前 `ReportedContentClassifiers` 共七项：

| API 枚举      | 可用中文表达 | 返回的 `minimizedReason` |
| ------------- | ------------ | ------------------------ |
| `ABUSE`       | 辱骂或骚扰   | `abuse`                  |
| `DUPLICATE`   | 重复内容     | `duplicate`              |
| `LOW_QUALITY` | 低质量内容   | `low-quality`            |
| `OFF_TOPIC`   | 偏离主题     | `off-topic`              |
| `OUTDATED`    | 已过时       | `outdated`               |
| `RESOLVED`    | 已解决       | `resolved`               |
| `SPAM`        | 垃圾信息     | `spam`                   |

枚举必须使用 schema 的大写下划线值；响应 reason 是不同大小写/格式的字符串。[枚举定义](https://docs.github.com/en/graphql/reference/meta#reportedcontentclassifiers)、[响应字段](https://docs.github.com/en/graphql/reference/issues#minimizable)

### REST 删除的 fine-grained token 权限

以下端点都支持 GitHub App user token、installation token、fine-grained PAT。表中 Write 是 token 的 repository permission，**不是用户必须拥有仓库 Write 角色**；普通作者删自己评论也仍需满足 token 要求及仓库可访问性。

| 删除对象            | 所需 token repository permission                   | 来源                                                                                                               |
| ------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Issue / PR 普通评论 | `Issues: write` 或 `Pull requests: write` 至少一项 | [Issue comment DELETE](https://docs.github.com/en/rest/issues/comments#delete-an-issue-comment)                    |
| PR 行内评论         | `Pull requests: write`                             | [Review comment DELETE](https://docs.github.com/en/rest/pulls/comments#delete-a-review-comment-for-a-pull-request) |
| Pending review      | `Pull requests: write`                             | [Pending review DELETE](https://docs.github.com/en/rest/pulls/reviews#delete-a-pending-review-for-a-pull-request)  |
| Commit 评论         | `Contents: write`                                  | [Commit comment DELETE](https://docs.github.com/en/rest/commits/comments#delete-a-commit-comment)                  |

### OAuth / classic PAT 与 GraphQL

Scopes 只会缩小用户既有权限，不会授予仓库管理能力。`repo` 覆盖公有和私有仓库，`public_repo` 限公共仓库；实际授权范围可通过 `X-OAuth-Scopes` 与端点接受范围检查。[OAuth scope](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)

当前 Discussions GraphQL guide 明确说明 private repository 要 `repo`、public repository 要 `public_repo`。不能因为现有 OAuth 没有单列 discussion scope 就断言必须扩权。[Discussions API 授权](https://docs.github.com/en/graphql/guides/using-the-graphql-api-for-discussions)

当前 GraphQL 文档明确支持 fine-grained PAT，并举 `issues:read` 例子；“fine-grained PAT 不支持 GraphQL”已经不是可用结论。权限不足时 API 会说明所需 scopes 或 permissions。[GraphQL 身份验证](https://docs.github.com/en/graphql/guides/forming-calls-with-graphql#authenticating-with-graphql)

Fine-grained PAT 仍有重要资源限制：不能向自己不是成员的公共仓库贡献、不能覆盖多个组织、outside collaborator 场景有限制；还可能等待组织批准。即使用户在网页能操作，GitPulse token 也未必能操作。[当前 PAT 限制](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#fine-grained-personal-access-tokens-limitations)

本仓库现状由并行代码调查确认：`server/routes/auth/github.get.ts` 已请求 `repo`；GitHub client 使用 session 的实际 access token。因此目前没有证据要求本次设计新增 OAuth scope。未来若实际 token 缺少权限，应提供重新授权/调整 PAT 的明确路径，不能在后台静默扩权。

## 设计边界、证据差异与未验证项

- 通用“管理 disruptive comments”页只概括 Write 可 hide，而角色表明确 Triage 可 hide Discussion；不能将前者当作完整穷举。
- 当前 `PullRequestReview` 同时有 `Minimizable` / `Deletable`，但 REST 明确 submitted review 不能删除。GraphQL 的简短 delete mutation 说明没有逐状态列权限，本次未实测它是否存在不同边界；按 `viewerCanDelete` 判入口，不将 REST 的 pending-only 规则硬编码为 GraphQL 规则。
- `deleteDiscussionComment` 对有回复评论会 wipe；设计不得说“所有回复也会删除”，也不要乐观移除整棵回复树。
- 未用真实多个角色账号执行 mutation；未确认每种 token 与每种 minimize 对象所需最小 fine-grained permission 的逐格组合。REST 删除表不能直接套给 GraphQL minimize。菜单能力与实际 API 错误应共同决定可用状态。
- 未发现“本地收起”需要任何 GitHub 写权限的依据；若设计这种阅读操作，其持久化范围是 GitPulse 的产品决定，不是 GitHub moderation 功能。
- 本次没有修改应用、GLOSSARY 或 ADR，也没有启动浏览器或开发服务器。
