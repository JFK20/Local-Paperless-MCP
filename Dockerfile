FROM node:22.16-alpine3.22 AS node-base
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
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
EXPOSE ${BRIDGE_PORT}
CMD ["sh", "-c", "echo  ${MCPO_API_KEY} && uvx mcpo --host 0.0.0.0 --api-key ${MCPO_API_KEY} --port ${BRIDGE_PORT:-3001} -- node dist/index.js"]
