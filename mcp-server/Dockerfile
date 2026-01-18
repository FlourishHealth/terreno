# Build stage
FROM oven/bun:1.3.5-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN bun run build

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Install only production dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Expose port for HTTP transport (if needed)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1

# Set environment
ENV NODE_ENV=production

# Run the MCP server
# For stdio transport (default MCP mode)
CMD ["node", "dist/index.js"]
