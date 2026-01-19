# Stage 1: Build
FROM oven/bun:1 AS builder
WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile --ignore-scripts

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

