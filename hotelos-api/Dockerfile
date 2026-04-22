FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

COPY ./src ./src
COPY ./Database /app/Database

ENV NODE_ENV=production
ENV DATABASE_FILE=/data/hotelos.db
ENV DATABASE_SEED_DIR=/app/Database

RUN mkdir -p /data

EXPOSE 8080

CMD ["node", "src/server.js"]
