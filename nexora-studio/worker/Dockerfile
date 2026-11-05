# Worker di Nexora Studio (Railway). Build dalla radice di nexora-studio:
#   docker build -f worker/Dockerfile .
FROM node:22-bookworm-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY worker/package.json worker/
COPY app/package.json app/
RUN npm ci --workspace @nexora/worker --workspace @nexora/shared --include-workspace-root=false
COPY packages/shared packages/shared
COPY worker worker
RUN npm run build -w @nexora/shared && npm run build -w @nexora/worker

FROM node:22-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/packages/shared/package.json packages/shared/package.json
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/worker/package.json worker/package.json
COPY --from=build /repo/worker/dist worker/dist
USER node
CMD ["node", "worker/dist/index.js"]
