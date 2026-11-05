# Worker di Nexora Studio (Railway). Build dalla radice di nexora-studio:
#   docker build -f worker/Dockerfile .
FROM node:22-bookworm-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/video-engine/package.json packages/video-engine/
COPY worker/package.json worker/
COPY app/package.json app/
RUN npm ci --workspace @nexora/worker --workspace @nexora/shared --workspace @nexora/video-engine --include-workspace-root=false
COPY packages/shared packages/shared
COPY packages/video-engine packages/video-engine
COPY worker worker
RUN npm run build -w @nexora/shared && npm run build -w @nexora/video-engine && npm run build -w @nexora/worker \
  && npm prune --omit=dev --workspace @nexora/worker --workspace @nexora/shared --workspace @nexora/video-engine

FROM node:22-bookworm-slim
# FFmpeg (render), Python + OpenCV (rilevamento volti YuNet), numpy (libreria musicale), font Inter (sottotitoli)
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 python3-opencv python3-numpy fonts-inter fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
ENV NODE_ENV=production \
    PYTHON_BIN=python3 \
    MUSIC_DIR=/repo/music \
    WORK_DIR=/tmp/nexora-work
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/packages/shared/package.json packages/shared/package.json
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/packages/video-engine/package.json packages/video-engine/package.json
COPY --from=build /repo/packages/video-engine/dist packages/video-engine/dist
COPY --from=build /repo/packages/video-engine/python packages/video-engine/python
COPY --from=build /repo/packages/video-engine/assets packages/video-engine/assets
COPY --from=build /repo/worker/package.json worker/package.json
COPY --from=build /repo/worker/dist worker/dist
# Libreria musicale iniziale: brani originali generati durante la build (nessun diritto di terzi).
RUN node -e "import('@nexora/video-engine').then((m) => m.buildMusicLibrary('/repo/music'))" \
  && chown -R node:node /repo/music
USER node
CMD ["node", "worker/dist/index.js"]
