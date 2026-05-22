FROM node:20-bookworm-slim AS build

# better-sqlite3 needs build tools to compile against this Node version
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY src ./src
COPY server ./server

RUN npm run build

# ---------- Runtime ----------
FROM node:20-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV SCOPE_DB_PATH=/data/scope.db
ENV SCOPE_STATIC_DIR=/app/dist

COPY package.json package-lock.json ./
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && npm ci --omit=dev --no-audit --no-fund \
    && apt-get purge -y --auto-remove python3 make g++ \
    && rm -rf /var/lib/apt/lists/* /root/.npm

COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server

# Railway mounts the persistent volume at /data; create the dir so the
# initial DB file can be written even if the volume hasn't initialized.
RUN mkdir -p /data

EXPOSE 3000

CMD ["node", "dist-server/index.js"]
