FROM oven/bun:1.1.38-alpine

WORKDIR /app

# Copy pre-built dist and production dependencies
COPY dist ./dist
COPY node_modules ./node_modules
COPY package.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

ENV NODE_ENV=production

CMD ["bun", "dist/index.js"]
