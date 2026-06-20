## Quick Start

We use **Bun** as our package manager. Build the project.

```bash
bun install
bun run build
```

---

## Docker Images

Pre-built Docker images are published to GitHub Container Registry and Docker Hub with every release:

- `ghcr.io/pynickle/gitpulse:latest`
- `docker.io/enceuphony/gitpulse:latest`

---

## Configuration

GitPulse has two deployment modes, controlled by environment variables. At least one must be enabled, or the app refuses to start.

### Non-personal Mode (multi-user)

Users sign in by pasting a GitHub token or via GitHub OAuth. Suitable for teams or hosted deployments.

| Environment Variable              | Required | Default | Description                            |
| --------------------------------- | -------- | ------- | -------------------------------------- |
| `NUXT_SESSION_PASSWORD`           | **Yes**  | —       | 32-byte hex key for session encryption |
| `NUXT_AUTH_PAT_ENABLED`           | No       | `true`  | Allow token-based login                |
| `NUXT_AUTH_GITHUB_OAUTH_ENABLED`  | No       | —       | Allow OAuth login                      |
| `NUXT_OAUTH_GITHUB_CLIENT_ID`     | If OAuth | —       | GitHub OAuth app client ID             |
| `NUXT_OAUTH_GITHUB_CLIENT_SECRET` | If OAuth | —       | GitHub OAuth app secret                |

### Personal Mode (single-user, self-hosted)

A password-gated vault with a pre-configured token. On each new browser you see a lock screen; optionally tick "Remember this device" to stay logged in.

| Environment Variable              | Required | Default | Description                              |
| --------------------------------- | -------- | ------- | ---------------------------------------- |
| `NUXT_AUTH_PERSONAL_MODE_ENABLED` | **Yes**  | —       | Enable personal mode                     |
| `NUXT_PERSONAL_TOKEN`             | **Yes**  | —       | GitHub token baked into the server       |
| `NUXT_PERSONAL_MODE_PASSWORD`     | **Yes**  | —       | Lock-screen password                     |
| `NUXT_PERSONAL_COOKIE_SECRET`     | **Yes**  | —       | Secret for signing "remember me" cookies |

### User Settings Storage

Dashboard user settings, including font choices, tab groups, and custom search tabs, are persisted through the server user settings storage layer. You can configure it to use Redis, Upstash Redis, or the local filesystem.

By default GitPulse uses local filesystem storage at `./.data/user-settings`.

| Environment Variable                                     | Required | Default              | Description                                                                                                                                         |
| -------------------------------------------------------- | -------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NUXT_GITPULSE_USER_SETTINGS_STORAGE_DRIVER`             | No       | `fs`                 | User settings storage backend. Use `fs` for local Nitro storage, `redis` for Redis through the npm `redis` package, or `upstash` for Upstash Redis. |
| `NUXT_GITPULSE_USER_SETTINGS_STORAGE_BASE`               | No       | Driver-specific      | Base path/namespace. Defaults to `./.data/user-settings` for `fs` and `gitpulse:user-settings` for `redis` and `upstash`.                           |
| `NUXT_GITPULSE_USER_SETTINGS_STORAGE_REDIS_URL`          | Redis    | —                    | Redis connection URL used when `NUXT_GITPULSE_USER_SETTINGS_STORAGE_DRIVER=redis`.                                                                  |
| `NUXT_GITPULSE_USER_SETTINGS_STORAGE_UPSTASH_ENV_PREFIX` | No       | `UPSTASH_REDIS_REST` | Optional custom env prefix. GitPulse reads `<prefix>_KV_REST_API_URL` and `<prefix>_KV_REST_API_TOKEN`.                                             |
| `UPSTASH_REDIS_REST_URL`                                 | Upstash  | —                    | Upstash Redis REST URL.                                                                                                                             |
| `UPSTASH_REDIS_REST_TOKEN`                               | Upstash  | —                    | Upstash Redis REST token.                                                                                                                           |

For Redis, set:

```env
NUXT_GITPULSE_USER_SETTINGS_STORAGE_DRIVER=redis
NUXT_GITPULSE_USER_SETTINGS_STORAGE_REDIS_URL=redis://localhost:6379
```

For Upstash Redis, set:

```env
NUXT_GITPULSE_USER_SETTINGS_STORAGE_DRIVER=upstash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```
