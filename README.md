# GitPulse

一个基于 Nuxt 和 Bun 的 GitHub Notifier Web 项目。

## 技术栈

- **框架**: Nuxt
- **运行时**: Bun
- **图标**: Lucide
- **国际化**: @nuxtjs/i18n
- **CSS 框架**: Bulma
- **Linter**: Oxlint
- **Formatter**: Oxfmt

## 认证开关

GitPulse 现在支持两种登录方式，并通过环境变量控制是否启用：

- `AUTH_PAT_ENABLED`：是否允许用户输入 Personal Access Token，默认 `true`
- `AUTH_GITHUB_OAUTH_ENABLED`：是否启用 GitHub OAuth App 登录，默认 `false`

规则说明：

- 两者不能同时关闭；如果同时关闭，应用将拒绝启动
- 如果开启了 `AUTH_GITHUB_OAUTH_ENABLED`，但缺少 `NUXT_OAUTH_GITHUB_CLIENT_ID` 或 `NUXT_OAUTH_GITHUB_CLIENT_SECRET`，应用会在启动时给出提示，并在本次运行中暂时禁用 OAuth 登录
