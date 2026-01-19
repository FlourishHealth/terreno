# Stage 1: Build
FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock ./
COPY api/package.json api/tsconfig.json ./api/
COPY api/src ./api/src
COPY mcp-server/package.json mcp-server/tsconfig.json ./mcp-server/
COPY mcp-server/src ./mcp-server/src

RUN bun install --frozen-lockfile --ignore-scripts
RUN bun run --filter "@terreno/api" compile

WORKDIR /app/mcp-server
RUN bun build --compile src/index.ts --outfile dist/terreno-mcp
RUN mkdir -p dist/docs && cp -r src/docs/* dist/docs/

# Stage 2: Runtime
FROM debian:bookworm-slim
WORKDIR /app

COPY --from=builder /app/mcp-server/dist/terreno-mcp ./terreno-mcp
COPY --from=builder /app/mcp-server/dist/docs ./docs

ENV NODE_ENV=production

CMD ["./terreno-mcp"]

