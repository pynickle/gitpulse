# GitPulse — GitHub 工作仪表盘

在一个集中的工作区中追踪通知、Issue、Pull Request 和仓库活动。不用频繁切换标签页，没有噪音。

![AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue) ![Nuxt 4](https://img.shields.io/badge/Nuxt-4-00DC82?logo=nuxt) ![Bun](https://img.shields.io/badge/Bun-000000?logo=bun)

---

## 功能

### 📬 通知

按原因分组——`mention`、`review_requested`、`ci_activity`、`security_alert`、`assign`、`state_change`、`subscribed` 等。未读项有蓝色标记。点击 **标记已读** 即可消除，或让 60 秒自动刷新捕获新通知，无需重载页面。

### 🎯 Issue 与 Pull Request

基于搜索的列表，支持快速筛选（open / closed / merged）。点击任意行打开 **侧滑详情面板**，显示完整时间线、标签、负责人和操作按钮——无需页面跳转。

### ✨ 自定义标签页

创建基于 **真实 GitHub 搜索查询** 的无限标签页。将任意 GitHub 搜索限定符粘贴到标签编辑器中即可。拖拽排序，将标签页归入文件夹分组。

### 🖨 Markdown + 图表

评论渲染为丰富 Markdown，代码块带语法高亮，以及 **Mermaid 图表**——时序图、流程图、甘特图——内嵌在原本的位置。

### 🌐 国际化

内置英文和简体中文，根据浏览器自动检测。

### 🌙 深色模式

自适应深色模式样式，在低光环境下保持仪表盘舒适可读，并与系统主题保持一致。

### 📂 仓库

分页展示你的仓库列表，每个仓库有快速链接。在不离开仪表盘的情况下快速跳转到项目。

---

## 为什么用 GitPulse？

GitHub 原生界面让你在标签页、页面和仓库之间来回跳转。GitPulse 将所有内容整合到 **一个单页工作区**：

|                   | GitHub.com                 | GitPulse                     |
| ----------------- | -------------------------- | ---------------------------- |
| 通知 + Issue + PR | 分散在多个页面，来回跳转   | 一个仪表盘，四个标签页       |
| 自定义保存的搜索  | 书签或 URL 拼凑            | 自带标签页管理，支持拖拽排序 |
| 界面专注度        | 导航栏、项目面板、侧栏干扰 | 只显示你关心的 GitHub 活动   |

---

## 快速开始

运行环境使用 **Bun**。启动开发服务器：

```bash
bun install
bun run dev
```

打开终端显示的 URL，在登录页面粘贴你的 GitHub token。

> 要获取 token，运行 `gh auth token`——该 token 继承你授予 GitHub CLI 的权限，通常包含组织级别的访问权限。

---

## 在线试用

访问 **[gitpulse.euphony.ink](https://gitpulse.euphony.ink)**——一个运行在非个人模式下的官方演示站点。粘贴 GitHub token 或通过 OAuth 登录即可立即体验。

---

## 自部署

GitPulse 有两种部署模式，通过环境变量控制。至少启用一种模式，否则应用拒绝启动。

### 非个人模式（多用户）

用户通过粘贴 GitHub token 或 GitHub OAuth 登录。适用于团队或托管部署。

| 环境变量                          | 必填              | 默认值 | 说明                           |
| --------------------------------- | ----------------- | ------ | ------------------------------ |
| `NUXT_SESSION_PASSWORD`           | **是**            | —      | 32 字节 hex 密钥，用于会话加密 |
| `NUXT_AUTH_PAT_ENABLED`           | 否                | `true` | 允许 token 登录                |
| `NUXT_AUTH_GITHUB_OAUTH_ENABLED`  | 否                | —      | 允许 OAuth 登录                |
| `NUXT_OAUTH_GITHUB_CLIENT_ID`     | 启用 OAuth 时必填 | —      | GitHub OAuth 应用的 Client ID  |
| `NUXT_OAUTH_GITHUB_CLIENT_SECRET` | 启用 OAuth 时必填 | —      | GitHub OAuth 应用的 Secret     |

### 个人模式（单用户，自托管）

密码保护的安全柜，内含预先配置好的 token。每次打开新浏览器都会看到锁屏；可选勾选"记住此设备"保持登录状态。

| 环境变量                          | 必填   | 默认值 | 说明                           |
| --------------------------------- | ------ | ------ | ------------------------------ |
| `NUXT_AUTH_PERSONAL_MODE_ENABLED` | **是** | —      | 启用个人模式                   |
| `NUXT_PERSONAL_TOKEN`             | **是** | —      | 内置于服务器的 GitHub token    |
| `NUXT_PERSONAL_MODE_PASSWORD`     | **是** | —      | 锁屏密码                       |
| `NUXT_PERSONAL_COOKIE_SECRET`     | **是** | —      | 用于签名"记住我" cookie 的密钥 |

---

## 常见问题

### GitPulse 会存储我的 token 吗？

不会。你的 token 保存在加密的服务端会话 cookie 中——永远不会写入数据库。关闭浏览器后，会话即结束。

### 如何退出登录？

点击左侧活动栏中的头像 → **退出登录**。你的会话 cookie 会被清除。

---

## 许可证

GNU Affero General Public License v3.0 — 详见 [LICENSE](LICENSE)。
