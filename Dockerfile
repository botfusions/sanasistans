# Build stage
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/docs ./docs

# Ensure data directory exists for local sqlite or files if any
RUN mkdir -p data

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
