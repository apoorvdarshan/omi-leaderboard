"""Cut the Omi pendant out of its white studio background.

Usage: python cutout.py <src.jpg> <out.png>

Background = near-white pixels connected to the image border. Pixels next to
the background are softened with color-to-alpha so the edge stays clean on
any page color. The cord fades out toward the top so it doesn't end abruptly.
"""
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

src, out = sys.argv[1], sys.argv[2]
img = Image.open(src).convert("RGB")
rgb = np.asarray(img).astype(np.float32)
h, w, _ = rgb.shape

# Near-white candidates, then keep only those reachable from the border.
whiteness = rgb.min(axis=2)
mask = Image.fromarray(np.where(whiteness >= 236, 255, 0).astype(np.uint8)).copy()
for x in range(0, w, 4):
    for y in (0, h - 1):
        if mask.getpixel((x, y)) == 255:
            ImageDraw.floodfill(mask, (x, y), 128)
for y in range(0, h, 4):
    for x in (0, w - 1):
        if mask.getpixel((x, y)) == 255:
            ImageDraw.floodfill(mask, (x, y), 128)
bg = np.array(mask) == 128

# Edge band: a few pixels of foreground touching the background.
bg_img = Image.fromarray((bg * 255).astype(np.uint8))
near = np.asarray(bg_img.filter(ImageFilter.MaxFilter(5))) > 0
band = near & ~bg

alpha = np.ones((h, w), np.float32)
alpha[bg] = 0.0
# Color-to-alpha against white inside the band.
a_band = ((255.0 - rgb[band]).max(axis=1) / 255.0).clip(0, 1)
a_band = np.maximum(a_band, 0.15)
alpha[band] = a_band
color = rgb.copy()
color[band] = ((rgb[band] - (1 - a_band[:, None]) * 255.0) / a_band[:, None]).clip(0, 255)

# Slight blur on alpha for anti-aliasing.
a_img = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
alpha = np.asarray(a_img).astype(np.float32) / 255.0
alpha[bg & ~near] = 0.0

# Crop to the subject.
ys, xs = np.where(alpha > 0.02)
pad = 24
x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad, w)
y0, y1 = max(ys.min(), 0), min(ys.max() + pad, h)
alpha = alpha[y0:y1, x0:x1]
color = color[y0:y1, x0:x1]

# Fade the cord out over the top 18% of the crop.
ch = alpha.shape[0]
fade = np.clip(np.linspace(0, 1, int(ch * 0.18)), 0, 1) ** 1.6
alpha[: len(fade)] *= fade[:, None]

rgba = np.dstack([color, alpha * 255.0]).astype(np.uint8)
Image.fromarray(rgba).save(out, optimize=True)
print(out, rgba.shape[1], "x", rgba.shape[0])
