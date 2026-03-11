# Stage 1: Install dependencies and compile @terreno/api
FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock ./
COPY api ./api
COPY mcp-server ./mcp-server

RUN bun install --frozen-lockfile --ignore-scripts
RUN bun run --filter "@terreno/api" compile

# Stage 2: Runtime
FROM oven/bun:1
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/api ./api
COPY --from=builder /app/mcp-server ./mcp-server
COPY --from=builder /app/package.json ./package.json

ENV NODE_ENV=production
WORKDIR /app/mcp-server

CMD ["bun", "run", "src/index.ts"]
