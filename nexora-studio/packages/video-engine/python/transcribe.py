#!/usr/bin/env python3
"""Trascrizione parola per parola con Whisper eseguito sul worker (faster-whisper, CPU).

Uso: transcribe.py <audio> [lingua] [modello] [cartella_modelli]
Stampa su stdout un JSON: {"language", "text", "duration", "words": [{"text", "start", "end"}]}
L'audio non lascia il server: nessuna chiamata esterna (il modello è già scaricato nell'immagine).
"""
import json
import os
import subprocess
import sys

import numpy as np
from faster_whisper import WhisperModel

SAMPLE_RATE = 16000


def load_audio(path: str) -> np.ndarray:
    """Audio mono a 16 kHz decodificato da FFmpeg (già presente sul worker)."""
    raw = subprocess.run(
        ["ffmpeg", "-nostdin", "-loglevel", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SAMPLE_RATE), "-"],
        check=True,
        capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32)


def main() -> None:
    if len(sys.argv) < 2:
        print("uso: transcribe.py <audio> [lingua] [modello] [cartella_modelli]", file=sys.stderr)
        sys.exit(2)
    audio = sys.argv[1]
    language = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else "it"
    model_name = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else "small"
    models_dir = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] else None

    threads = int(os.environ.get("WHISPER_THREADS", "0")) or os.cpu_count() or 4
    model = WhisperModel(
        model_name,
        device="cpu",
        compute_type="int8",
        cpu_threads=threads,
        download_root=models_dir,
        local_files_only=bool(models_dir and os.environ.get("WHISPER_OFFLINE", "1") == "1"),
    )
    samples = load_audio(audio)
    segments, info = model.transcribe(
        samples,
        language=language,
        word_timestamps=True,
        vad_filter=False,  # le pause servono al montaggio per tagliarle: non vanno nascoste
        beam_size=5,
        condition_on_previous_text=False,
    )
    words = []
    texts = []
    for seg in segments:
        texts.append(seg.text.strip())
        for w in seg.words or []:
            token = w.word.strip()
            if token:
                words.append({"text": token, "start": round(w.start, 3), "end": round(w.end, 3)})
    json.dump(
        {
            "language": info.language,
            "text": " ".join(t for t in texts if t),
            "duration": round(info.duration, 3),
            "words": words,
        },
        sys.stdout,
        ensure_ascii=False,
    )


if __name__ == "__main__":
    main()
