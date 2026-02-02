FROM debian:bookworm-slim
WORKDIR /app

COPY server .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["./server"]
