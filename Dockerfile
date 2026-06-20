FROM node:22-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g pnpm@9 && pnpm install --frozen-lockfile

FROM base AS runner
ENV NODE_ENV=production
ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=${GIT_COMMIT}
RUN groupadd --system --gid 1001 exodia && useradd --system --uid 1001 --gid exodia exodia
COPY --from=deps /app/node_modules ./node_modules
COPY . .
USER exodia
CMD ["node_modules/.bin/tsx", "src/index.ts"]
