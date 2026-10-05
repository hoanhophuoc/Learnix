FROM node:24-alpine AS base

# The web Dockerfile is copy-pasted into our main docs at /docs/handbook/deploying-with-docker.
# Make sure you update this Dockerfile, the Dockerfile in the web workspace and copy that over to Dockerfile in the docs.

FROM base AS builder
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
# Set working directory
WORKDIR /app
RUN npm install -g turbo@2.11.7 pnpm@12.9.1
COPY . .
RUN turbo prune @repo/web @repo/api --docker

# Add lockfile and package.json's of isolated subworkspace
FROM base AS installer
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@12.9.1
WORKDIR /app

# First install dependencies (as they change less often)
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
RUN pnpm install --frozen-lockfile

# Build the project and its dependencies
COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json

# ARG to determine which app to build/start (web or api)
ARG APP_NAME=web
ENV APP_NAME=${APP_NAME}

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Check if build script is defined, if not, try to build with turbo
RUN npx turbo build --filter=@repo/${APP_NAME}...
RUN pnpm deploy --filter=@repo/${APP_NAME} --prod /app/runtime
RUN if [ "$APP_NAME" = "web" ]; then \
  cp -R apps/web/dist /app/runtime/dist; \
  else \
  cp -R apps/api/dist /app/runtime/dist; \
  fi

FROM base AS runner
WORKDIR /app
ARG APP_NAME=web
ENV APP_NAME=${APP_NAME}

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=installer --chown=nextjs:nodejs /app/runtime/node_modules ./node_modules
COPY --from=installer --chown=nextjs:nodejs /app/runtime/dist ./dist
RUN mkdir -p uploads && chown nextjs:nodejs uploads

RUN printf '%s\n' \
  '#!/bin/sh' \
  'set -eu' \
  'if [ "$APP_NAME" = "web" ]; then' \
  '  exec serve -s dist -l 3000' \
  'fi' \
  'exec node dist/main.js' \
  > /usr/local/bin/learnix-start \
  && chmod +x /usr/local/bin/learnix-start

# Install only the static file server needed by the web runtime.
RUN if [ "$APP_NAME" = "web" ]; then npm install -g serve@14.2.4; fi

USER nextjs
ENV NODE_ENV=production

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/learnix-start"]
