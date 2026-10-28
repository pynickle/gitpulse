FROM oven/bun:1.4-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts

# The build must run on Node, not Bun. Nuxt loads its config and modules through
# jiti, which wraps Error.prepareStackTrace, and the legacy CustomError classes
# Vite bundles are not real Error instances. Bun's native prepareStackTrace
# rejects that pairing with "First argument must be an Error object"
# (https://github.com/oven-sh/bun/issues/46393) while Node/V8 accepts it.
FROM node:26-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
ENV NITRO_PRESET=bun
RUN node node_modules/nuxt/bin/nuxt.mjs build

FROM base AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=build --chown=bun:bun /app/.output ./.output
RUN mkdir -p .data/user-settings && chown -R bun:bun .data

USER bun
EXPOSE 3000/tcp
VOLUME ["/app/.data"]

CMD ["bun", "./.output/server/index.mjs"]
