# syntax=docker/dockerfile:1

# ─── Stage 1: Install all dependencies ────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ─── Stage 2: Build Next.js production bundle ─────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are baked into the client bundle at build time
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# Static metadata/robots are evaluated at build time; dynamic profiles also need
# the same frontend origin in the runner's environment.
ARG APP_URL
ENV APP_URL=$APP_URL
# Rewrites are compiled too; use the same direct API target at build/runtime.
ARG BACKEND_INTERNAL_URL=http://backend:5000
ENV BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL
ENV NODE_ENV=production

RUN node scripts/check-production-api-url.mjs
RUN npm run build

# ─── Stage 3: Production runner ───────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy the standalone server and browser assets
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
ENV HOSTNAME=0.0.0.0
USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000 || exit 1

CMD ["node", "server.js"]
