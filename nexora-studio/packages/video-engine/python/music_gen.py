#!/usr/bin/env python3
"""Libreria musicale iniziale di Nexora Studio, composta in modo procedurale.

Ogni brano è generato da zero (sintesi con numpy): nessun campione o diritto di terzi.
Uso: music_gen.py <cartella_output>   →  <id>.wav + manifest.json
La conversione in MP3 e la normalizzazione del volume le fa FFmpeg (vedi music.ts).
"""
import json
import os
import sys

import numpy as np

SR = 44100
RNG = np.random.default_rng(7)

NOTE = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def hz(name: str, octave: int) -> float:
    return 440.0 * 2 ** ((NOTE[name] + 12 * (octave + 1) - 69) / 12)


def chord(root: str, kind: str, octave: int = 3) -> list[float]:
    steps = {"maj": [0, 4, 7], "min": [0, 3, 7], "maj7": [0, 4, 7, 11], "min7": [0, 3, 7, 10], "7": [0, 4, 7, 10]}[kind]
    base = NOTE[root] + 12 * (octave + 1)
    return [440.0 * 2 ** ((base + s - 69) / 12) for s in steps]


def env(n: int, attack: float, decay: float) -> np.ndarray:
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-t / max(decay, 1e-4))


def lowpass(x: np.ndarray, cutoff: float) -> np.ndarray:
    # Filtro a un polo applicato due volte (12 dB/ottava), vettorizzato a blocchi via FFT.
    spec = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(len(x), 1 / SR)
    resp = 1 / (1 + (freqs / cutoff) ** 4)
    return np.fft.irfft(spec * resp, n=len(x))


def highpass(x: np.ndarray, cutoff: float) -> np.ndarray:
    return x - lowpass(x, cutoff)


def saw(freq: float, n: int, harmonics: int = 12) -> np.ndarray:
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k in range(1, harmonics + 1):
        if freq * k > SR / 2.2:
            break
        out += np.sin(2 * np.pi * freq * k * t) / k
    return out * 0.6


def piano(freq: float, n: int) -> np.ndarray:
    t = np.arange(n) / SR
    tone = sum(np.sin(2 * np.pi * freq * k * t + k) * (0.6 ** (k - 1)) for k in range(1, 6))
    return tone * env(n, 0.004, 0.9) * 0.35


def pluck(freq: float, n: int) -> np.ndarray:
    return lowpass(saw(freq, n, 8) * env(n, 0.002, 0.18), 3500) * 0.5


def kick(n: int) -> np.ndarray:
    t = np.arange(n) / SR
    f = 42 + 90 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) * 0.9


def snare(n: int, soft: bool = False) -> np.ndarray:
    t = np.arange(n) / SR
    noise = lowpass(highpass(RNG.standard_normal(n), 1200), 7000) * np.exp(-t * (24 if not soft else 32))
    tone = np.sin(2 * np.pi * 185 * t) * np.exp(-t * 30)
    return (noise * 0.45 + tone * 0.35) * (0.6 if soft else 1.0)


def hat(n: int, open_: bool = False) -> np.ndarray:
    t = np.arange(n) / SR
    noise = lowpass(highpass(RNG.standard_normal(n), 6000), 11000)
    return noise * np.exp(-t * (18 if open_ else 80)) * 0.09


def reverb(x: np.ndarray, seconds: float = 1.4, mix: float = 0.22) -> np.ndarray:
    n = int(seconds * SR)
    ir = RNG.standard_normal(n) * np.exp(-np.arange(n) / SR * (6.9 / seconds))
    ir = lowpass(ir, 5000)
    ir /= np.sqrt(np.sum(ir ** 2))
    size = len(x) + n
    wet = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), n=size)[: len(x)]
    return x * (1 - mix) + wet * mix


def place(buf: np.ndarray, sig: np.ndarray, at: float, gain: float = 1.0) -> None:
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


def track(spec: dict) -> np.ndarray:
    bpm, bars, prog = spec["bpm"], spec["bars"], spec["progression"]
    beat = 60 / bpm
    total = bars * 4 * beat
    n = int((total + 2.5) * SR)
    drums, bass, harm, lead = (np.zeros(n) for _ in range(4))
    swing = spec.get("swing", 0.0)

    for bar in range(bars):
        root, kind = prog[bar % len(prog)]
        freqs = chord(root, kind, spec.get("octave", 3))
        t0 = bar * 4 * beat
        intro = bar < 2
        outro = bar >= bars - 2

        # Armonia: pad o accordi di pianoforte
        if spec["harmony"] == "pad":
            seg = int(4 * beat * SR)
            pad = sum(saw(f * d, seg, 6) for f in freqs for d in (0.997, 1.003))
            pad = lowpass(pad, spec.get("pad_cutoff", 1400)) * env(seg, 0.6, 30.0)
            place(harm, pad / len(freqs), t0, 0.22)
        else:
            for b in range(4 if spec["harmony"] == "piano_arp" else 2):
                step = beat if spec["harmony"] == "piano_arp" else 2 * beat
                f = freqs[b % len(freqs)] * (2 if b == 3 else 1)
                place(harm, piano(f, int(1.6 * SR)), t0 + b * step, 0.7)

        # Basso
        if spec.get("bass", True):
            bf = hz(root, 1 if spec.get("bass_low", True) else 2)
            pattern = spec.get("bass_pattern", [0, 2])
            for p in pattern:
                seg = int(beat * SR * spec.get("bass_len", 0.9))
                place(bass, lowpass(saw(bf, seg, 10), 600) * env(seg, 0.01, 0.6), t0 + p * beat, 0.55)

        # Melodia / arpeggio
        if spec.get("arp") and not intro:
            steps = 8
            for s in range(steps):
                f = freqs[(s * 2 + bar) % len(freqs)] * 2
                place(lead, pluck(f, int(0.4 * SR)), t0 + s * beat / 2, 0.32)

        # Batteria
        if spec.get("drums") and not intro:
            for b in range(4):
                tb = t0 + b * beat
                if spec["drums"] == "four":
                    place(drums, kick(int(0.5 * SR)), tb, 0.85)
                    place(drums, hat(int(0.1 * SR)), tb + beat / 2, 0.9)
                    if b in (1, 3):
                        place(drums, snare(int(0.3 * SR)), tb, 0.4)
                elif spec["drums"] == "lofi":
                    if b in (0, 2):
                        place(drums, kick(int(0.5 * SR)), tb + (0.25 * beat if b == 2 else 0), 0.75)
                    if b in (1, 3):
                        place(drums, snare(int(0.3 * SR), soft=True), tb, 0.55)
                    for h in range(2):
                        place(drums, hat(int(0.08 * SR)), tb + h * beat / 2 + (swing * beat if h else 0), 0.55)
                elif spec["drums"] == "shaker":
                    for h in range(4):
                        place(drums, hat(int(0.06 * SR)), tb + h * beat / 4, 0.35 if h % 2 else 0.2)
                    if b == 0:
                        place(drums, kick(int(0.5 * SR)), tb, 0.45)
            if outro:
                drums[int(t0 * SR):int((t0 + 4 * beat) * SR)] *= 0.6

    mix = drums * spec.get("drums_gain", 1.0) + bass + reverb(harm, 2.0, 0.3) + reverb(lead, 1.2, 0.25)
    if spec.get("vinyl"):
        mix += lowpass(RNG.standard_normal(n), 3000) * 0.006
    mix = mix[: int((total + 2.0) * SR)]
    # Dissolvenze e normalizzazione
    fade = int(2.0 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)
    mix[: int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR))
    mix /= np.max(np.abs(mix)) + 1e-9
    left = mix
    right = np.roll(mix, int(0.012 * SR)) * 0.92 + mix * 0.08  # leggera apertura stereo
    return np.stack([left, right], axis=1) * 0.9


TRACKS = [
    {"id": "energica-01", "title": "Avanti tutta", "mood": "energica", "bpm": 118, "bars": 32,
     "progression": [("A", "min"), ("F", "maj"), ("C", "maj"), ("G", "maj")],
     "harmony": "pad", "pad_cutoff": 2200, "arp": True, "drums": "four", "bass_pattern": [0, 1, 2, 3], "bass_len": 0.5},
    {"id": "energica-02", "title": "Giornata piena", "mood": "energica", "bpm": 124, "bars": 32,
     "progression": [("D", "min"), ("A#", "maj"), ("F", "maj"), ("C", "maj")],
     "harmony": "pad", "pad_cutoff": 1800, "arp": True, "drums": "four", "bass_pattern": [0, 0.5, 1.5, 2, 2.5, 3.5], "bass_len": 0.4},
    {"id": "rilassata-01", "title": "Caffè lento", "mood": "rilassata", "bpm": 80, "bars": 24,
     "progression": [("F", "maj7"), ("E", "min7"), ("D", "min7"), ("C", "maj7")],
     "harmony": "piano", "drums": "lofi", "swing": 0.12, "vinyl": True, "drums_gain": 0.8, "bass_pattern": [0, 2.5]},
    {"id": "rilassata-02", "title": "Sera tranquilla", "mood": "rilassata", "bpm": 76, "bars": 24,
     "progression": [("A", "min7"), ("D", "7"), ("G", "maj7"), ("C", "maj7")],
     "harmony": "pad", "pad_cutoff": 1100, "drums": "lofi", "swing": 0.1, "vinyl": True, "drums_gain": 0.7, "bass_pattern": [0, 2]},
    {"id": "elegante-01", "title": "Vetrina", "mood": "elegante", "bpm": 92, "bars": 28,
     "progression": [("C", "maj7"), ("A", "min7"), ("D", "min7"), ("G", "7")],
     "harmony": "piano_arp", "drums": "shaker", "bass_pattern": [0], "bass_len": 3.5, "octave": 4},
    {"id": "elegante-02", "title": "Dettagli", "mood": "elegante", "bpm": 88, "bars": 28,
     "progression": [("E", "min7"), ("C", "maj7"), ("G", "maj7"), ("D", "maj")],
     "harmony": "piano_arp", "drums": "shaker", "bass": True, "bass_pattern": [0, 2], "bass_len": 1.8, "octave": 4},
]


def main() -> None:
    out_dir = sys.argv[1]
    os.makedirs(out_dir, exist_ok=True)
    manifest = []
    for spec in TRACKS:
        audio = track(spec)
        pcm = (np.clip(audio, -1, 1) * 32767).astype("<i2")
        path = os.path.join(out_dir, f"{spec['id']}.wav")
        with open(path, "wb") as fh:
            data = pcm.tobytes()
            fh.write(b"RIFF" + (36 + len(data)).to_bytes(4, "little") + b"WAVEfmt ")
            fh.write((16).to_bytes(4, "little") + (1).to_bytes(2, "little") + (2).to_bytes(2, "little"))
            fh.write(SR.to_bytes(4, "little") + (SR * 4).to_bytes(4, "little") + (4).to_bytes(2, "little") + (16).to_bytes(2, "little"))
            fh.write(b"data" + len(data).to_bytes(4, "little") + data)
        manifest.append({
            "id": spec["id"], "title": spec["title"], "mood": spec["mood"], "bpm": spec["bpm"],
            "duration_s": round(len(pcm) / SR, 1),
        })
        print(f"{spec['id']}: {len(pcm) / SR:.1f}s", file=sys.stderr)
    with open(os.path.join(out_dir, "manifest.json"), "w") as fh:
        json.dump({"license": "Composti proceduralmente da Nexora Studio: nessun diritto di terzi.", "tracks": manifest}, fh, indent=2)


if __name__ == "__main__":
    main()
