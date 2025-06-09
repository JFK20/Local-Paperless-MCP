FROM node:22.16-alpine3.22

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

COPY docker.env .env

EXPOSE 3001