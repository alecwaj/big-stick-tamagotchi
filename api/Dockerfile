# Dockerfile for Airvana API
# Uses Node 22, compiles TypeScript, runs on Railway with persistent volume

FROM node:22-alpine

# Install build tools needed for better-sqlite3 native module
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install deps first (layer cache)
COPY package*.json ./
RUN npm install --production=false

# Copy source and compile
COPY . .
RUN npm run build

# Prune dev deps
RUN npm prune --production

EXPOSE 3001

# Railway mounts volume at /data by default
ENV DB_PATH=/data/worms.db
ENV PORT=3001

CMD ["node", "dist/server.js"]
