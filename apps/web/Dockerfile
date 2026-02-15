# Build context must be the monorepo root:
#   docker build -f apps/web/Dockerfile .

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/

RUN npm ci --workspace=apps/web --include-workspace-root

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Copy hoisted node_modules from deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./

# Copy web app source
COPY apps/web ./apps/web

# Build-time env vars (NEXT_PUBLIC_* must be set at build time)
ARG NEXT_PUBLIC_API_BASE_URL

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

RUN cd apps/web && npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# In monorepo, standalone preserves directory structure
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./

# Static files must be at apps/web/.next/static (matching monorepo structure)
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3006

ENV PORT=3006
ENV HOSTNAME="0.0.0.0"

# With outputFileTracingRoot, standalone preserves monorepo structure
CMD ["node", "apps/web/server.js"]
