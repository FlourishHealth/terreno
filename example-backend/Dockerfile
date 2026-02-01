# Stage 1: Build
FROM oven/bun:1 AS builder
WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile --ignore-scripts
RUN bun run --filter "@terreno/api" compile

WORKDIR /app/example-backend
RUN bun build src/index.ts --outdir ./dist --target node

# Stage 2: Runtime
FROM oven/bun:1-slim
WORKDIR /app

COPY --from=builder /app/example-backend/dist ./dist
COPY --from=builder /app/example-backend/package.json .
COPY --from=builder /app/example-backend/node_modules ./node_modules

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "run", "dist/index.js"]
