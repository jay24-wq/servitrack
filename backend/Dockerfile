FROM node:22-slim AS builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
COPY common/ ../common/
RUN npm run build

FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    UPLOAD_DIR=/app/uploads
WORKDIR /app/backend
COPY --from=builder --chown=node:node /app/backend/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder --chown=node:node /app/backend/dist/backend/src/server.js ./dist/backend/src/server.js
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 3000
CMD ["node", "dist/backend/src/server.js"]
