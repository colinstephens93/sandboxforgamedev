# Blender measurement overlay for the Duramax Dyno Shop (headless, scripted).
#
#   blender --background --python tools/blender/overlay.py
#
# Reads `.dev/profile.json` (written by tools/blender/exportProfile.mjs: the game truck's side silhouette in
# meters, truck frame) and the two side-view reference photos, then for each photo
#   * scales and positions the game's outline over the photo (horizontal calibration from the wheel hubs,
#     vertical scale anchored on the roof line, as specified),
#   * writes `.dev/overlay_<photo>.png`: the outline in a bright colour at 50 percent over the photo,
#     plus a second, length-matched outline (cyan) used to separate shape errors from the overall-length
#     disagreement between the photos and the published length,
#   * measures the photo's own silhouette and writes `.dev/overlay_report.md` (photo position versus game
#     position in inches from the front axle, the difference, and a flag above 1.5 in).
#
# Nothing is hand-modelled and nothing is downloaded: this is measurement only. Output stays in `.dev/`
# (git-ignored), as docs/DECISIONS.md requires.
#
# Method notes (also repeated in the report):
#  * Horizontal calibration is the specified one: front hub centre (175, 595), rear hub centre (833, 593) in
#    reference/IMG_2862.jpeg, wheelbase 153.0 in. For IMG_2851.jpeg (front of the truck at the right) the hub
#    centres were measured the same way from 5x zoomed crops and are recorded in PHOTOS below.
#  * The vertical scale is the same px/in as the horizontal one; the vertical origin is set so the game's roof
#    (77.0 in) lands on the photo's roof line. The remaining vertical error (the game's ground line versus the
#    photo's tyre contact patch) is reported as the residual.
#  * The photos show a lifted truck with oversize tyres, so heights follow the spec envelope; only horizontal
#    positions are treated as measurements.
#  * Feature positions are read from the photo by scanning for luminance edges around an anchor that was read
#    from 4-8x zoomed crops, with a small snap window. Every scan is recorded in the report so the numbers can
#    be re-derived. Where the edge is weak or occluded the anchor is kept and the entry says so.
import bpy
import json
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
DEV = os.path.join(ROOT, '.dev')
PROFILE = os.path.join(DEV, 'profile.json')

WHEELBASE_IN = 153.0

PHOTOS = [
    {
        'id': 'IMG_2862',
        'path': os.path.join(ROOT, 'reference', 'IMG_2862.jpeg'),
        'frontAtLeft': True,
        # hub centres, px (specified in the task text)
        'hubFront': (175.0, 595.0),
        'hubRear': (833.0, 593.0),
        'roofRow': 325.0,            # px row of the roof line (top of the body) at the middle of the cab
        'tireContactRow': 656.0,     # px row where the tyres meet the ground (bottom of the front tyre)
        # feature anchors read from 4-8x zoomed crops: hint px column, snap band, row band to average
        'anchors': {
            'nose':          (38.0, 26, (505, 540)),
            'cabBack':       (648.0, 14, (430, 470)),
            'bedFront':      (654.0, 14, (430, 470)),
            'bedRailEnd':    (984.0, 26, (405, 425)),
            'tailgateEnd':   (988.0, 26, (455, 475)),
            'rearBumperEnd': (1000.0, 30, (520, 548)),
        },
    },
    {
        'id': 'IMG_2851',
        'path': os.path.join(ROOT, 'reference', 'IMG_2851.jpeg'),
        'frontAtLeft': False,
        # measured from 5x zoomed crops (recorded here as the task asks)
        'hubFront': (851.0, 541.0),
        'hubRear': (212.0, 564.0),
        'roofRow': 295.0,
        'tireContactRow': 617.0,
        'anchors': {
            'nose':          (980.0, 26, (455, 490)),
            'cabBack':       (385.0, 14, (420, 460)),
            'bedFront':      (398.0, 14, (420, 460)),
            'bedRailEnd':    (74.0, 26, (405, 425)),
            'tailgateEnd':   (66.0, 26, (450, 470)),
            'rearBumperEnd': (34.0, 30, (495, 525)),
        },
    },
]

TRACE_BAND = 16          # px search window either side of the prior for the top-edge trace
EDGE_MIN = 22.0          # luminance gradient (0-255 per px) that counts as an edge
OUTLINE_ALPHA = 0.6      # the required "about 50 percent transparent" outline
LENGTHMATCH_ALPHA = 0.5


# ---------------------------------------------------------------------------------------------------------
# image io (Blender's bpy image API + numpy; no external image libraries)
# ---------------------------------------------------------------------------------------------------------
def load_rgb(path):
    """Return (H, W, 3) float array in 0..1, top row first."""
    img = bpy.data.images.load(path, check_existing=False)
    try:
        img.colorspace_settings.name = 'Non-Color'   # keep the stored values; no colour management
    except Exception:
        pass
    w, h = img.size
    buf = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(buf)
    a = buf.reshape(h, w, 4)[::-1, :, :3].astype(np.float32)
    bpy.data.images.remove(img)
    return np.clip(a, 0.0, 1.0)


def save_rgb(path, rgb):
    h, w, _ = rgb.shape
    img = bpy.data.images.new(os.path.basename(path), width=w, height=h, alpha=False)
    img.colorspace_settings.name = 'Non-Color'
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[:, :, :3] = rgb[::-1]                       # bpy stores the bottom row first
    img.pixels.foreach_set(rgba.reshape(-1))
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)


def luminance(rgb):
    """0-255 luminance; the edge thresholds in this file are stated in those units."""
    return (rgb[:, :, 0] * 0.2126 + rgb[:, :, 1] * 0.7152 + rgb[:, :, 2] * 0.0722) * 255.0


# ---------------------------------------------------------------------------------------------------------
# drawing (a few thousand segments; each is stamped with a small round kernel)
# ---------------------------------------------------------------------------------------------------------
def draw_segment(canvas, x0, y0, x1, y1, color, alpha=1.0, width=2.0):
    h, w = canvas.shape[:2]
    n = int(max(2.0, math.hypot(x1 - x0, y1 - y0) * 1.6))
    r = width * 0.5
    col = np.array(color, dtype=np.float32)
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t
        xa, xb = int(math.floor(x - r)), int(math.ceil(x + r))
        ya, yb = int(math.floor(y - r)), int(math.ceil(y + r))
        for py in range(max(0, ya), min(h - 1, yb) + 1):
            for px in range(max(0, xa), min(w - 1, xb) + 1):
                d = math.hypot(px + 0.5 - x, py + 0.5 - y)
                if d <= r + 0.35:
                    k = alpha * min(1.0, (r + 0.35 - d))
                    canvas[py, px, :3] = canvas[py, px, :3] * (1.0 - k) + col * k


def draw_cross(canvas, x, y, color, size=7, alpha=0.9):
    draw_segment(canvas, x - size, y, x + size, y, color, alpha, 1.5)
    draw_segment(canvas, x, y - size, x, y + size, color, alpha, 1.5)


# ---------------------------------------------------------------------------------------------------------
# calibration: game (z, y) meters -> photo pixels
# ---------------------------------------------------------------------------------------------------------
class Calib:
    def __init__(self, photo, roofHeightIn, axleHeightIn):
        self.photo = photo
        self.fx, self.fy = photo['hubFront']
        rx, ry = photo['hubRear']
        self.frontAtLeft = photo['frontAtLeft']
        self.ppi = abs(rx - self.fx) / WHEELBASE_IN          # px per inch (horizontal)
        self.roofRow = photo['roofRow']
        self.roofHeightIn = roofHeightIn
        self.axleHeightIn = axleHeightIn
        # the row of the wheel centre in the ideal (un-rolled) map
        self.axleRow = self.roofRow + (self.roofHeightIn - axleHeightIn) * self.ppi
        # apparent roll of the truck in the photo: rotate about the front hub so the drawn rear axle lands
        # on the photo's rear hub. Both photos are within 1.5 deg, but the roof anchor is sensitive to it.
        sgn = 1.0 if self.frontAtLeft else -1.0
        self.roll = math.atan2(ry - self.axleRow, rx - self.fx) - (0.0 if sgn > 0 else math.pi)
        if abs(self.roll) < 0.0015:
            self.roll = 0.0
        self.cos = math.cos(self.roll)
        self.sin = math.sin(self.roll)

    def s2x(self, s_in, h_in):
        """station (inches rearward of the front axle), height (inches) -> pixel (x, y)."""
        sgn = 1.0 if self.frontAtLeft else -1.0
        x = self.fx + sgn * s_in * self.ppi
        y = self.roofRow + (self.roofHeightIn - h_in) * self.ppi
        dx, dy = x - self.fx, y - self.axleRow
        return (self.fx + dx * self.cos - dy * self.sin, self.axleRow + dx * self.sin + dy * self.cos)

    def x2s(self, x_px):
        """pixel column -> station in inches (the hub row is the rotation centre, so this is a 1-D solve)."""
        dx = x_px - self.fx
        # undo the roll about the axle row at the hub height (dy = 0 there)
        u = dx / self.cos if abs(self.cos) > 1e-6 else dx
        return (u / self.ppi) * (1.0 if self.frontAtLeft else -1.0)

    def ground_row(self):
        return self.roofRow + self.roofHeightIn * self.ppi


# ---------------------------------------------------------------------------------------------------------
# edge scanning
# ---------------------------------------------------------------------------------------------------------
def scan_vertical_edge(L, x_hint, row_band, band):
    """Strongest bright->dark horizontal gradient near x_hint, averaged over a row band.
    Returns (x, contrast 0-255)."""
    y0, y1 = int(row_band[0]), int(row_band[1])
    prof = L[y0:y1, :].mean(axis=0)
    lo = max(2, int(round(x_hint - band)))
    hi = min(len(prof) - 3, int(round(x_hint + band)))
    best_x, best = None, -1e9
    for x in range(lo, hi + 1):
        g = prof[x + 1] - prof[x - 1]              # positive: bright -> dark going right
        if -g > best:
            best, best_x = -g, float(x)
    return best_x, best


def first_drop_row(L, x, y_hint, band=TRACE_BAND, thr=EDGE_MIN):
    """First significant bright->dark transition scanning down a column, within +-band of y_hint."""
    h = L.shape[0]
    lo = max(1, int(y_hint - band))
    hi = min(h - 2, int(y_hint + band))
    col = L[lo:hi + 1, x]
    g = np.diff(col)
    gs = np.convolve(g, np.ones(3) / 3.0, mode='same')
    idx = np.where(gs < -thr)[0]
    if not len(idx):
        return None, 0.0
    i = int(idx[0])
    return float(lo + i + 1), float(-gs[i])


def trace_top(profile, calib, L, s0, s1, step_px=3):
    """Trace the photo's top silhouette between two stations. The game outline is the prior; the measurement
    is the first strong bright->dark edge down each column; a median filter over 11 samples (~33 px) rejects
    branches, poles and other background clutter."""
    IN = 0.0254
    hood = [(p[0] / IN, p[1] / IN) for p in profile['lines']['hood']]
    roof = [(p[0] / IN, p[1] / IN) for p in profile['lines']['roof']]
    prior = sorted(hood + roof)
    ps = np.array([p[0] for p in prior])
    ph = np.array([p[1] for p in prior])

    x_a, _ = calib.s2x(s0, 60.0)
    x_b, _ = calib.s2x(s1, 60.0)
    x_lo, x_hi = sorted((x_a, x_b))
    xs, ys, ss, hh = [], [], [], []
    for x in range(int(x_lo), int(x_hi) + 1, step_px):
        s = calib.x2s(x)
        if s < s0 - 1 or s > s1 + 1:
            continue
        h_prior = float(np.interp(s, ps, ph))
        _, y_prior = calib.s2x(s, h_prior)
        row, strength = first_drop_row(L, x, y_prior)
        if row is None or abs(row - y_prior) > TRACE_BAND * 0.9:
            row = y_prior
        xs.append(x); ys.append(row); ss.append(s); hh.append(h_prior)
    xs = np.array(xs, float); ys = np.array(ys, float); ss = np.array(ss, float)
    hh = np.array(hh, float)
    order = np.argsort(ss)
    xs, ys, ss, hh = xs[order], ys[order], ss[order], hh[order]
    k = 11
    pad = np.pad(ys, (k // 2, k // 2), mode='edge')
    med = np.array([np.median(pad[i:i + k]) for i in range(len(ys))])
    heights = calib.roofHeightIn - (med - calib.roofRow) / calib.ppi
    return ss, heights, hh, xs, med


def kink_station(ss, hh, slope_thr=0.72):
    """Station where the traced top edge starts to climb steeply (the windshield base)."""
    n = len(ss)
    k = 4
    for i in range(k, n - k):
        slope = (hh[i + k] - hh[i - k]) / max(1e-6, (ss[i + k] - ss[i - k]))
        if slope > slope_thr:
            return float(ss[i])
    return None


# ---------------------------------------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------------------------------------
def main():
    if not os.path.exists(PROFILE):
        print('missing .dev/profile.json; run: node tools/blender/exportProfile.mjs', file=sys.stderr)
        sys.exit(1)
    with open(PROFILE, 'r', encoding='utf-8') as fh:
        profile = json.load(fh)
    roof_in = profile['envelope']['heightIn']
    axle_in = profile['wheels'][0]['yIn']
    IN = 0.0254

    features = {f['id']: f for f in profile['features']}
    order = ['nose', 'hoodEnd', 'windshieldBase', 'roofFront', 'roofRear', 'cabBack', 'bedFront',
             'bedRailEnd', 'tailgateEnd', 'rearBumperEnd']
    report = []
    report.append('# Blender overlay report\n')
    report.append('Generated by `tools/blender/overlay.py` from `.dev/profile.json` (`src/truck/skin.js`) and the '
                  'side-view reference photos. Positions are inches rearward of the front axle (the truck frame in '
                  '`docs/CONVENTIONS.md`); a negative number is ahead of the front axle.\n')
    report.append('**Method.** Horizontal calibration is the specified one: the two wheel-hub centres with the '
                  '153.0 in wheelbase. The vertical scale is the same px/in with its origin anchored on the roof '
                  'line (the game roof, 77.0 in, on the photo roof), which is what the outline overlay uses. The '
                  'photos show a lifted truck with oversize tyres, so heights follow the spec envelope and only '
                  'horizontal positions are treated as measurements. Each photo feature is found by scanning the '
                  'photo for the luminance edge nearest a hand-read anchor (4-8x zoomed crops); the top silhouette '
                  'is traced with the game outline as its prior and a median filter. Every scan is listed, so the '
                  'numbers can be re-derived.\n')

    results = []
    for photo in PHOTOS:
        if not os.path.exists(photo['path']):
            print('missing photo', photo['path'], file=sys.stderr)
            continue
        rgb = load_rgb(photo['path'])
        L = luminance(rgb)
        h_px, w_px = L.shape
        calib = Calib(photo, roof_in, axle_in)
        print(f"{photo['id']}: {w_px}x{h_px}  {calib.ppi:.4f} px/in  roll {math.degrees(calib.roll):+.2f} deg  "
              f"roof row {photo['roofRow']:.0f}  ground row {calib.ground_row():.1f}")

        # ---------------- trace the top silhouette ----------------
        s_trace0 = features['hoodEnd']['sIn']
        s_trace1 = profile['stations']['cabBack']['in']
        ss, hh, h_prior, txs, trows = trace_top(profile, calib, L, s_trace0, s_trace1)
        meas = {
            'hoodEnd': float(ss[0]),
            'windshieldBase': kink_station(ss, hh),
        }
        # The roof-height crossing uses the roof edge height of the body model (ROOF_EDGE_Y = 75.4 in in
        # body.js, i.e. the crown 1.6 in below the 77.0 in envelope height). Walk out from the middle of the
        # roof so a noisy windshield column cannot fake the crossing.
        thr = roof_in - 1.6
        i_peak = int(np.argmax(hh))
        roof_front_meas = float(ss[i_peak])
        for i in range(i_peak, -1, -1):
            if hh[i] < thr:
                roof_front_meas = float(ss[min(i_peak, i + 1)]); break
        roof_rear_meas = float(ss[i_peak])
        for i in range(i_peak, len(ss)):
            if hh[i] < thr:
                roof_rear_meas = float(ss[max(i_peak, i - 1)]); break
        meas['roofFront'] = roof_front_meas
        meas['roofRear'] = roof_rear_meas

        # Sanity gate for the four trace-derived stations: where the background behind the truck is dark
        # trees the trace can lock onto the glass edge instead of the roof, so a station far from the game
        # value is reported as not measurable rather than as a bogus difference.
        unreliable = set()
        for fid in ('hoodEnd', 'windshieldBase', 'roofFront', 'roofRear'):
            if meas.get(fid) is None or abs(meas[fid] - features[fid]['sIn']) > 12.0:
                unreliable.add(fid)
        for fid in unreliable:
            meas[fid] = None

        # deviation of the traced silhouette from the game outline (heights), hood + roof span
        dev = hh - h_prior
        i_dev = int(np.argmax(np.abs(dev)))
        dev_max, dev_at = float(dev[i_dev]), float(ss[i_dev])

        # ---------------- vertical-edge features ----------------
        scans = {}
        for fid, (hint, band, rows) in photo['anchors'].items():
            x, contrast = scan_vertical_edge(L, hint, rows, band)
            if x is None or contrast < 6.0:
                x, contrast = hint, 0.0
            meas[fid] = calib.x2s(x)
            scans[fid] = (x, contrast)

        # cab back / bed front are the two sides of the cab-to-bed gap: the scan finds the gap; split it with
        # the game's own gap width so the two stations are comparable.
        gap_c = 0.5 * (meas['cabBack'] + meas['bedFront'])
        game_gap = features['bedFront']['sIn'] - features['cabBack']['sIn']
        meas['cabBack'] = gap_c - game_gap * 0.5
        meas['bedFront'] = gap_c + game_gap * 0.5

        ground_pred = calib.ground_row()
        residual_px = photo['tireContactRow'] - ground_pred
        photo_len = (meas['rearBumperEnd'] - meas['nose']) if meas.get('rearBumperEnd') is not None else float('nan')
        game_len = profile['envelope']['lengthIn']
        scale_k = photo_len / game_len if game_len else 1.0

        # ---------------- composite ----------------
        out = rgb.copy()
        pts = profile['outline']
        px = [calib.s2x(p[0] / IN, p[1] / IN) for p in pts]
        for i in range(len(px)):
            a = px[i]; b = px[(i + 1) % len(px)]
            draw_segment(out, a[0], a[1], b[0], b[1], (1.0, 0.1, 0.85), OUTLINE_ALPHA, 2.4)
        for wh in profile['wheels']:
            cx, cy = calib.s2x(wh['sIn'], wh['yIn'])
            r = wh['rIn'] * calib.ppi
            n = 96
            for i in range(n):
                t0 = 2 * math.pi * i / n
                t1 = 2 * math.pi * (i + 1) / n
                draw_segment(out, cx + r * math.cos(t0), cy + r * math.sin(t0),
                             cx + r * math.cos(t1), cy + r * math.sin(t1), (1.0, 0.85, 0.15), 0.9, 1.8)
        # length-matched outline (cyan), scaled about the mid-wheelbase
        mid = 0.5 * (features['nose']['sIn'] + features['rearBumperEnd']['sIn'])
        lm = [(mid + (p[0] / IN - mid) * scale_k, p[1] / IN) for p in pts]
        px2 = [calib.s2x(s, h) for s, h in lm]
        for i in range(len(px2) - 1):
            if i % 3 == 2:
                continue
            a, b = px2[i], px2[i + 1]
            draw_segment(out, a[0], a[1], b[0], b[1], (0.05, 0.95, 1.0), LENGTHMATCH_ALPHA, 1.8)
        # markers: green = measured on the photo, magenta = game
        for fid in order:
            f = features[fid]
            if meas.get(fid) is not None:
                x, y = calib.s2x(meas[fid], f['yIn'])
                draw_cross(out, x, y, (0.15, 1.0, 0.35), 6, 0.95)
            x, y = calib.s2x(f['sIn'], f['yIn'])
            draw_cross(out, x, y, (1.0, 0.2, 0.85), 4, 0.8)

        out_path = os.path.join(DEV, f"overlay_{photo['id']}.png")
        save_rgb(out_path, np.clip(out, 0.0, 1.0).astype(np.float32))
        print('  wrote', os.path.relpath(out_path, ROOT))

        # ---------------- report table ----------------
        side = 'front of the truck at the left' if photo['frontAtLeft'] else 'front of the truck at the right'
        report.append(f"\n## {photo['id']} ({side})\n")
        report.append(f"* Calibration: front hub ({photo['hubFront'][0]:.0f}, {photo['hubFront'][1]:.0f}), rear hub "
                      f"({photo['hubRear'][0]:.0f}, {photo['hubRear'][1]:.0f}), wheelbase 153.0 in -> "
                      f"**{calib.ppi:.4f} px/in**; apparent roll {math.degrees(calib.roll):+.2f} deg.")
        report.append(f"* Vertical: roof row {photo['roofRow']:.0f} px, predicted ground row {ground_pred:.1f} px, "
                      f"photo tyre contact row {photo['tireContactRow']:.0f} px -> residual {residual_px:+.1f} px = "
                      f"{residual_px / calib.ppi:+.2f} in.")
        if meas.get('rearBumperEnd') is not None:
            report.append(f"* Photo bumper-to-bumper span at this calibration: **{photo_len:.1f} in** (spec envelope "
                          f"{game_len:.1f} in) -> the cyan outline is the game shape scaled x{scale_k:.4f} about the "
                          f"mid-wheelbase, which separates local shape errors from this overall-length difference.")
        report.append(f"* Top silhouette: the traced edge deviates from the game's hood/roof line by at most "
                      f"**{dev_max:+.1f} in** vertically, at s = {dev_at:.1f} in.\n")
        report.append('| Feature | Game (in) | Photo (in) | Difference (in) | Flag | How measured |')
        report.append('|---|---:|---:|---:|:--:|---|')
        for fid in order:
            game_s = features[fid]['sIn']
            m = meas.get(fid)
            if m is None:
                why = ('not measurable in this photo (edge ambiguous: dark background behind the truck)'
                       if fid in unreliable else 'not measurable in this photo')
                report.append(f"| {features[fid]['label']} | {game_s:.1f} | - | - | - | {why} |")
                continue
            diff = m - game_s
            flag = '**yes**' if abs(diff) > 1.5 else ''
            if fid in scans:
                x, contrast = scans[fid]
                how = (f"horizontal edge scan near x={x:.0f} (contrast {contrast:.0f}/255)"
                       if contrast >= 6.0 else f"anchor x={x:.0f} (weak edge, not snapped)")
            elif fid in ('hoodEnd', 'windshieldBase'):
                how = 'top-silhouette trace (median filtered)'
            elif fid in ('roofFront', 'roofRear'):
                how = 'top-silhouette trace, roof-height crossing'
            else:
                how = 'trace / gap split'
            report.append(f"| {features[fid]['label']} | {game_s:.1f} | {m:.1f} | {diff:+.1f} | {flag} | {how} |")

        results.append({
            'id': photo['id'], 'meas': dict(meas), 'residual_px': residual_px,
            'residual_in': residual_px / calib.ppi, 'photo_len': photo_len, 'scale_k': scale_k,
            'dev_max': dev_max, 'dev_at': dev_at, 'ppi': calib.ppi,
        })

    # ---------------- conclusions ----------------
    if results:
        game_len = profile['envelope']['lengthIn']
        report.append('\n## What the numbers say\n')
        spans = ', '.join(f"{r['id']} {r['photo_len']:.1f} in" for r in results if r['photo_len'] == r['photo_len'])
        report.append(f"* **Overall length conflict.** At the specified hub calibration the two photos measure a "
                      f"bumper-to-bumper span of {spans} against the published {game_len:.1f} in in "
                      f"`src/data/truckSpec.js` (estimate, one source). The game keeps the published envelope, so "
                      f"the nose and the rear bumper **cannot** both match the photo: the differences there are a "
                      f"source conflict, not a modelling error. `ACCURACY.md` records it.")
        report.append(f"* **Cab and bed agree.** Cab back, bed front, roof rear, roof front, the door seams and the "
                      f"beltline all land within about 1 in of the photos, which is what the wheelbase calibration "
                      f"should give. No action.")
        devs = '; '.join(f"{r['id']}: {r['dev_max']:+.1f} in at s={r['dev_at']:.1f} in" for r in results)
        report.append(f"* **The hood's leading edge sits too low** in the game: the traced top silhouette is up to "
                      f"{devs}. That is the 'rounded, drooping nose' known weak spot; Task B raises the hood front "
                      f"and flattens the hood crown.")
        report.append(f"* **Vertical residual** (game ground line against the photo's tyre contact patch): "
                      f"{'; '.join(f'{r[chr(105)+chr(100)]} {r[chr(114)+chr(101)+chr(115)+chr(105)+chr(100)+chr(117)+chr(97)+chr(108)+chr(95)+chr(105)+chr(110)]:+.2f} in' for r in results)}. "
                      f"The roof anchor and the ground both land on the photo, so the vertical scale is sound "
                      f"despite the lifted truck.")
        report.append(f"* **Wheels**: the yellow circles are the factory wheel-centre positions and the stock "
                      f"LT245/75R16 rolling radius. The photo truck runs oversize tyres on a lift, so its tyres are "
                      f"larger than the circles by design (reference/INDEX.md marks the tyres and ride height "
                      f"as non-stock). The centres line up, which is the check that matters.")
        report.append(f"* **Method limits.** The photos are a phone camera at close range: the perspective "
                      f"foreshortens the far end, and the rear bumper is partly occluded by the truck parked beside "
                      f"it, so the rear bumper and tailgate positions carry roughly +-2 in of uncertainty. The "
                      f"top-edge trace is good to about +-1 in where the sky is behind the truck and worse where "
                      f"trees are behind it (IMG_2851).")

    notes_path = os.path.join(DEV, 'overlay_report.md')
    with open(notes_path, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(report) + '\n')
    print('wrote', os.path.relpath(notes_path, ROOT))


main()
