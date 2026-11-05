#!/usr/bin/env python3
"""Rileva i volti nei fotogrammi estratti da FFmpeg (YuNet, OpenCV).

Uso: faces.py <cartella_frame> <fps> <modello.onnx>
I file sono frame_000001.jpg, frame_000002.jpg, ... estratti a <fps> fotogrammi al secondo.
Stampa JSON: [{"t": secondi, "faces": [[x, y, w, h], ...]}] con box normalizzati 0..1.
"""
import json
import os
import sys

import cv2


def main() -> None:
    frames_dir, fps, model = sys.argv[1], float(sys.argv[2]), sys.argv[3]
    files = sorted(f for f in os.listdir(frames_dir) if f.endswith(".jpg"))
    detector = None
    out = []
    for i, name in enumerate(files):
        img = cv2.imread(os.path.join(frames_dir, name))
        if img is None:
            continue
        h, w = img.shape[:2]
        if detector is None:
            detector = cv2.FaceDetectorYN.create(model, "", (w, h), 0.6, 0.3, 50)
        detector.setInputSize((w, h))
        _, faces = detector.detect(img)
        boxes = []
        if faces is not None:
            for f in faces:
                x, y, bw, bh = (float(v) for v in f[:4])
                # Allarga un po' il box: capelli e mento non sempre sono inclusi.
                x, y = x - bw * 0.1, y - bh * 0.25
                bw, bh = bw * 1.2, bh * 1.45
                boxes.append([round(max(0.0, x / w), 4), round(max(0.0, y / h), 4),
                              round(min(1.0, bw / w), 4), round(min(1.0, bh / h), 4)])
        # Il frame i (da 1) estratto con fps=N rappresenta l'intervallo che inizia a (i-1)/N.
        out.append({"t": round(i / fps, 3), "faces": boxes})
    json.dump(out, sys.stdout)


if __name__ == "__main__":
    main()
