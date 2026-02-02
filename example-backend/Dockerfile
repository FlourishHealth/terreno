# Build stage
FROM oven/bun:1 AS builder
WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile --ignore-scripts
RUN bun run --filter "@terreno/api" compile

WORKDIR /app/example-backend
RUN bun build src/index.ts --outdir ./dist --target bun --packages external

# Runtime stage
FROM oven/bun:1-slim
WORKDIR /app

# Copy the bundled application
COPY --from=builder /app/example-backend/dist ./dist
COPY --from=builder /app/example-backend/package.json .

# Copy root node_modules (includes hoisted dependencies)
COPY --from=builder /app/node_modules ./node_modules

# Copy workspace @terreno/api package
COPY --from=builder /app/api ./node_modules/@terreno/api

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "run", "dist/index.js"]
