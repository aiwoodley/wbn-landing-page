"""Woodley Solutions logo system.

Mark: two identical V's interlocking into a W, one for each brother. They're the same shape,
offset, and they hold each other up. Wordmark text is converted to outlines so the SVGs
don't depend on any installed font.

Run with a Python that has fontTools: python build_logo.py
"""
import os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = "/tmp/fonts"
OUT = os.path.join(HERE, "logo")
os.makedirs(OUT, exist_ok=True)

INK = "#14213D"      # deep navy
BRASS = "#B8873B"    # brass / old gold
PAPER = "#F6F1E7"    # warm paper
WHITE = "#FFFFFF"


# ---------- geometry ----------
def v_poly(L, R, top, bot, w):
    """A V with horizontal-cut tops; constant horizontal stroke width w."""
    M = (L + R) / 2
    # inner apex where the two inner edges meet
    y_in = top + (bot - top) * (M - L - w) / (M - w / 2 - L)
    pts = [(L, top), (M - w / 2, bot), (M + w / 2, bot), (R, top), (R - w, top), (M, y_in), (L + w, top)]
    return "M" + " L".join(f"{x:.2f},{y:.2f}" for x, y in pts) + " Z"


TOP, BOT, W = 20, 80, 13.5
V1 = v_poly(6, 64, TOP, BOT, W)     # left V
V2 = v_poly(36, 94, TOP, BOT, W)    # right V: identical, offset so the inner arms cross in an X


def mark(fg1, fg2, gap, size=100, x=0, y=0, scale=1.0):
    """Interlock: V2 sits over V1 at the top crossing, V1 passes back over V2 lower down.
    The gap color knocks out a hairline so the weave reads cleanly."""
    s = scale
    mid = f"k{abs(hash((fg1, fg2, x, y, s))) % 10**7}"
    g = f'<g transform="translate({x},{y}) scale({s})">'
    # V2 crosses over V1. V1 is masked by a slightly fattened V2 so a clean gap shows
    # whatever is behind the logo (works on any background, transparent PNGs included).
    g += (f'<mask id="{mid}" maskUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="120">'
          f'<rect x="-10" y="-10" width="120" height="120" fill="#fff"/>'
          f'<path d="{V2}" fill="#000" stroke="#000" stroke-width="6" stroke-linejoin="miter"/></mask>')
    g += f'<path d="{V1}" fill="{fg1}" mask="url(#{mid})"/>'
    g += f'<path d="{V2}" fill="{fg2}"/>'
    g += "</g>"
    return g


# ---------- text to outlines ----------
class Typesetter:
    def __init__(self, path):
        self.f = TTFont(path)
        self.gs = self.f.getGlyphSet()
        self.cmap = self.f.getBestCmap()
        self.upm = self.f["head"].unitsPerEm
        self.hmtx = self.f["hmtx"]
        kern = {}
        if "GPOS" in self.f:
            pass  # pair kerning applied manually below where needed
        self.kern = kern

    def path(self, text, size, x, y, tracking=0.0, kern=None):
        kern = kern or {}
        s = size / self.upm
        pen = SVGPathPen(self.gs)
        cx = 0.0
        prev = None
        for ch in text:
            gname = self.cmap.get(ord(ch))
            if gname is None:
                continue
            if prev and (prev + ch) in kern:
                cx += kern[prev + ch] * self.upm / 1000
            tp = TransformPen(pen, (s, 0, 0, -s, x + cx * s, y))
            self.gs[gname].draw(tp)
            cx += self.hmtx[gname][0] + tracking * self.upm
            prev = ch
        width = (cx - tracking * self.upm) * s
        return pen.getCommands(), width

    def width(self, text, size, tracking=0.0, kern=None):
        return self.path(text, size, 0, 0, tracking, kern)[1]


serif = Typesetter(os.path.join(FONTS, "Fraunces-600.ttf"))
sans = Typesetter(os.path.join(FONTS, "Instrument-600.ttf"))
KERN = {"Wo": -40}


def svg(w, h, body, bg=None):
    rect = f'<rect width="100%" height="100%" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.1f} {h:.1f}" '
            f'width="{w:.0f}" height="{h:.0f}" role="img" aria-label="Woodley Solutions">{rect}{body}</svg>\n')


def horizontal(ink, accent, gap, bg=None, sub=None):
    sub = sub or ink
    mk = mark(ink, accent, gap, x=0, y=0, scale=1.0)
    d1, w1 = serif.path("Woodley", 58, 122, 61, kern=KERN)
    d2, w2 = sans.path("SOLUTIONS", 19, 125, 90, tracking=0.30)
    W_ = 122 + max(w1, w2 + 3) + 4
    body = mk + f'<path d="{d1}" fill="{ink}"/><path d="{d2}" fill="{sub}"/>'
    return svg(W_, 100, body, bg)


def stacked(ink, accent, gap, bg=None):
    d1, w1 = serif.path("Woodley", 64, 0, 0, kern=KERN)
    d2, w2 = sans.path("SOLUTIONS", 17, 0, 0, tracking=0.34)
    W_ = max(w1, w2) + 20
    mk = mark(ink, accent, gap, x=(W_ - 120) / 2, y=0, scale=1.2)
    d1, _ = serif.path("Woodley", 64, (W_ - w1) / 2, 178, kern=KERN)
    d2, _ = sans.path("SOLUTIONS", 17, (W_ - w2) / 2, 210, tracking=0.34)
    body = mk + f'<path d="{d1}" fill="{ink}"/><path d="{d2}" fill="{ink}"/>'
    return svg(W_, 222, body, bg)


def mark_only(ink, accent, gap, bg=None, pad=0):
    return svg(100 + 2 * pad, 100 + 2 * pad, mark(ink, accent, gap, x=pad, y=pad), bg)


def app_icon(bg, ink, accent):
    # Rounded tile for favicon / social avatar
    body = f'<rect width="128" height="128" rx="26" fill="{bg}"/>' + mark(ink, accent, bg, x=14, y=14, scale=1.0)
    return svg(128, 128, body)


files = {
    "woodley-solutions-mark.svg": mark_only(INK, BRASS, PAPER),
    "woodley-solutions-mark-on-dark.svg": mark_only(PAPER, BRASS, INK),
    "woodley-solutions-horizontal.svg": horizontal(INK, BRASS, PAPER),
    "woodley-solutions-horizontal-on-dark.svg": horizontal(PAPER, BRASS, INK, sub=BRASS),
    "woodley-solutions-horizontal-mono-black.svg": horizontal("#000", "#000", WHITE),
    "woodley-solutions-stacked.svg": stacked(INK, BRASS, PAPER),
    "woodley-solutions-stacked-on-dark.svg": stacked(PAPER, BRASS, INK),
    "woodley-solutions-icon.svg": app_icon(INK, PAPER, BRASS),
}
for name, content in files.items():
    with open(os.path.join(OUT, name), "w") as fh:
        fh.write(content)
print("\n".join(sorted(files)))
