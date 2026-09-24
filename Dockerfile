# Multi-stage Dockerfile for Coolify / Docker deployment
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies (including devDependencies needed for build)
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build client SPA and bundle server to dist/server.cjs
RUN npm run build

# Runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force

# Copy built distribution from builder
COPY --from=builder /app/dist ./dist

# Ensure data directory exists and copy default data
RUN mkdir -p ./data
COPY --from=builder /app/data ./data

# Expose application port
EXPOSE 3000

# Healthcheck using native Node.js probe
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1));"

# Start the Node.js production server
CMD ["node", "dist/server.cjs"]
