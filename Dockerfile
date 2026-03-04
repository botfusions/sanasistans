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

# Non-root user for security
COPY package*.json ./
RUN npm install --omit=dev && chown -R node:node /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/docs ./docs

# Ensure data directory exists and set permissions
RUN mkdir -p data && chown -R node:node /app/data

USER node

ENV NODE_ENV=production

# Health check for Coolify
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000), (r) => { if (r.statusCode !== 200) process.exit(1); })"

CMD ["node", "dist/index.js"]
