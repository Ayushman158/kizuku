"""
Procedural watercolour grounds for Kizuku, modelled on the research wash
("first watercolour wash — finding the app's colour temperature").

Watercolour is transparent pigment on paper, so layers multiply rather than
cover. Its tells are: soft-edged pools, darker rims where pigment migrates to
the drying edge, granulation inside a pool, horizontal drag from the brush,
and paper grain showing through. Each is modelled below. Darkness is capped so
forest/600 text stays readable anywhere on the sheet.
"""
import sys, json
import numpy as np
from scipy import ndimage
from PIL import Image

W, H = 603, 1311          # half of 1206x2622; the app cover-scales it up

def hex_rgb(h):
    h = h.lstrip("#"); return np.array([int(h[i:i+2], 16) for i in (0, 2, 4)]) / 255.0

PAPER  = hex_rgb("#FBF8EE")
AMBER  = hex_rgb("#ECD858")
SKY    = hex_rgb("#A4C8DE")
SAGE   = hex_rgb("#A4C49C")
SALMON = hex_rgb("#E0906F")

# dominant pigment carries most of the sheet; the others drift in like the painting
RECIPES = {
    "optimizer": [(AMBER, 0.62, 1.00), (SAGE, 0.26, 0.55), (SALMON, 0.16, 0.45)],
    "seeker":    [(SKY,   0.62, 1.00), (SAGE, 0.24, 0.55), (SALMON, 0.14, 0.40)],
    "planner":   [(SAGE,  0.62, 1.00), (SKY,  0.22, 0.50), (AMBER,  0.18, 0.50)],
}

def field(rng, sx, sy):
    n = rng.standard_normal((H, W))
    n = ndimage.gaussian_filter(n, sigma=(sy, sx), mode="wrap")
    return (n - n.min()) / (n.max() - n.min())

def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

def pool(rng, coverage, strength, crisp=True):
    # large shapes, stretched sideways like a loaded flat brush
    f = 0.7 * field(rng, 90, 34) + 0.3 * field(rng, 28, 11)
    # small-scale wobble on the edge itself: real washes dry to irregular,
    # slightly frayed boundaries, never a clean blurred blob
    f = f + 0.07 * field(rng, 3.5, 3.5)
    f = (f - f.min()) / (f.max() - f.min())
    thr = np.quantile(f, 1 - coverage)
    lo, hi = (thr - 0.012, thr + 0.035) if crisp else (thr - 0.06, thr + 0.10)
    mask = smoothstep(lo, hi, f)
    # the wet edge: a narrow darker line where pigment migrated as it dried
    rim = np.clip(mask - ndimage.gaussian_filter(mask, 2.2), 0, None)
    rim = rim / (rim.max() + 1e-6)
    settle = 0.80 + 0.40 * field(rng, 40, 16)           # pigment settling unevenly
    gran = 0.86 + 0.28 * field(rng, 1.8, 1.8)           # granulation
    return np.clip((mask * 0.55 * settle + rim * 0.42) * gran * strength, 0, 1)

def make(kind, seed, edge_cap):
    rng = np.random.default_rng(seed)
    out = np.ones((H, W, 3)) * PAPER
    dominant = RECIPES[kind][0][0]
    # 1. a first wash laid across the whole sheet, graded, no bare islands
    base = 0.50 + 0.16 * (field(rng, 160, 90) - 0.5)
    out *= 1 - np.minimum(base, edge_cap)[..., None] * (1 - dominant)
    # 2. glazes on top, calmer in the top third where titles sit
    ramp = np.clip(np.linspace(0.45, 1.15, H), 0, 1)[:, None]
    for pigment, coverage, strength in RECIPES[kind]:
        d = pool(rng, coverage * 0.75, strength * 0.85) * ramp
        d = np.minimum(d, edge_cap)
        out *= 1 - d[..., None] * (1 - pigment)
    grain = 1 + 0.02 * (field(rng, 0.6, 0.6) - 0.5)      # paper tooth
    out *= grain[..., None]
    return np.clip(out, 0, 1)

def lum(rgb):
    c = np.where(rgb <= 0.03928, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    return 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]

TEXT = {"forest600": hex_rgb("#1C3C1C"), "forest500": hex_rgb("#2C5228")}

if __name__ == "__main__":
    out_dir, cap = sys.argv[1], float(sys.argv[2])
    report = {}
    for i, kind in enumerate(RECIPES):
        img = make(kind, 11 + i * 7, cap)
        Image.fromarray((img * 255).astype(np.uint8)).save(f"{out_dir}/wash-{kind}.jpg", quality=84, optimize=True)
        L = lum(img)
        row = {}
        for tn, tc in TEXT.items():
            cr = (L + 0.05) / (lum(tc) + 0.05)
            row[tn] = {"min": round(float(cr.min()), 2), "p01": round(float(np.quantile(cr, 0.01)), 2)}
        report[kind] = row
    print(json.dumps(report, indent=1))
