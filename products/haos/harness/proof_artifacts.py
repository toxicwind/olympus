#!/usr/bin/env python3
"""Proof artifact generator — dark-mode PNG + tone WAV.

Renders a dark-mode PNG proof (grid + arm legend) and writes a short
sine-tone WAV so the harness output has both image and audio proof.
Uses PIL/numpy from the portable target dir when available, and falls
back to a pure-stdlib PNG/WAV writer when they are not.
"""
import math
import os
import struct
import sys
import wave
import zlib

WS = os.environ.get("LOCAL_WORKSPACE") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB_DIR = os.path.join(WS, "libs")
if os.path.isdir(LIB_DIR):
    sys.path.insert(0, LIB_DIR)

W, H = 640, 360
BG = (16, 16, 16)
GRID = (40, 40, 40)
INK = (222, 222, 222)
ACCENT = (0, 200, 160)


def write_png_stdlib(path):
    """Minimal PNG writer (RGB8, no dependencies)."""
    rows = []
    for y in range(H):
        row = bytearray()
        for x in range(W):
            c = GRID if (x % 40 == 0 or y % 40 == 0) else BG
            row += bytes(c)
        rows.append(bytes(row))
    raw = b"".join(b"\x00" + r for r in rows)

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def build_png(path):
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        write_png_stdlib(path)
        return "stdlib"
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    for x in range(0, W, 40):
        d.line([(x, 0), (x, H)], fill=GRID)
    for y in range(0, H, 40):
        d.line([(0, y), (W, y)], fill=GRID)
    d.rectangle([24, 24, 616, 336], outline=(70, 70, 70), width=2)
    d.rectangle([24, 24, 30, 336], fill=ACCENT)
    d.text((48, 48), "EFFUSION CHAOS HARNESS 2.1.0", fill=INK)
    d.text((48, 74), "arms: edge_socket / boundary_limits / payload_overflow", fill=(160, 160, 160))
    d.text((48, 94), "      half_close_race / rst_abort", fill=(160, 160, 160))
    d.text((48, 130), "barrier-synchronized concurrency stress harness", fill=INK)
    d.text((48, 300), "dark mode proof - rgb(16,16,16)", fill=(120, 120, 120))
    img.save(path)
    return "pillow"


def build_wav(path):
    rate = 44100
    dur = 1.0
    freq = 440.0
    n = int(rate * dur)
    frames = bytearray()
    for i in range(n):
        env = min(1.0, i / 2000.0) * min(1.0, (n - i) / 2000.0)
        v = int(11000 * env * math.sin(2 * math.pi * freq * i / rate))
        frames += struct.pack("<h", v)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(bytes(frames))


def main():
    png_path = os.path.join(WS, "proof_dark.png")
    wav_path = os.path.join(WS, "proof_tone.wav")
    backend = build_png(png_path)
    build_wav(wav_path)
    print(f"PNG proof : {png_path} ({backend}, {os.path.getsize(png_path)} bytes)")
    print(f"WAV tone  : {wav_path} ({os.path.getsize(wav_path)} bytes)")


if __name__ == "__main__":
    main()