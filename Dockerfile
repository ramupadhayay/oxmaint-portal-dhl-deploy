# Oxmaint Portal container.
#
# The repo ships a PM2 config, not a Dockerfile — this box runs its portals
# under Docker instead, so containers come back on their own after a reboot
# via `restart: always` rather than needing PM2 installed and its startup hook
# wired up separately.
#
# A plain (non-standalone) build on purpose: `output: 'standalone'` would mean
# editing next.config.js, which every other branch also touches. Carrying
# node_modules costs image size, and the hosts running this have the room; a
# merge conflict in the build config on every update costs more.

# ── deps ──────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── build ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Placeholders only. The real values arrive at runtime through env_file; these
# exist so the build does not fail on a module that reads them at import time.
ENV MONGO_URI=mongodb://placeholder:27017/build
ENV JWT_SECRET=build-placeholder

# These cannot arrive at runtime, and that is not a choice this file makes.
#
# `next build` inlines every NEXT_PUBLIC_ value into the browser bundle, so a
# variable that is absent here is the literal `undefined` in the browser for the
# life of the image — env_file cannot reach it later, however correct the value
# in it looks. Without them the container could only ever be the default pack,
# whatever the host was configured with.
#
# BASE_PATH is the same shape of thing: next.config.js reads it while building.
ARG NEXT_PUBLIC_OXMAINT_PACK=
ARG NEXT_PUBLIC_OX_DEMOS_SERVED=
ARG NEXT_PUBLIC_OX_DEMOS=
ARG BASE_PATH=
ENV NEXT_PUBLIC_OXMAINT_PACK=$NEXT_PUBLIC_OXMAINT_PACK \
    NEXT_PUBLIC_OX_DEMOS_SERVED=$NEXT_PUBLIC_OX_DEMOS_SERVED \
    NEXT_PUBLIC_OX_DEMOS=$NEXT_PUBLIC_OX_DEMOS \
    BASE_PATH=$BASE_PATH

RUN npm run build

# ── runtime ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Docker sets HOSTNAME to the container id, which Next would then bind to
# instead of every interface — loopback and the healthcheck both break.
ENV HOSTNAME=0.0.0.0

# The same two values again, because the server needs them at runtime and not
# only while building. Build args do not survive into the running image, and
# their absence here is silent:
#
#   NEXT_PUBLIC_OXMAINT_PACK — the records API scopes every read and write to
#     the pack the server is running (app/api/oxmaint/records). Unset, that is
#     the default 'chiller', so a hospital image would serve hospital screens
#     and read another customer's records.
#   BASE_PATH — `next start` reads next.config.js, so a build mounted on
#     /hospital has to be told again or it serves from the root and every
#     asset 404s.
#
# Declared per stage: an ARG from an earlier stage is out of scope here.
ARG NEXT_PUBLIC_OXMAINT_PACK=
ARG NEXT_PUBLIC_OX_DEMOS_SERVED=
ARG NEXT_PUBLIC_OX_DEMOS=
ARG BASE_PATH=
ENV NEXT_PUBLIC_OXMAINT_PACK=$NEXT_PUBLIC_OXMAINT_PACK \
    NEXT_PUBLIC_OX_DEMOS_SERVED=$NEXT_PUBLIC_OX_DEMOS_SERVED \
    NEXT_PUBLIC_OX_DEMOS=$NEXT_PUBLIC_OX_DEMOS \
    BASE_PATH=$BASE_PATH

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 && chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
CMD ["node_modules/next/dist/bin/next", "start", "-p", "3000"]
