FROM node:22.16-alpine3.22 AS node-base
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
COPY docker.env .env
RUN npm run build

FROM ghcr.io/astral-sh/uv:debian-slim
WORKDIR /app

RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY --from=node-base /app .
EXPOSE 3001
CMD ["uvx", "mcpo", "--host", "0.0.0.0", "--port", "3001", "--", "node", "dist/index.js"]