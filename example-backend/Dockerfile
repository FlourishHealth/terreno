# Build stage
# TODO: Do this build in Github Actions
FROM oven/bun:1 AS builder
WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile --ignore-scripts
RUN bun run --filter "@terreno/api" compile
RUN bun run --filter "@terreno/api-health" compile
RUN bun run --filter "@terreno/ai" compile
RUN bun run --filter "@terreno/admin-backend" compile

WORKDIR /app/example-backend
RUN bun build --compile src/index.ts --outfile dist/backend

# Runtime stage
FROM debian:bookworm-slim
WORKDIR /app

COPY --from=builder /app/example-backend/dist/backend ./backend

ENV NODE_ENV=production
EXPOSE 3000

CMD ["./backend"]

