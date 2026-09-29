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
RUN pnpm --filter "@feedants/${SERVICE}" deploy --prod --legacy /out

FROM build AS migrate
ARG SERVICE
WORKDIR /repo/services/${SERVICE}
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
# Non-root, read-only root filesystem at run time (see compose.yaml).
USER node
CMD ["node", "--enable-source-maps", "dist/main.js"]
