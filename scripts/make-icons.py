"""Generates the PWA app icons (public/icons/app-192.png, app-512.png) with no
dependencies: a gold rounded square with a dark alchemy flask silhouette."""
import os
import struct
import zlib

ROOT = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
GOLD = (233, 189, 35)
DARK = (15, 17, 21)


def png(width, height, pixels):
    raw = b"".join(b"\x00" + bytes(v for px in row for v in px) for row in pixels)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def make(size):
    r = size * 0.22  # corner radius
    cx = size / 2
    rows = []
    for y in range(size):
        row = []
        for x in range(size):
            # rounded square mask
            dx = max(abs(x + 0.5 - cx) - (cx - r), 0)
            dy = max(abs(y + 0.5 - cx) - (cx - r), 0)
            inside = dx * dx + dy * dy <= r * r
            if not inside:
                row.append(DARK)  # transparent-ish corners are not supported in RGB; keep dark
                continue
            # flask: neck rect + round bulb + liquid line
            neck = abs(x - cx) < size * 0.07 and size * 0.20 < y < size * 0.48
            lip = abs(x - cx) < size * 0.12 and size * 0.17 < y < size * 0.23
            bx, by = x - cx, y - size * 0.64
            bulb = bx * bx + by * by < (size * 0.24) ** 2 and y > size * 0.40
            row.append(DARK if (neck or lip or bulb) else GOLD)
        rows.append(row)
    return png(size, size, rows)


os.makedirs(ROOT, exist_ok=True)
for s in (192, 512):
    with open(os.path.join(ROOT, f"app-{s}.png"), "wb") as f:
        f.write(make(s))
    print("wrote", f"app-{s}.png")
