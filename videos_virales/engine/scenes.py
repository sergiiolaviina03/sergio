"""Escenas animadas. Cada escena: fn(cr, t, p, prm, cast) con t = segundos locales, p = progreso 0..1."""
import math, random
import cairo
from draw import *

R = random.Random


def ease(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def back_out(x):
    x = max(0.0, min(1.0, x)); c1 = 1.70158; c3 = c1 + 1
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


# ------------------------------------------------------------ fondos
def bg_fill(cr, top, bot):
    cr.set_source(vgrad(cr, 0, 0, 0, H, [(0, top), (1, bot)])); cr.paint()


def night_sky(cr, t, seed=3, moon=(560, 230), top='#060914', bot='#1b2540'):
    bg_fill(cr, top, bot)
    rnd = R(seed)
    for i in range(70):
        x, y = rnd.random() * W, rnd.random() * H * 0.55
        a = 0.3 + 0.7 * abs(math.sin(t * (0.5 + rnd.random()) + i))
        setc(cr, '#ffffff', a * 0.7); cr.arc(x, y, rnd.random() * 1.6 + 0.4, 0, TAU); cr.fill()
    if moon:
        glow(cr, moon[0], moon[1], 190, '#c9d6ff', 0.25)
        setc(cr, '#e9eefc'); cr.arc(moon[0], moon[1], 52, 0, TAU); cr.fill()
        setc(cr, '#c7cfe6'); cr.arc(moon[0] - 15, moon[1] - 10, 10, 0, TAU); cr.fill(); cr.arc(moon[0] + 18, moon[1] + 14, 7, 0, TAU); cr.fill()


def fog(cr, t, y0=850, col='#9fb0d0', a=0.10, n=4):
    for i in range(n):
        x = ((t * (12 + i * 5) + i * 300) % (W + 600)) - 300
        cr.set_source(rgrad(cr, x, y0 + i * 60, 0, 380, [(0, hexc(col, a)), (1, hexc(col, 0))]))
        cr.save(); cr.translate(x, y0 + i * 60); cr.scale(1, 0.25); cr.arc(0, 0, 380, 0, TAU); cr.restore(); cr.fill()


def room_bg(cr, t, prm):
    wall = prm.get('wall', '#2c3a55'); floor = prm.get('floor', '#1d1a1f')
    cr.set_source(vgrad(cr, 0, 0, 0, H, [(0, shade(wall, 0.6)), (0.6, wall), (1, shade(wall, 0.7))])); cr.paint()
    # zócalo
    setc(cr, shade(wall, 0.75)); cr.rectangle(0, 900, W, 40); cr.fill()
    setc(cr, floor); cr.rectangle(0, 940, W, H - 940); cr.fill()
    kind = prm.get('bg', 'room')
    if kind == 'room':
        # ventana
        wx, wy = prm.get('winx', 70), 250
        setc(cr, '#151a24'); rrect(cr, wx - 12, wy - 12, 224, 304, 8); cr.fill()
        cr.set_source(vgrad(cr, 0, wy, 0, wy + 280, [(0, '#0b1430'), (1, '#24365e')])); cr.rectangle(wx, wy, 200, 280); cr.fill()
        setc(cr, '#e9eefc'); cr.arc(wx + 140, wy + 70, 22, 0, TAU); cr.fill()
        setc(cr, '#151a24'); cr.rectangle(wx + 96, wy, 8, 280); cr.fill(); cr.rectangle(wx, wy + 136, 200, 8); cr.fill()
        # cuadro
        setc(cr, '#3b2a1c'); cr.rectangle(470, 260, 170, 130); cr.fill()
        setc(cr, '#5c6b5a'); cr.rectangle(482, 272, 146, 106); cr.fill()
        setc(cr, '#3f4d3c'); poly(cr, [(482, 378), (540, 310), (580, 350), (610, 320), (628, 378)]); cr.fill()
    elif kind == 'bar':
        setc(cr, '#3a2516'); cr.rectangle(0, 230, W, 22); cr.fill(); cr.rectangle(0, 420, W, 22); cr.fill()
        rnd = R(5)
        for row, yb in ((0, 230), (1, 420)):
            x = 20
            while x < W - 30:
                h = rnd.randint(70, 120); w = rnd.randint(26, 40)
                setc(cr, rnd.choice(['#2f5a3c', '#6b3a1e', '#3b4f7a', '#7a6a2e', '#5a2a3a']), 0.9)
                rrect(cr, x, yb - h, w, h, 6); cr.fill(); cr.rectangle(x + w / 2 - 5, yb - h - 25, 10, 28); cr.fill()
                x += w + rnd.randint(8, 22)
        glow(cr, 360, 120, 420, '#ffb347', 0.18)
    elif kind == 'office':
        setc(cr, '#202833'); rrect(cr, 60, 220, 600, 300, 6); cr.fill()
        setc(cr, '#2f3d52')
        for i in range(14):
            cr.rectangle(70, 230 + i * 21, 580, 12); cr.fill()
        setc(cr, '#c8d3e6', 0.08); poly(cr, [(60, 220), (660, 220), (720, 1280), (0, 1280)]); cr.fill()
    elif kind == 'police':
        setc(cr, '#1e2b3f'); cr.rectangle(0, 90, W, 100); cr.fill()
        text(cr, 'COMISARÍA', 360, 158, 50, '#c9d6ea', font='Inter', a=0.85)
        setc(cr, '#6b4f2e'); rrect(cr, 450, 330, 220, 280, 4); cr.fill()
        rnd = R(9)
        for i in range(7):
            setc(cr, rnd.choice(['#f2efe6', '#f7e27a', '#e8e8e8'])); cr.save(); cr.translate(470 + (i % 3) * 65, 350 + (i // 3) * 85)
            cr.rotate(rnd.uniform(-0.1, 0.1)); cr.rectangle(0, 0, 55, 70); cr.fill(); cr.restore()
        glow(cr, 360, 100, 500, '#d8e6ff', 0.12)
    elif kind == 'cell':
        setc(cr, '#3a3f47'); cr.paint()
        setc(cr, '#30343b')
        for r_ in range(30):
            for c_ in range(6):
                off = 60 if r_ % 2 else 0
                rrect(cr, c_ * 130 - off + 4, r_ * 44 + 4, 122, 36, 3); cr.fill()
        setc(cr, '#1d1f24'); cr.rectangle(0, 980, W, 300); cr.fill()
        setc(cr, '#9fb5d8', 0.12); poly(cr, [(520, 120), (640, 120), (720, 900), (380, 900)]); cr.fill()
        setc(cr, '#14161a'); cr.rectangle(520, 120, 120, 90); cr.fill()
        setc(cr, '#9fb5d8', 0.5); cr.rectangle(528, 128, 104, 74); cr.fill()
        setc(cr, '#14161a')
        for i in range(4):
            cr.rectangle(540 + i * 26, 128, 6, 74); cr.fill()
    elif kind == 'street':
        night_sky(cr, t, moon=(560, 210))
        rnd = R(11)
        x = -20
        while x < W:
            w = rnd.randint(110, 190); h = rnd.randint(380, 620)
            setc(cr, rnd.choice(['#141b2b', '#182136', '#111726'])); cr.rectangle(x, 940 - h, w, h); cr.fill()
            for wy in range(940 - h + 30, 900, 70):
                for wx in range(x + 18, x + w - 30, 42):
                    if rnd.random() < 0.28:
                        setc(cr, '#ffcf6b', 0.8); cr.rectangle(wx, wy, 22, 32); cr.fill()
            x += w + 6
        setc(cr, '#0e1118'); cr.rectangle(0, 940, W, 340); cr.fill()
        glow(cr, 620, 600, 380, '#ffc46b', 0.25)
    elif kind == 'field':
        night_sky(cr, t)
        setc(cr, '#141c2a'); cr.move_to(0, 760); cr.curve_to(200, 650, 400, 720, 720, 640); cr.line_to(720, H); cr.line_to(0, H); cr.fill()
        setc(cr, '#0d131d'); cr.move_to(0, 860); cr.curve_to(250, 800, 480, 880, 720, 820); cr.line_to(720, H); cr.line_to(0, H); cr.fill()
        fog(cr, t, 780)
    elif kind == 'court':
        setc(cr, '#3b2618'); cr.paint()
        setc(cr, '#4a3020')
        for i in range(8):
            cr.rectangle(i * 95 + 8, 120, 78, 760); cr.fill()
        setc(cr, '#c9a14a'); text(cr, '⚖', 360, 260, 120, '#c9a14a', a=0.5)
    elif kind == 'shop':
        setc(cr, '#f2e6d6', 0.12); cr.rectangle(0, 120, W, 60); cr.fill()
        text(cr, 'MODA AKI', 360, 165, 46, '#ffe9c7', a=0.9)
        rnd = R(13)
        for rod_y in (520,):
            setc(cr, '#9aa3ad'); cr.rectangle(20, rod_y, W - 40, 8); cr.fill()
            x = 40
            while x < W - 70:
                col = rnd.choice(['#c0262d', '#2b6cb0', '#e8a33a', '#3a7a5a', '#e8e2d0', '#7a5aa0', '#1a1a1a'])
                setc(cr, '#cfd4da'); cr.set_line_width(3); cr.move_to(x + 25, rod_y + 4); cr.line_to(x + 25, rod_y + 22); cr.stroke()
                setc(cr, col); poly(cr, [(x, rod_y + 22), (x + 50, rod_y + 22), (x + 56, rod_y + 50), (x + 46, rod_y + 52), (x + 46, rod_y + 170), (x + 4, rod_y + 170), (x + 4, rod_y + 52), (x - 6, rod_y + 50)]); cr.fill()
                x += 58
        glow(cr, 360, 100, 500, '#ffd59a', 0.18)
    elif kind == 'plain':
        pass
    lamp = prm.get('lamp')
    if lamp:
        glow(cr, lamp[0], lamp[1], 520, '#ffb85c', 0.22)


def vignette(cr, k=0.75):
    cr.set_source(rgrad(cr, W / 2, H * 0.48, H * 0.25, H * 0.75, [(0, (0, 0, 0, 0)), (1, (0, 0, 0, k))]))
    cr.paint()


# ------------------------------------------------------------ escenas
def sc_char(cr, t, p, prm, cast):
    room_bg(cr, t, prm)
    who = cast[prm['who']]
    s = prm.get('size', 165)
    bob = math.sin(t * 2.2) * 3
    look = prm.get('look', (math.sin(t * 0.8) * 0.6, 0.0))
    x = prm.get('x', 360)
    draw_char(cr, x, prm.get('y', 700) + bob, s, who, t, prm.get('expr', 'neutral'), look,
              talk=prm.get('talk', False), seed=hash(prm['who']) % 50, light=prm.get('light'))
    if prm.get('bg') == 'cell' or prm.get('bars'):
        bars(cr)


def bars(cr, col='#1a1c20'):
    for i in range(8):
        x = 30 + i * 95
        cr.set_source(vgrad(cr, x, 0, x + 26, 0, [(0, '#0d0e10'), (0.5, '#5a606b'), (1, '#0d0e10')]))
        cr.rectangle(x, 0, 26, H); cr.fill()
    setc(cr, '#2a2d33'); cr.rectangle(0, 300, W, 26); cr.fill(); cr.rectangle(0, 1050, W, 26); cr.fill()


def sc_duo(cr, t, p, prm, cast):
    room_bg(cr, t, prm)
    names = prm['who']
    n = len(names)
    s = prm.get('size', {1: 160, 2: 112, 3: 88, 4: 72, 5: 62}[n])
    xs = [W * (i + 1) / (n + 1) for i in range(n)]
    exprs = prm.get('expr', ['neutral'] * n)
    if isinstance(exprs, str):
        exprs = [exprs] * n
    for i, nm in enumerate(names):
        y = prm.get('y', 760) + math.sin(t * 2 + i) * 3 + (i % 2) * prm.get('stagger', 0)
        lk = prm.get('look', None)
        if lk is None:
            lk = (0.7 if xs[i] < W / 2 else -0.7, 0)
        draw_char(cr, xs[i], y, s, cast[nm], t, exprs[i], lk, seed=i * 7 + 3)
    if prm.get('bg') == 'cell' or prm.get('bars'):
        bars(cr)


def sc_eyes(cr, t, p, prm, cast):
    kind = prm.get('kind', 'human')
    if kind == 'wolf':
        setc(cr, '#020203'); cr.paint()
        fog(cr, t, 600, '#304060', 0.08)
        fl = 0.8 + 0.2 * math.sin(t * 5)
        for side in (-1, 1):
            ex, ey = 360 + side * 150, 640
            glow(cr, ex, ey, 230, '#ffcc33', 0.25 * fl)
            setc(cr, '#ffd23f', fl); ellipse(cr, ex, ey, 95, 55); cr.fill()
            setc(cr, '#000000'); ellipse(cr, ex, ey, 14 + 6 * math.sin(t), 50); cr.fill()
        return
    skin = cast[prm['who']]['skin'] if prm.get('who') else '#c98b5f'
    setc(cr, shade(skin, 0.55)); cr.paint()
    cr.set_source(vgrad(cr, 0, 470, 0, 830, [(0, (0, 0, 0, 0.9)), (0.25, (0, 0, 0, 0)), (0.75, (0, 0, 0, 0)), (1, (0, 0, 0, 0.9))]))
    cr.paint()
    setc(cr, shade(skin, 0.8)); cr.rectangle(0, 520, W, 260); cr.fill()
    bl = blink_amount(t, 4)
    lx = math.sin(t * 0.6) * 0.8 if not prm.get('stare') else 0
    shrink = prm.get('shrink', False)
    for side in (-1, 1):
        ex, ey = 360 + side * 175, 650
        setc(cr, '#f4f4f4'); ellipse(cr, ex, ey, 120, 92); cr.fill()
        pr = 46 - (24 * ease(p) if shrink else 0)
        setc(cr, '#2b1a10'); cr.arc(ex + lx * 30, ey, pr + 12, 0, TAU); cr.fill()
        setc(cr, '#050505'); cr.arc(ex + lx * 30, ey, pr, 0, TAU); cr.fill()
        setc(cr, '#ffffff'); cr.arc(ex + lx * 30 + 14, ey - 16, 11, 0, TAU); cr.fill()
        lid = max(bl, prm.get('lid', 0.0))
        if lid:
            cr.save(); ellipse(cr, ex, ey, 121, 93); cr.clip()
            setc(cr, shade(skin, 0.75)); cr.rectangle(ex - 130, ey - 95, 260, 186 * lid); cr.fill(); cr.restore()
        setc(cr, '#0d0d0d'); cr.set_line_width(9); ellipse(cr, ex, ey, 120, 92); cr.stroke()
        setc(cr, shade(skin, 0.4)); cr.set_line_width(22); cr.set_line_cap(cairo.LINE_CAP_ROUND)
        k = prm.get('brow', 1)
        cr.move_to(ex - side * 110, ey - 140 + k * 30 * 0); cr.line_to(ex + side * 110, ey - 140 - (0 if k == 0 else -k * 30)); cr.stroke()


def spain_poly():
    sp = [(-9.3, 42.9), (-8.4, 43.4), (-7.0, 43.55), (-5.7, 43.56), (-3.8, 43.47), (-2.9, 43.35), (-1.8, 43.37),
          (-1.4, 43.1), (0.0, 42.7), (1.5, 42.5), (3.15, 42.45), (3.3, 42.3), (2.17, 41.38), (1.25, 41.1),
          (0.85, 40.7), (-0.03, 39.98), (-0.35, 39.45), (0.23, 38.73), (-0.48, 38.34), (-0.7, 37.63), (-1.6, 37.4),
          (-2.2, 36.72), (-2.45, 36.83), (-4.42, 36.72), (-5.35, 36.15), (-5.6, 36.01), (-6.29, 36.53), (-6.9, 37.15), (-7.4, 37.2),
          (-7.5, 38.0), (-7.1, 38.8), (-7.0, 39.6), (-6.9, 40.2), (-6.8, 41.0), (-6.2, 41.6), (-6.5, 41.9),
          (-7.2, 41.9), (-8.2, 41.85), (-8.87, 41.87), (-8.7, 42.24), (-9.0, 42.5)]
    pt = [(-8.87, 41.87), (-8.67, 41.15), (-9.0, 40.2), (-9.5, 38.78), (-9.2, 38.7), (-8.9, 38.5), (-8.87, 37.95),
          (-8.99, 37.02), (-7.93, 37.0), (-7.4, 37.2), (-7.5, 38.0), (-7.1, 38.8), (-7.0, 39.6), (-6.9, 40.2),
          (-6.8, 41.0), (-6.2, 41.6), (-6.5, 41.9), (-7.2, 41.9), (-8.2, 41.85)]
    isl = [(2.95, 39.6, 0.55, 0.3), (4.1, 39.97, 0.25, 0.12), (1.42, 38.98, 0.2, 0.15)]
    return sp, pt, isl


def proj(lon, lat):
    k = 95
    return 360 + (lon + 3.7) * k * 0.77, 640 - (lat - 40.0) * k


def sc_map(cr, t, p, prm, cast):
    bg_fill(cr, '#07101f', '#0d1d36')
    pins = prm.get('pins') or [(prm.get('label', ''), prm['lon'], prm['lat'])]
    fx, fy = proj(*pins[0][1:3]) if len(pins) == 1 else (360, 640)
    z = 1.0 + (prm.get('zoom', 0.9)) * ease(p * 1.3) if len(pins) == 1 else 0.7
    cr.save()
    cr.translate(360, 640); cr.scale(z, z); cr.translate(-(360 + (fx - 360) * ease(p * 1.3)), -(640 + (fy - 640) * ease(p * 1.3)))
    setc(cr, '#1c3254', 0.5); cr.set_line_width(1)
    for i in range(-10, 30):
        cr.move_to(i * 60, -400); cr.line_to(i * 60, 1800); cr.stroke()
        cr.move_to(-400, i * 60); cr.line_to(1200, i * 60); cr.stroke()
    sp, pt, isl = spain_poly()
    setc(cr, '#000000', 0.4); poly(cr, [(x + 8, y + 10) for x, y in [proj(*a) for a in sp]]); cr.fill()
    setc(cr, '#2a3a52'); poly(cr, [proj(*a) for a in sp]); cr.fill()
    setc(cr, '#1a2638'); poly(cr, [proj(*a) for a in pt]); cr.fill()
    setc(cr, '#4d6a94'); cr.set_line_width(2.5); poly(cr, [proj(*a) for a in sp]); cr.stroke()
    for lo, la, rx, ry in isl:
        x, y = proj(lo, la); setc(cr, '#2a3a52'); ellipse(cr, x, y, rx * 73, ry * 95); cr.fill()
    cr.restore()
    for i, (lab, lo, la) in enumerate(pins):
        appear = 0.15 + i * (0.7 / max(1, len(pins)))
        if len(pins) > 1 and p < appear:
            continue
        x, y = proj(lo, la)
        x = 360 + (x - (360 + (fx - 360) * ease(p * 1.3))) * z
        y = 640 + (y - (640 + (fy - 640) * ease(p * 1.3))) * z
        k = back_out((p - appear) * 6) if len(pins) > 1 else back_out(p * 4)
        pul = (t * 1.2) % 1
        setc(cr, '#ff3b3b', (1 - pul) * 0.7); cr.set_line_width(3); cr.arc(x, y, 10 + pul * 50, 0, TAU); cr.stroke()
        glow(cr, x, y, 60, '#ff3b3b', 0.5)
        setc(cr, '#ff3b3b'); cr.arc(x, y, 11 * k, 0, TAU); cr.fill()
        setc(cr, '#ffffff'); cr.arc(x, y, 4 * k, 0, TAU); cr.fill()
        if lab and (len(pins) == 1 or len(pins) <= 4):
            fs = 30 if len(pins) == 1 else 22
            tw = text_w(cr, lab.upper(), fs) + 34
            bx = min(max(x - tw / 2, 20), W - 20 - tw)
            by = y + 28
            setc(cr, '#0a0f18', 0.85); rrect(cr, bx, by, tw, fs + 22, 10); cr.fill()
            setc(cr, '#ff3b3b'); cr.set_line_width(2); rrect(cr, bx, by, tw, fs + 22, 10); cr.stroke()
            text(cr, lab.upper(), bx + tw / 2, by + fs + 6, fs, '#ffffff')
    if prm.get('year'):
        text(cr, prm['year'], 360, 1120, 120, '#ffffff', a=0.12 + 0.1 * ease(p * 3))


def sc_news(cr, t, p, prm, cast):
    bg_fill(cr, '#141012', '#251d18')
    glow(cr, 360, 640, 600, '#ffcf8a', 0.15)
    k = ease(t / 0.55)
    sc = 1.9 - 0.9 * k
    rot = (1 - k) * 4.0 + 0.04
    cr.save(); cr.translate(360, 820); cr.rotate(-0.05 + (1 - k) * 2.5); cr.scale(sc * 0.86, sc * 0.86)
    pw, ph = 600, 820
    setc(cr, '#000000', 0.5); cr.rectangle(-pw / 2 + 14, -ph / 2 + 18, pw, ph); cr.fill()
    setc(cr, '#ece5d3'); cr.rectangle(-pw / 2, -ph / 2, pw, ph); cr.fill()
    text(cr, prm.get('paper', 'LA CRÓNICA NEGRA'), 0, -ph / 2 + 72, 50, '#151515', font='DejaVu Serif')
    setc(cr, '#151515'); cr.rectangle(-pw / 2 + 25, -ph / 2 + 90, pw - 50, 3); cr.fill()
    text(cr, prm.get('date', ''), 0, -ph / 2 + 118, 18, '#333333', bold=False, font='DejaVu Serif')
    cr.rectangle(-pw / 2 + 25, -ph / 2 + 130, pw - 50, 2); cr.fill()
    lines = wrap(cr, prm['headline'].upper(), 54, pw - 60, font='DejaVu Serif')
    yy = -ph / 2 + 195
    for ln in lines[:4]:
        text(cr, ln, 0, yy, 54, '#0d0d0d', font='DejaVu Serif'); yy += 60
    # foto
    setc(cr, '#8b8679'); cr.rectangle(-pw / 2 + 30, yy - 10, 300, 300); cr.fill()
    cr.save(); cr.rectangle(-pw / 2 + 30, yy - 10, 300, 300); cr.clip()
    if prm.get('who'):
        draw_char(cr, -pw / 2 + 180, yy + 120, 80, cast[prm['who']], 0, prm.get('expr', 'neutral'), (0, 0), seed=2)
        cr.set_source_rgba(0.55, 0.52, 0.45, 0.35); cr.rectangle(-pw / 2 + 30, yy - 10, 300, 300); cr.fill()
    else:
        silhouette(cr, -pw / 2 + 180, yy + 110, 70, '#3a3833')
    cr.restore()
    setc(cr, '#6b675c')
    for i in range(14):
        cr.rectangle(-pw / 2 + 350, yy + i * 21, 220 - (i % 4) * 14, 8); cr.fill()
    for i in range(6):
        cr.rectangle(-pw / 2 + 30, yy + 315 + i * 21, pw - 60 - (i % 3) * 30, 8); cr.fill()
    cr.restore()


def sc_stamp(cr, t, p, prm, cast):
    bg_fill(cr, prm.get('top', '#140306'), prm.get('bot', '#050102'))
    glow(cr, 360, 640, 650, prm.get('glow', '#b3001b'), 0.35 + 0.08 * math.sin(t * 9))
    k = back_out(t / 0.35)
    sh = (1 - min(1, t / 0.5)) * 14
    cr.save(); cr.translate(360 + math.sin(t * 60) * sh, 640 + math.cos(t * 53) * sh); cr.scale(k, k)
    lines = prm['text'].split('\n')
    fs = prm.get('size', 112)
    tot = len(lines) * fs * 1.05
    y = -tot / 2 + fs * 0.85
    for ln in lines:
        lw = text_w(cr, ln, fs)
        f2 = fs * min(1, 640 / max(lw, 1))
        setc(cr, '#000000', 0.6); text(cr, ln, 5, y + 6, f2, '#000000', a=0.6)
        text(cr, ln, 0, y, f2, prm.get('col', '#ffffff'))
        y += fs * 1.05
    cr.restore()
    if prm.get('sub'):
        text(cr, prm['sub'], 360, 640 + tot / 2 + 70, 34, prm.get('subcol', '#ff4d5e'), a=ease((t - 0.4) / 0.4))


def sc_evidence(cr, t, p, prm, cast):
    setc(cr, '#6b4a2b'); cr.paint()
    rnd = R(21)
    for i in range(900):
        setc(cr, rnd.choice(['#5a3d22', '#7a5733', '#4d341e']), 0.6)
        cr.arc(rnd.random() * W, rnd.random() * H, rnd.random() * 3 + 1, 0, TAU); cr.fill()
    items = prm.get('items', ['?', '?', '?', '?'])
    pos = [(180, 640), (540, 610), (170, 1090), (550, 1110), (360, 860)]
    for i, lab in enumerate(items[:5]):
        x, y = pos[i]
        cr.save(); cr.translate(x, y); cr.rotate(rnd.uniform(-0.12, 0.12))
        setc(cr, '#000000', 0.35); cr.rectangle(-95, -105, 200, 240); cr.fill()
        setc(cr, '#f3f0e6'); cr.rectangle(-100, -115, 200, 240); cr.fill()
        setc(cr, '#2a2f38'); cr.rectangle(-86, -100, 172, 170); cr.fill()
        if isinstance(lab, dict) and lab.get('who'):
            cr.save(); cr.rectangle(-86, -100, 172, 170); cr.clip()
            draw_char(cr, 0, -20, 48, cast[lab['who']], t, 'neutral', (0, 0), seed=i)
            cr.restore(); lab = lab.get('label', '')
        elif lab == '?':
            text(cr, '?', 0, 25, 120, '#ff4d4d')
        else:
            silhouette(cr, 0, -30, 40, '#11141a')
        text(cr, str(lab), 0, 108, 22, '#222222', font='DejaVu Sans')
        cr.restore()
    # hilos
    setc(cr, '#d11f1f'); cr.set_line_width(4)
    links = [(0, 4), (1, 4), (2, 4), (3, 4), (0, 1)][:len(items)]
    for a, b in links:
        if a < len(items) and b < len(items):
            ax, ay = pos[a]; bx, by = pos[b]
            k = ease(p * 2.5)
            cr.move_to(ax, ay - 100); cr.line_to(ax + (bx - ax) * k, ay - 100 + (by - 100 - ay + 100) * k); cr.stroke()
    for i in range(min(5, len(items))):
        x, y = pos[i]; setc(cr, '#e02b2b'); cr.arc(x, y - 100, 10, 0, TAU); cr.fill()
    if prm.get('stamp'):
        k = back_out((p - 0.45) * 5)
        if p > 0.45:
            cr.save(); cr.translate(360, 860); cr.rotate(-0.22); cr.scale(k, k)
            setc(cr, '#d1001f', 0.9); cr.set_line_width(10); rrect(cr, -300, -70, 600, 140, 14); cr.stroke()
            text(cr, prm['stamp'], 0, 28, 72, '#d1001f', a=0.92)
            cr.restore()


def sc_object(cr, t, p, prm, cast):
    bg_fill(cr, '#0b0c12', '#15121a')
    glow(cr, 360, 650, 520, prm.get('glow', '#ffd59a'), 0.18)
    kind = prm['kind']
    fl = math.sin(t * 1.3) * 10
    sc = 0.9 + 0.1 * ease(t / 0.6)
    cr.save(); cr.translate(360, 770 + fl); cr.scale(sc * 0.85, sc * 0.85); cr.rotate(math.sin(t * 0.7) * 0.04)
    if kind == 'card':
        setc(cr, '#000000', 0.5); rrect(cr, -150 + 12, -230 + 16, 300, 460, 22); cr.fill()
        setc(cr, '#f6f1e3'); rrect(cr, -150, -230, 300, 460, 22); cr.fill()
        setc(cr, '#c0262d'); cr.set_line_width(6); rrect(cr, -132, -212, 264, 424, 14); cr.stroke()
        # copa
        setc(cr, '#d9a520'); cr.move_to(-80, -110); cr.curve_to(-80, 20, 80, 20, 80, -110); cr.close_path(); cr.fill()
        setc(cr, '#c0262d'); ellipse(cr, 0, -110, 80, 18); cr.fill()
        setc(cr, '#d9a520'); cr.rectangle(-12, 0, 24, 90); cr.fill(); ellipse(cr, 0, 100, 70, 20); cr.fill()
        setc(cr, '#2b6cb0'); cr.arc(0, -45, 16, 0, TAU); cr.fill()
        text(cr, prm.get('label', '1'), -105, -165, 40, '#c0262d', font='DejaVu Serif')
        text(cr, prm.get('label', '1'), 105, 195, 40, '#c0262d', font='DejaVu Serif')
    elif kind == 'jar':
        setc(cr, '#e8d9a0', 0.9); rrect(cr, -120, -120, 240, 300, 40); cr.fill()
        setc(cr, '#f6f3ea', 0.35); rrect(cr, -140, -170, 280, 360, 50); cr.fill()
        setc(cr, '#5a4632'); rrect(cr, -110, -215, 220, 60, 10); cr.fill()
        setc(cr, '#efe7d2'); cr.rectangle(-100, -10, 200, 90); cr.fill()
        text(cr, prm.get('label', 'UNTO'), 0, 52, 48, '#3b2a1a', font='DejaVu Serif')
        setc(cr, '#ffffff', 0.4); rrect(cr, -110, -150, 26, 280, 13); cr.fill()
    elif kind == 'phone':
        setc(cr, '#000000', 0.5); rrect(cr, -170 + 12, -330 + 16, 340, 660, 44); cr.fill()
        setc(cr, '#101114'); rrect(cr, -170, -330, 340, 660, 44); cr.fill()
        cr.set_source(vgrad(cr, 0, -310, 0, 310, [(0, '#2b2f5a'), (1, '#120f22')])); rrect(cr, -155, -315, 310, 630, 34); cr.fill()
        text(cr, prm.get('date', 'lunes'), 0, -230, 22, '#e8e8f0', bold=False)
        text(cr, prm.get('time', '3:33'), 0, -150, 92, '#ffffff')
        if p > 0.15:
            k = back_out((p - 0.15) * 5)
            cr.save(); cr.translate(0, -40); cr.scale(k, k)
            setc(cr, '#f2f2f5', 0.95); rrect(cr, -140, -50, 280, 150, 20); cr.fill()
            text(cr, prm.get('from', 'Desconocido'), -120, -15, 22, '#111111', align='left')
            for i, ln in enumerate(wrap(cr, prm.get('msg', ''), 22, 240, bold=False)[:3]):
                text(cr, ln, -120, 22 + i * 28, 22, '#333333', bold=False, align='left')
            cr.restore()
    elif kind == 'clock':
        hh, mm = prm.get('time', (3, 33))
        setc(cr, '#000000', 0.5); cr.arc(10, 14, 230, 0, TAU); cr.fill()
        setc(cr, '#2a2420'); cr.arc(0, 0, 230, 0, TAU); cr.fill()
        setc(cr, '#efe9dc'); cr.arc(0, 0, 205, 0, TAU); cr.fill()
        setc(cr, '#222222')
        for i in range(12):
            a = i / 12 * TAU
            cr.set_line_width(8 if i % 3 == 0 else 4)
            cr.move_to(math.sin(a) * 170, -math.cos(a) * 170); cr.line_to(math.sin(a) * 192, -math.cos(a) * 192); cr.stroke()
        sec = t * 6
        for ang, ln, wd, col in (((hh % 12 + mm / 60) / 12 * TAU, 110, 14, '#151515'), (mm / 60 * TAU, 160, 9, '#151515'),
                                 (sec / 60 * TAU * 10, 175, 3, '#c0262d')):
            setc(cr, col); cr.set_line_width(wd); cr.set_line_cap(cairo.LINE_CAP_ROUND)
            cr.move_to(0, 0); cr.line_to(math.sin(ang) * ln, -math.cos(ang) * ln); cr.stroke()
        setc(cr, '#151515'); cr.arc(0, 0, 14, 0, TAU); cr.fill()
    elif kind == 'dna':
        for i in range(26):
            y = -330 + i * 26
            a = t * 2 + i * 0.45
            x1, x2 = math.sin(a) * 130, -math.sin(a) * 130
            dep = math.cos(a)
            setc(cr, ['#4fd1c5', '#f6ad55', '#fc8181', '#90cdf4'][i % 4], 0.7); cr.set_line_width(6)
            cr.move_to(x1, y); cr.line_to(x2, y); cr.stroke()
            setc(cr, '#e2e8f0', 0.6 + 0.4 * dep); cr.arc(x1, y, 13, 0, TAU); cr.fill()
            setc(cr, '#e2e8f0', 0.6 - 0.4 * dep); cr.arc(x2, y, 13, 0, TAU); cr.fill()
    elif kind == 'cigarette':
        setc(cr, '#2d2a26'); rrect(cr, -320, 60, 640, 200, 20); cr.fill()
        cr.save(); cr.rotate(-0.2)
        setc(cr, '#d9884a'); rrect(cr, -150, -28, 110, 56, 10); cr.fill()
        setc(cr, '#efeae0'); rrect(cr, -45, -28, 120, 56, 6); cr.fill()
        setc(cr, '#3a3a3a'); ellipse(cr, 78, 0, 10, 28); cr.fill()
        cr.restore()
        setc(cr, '#f2c400'); poly(cr, [(160, 120), (240, 120), (260, -20), (140, -20)]); cr.fill()
        text(cr, prm.get('label', '1'), 200, 75, 70, '#111111')
    elif kind == 'drink':
        setc(cr, '#f2efe6'); poly(cr, [(-100, -200), (100, -200), (100, 230), (-100, 230)]); cr.fill()
        setc(cr, '#e9e2d0'); poly(cr, [(-100, -200), (0, -280), (100, -200)]); cr.fill()
        setc(cr, '#f39c12'); cr.rectangle(-100, -60, 200, 150); cr.fill()
        text(cr, prm.get('label', 'ZUMO'), 0, 40, 46, '#ffffff')
        setc(cr, '#ffffff'); cr.rectangle(-70, -330, 14, 140); cr.fill()
        if p > 0.4:
            k = back_out((p - 0.4) * 4)
            cr.save(); cr.translate(150, -180); cr.scale(k, k)
            setc(cr, '#d1001f'); cr.arc(0, 0, 70, 0, TAU); cr.fill(); text(cr, '!', 0, 32, 90, '#ffffff'); cr.restore()
    elif kind == 'letter':
        setc(cr, '#000000', 0.5); cr.rectangle(-230 + 12, -300 + 16, 460, 600); cr.fill()
        setc(cr, '#efe8d6'); cr.rectangle(-230, -300, 460, 600); cr.fill()
        setc(cr, '#c9c0aa')
        for i in range(14):
            cr.rectangle(-200, -230 + i * 36, 400, 2); cr.fill()
        lines = wrap(cr, prm.get('msg', ''), 34, 380, font='DejaVu Serif')
        for i, ln in enumerate(lines[:7]):
            text(cr, ln, -195, -205 + i * 50, 34, '#8a1010', font='DejaVu Serif', align='left', slant=True)
    elif kind == 'gavel':
        setc(cr, '#3b2616'); rrect(cr, -260, 120, 520, 70, 10); cr.fill()
        hit = (t * 1.1) % 1
        ang = -0.9 + 0.9 * ease(hit / 0.25) if hit < 0.25 else -0.9 * ease((hit - 0.25) / 0.75) * 0
        cr.save(); cr.translate(160, 110); cr.rotate(ang if hit < 0.25 else 0)
        setc(cr, '#6b3f1f'); rrect(cr, -300, -14, 300, 28, 12); cr.fill()
        setc(cr, '#7a4a26'); rrect(cr, -380, -60, 120, 120, 16); cr.fill()
        setc(cr, '#c9a14a'); cr.rectangle(-380, -20, 120, 10); cr.fill(); cr.rectangle(-380, 10, 120, 10); cr.fill()
        cr.restore()
    elif kind == 'handcuffs':
        setc(cr, '#b7bec9'); cr.set_line_width(26)
        cr.arc(-110, 40, 100, 0, TAU); cr.stroke(); cr.arc(110, 40, 100, 0, TAU); cr.stroke()
        cr.set_line_width(12)
        for i in range(3):
            ellipse(cr, -20 + i * 20, -80 - i * 6, 14, 10); cr.stroke()
    elif kind == 'tv':
        setc(cr, '#2a2420'); rrect(cr, -290, -230, 580, 440, 30); cr.fill()
        cr.set_source(vgrad(cr, 0, -200, 0, 180, [(0, '#2a4a6a'), (1, '#0e1b2a')])); rrect(cr, -255, -200, 510, 380, 40); cr.fill()
        silhouette(cr, 0, -40, 55, '#0b1220')
        setc(cr, '#c0101f'); cr.rectangle(-255, 90, 510, 50); cr.fill()
        text(cr, prm.get('label', 'ÚLTIMA HORA'), -240, 126, 30, '#ffffff', align='left')
        setc(cr, '#f2f2f2'); cr.rectangle(-255, 140, 510, 36); cr.fill()
        s = prm.get('ticker', '')
        off = (t * 120) % (text_w(cr, s, 22) + 510)
        cr.save(); cr.rectangle(-255, 140, 510, 36); cr.clip(); text(cr, s, 255 - off, 166, 22, '#111111', align='left'); cr.restore()
        setc(cr, '#1a1512'); cr.rectangle(-120, 210, 240, 40); cr.fill()
    elif kind == 'shelf':
        setc(cr, '#3b2616')
        for r_ in range(3):
            cr.rectangle(-300, -200 + r_ * 200, 600, 22); cr.fill()
        rnd = R(4)
        for r_ in range(3):
            x = -280
            while x < 240:
                kind2 = rnd.choice(['tv', 'vase', 'clock', 'fig', 'box'])
                yb = -200 + r_ * 200
                col = rnd.choice(['#8a6a4a', '#5a7a9a', '#9a4a4a', '#c9b48a', '#6a8a5a'])
                setc(cr, col)
                if kind2 == 'tv':
                    rrect(cr, x, yb - 90, 110, 90, 10); cr.fill(); setc(cr, '#22303f'); rrect(cr, x + 10, yb - 80, 75, 70, 8); cr.fill(); w = 110
                elif kind2 == 'vase':
                    ellipse(cr, x + 30, yb - 45, 30, 45); cr.fill(); w = 60
                elif kind2 == 'clock':
                    cr.arc(x + 35, yb - 40, 35, 0, TAU); cr.fill(); setc(cr, '#f2f2f2'); cr.arc(x + 35, yb - 40, 26, 0, TAU); cr.fill(); w = 70
                elif kind2 == 'fig':
                    cr.arc(x + 20, yb - 70, 14, 0, TAU); cr.fill(); rrect(cr, x + 6, yb - 58, 28, 58, 8); cr.fill(); w = 40
                else:
                    cr.rectangle(x, yb - 50, 70, 50); cr.fill(); w = 70
                x += w + 18
        glow(cr, 0, -100, 450, '#ffd27a', 0.12)
    elif kind == 'monitor':
        setc(cr, '#1a1c22'); rrect(cr, -320, -280, 640, 520, 20); cr.fill()
        for i in range(4):
            cx, cy = -300 + (i % 2) * 305, -260 + (i // 2) * 245
            setc(cr, '#1d2b24'); cr.rectangle(cx, cy, 295, 235); cr.fill()
            setc(cr, '#2e4438'); cr.move_to(cx, cy + 235); cr.line_to(cx + 120, cy + 120); cr.line_to(cx + 175, cy + 120); cr.line_to(cx + 295, cy + 235); cr.fill()
            if i == prm.get('figure', 3):
                silhouette(cr, cx + 148, cy + 120, 16 + 10 * ease(p), '#050706')
            text(cr, f'CAM {i + 1:02d}', cx + 12, cy + 26, 18, '#cfe8d8', align='left', bold=False, font='DejaVu Sans Mono')
            setc(cr, '#ff2b2b', 0.5 + 0.5 * (int(t * 2) % 2)); cr.arc(cx + 275, cy + 20, 7, 0, TAU); cr.fill()
        setc(cr, '#ffffff', 0.05)
        for y in range(-280, 240, 6):
            cr.rectangle(-320, y, 640, 2); cr.fill()
    elif kind == 'calendar':
        setc(cr, '#000000', 0.5); rrect(cr, -200 + 12, -230 + 16, 400, 440, 20); cr.fill()
        setc(cr, '#f5f2ea'); rrect(cr, -200, -230, 400, 440, 20); cr.fill()
        setc(cr, '#c0262d'); rrect(cr, -200, -230, 400, 120, 20); cr.fill(); cr.rectangle(-200, -140, 400, 30); cr.fill()
        text(cr, prm.get('month', 'OCTUBRE'), 0, -150, 44, '#ffffff')
        text(cr, prm.get('day', '9'), 0, 100, 190, '#151515')
        text(cr, prm.get('year', ''), 0, 175, 34, '#555555')
    elif kind == 'fire':
        for i in range(12):
            ph = t * 4 + i
            x = math.sin(i * 1.7) * 140
            hgt = 200 + 80 * math.sin(ph)
            setc(cr, ['#ff6b00', '#ffb300', '#ff3d00'][i % 3], 0.75)
            cr.move_to(x - 60, 200); cr.curve_to(x - 70, 100, x - 10, 50, x + math.sin(ph) * 20, 200 - hgt)
            cr.curve_to(x + 10, 50, x + 70, 100, x + 60, 200); cr.fill()
        glow(cr, 0, 100, 400, '#ff7a00', 0.35)
    cr.restore()


def sc_house(cr, t, p, prm, cast):
    kind = prm.get('kind', 'house')
    night_sky(cr, t, seed=prm.get('seed', 3), moon=prm.get('moon', (580, 220)))
    if kind == 'lighthouse':
        setc(cr, '#0b1426'); cr.rectangle(0, 900, W, 400); cr.fill()
        for i in range(6):
            setc(cr, '#2a4a7a', 0.25); cr.set_line_width(3)
            y = 930 + i * 50 + math.sin(t * 2 + i) * 6
            cr.move_to(0, y)
            for x in range(0, W + 40, 40):
                cr.line_to(x, y + math.sin(x / 50 + t * 2 + i) * 6)
            cr.stroke()
        setc(cr, '#141a24'); poly(cr, [(0, 930), (120, 820), (330, 800), (460, 880), (480, 1280), (0, 1280)]); cr.fill()
        a = t * 0.9
        cr.save(); cr.translate(250, 420)
        cr.set_source(rgrad(cr, 0, 0, 0, 800, [(0, hexc('#fff3b0', 0.45)), (1, hexc('#fff3b0', 0))]))
        cr.move_to(0, 0); cr.arc(0, 0, 900, a - 0.12, a + 0.12); cr.close_path(); cr.fill()
        cr.move_to(0, 0); cr.arc(0, 0, 900, a + math.pi - 0.12, a + math.pi + 0.12); cr.close_path(); cr.fill()
        cr.restore()
        setc(cr, '#e9e4d8'); poly(cr, [(200, 820), (300, 820), (280, 450), (220, 450)]); cr.fill()
        setc(cr, '#b8232f')
        for y0 in (520, 640, 760):
            poly(cr, [(214 - (y0 - 450) * 0.03, y0), (286 + (y0 - 450) * 0.03, y0), (288 + (y0 - 450) * 0.03, y0 + 50), (212 - (y0 - 450) * 0.03, y0 + 50)]); cr.fill()
        setc(cr, '#1d1d1d'); cr.rectangle(205, 395, 90, 60); cr.fill()
        glow(cr, 250, 420, 120, '#fff3b0', 0.8)
        setc(cr, '#fff6c8'); cr.rectangle(215, 402, 70, 42); cr.fill()
        setc(cr, '#1d1d1d'); poly(cr, [(198, 398), (302, 398), (250, 350)]); cr.fill()
    elif kind == 'cortijo':
        setc(cr, '#1a2216'); cr.rectangle(0, 880, W, 400); cr.fill()
        setc(cr, '#000000', 0.3); cr.rectangle(60, 860, 600, 30); cr.fill()
        setc(cr, '#d9d4c7'); cr.rectangle(60, 640, 420, 230); cr.fill()
        setc(cr, '#cfc9ba'); cr.rectangle(480, 700, 200, 170); cr.fill()
        setc(cr, '#8a3b22'); poly(cr, [(40, 650), (500, 650), (460, 580), (80, 580)]); cr.fill()
        poly(cr, [(470, 708), (700, 708), (680, 660), (490, 660)]); cr.fill()
        for i, x in enumerate((110, 210, 330, 540)):
            lit = prm.get('lit', True) and i in (1, 3)
            setc(cr, '#ffcc66' if lit else '#1b1f28'); cr.rectangle(x, 720, 50, 70); cr.fill()
            if lit:
                glow(cr, x + 25, 755, 90, '#ffcc66', 0.3)
        setc(cr, '#3b2616'); cr.rectangle(400, 760, 60, 110); cr.fill()
        if prm.get('fire'):
            fx = 160
            setc(cr, '#c9a24a'); ellipse(cr, fx, 900, 120, 60); cr.fill()
            for i in range(10):
                ph = t * 5 + i
                x = fx + math.sin(i * 2.1) * 80
                hh = 120 + 60 * math.sin(ph)
                setc(cr, ['#ff6b00', '#ffb300', '#ff3d00'][i % 3], 0.8)
                cr.move_to(x - 40, 900); cr.curve_to(x - 40, 850, x, 820, x + math.sin(ph) * 15, 900 - hh)
                cr.curve_to(x + 10, 820, x + 40, 850, x + 40, 900); cr.fill()
            glow(cr, fx, 850, 300, '#ff7a00', 0.4)
            for i in range(6):
                k = (t * 0.25 + i / 6) % 1
                setc(cr, '#2a2a2e', 0.5 * (1 - k)); cr.arc(fx + math.sin(k * 6 + i) * 40 + k * 120, 760 - k * 600, 40 + k * 90, 0, TAU); cr.fill()
        fog(cr, t, 860, '#c0c8b0', 0.06)
    elif kind == 'block':
        setc(cr, '#0d1018'); cr.rectangle(0, 1050, W, 230); cr.fill()
        setc(cr, '#1c2232'); cr.rectangle(110, 260, 500, 800); cr.fill()
        rnd = R(prm.get('seed', 3))
        win = prm.get('window')
        for r_ in range(7):
            for c_ in range(4):
                x, y = 145 + c_ * 115, 300 + r_ * 108
                lit = rnd.random() < 0.35
                if win == (r_, c_):
                    lit = True
                setc(cr, '#ffd27a' if lit else '#121622'); cr.rectangle(x, y, 80, 70); cr.fill()
                if win == (r_, c_):
                    glow(cr, x + 40, y + 35, 120, '#ffd27a', 0.4)
                    silhouette(cr, x + 40, y + 30, 13, '#2a1a0a')
                    setc(cr, '#ffd27a'); cr.rectangle(x, y + 52, 80, 18); cr.fill()
    elif kind == 'gas':
        setc(cr, '#0c0f14'); cr.rectangle(0, 900, W, 380); cr.fill()
        setc(cr, '#e9ecef'); cr.rectangle(60, 560, 600, 70); cr.fill()
        setc(cr, '#c0262d'); cr.rectangle(60, 615, 600, 15); cr.fill()
        setc(cr, '#9aa3ad'); cr.rectangle(120, 630, 22, 280); cr.fill(); cr.rectangle(578, 630, 22, 280); cr.fill()
        for i in range(3):
            x = 220 + i * 120
            setc(cr, '#f2f2f2', 0.85 + 0.15 * (1 if (i != 1 or int(t * 7) % 5) else 0)); cr.rectangle(x, 630, 60, 8); cr.fill()
        setc(cr, '#ffffff', 0.08); poly(cr, [(60, 638), (660, 638), (720, 960), (0, 960)]); cr.fill()
        for x in (250, 430):
            setc(cr, '#c0262d'); rrect(cr, x, 760, 70, 150, 8); cr.fill()
            setc(cr, '#1b1b1b'); cr.rectangle(x + 12, 780, 46, 34); cr.fill()
        setc(cr, '#14181f'); cr.rectangle(0, 700, 60, 200); cr.fill()
        if prm.get('car'):
            setc(cr, '#2b3a55'); rrect(cr, -40 + 140 * ease(p), 860, 220, 70, 20); cr.fill(); rrect(cr, 0 + 140 * ease(p), 820, 140, 55, 18); cr.fill()
            setc(cr, '#ffef9a'); cr.arc(175 + 140 * ease(p), 890, 12, 0, TAU); cr.fill()
            setc(cr, '#0a0a0a'); cr.arc(10 + 140 * ease(p), 930, 24, 0, TAU); cr.fill(); cr.arc(140 + 140 * ease(p), 930, 24, 0, TAU); cr.fill()
    elif kind == 'camp':
        setc(cr, '#0b1210'); cr.rectangle(0, 900, W, 380); cr.fill()
        trees(cr, t, 3)
        setc(cr, '#2f6b4a'); poly(cr, [(200, 980), (360, 760), (520, 980)]); cr.fill()
        setc(cr, '#1d4430'); poly(cr, [(330, 980), (360, 860), (390, 980)]); cr.fill()
        glow(cr, 360, 900, 160, '#ffcf6b', 0.35 * (0.8 + 0.2 * math.sin(t * 9)))
        fog(cr, t, 880)
    else:
        setc(cr, '#0f1612'); cr.rectangle(0, 920, W, 360); cr.fill()
        setc(cr, '#2a2f3a'); cr.rectangle(170, 620, 380, 300); cr.fill()
        setc(cr, '#1a1d24'); poly(cr, [(140, 630), (360, 470), (580, 630)]); cr.fill()
        setc(cr, '#ffcf6b'); cr.rectangle(220, 690, 80, 90); cr.fill(); glow(cr, 260, 735, 120, '#ffcf6b', 0.3)
        setc(cr, '#121212'); cr.rectangle(410, 760, 80, 160); cr.fill()
        fog(cr, t, 900)
    if prm.get('figure'):
        fx = prm.get('fx', 600)
        silhouette(cr, fx, 830, 22, '#030405', eyes=prm.get('eyes'), t=t)


def trees(cr, t, seed=1, col='#0a0f0c', n=12, y0=930):
    rnd = R(seed)
    for i in range(n):
        x = rnd.uniform(-40, W + 40); h = rnd.uniform(260, 520); w = h * 0.35
        setc(cr, col)
        for k in range(3):
            yy = y0 - h * k / 3.2
            poly(cr, [(x - w * (1 - k * 0.25), yy), (x, yy - h * 0.55), (x + w * (1 - k * 0.25), yy)]); cr.fill()
        cr.rectangle(x - 8, y0 - 10, 16, 40); cr.fill()


def sc_forest(cr, t, p, prm, cast):
    night_sky(cr, t, seed=prm.get('seed', 6), moon=(500, 260))
    trees(cr, t, 2, '#121a20', 10, 880)
    fog(cr, t, 780, '#9fb0d0', 0.09)
    trees(cr, t, 5, '#070b0c', 9, 1000)
    setc(cr, '#05080a'); cr.rectangle(0, 1000, W, 280); cr.fill()
    if prm.get('walker'):
        k = p
        draw_char(cr, 120 + 480 * k, 830, 30, cast[prm['walker']], t, 'neutral', (1, 0), legs=True, walk=t * 6, seed=3)
    if prm.get('eyes'):
        for i, (ex, ey) in enumerate([(160, 900), (590, 860), (420, 930)][:prm.get('n', 2)]):
            if p > 0.2 + i * 0.15:
                fl = 0.6 + 0.4 * math.sin(t * 6 + i)
                for side in (-1, 1):
                    glow(cr, ex + side * 14, ey, 30, '#ffd23f', 0.4 * fl)
                    setc(cr, '#ffd23f', fl); ellipse(cr, ex + side * 14, ey, 7, 4); cr.fill()
    if prm.get('figure'):
        silhouette(cr, 360, 760, 30, '#020304', eyes=prm.get('figeyes', '#ff2b2b'), t=t)
    fog(cr, t, 960, '#8090b0', 0.07)


def sc_street(cr, t, p, prm, cast):
    room_bg(cr, t, {'bg': 'street'})
    for lx in (120, 600):
        setc(cr, '#202631'); cr.rectangle(lx - 5, 560, 10, 380); cr.fill()
        setc(cr, '#ffe2a8'); ellipse(cr, lx, 560, 26, 10); cr.fill()
        cr.set_source(vgrad(cr, 0, 560, 0, 960, [(0, hexc('#ffd27a', 0.28)), (1, hexc('#ffd27a', 0.02))]))
        poly(cr, [(lx - 20, 565), (lx + 20, 565), (lx + 140, 960), (lx - 140, 960)]); cr.fill()
    if prm.get('walker'):
        d = prm.get('dir', 1)
        x = 80 + 560 * p if d > 0 else 640 - 560 * p
        draw_char(cr, x, 760, 36, cast[prm['walker']], t, prm.get('expr', 'neutral'), (d, 0), legs=True, walk=t * 6, seed=5)
    if prm.get('follower'):
        x = 80 + 560 * p - 210
        silhouette(cr, x, 770, 32, '#020304', t=t, hat=prm.get('hat', False))
    if prm.get('stop'):
        setc(cr, '#3a4a6a'); cr.rectangle(500, 700, 160, 220); cr.fill()
        setc(cr, '#c0262d'); cr.arc(470, 640, 30, 0, TAU); cr.fill(); setc(cr, '#202631'); cr.rectangle(466, 670, 8, 270); cr.fill()
        text(cr, 'BUS', 470, 650, 22, '#ffffff')


def sc_hallway(cr, t, p, prm, cast):
    flick = 1.0 if (int(t * 9) % 13) else 0.4
    base = prm.get('col', '#2a3142')
    setc(cr, shade(base, 0.5)); cr.paint()
    vx, vy, dw, dh = 360, 600, 150, 260
    setc(cr, shade(base, 0.9 * flick)); poly(cr, [(0, 0), (vx - dw / 2, vy - dh / 2), (vx - dw / 2, vy + dh / 2), (0, H)]); cr.fill()
    setc(cr, shade(base, 0.75 * flick)); poly(cr, [(W, 0), (vx + dw / 2, vy - dh / 2), (vx + dw / 2, vy + dh / 2), (W, H)]); cr.fill()
    setc(cr, shade(base, 0.55 * flick)); poly(cr, [(0, 0), (W, 0), (vx + dw / 2, vy - dh / 2), (vx - dw / 2, vy - dh / 2)]); cr.fill()
    setc(cr, shade(base, 0.35)); poly(cr, [(0, H), (W, H), (vx + dw / 2, vy + dh / 2), (vx - dw / 2, vy + dh / 2)]); cr.fill()
    for i in range(4):
        k = (i + 1) / 5
        y = vy - dh / 2 - (vy - dh / 2) * (1 - k) ** 1.6
        setc(cr, '#f4f1e0', 0.85 * flick); ellipse(cr, vx, y + 10, 50 * (1 - k * 0.7) + 10, 8 * (1 - k * 0.6) + 3); cr.fill()
    for side in (-1, 1):
        for i in range(3):
            k = 0.25 + i * 0.22
            x = vx + side * (dw / 2 + (W / 2 - dw / 2) * (1 - k) ** 1.4)
            hh = dh * (1 + (1 - k) * 2.6)
            setc(cr, '#1b130d'); poly(cr, [(x, vy + dh / 2 * (1 + (1 - k) * 2.6) - hh), (x + side * 40 * (1 - k), vy + dh / 2 * (1 + (1 - k) * 2.6) - hh - 10 * (1 - k)),
                                         (x + side * 40 * (1 - k), vy + dh / 2 * (1 + (1 - k) * 2.6) + 10 * (1 - k)), (x, vy + dh / 2 * (1 + (1 - k) * 2.6))]); cr.fill()
    setc(cr, '#120d09'); cr.rectangle(vx - dw / 2, vy - dh / 2, dw, dh); cr.fill()
    if prm.get('open'):
        setc(cr, '#ffdca0', 0.9); cr.rectangle(vx - dw / 2 + 10, vy - dh / 2 + 10, dw - 20, dh - 10); cr.fill()
    if prm.get('figure'):
        silhouette(cr, vx, vy - 40 + 0, 22 + 18 * ease(p), '#020203', eyes=prm.get('eyes'), t=t)
    if prm.get('mannequin'):
        setc(cr, '#d9d2c3'); ellipse(cr, vx + 0, vy - 60, 20, 24); cr.fill(); rrect(cr, vx - 26, vy - 36, 52, 110, 14); cr.fill()
    setc(cr, '#000000', 0.35 + 0.4 * (1 - flick)); cr.paint()


def sc_door(cr, t, p, prm, cast):
    setc(cr, '#1c1a20'); cr.paint()
    setc(cr, '#2a2630'); cr.rectangle(0, 0, W, H); cr.fill()
    knock = prm.get('knock', False)
    sh = 0
    if knock:
        ph = (t % 1.2)
        if ph < 0.45 and int(ph / 0.15) % 1 == 0:
            sh = math.sin(ph * 70) * 6 * (1 - ph / 0.45)
    cr.save(); cr.translate(sh, 0)
    setc(cr, '#3a2414'); cr.rectangle(150, 150, 420, 960); cr.fill()
    setc(cr, '#4a2e1a')
    for (x, y, w, h) in ((190, 200, 340, 380), (190, 640, 340, 420)):
        rrect(cr, x, y, w, h, 8); cr.fill()
    setc(cr, '#2e1c10'); cr.set_line_width(5)
    for (x, y, w, h) in ((190, 200, 340, 380), (190, 640, 340, 420)):
        rrect(cr, x, y, w, h, 8); cr.stroke()
    setc(cr, '#d4af37'); cr.arc(510, 640, 22, 0, TAU); cr.fill()
    setc(cr, '#0d0d0d'); cr.arc(360, 420, 10, 0, TAU); cr.fill()
    if prm.get('peep'):
        setc(cr, '#ffefc0', 0.5 + 0.5 * math.sin(t * 3)); cr.arc(360, 420, 6, 0, TAU); cr.fill()
    cr.restore()
    setc(cr, '#ffdca0', 0.9); cr.rectangle(150, 1110, 420, 10); cr.fill()
    cr.set_source(vgrad(cr, 0, 1120, 0, 1280, [(0, hexc('#ffdca0', 0.45)), (1, hexc('#ffdca0', 0))]))
    poly(cr, [(150, 1120), (570, 1120), (700, 1280), (20, 1280)]); cr.fill()
    if prm.get('feet'):
        fx = 360 + math.sin(t * 0.8) * 60
        setc(cr, '#000000', 0.85); cr.rectangle(fx - 70, 1110, 50, 10); cr.fill(); cr.rectangle(fx + 20, 1110, 50, 10); cr.fill()
        cr.set_source(vgrad(cr, 0, 1120, 0, 1280, [(0, hexc('#000000', 0.6)), (1, hexc('#000000', 0))]))
        poly(cr, [(fx - 70, 1120), (fx - 20, 1120), (fx - 10, 1280), (fx - 110, 1280)]); cr.fill()
        poly(cr, [(fx + 20, 1120), (fx + 70, 1120), (fx + 110, 1280), (fx + 10, 1280)]); cr.fill()
    if prm.get('intercom'):
        setc(cr, '#cfd4da'); rrect(cr, 600, 520, 90, 200, 10); cr.fill()
        setc(cr, '#2a2f38'); rrect(cr, 612, 540, 66, 50, 6); cr.fill()
        setc(cr, '#30ff7a' if int(t * 3) % 2 else '#0a3a1a'); cr.arc(645, 690, 8, 0, TAU); cr.fill()


def sc_court(cr, t, p, prm, cast):
    room_bg(cr, t, {'bg': 'court', 'floor': '#2a1a10'})
    if prm.get('judge', True):
        draw_char(cr, 360, 560, 95, dict(skin='#e2b48c', hair='#d8d8d8', style='bald', old=True, glasses=True, robe=True), t, 'angry', (0, 0.4), seed=9)
    setc(cr, '#5a3a22'); cr.rectangle(60, 760, 600, 300); cr.fill()
    setc(cr, '#6b4630'); cr.rectangle(40, 740, 640, 40); cr.fill()
    setc(cr, '#c9a14a'); cr.arc(360, 900, 50, 0, TAU); cr.set_line_width(6); cr.stroke()
    if prm.get('who'):
        draw_char(cr, 360, 1140, 110, cast[prm['who']], t, prm.get('expr', 'neutral'), (0, -0.8), seed=4)
    if prm.get('verdict'):
        k = back_out((p - 0.35) * 4)
        if p > 0.35:
            cr.save(); cr.translate(360, 215); cr.scale(k, k)
            setc(cr, '#0a0a0a', 0.85); rrect(cr, -300, -70, 600, 120, 16); cr.fill()
            text(cr, prm['verdict'], 0, 15, 60, '#ff4d4d')
            cr.restore()


def sc_slide(cr, t, p, prm, cast):
    acc = prm.get('acc', '#4fd1c5')
    bg_fill(cr, '#0b1020', '#141a30')
    glow(cr, 360, 760, 560, acc, 0.14)
    k = back_out(t / 0.4)
    cr.save(); cr.translate(360, 560); cr.scale(k, k)
    tag = prm.get('tag')
    if tag:
        tw = text_w(cr, tag, 26) + 40
        setc(cr, acc); rrect(cr, -tw / 2, -120, tw, 46, 23); cr.fill()
        text(cr, tag, 0, -88, 26, '#0b1020')
    text(cr, prm['title'], 0, 0, 56, '#ffffff')
    cr.restore()
    items = prm.get('items', [])
    for i, it in enumerate(items):
        ap = 0.08 + i * 0.75 / max(1, len(items))
        if p < ap and t > 0.2:
            continue
        kk = ease((p - ap) * 8) if t > 0.2 else 0
        y = 650 + i * 120
        cr.save(); cr.translate((1 - kk) * 80, 0)
        setc(cr, '#ffffff', 0.07 * kk); rrect(cr, 60, y, 600, 96, 18); cr.fill()
        setc(cr, acc, kk); rrect(cr, 60, y, 10, 96, 5); cr.fill()
        setc(cr, acc, kk); cr.arc(115, y + 48, 24, 0, TAU); cr.fill()
        text(cr, it[0], 115, y + 58, 28, '#0b1020', a=kk)
        lines = wrap(cr, it[1], 30, 500)
        for j, ln in enumerate(lines[:2]):
            text(cr, ln, 155, y + (58 if len(lines) == 1 else 42 + j * 36), 30, '#ffffff', align='left', a=kk)
        cr.restore()


SCENES = dict(slide=sc_slide, char=sc_char, duo=sc_duo, eyes=sc_eyes, map=sc_map, news=sc_news, stamp=sc_stamp, evidence=sc_evidence,
              object=sc_object, house=sc_house, forest=sc_forest, street=sc_street, hallway=sc_hallway, door=sc_door,
              court=sc_court)
