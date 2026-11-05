#!/usr/bin/env bash
# Crea logo e video di prova in tests/e2e/.assets (serve ffmpeg).
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)/.assets"
mkdir -p "$D"
cp "$(dirname "$0")/../../app/public/brand/nexora-mark-light.png" "$D/logo.png"
ffmpeg -loglevel error -y -f lavfi -i testsrc2=size=720x1280:rate=30 -t 3 -pix_fmt yuv420p "$D/esempio-piccolo.mp4"
# ~16 MB: verifica il caricamento a blocchi da 6 MB
ffmpeg -loglevel error -y -f lavfi -i "nullsrc=s=720x1280,geq=random(1)*255:128:128" -t 6 -b:v 20M -maxrate 20M -bufsize 20M -pix_fmt yuv420p "$D/esempio-grande.mp4"
echo "Pronto: $D"
