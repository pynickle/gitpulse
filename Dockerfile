FROM oven/bun:1.4-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts

FROM deps AS build
COPY . .
ENV NODE_ENV=production
ENV NITRO_PRESET=bun
RUN bun run build

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
