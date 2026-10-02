# syntax=docker/dockerfile:1.7
# One Dockerfile for every NestJS service:
#   docker build -f infra/docker/service.Dockerfile --build-arg SERVICE=identity .
# Targets: `runtime` (default, the service) and `migrate` (runs `prisma migrate deploy`).

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
ARG SERVICE
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@feedants/${SERVICE}..."
RUN pnpm --filter "@feedants/${SERVICE}..." build
# Self-contained production bundle: the service's dist plus production dependencies only.
RUN pnpm --filter "@feedants/${SERVICE}" deploy --prod --legacy /out \
    && node infra/docker/prune-runtime.mjs /out
# Inputs of the slim migrate image: schema, migrations, config, pinned CLI versions.
RUN mkdir -p /migrate && cd "services/${SERVICE}" \
    && cp -r prisma prisma.config.ts /migrate/ \
    && node /repo/infra/docker/migrate-package.mjs /migrate

# Only what `prisma migrate deploy` needs, not the build stage's toolchain and dependencies.
FROM node:${NODE_VERSION}-alpine AS migrate
WORKDIR /app
# Install before copying the service's schema: every service pins the same versions, so this
# layer is identical across the four migrate images and stored once.
COPY --from=build /migrate/package.json ./
RUN npm install --omit=dev --no-audit --no-fund \
    && npm cache clean --force && rm -rf /root/.cache /tmp/*
COPY --from=build /migrate/prisma ./prisma
COPY --from=build /migrate/prisma.config.ts ./
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
# Non-root, read-only root filesystem at run time (see compose.yaml).
USER node
CMD ["node", "--enable-source-maps", "dist/main.js"]
