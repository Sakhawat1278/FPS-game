# ==========================================
# Multi-Stage Dockerfile for Warehouse Strike
# Builds: Shared package, Client (Vite), Server (Colyseus)
# Serves: Game client static bundle & WebSocket API on single port
# ==========================================

# Stage 1: Build stage
FROM node:22-slim AS builder

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@12.16.1 --activate

# Copy dependency manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/

# Install all dependencies (including devDependencies for building)
RUN pnpm install --frozen-lockfile

# Copy source code and config
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server
COPY packages/client ./packages/client

# Build all workspace packages
RUN pnpm build

# Stage 2: Production runtime stage
FROM node:22-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=2567

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@12.16.1 --activate

# Copy manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/

# Install production-only dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy built code from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/client/dist ./packages/client/dist

# Expose port (default 2567, overrideable via $PORT)
EXPOSE 2567

# Healthcheck
HEALTHCHECK --interval=20s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 2567) + '/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start game server
CMD ["node", "packages/server/dist/index.js"]
