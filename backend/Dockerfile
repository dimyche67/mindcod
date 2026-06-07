FROM node:20-slim

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend package files first for layer caching
COPY backend/package*.json ./
RUN npm ci

# Copy backend source
COPY backend/ ./

EXPOSE 8787

CMD ["node", "server.js"]
