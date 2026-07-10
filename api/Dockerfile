# Dockerfile for Airvana API
FROM node:22-alpine

# Build tools for better-sqlite3 native module
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm install --production=false

COPY . .
RUN npm run build
RUN npm prune --production

# Ensure /data exists for SQLite (Railway volume mounts here)
RUN mkdir -p /data

EXPOSE 3001
ENV PORT=3001
ENV DB_PATH=/data/worms.db

CMD ["node", "dist/server.js"]
