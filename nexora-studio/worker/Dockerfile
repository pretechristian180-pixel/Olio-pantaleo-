# Worker di Nexora Studio (Railway). Build dalla radice di nexora-studio:
#   docker build -f worker/Dockerfile .
FROM node:22-bookworm-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/video-engine/package.json packages/video-engine/
COPY worker/package.json worker/
COPY app/package.json app/
# --ignore-scripts: il postinstall del monorepo compila @nexora/shared, ma qui i sorgenti non
# sono ancora copiati. La compilazione avviene due passi sotto.
RUN npm ci --ignore-scripts --no-audit --no-fund \
    --workspace @nexora/worker --workspace @nexora/shared --workspace @nexora/video-engine --include-workspace-root=false
COPY packages/shared packages/shared
COPY packages/video-engine packages/video-engine
COPY worker worker
RUN npm run build -w @nexora/shared && npm run build -w @nexora/video-engine && npm run build -w @nexora/worker \
  && npm prune --omit=dev --ignore-scripts --no-audit --no-fund \
    --workspace @nexora/worker --workspace @nexora/shared --workspace @nexora/video-engine --include-workspace-root=false

FROM node:22-bookworm-slim
# FFmpeg (render), Python, font Inter (sottotitoli). OpenCV e numpy arrivano da pip, sotto.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip fonts-inter fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*
# Trascrizione con Whisper sul worker (faster-whisper, CPU): il modello viene scaricato qui,
# durante la build, così in esecuzione l'audio non esce mai dal server.
# Il modello si sceglie con la variabile WHISPER_MODEL_SIZE (Railway la passa alla build;
# la vecchia WHISPER_LOCAL_MODEL non è più letta):
# large-v3-turbo (predefinito, serve ~3 GB di RAM), medium (~2 GB), small (~1 GB).
ARG WHISPER_MODEL_SIZE=large-v3-turbo
ENV WHISPER_MODEL_SIZE=$WHISPER_MODEL_SIZE \
    WHISPER_MODELS_DIR=/opt/whisper
# OpenCV 4.10 da pip: quello di Debian (4.6) non esegue il modello dei volti YuNet 2023mar.
RUN pip3 install --no-cache-dir --break-system-packages faster-whisper==1.2.1 opencv-python-headless==4.10.0.84 "numpy<2" \
  && python3 -c "from faster_whisper import WhisperModel; WhisperModel('$WHISPER_MODEL_SIZE', device='cpu', compute_type='int8', download_root='$WHISPER_MODELS_DIR')" \
  && chmod -R a+rX $WHISPER_MODELS_DIR
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
