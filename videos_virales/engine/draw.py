"""Primitivas de dibujo y personajes estilo cartoon plano (pycairo)."""
import math, random
import cairo

W, H = 720, 1280
TAU = math.pi * 2


def hexc(h, a=1.0):
    h = h.lstrip('#')
    if len(h) == 3:
        h = ''.join(ch * 2 for ch in h)
    return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255, a)


def setc(cr, h, a=1.0):
    if isinstance(h, tuple):
        cr.set_source_rgba(*h[:3], h[3] * a if len(h) > 3 else a)
    else:
        cr.set_source_rgba(*hexc(h, a))


def shade(h, f):
    r, g, b, _ = hexc(h)
    if f < 1:
        r, g, b = r * f, g * f, b * f
    else:
        r, g, b = r + (1 - r) * (f - 1), g + (1 - g) * (f - 1), b + (1 - b) * (f - 1)
    return '#%02x%02x%02x' % (int(max(0, min(1, r)) * 255), int(max(0, min(1, g)) * 255), int(max(0, min(1, b)) * 255))


def ellipse(cr, x, y, rx, ry):
    cr.save(); cr.translate(x, y); cr.scale(max(rx, 0.01), max(ry, 0.01)); cr.arc(0, 0, 1, 0, TAU); cr.restore()


def rrect(cr, x, y, w, h, r):
    r = min(r, w / 2, h / 2)
    cr.new_sub_path()
    cr.arc(x + w - r, y + r, r, -math.pi / 2, 0)
    cr.arc(x + w - r, y + h - r, r, 0, math.pi / 2)
    cr.arc(x + r, y + h - r, r, math.pi / 2, math.pi)
    cr.arc(x + r, y + r, r, math.pi, 1.5 * math.pi)
    cr.close_path()


def poly(cr, pts):
    cr.move_to(*pts[0])
    for p in pts[1:]:
        cr.line_to(*p)
    cr.close_path()


def vgrad(cr, x0, y0, x1, y1, stops):
    g = cairo.LinearGradient(x0, y0, x1, y1)
    for off, col in stops:
        if isinstance(col, tuple):
            g.add_color_stop_rgba(off, *col)
        else:
            g.add_color_stop_rgba(off, *hexc(col))
    return g


def rgrad(cr, x, y, r0, r1, stops):
    g = cairo.RadialGradient(x, y, r0, x, y, r1)
    for off, col in stops:
        g.add_color_stop_rgba(off, *(col if isinstance(col, tuple) else hexc(col)))
    return g


def glow(cr, x, y, r, col, a=0.5):
    cr.set_source(rgrad(cr, x, y, 0, r, [(0, hexc(col, a)), (1, hexc(col, 0))]))
    cr.arc(x, y, r, 0, TAU); cr.fill()


def text(cr, s, x, y, size, col='#ffffff', bold=True, align='center', font='Inter', a=1.0, slant=False):
    cr.select_font_face(font, cairo.FONT_SLANT_ITALIC if slant else cairo.FONT_SLANT_NORMAL,
                        cairo.FONT_WEIGHT_BOLD if bold else cairo.FONT_WEIGHT_NORMAL)
    cr.set_font_size(size)
    ext = cr.text_extents(s)
    if align == 'center':
        xx = x - ext.width / 2 - ext.x_bearing
    elif align == 'right':
        xx = x - ext.width - ext.x_bearing
    else:
        xx = x
    setc(cr, col, a)
    cr.move_to(xx, y)
    cr.show_text(s)
    return ext


def text_w(cr, s, size, bold=True, font='Inter'):
    cr.select_font_face(font, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD if bold else cairo.FONT_WEIGHT_NORMAL)
    cr.set_font_size(size)
    return cr.text_extents(s).x_advance


def wrap(cr, s, size, maxw, bold=True, font='Inter'):
    words, lines, cur = s.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if text_w(cr, t, size, bold, font) > maxw and cur:
            lines.append(cur); cur = w
        else:
            cur = t
    if cur:
        lines.append(cur)
    return lines


# ----------------------------------------------------------------- personajes
DEFAULT = dict(skin='#e0a77a', hair='#2b1d16', style='short', shirt='#3a5a8c', pants='#2a2f3a',
               glasses=False, mustache=False, beard=False, old=False, tie=None, cheeks=False,
               hat=None, eyes='#141414', lips=None, earrings=None, collar=None, robe=False)


def blink_amount(t, seed):
    period = 3.1 + (seed % 7) * 0.37
    ph = (t + seed * 0.71) % period
    if ph < 0.14:
        return math.sin(ph / 0.14 * math.pi)
    return 0.0


def draw_char(cr, x, y, s, spec, t=0.0, expr='neutral', look=(0.0, 0.0), body=True, legs=False,
              walk=0.0, talk=False, seed=1, light=None):
    """(x, y) = centro de la cabeza, s = radio de la cabeza."""
    c = dict(DEFAULT); c.update(spec or {})
    skin, hair = c['skin'], c['hair']
    if c['old'] and c['style'] != 'bald':
        hair = c.get('hair', '#cfcfcf')
    cr.save()
    # ---- cuerpo
    if body:
        if legs:
            sw = math.sin(walk) * 0.5
            for side, ph in ((-1, sw), (1, -sw)):
                cr.save(); cr.translate(x + side * 0.42 * s, y + 3.4 * s); cr.rotate(ph * 0.5)
                setc(cr, c['pants']); rrect(cr, -0.32 * s, 0, 0.64 * s, 2.3 * s, 0.25 * s); cr.fill()
                setc(cr, '#111111'); rrect(cr, -0.38 * s, 2.15 * s, 0.85 * s, 0.38 * s, 0.18 * s); cr.fill()
                cr.restore()
        # hair largo (detrás)
        if c['style'] in ('long', 'longstraight'):
            setc(cr, hair); rrect(cr, x - 1.12 * s, y - 0.7 * s, 2.24 * s, 2.5 * s, 0.9 * s); cr.fill()
        # brazos
        for side in (-1, 1):
            sw = math.sin(walk) * 0.35 * side if legs else 0
            cr.save(); cr.translate(x + side * 1.18 * s, y + 1.25 * s); cr.rotate(-side * 0.08 + sw)
            setc(cr, shade(c['shirt'], 0.82)); rrect(cr, -0.3 * s, 0, 0.6 * s, 2.25 * s, 0.3 * s); cr.fill()
            setc(cr, skin); cr.arc(0, 2.3 * s, 0.27 * s, 0, TAU); cr.fill()
            cr.restore()
        # torso
        shirt = '#141414' if c['robe'] else c['shirt']
        setc(cr, shirt)
        rrect(cr, x - 1.25 * s, y + 0.95 * s, 2.5 * s, 2.75 * s, 0.6 * s); cr.fill()
        # sombra lateral del torso
        cr.save(); rrect(cr, x - 1.25 * s, y + 0.95 * s, 2.5 * s, 2.75 * s, 0.6 * s); cr.clip()
        setc(cr, '#000000', 0.18); ellipse(cr, x + 1.5 * s, y + 2.3 * s, 0.9 * s, 2.0 * s); cr.fill(); cr.restore()
        # cuello
        setc(cr, shade(skin, 0.85)); rrect(cr, x - 0.28 * s, y + 0.65 * s, 0.56 * s, 0.5 * s, 0.1 * s); cr.fill()
        if c['collar']:
            setc(cr, c['collar']); poly(cr, [(x - 0.55 * s, y + 0.95 * s), (x, y + 1.35 * s), (x + 0.55 * s, y + 0.95 * s),
                                          (x + 0.3 * s, y + 0.95 * s), (x, y + 1.15 * s), (x - 0.3 * s, y + 0.95 * s)]); cr.fill()
        if c['tie']:
            setc(cr, c['tie']); poly(cr, [(x - 0.12 * s, y + 1.05 * s), (x + 0.12 * s, y + 1.05 * s), (x + 0.2 * s, y + 2.3 * s),
                                       (x, y + 2.55 * s), (x - 0.2 * s, y + 2.3 * s)]); cr.fill()
        if c['robe']:
            setc(cr, '#f2f2f2'); poly(cr, [(x - 0.35 * s, y + 0.97 * s), (x, y + 1.5 * s), (x + 0.35 * s, y + 0.97 * s)]); cr.fill()
    # ---- orejas
    setc(cr, shade(skin, 0.9))
    for side in (-1, 1):
        cr.arc(x + side * 0.98 * s, y + 0.08 * s, 0.19 * s, 0, TAU); cr.fill()
    if c['earrings']:
        setc(cr, c['earrings'])
        for side in (-1, 1):
            cr.arc(x + side * 0.98 * s, y + 0.32 * s, 0.07 * s, 0, TAU); cr.fill()
    # ---- cabeza
    setc(cr, skin); ellipse(cr, x, y, 1.0 * s, 1.05 * s); cr.fill()
    cr.save(); ellipse(cr, x, y, 1.0 * s, 1.05 * s); cr.clip()
    setc(cr, '#000000', 0.13); ellipse(cr, x + 0.95 * s, y + 0.2 * s, 0.55 * s, 1.3 * s); cr.fill()
    if light:
        setc(cr, light, 0.22); ellipse(cr, x - 1.0 * s, y, 0.45 * s, 1.3 * s); cr.fill()
    # barba
    if c['beard']:
        setc(cr, hair); ellipse(cr, x, y + 0.85 * s, 1.0 * s, 0.75 * s); cr.fill()
    cr.restore()
    # ---- pelo
    st = c['style']
    if st in ('short', 'long', 'longstraight', 'slick', 'bun', 'curly', 'kid'):
        cr.save(); ellipse(cr, x, y - 0.02 * s, 1.07 * s, 1.12 * s); cr.clip()
        setc(cr, hair)
        cr.move_to(x - 1.2 * s, y - 0.1 * s)
        if st == 'slick':
            cr.curve_to(x - 1.0 * s, y - 0.55 * s, x - 0.4 * s, y - 0.55 * s, x - 0.2 * s, y - 0.6 * s)
            cr.curve_to(x + 0.3 * s, y - 0.45 * s, x + 0.8 * s, y - 0.5 * s, x + 1.2 * s, y - 0.1 * s)
        elif st in ('long', 'longstraight'):
            cr.curve_to(x - 0.8 * s, y - 0.7 * s, x - 0.1 * s, y - 0.75 * s, x + 0.05 * s, y - 0.5 * s)
            cr.curve_to(x + 0.3 * s, y - 0.75 * s, x + 0.9 * s, y - 0.65 * s, x + 1.2 * s, y + 0.0 * s)
        else:
            for i in range(6):
                xx = x - 1.0 * s + i * 0.4 * s
                cr.curve_to(xx + 0.05 * s, y - 0.62 * s, xx + 0.25 * s, y - 0.48 * s, xx + 0.4 * s, y - 0.58 * s)
            cr.line_to(x + 1.2 * s, y - 0.1 * s)
        cr.line_to(x + 1.2 * s, y - 1.3 * s); cr.line_to(x - 1.2 * s, y - 1.3 * s); cr.close_path(); cr.fill()
        cr.restore()
        if st == 'bun':
            setc(cr, hair); cr.arc(x, y - 1.1 * s, 0.38 * s, 0, TAU); cr.fill()
        if st == 'curly':
            setc(cr, hair)
            for i in range(9):
                a = math.pi + i * math.pi / 8
                cr.arc(x + math.cos(a) * 0.95 * s, y - 0.1 * s + math.sin(a) * 1.0 * s, 0.26 * s, 0, TAU); cr.fill()
        if st in ('long', 'longstraight'):
            setc(cr, hair)
            for side in (-1, 1):
                rrect(cr, x + side * 0.82 * s - 0.25 * s, y - 0.5 * s, 0.5 * s, 1.6 * s, 0.25 * s); cr.fill()
    elif st == 'bald':
        setc(cr, hair)
        for side in (-1, 1):
            ellipse(cr, x + side * 0.9 * s, y - 0.15 * s, 0.18 * s, 0.35 * s); cr.fill()
    if c['hat'] == 'cap':
        setc(cr, c.get('hatc', '#1d2a44'))
        cr.save(); cr.rectangle(x - 1.3 * s, y - 1.5 * s, 2.6 * s, 1.0 * s); cr.clip()
        ellipse(cr, x, y - 0.45 * s, 1.08 * s, 0.95 * s); cr.fill(); cr.restore()
        rrect(cr, x - 1.2 * s, y - 0.6 * s, 2.4 * s, 0.22 * s, 0.1 * s); cr.fill()
        setc(cr, '#e8c14a'); cr.arc(x, y - 0.95 * s, 0.13 * s, 0, TAU); cr.fill()
    elif c['hat'] == 'tricornio':
        setc(cr, '#151515')
        poly(cr, [(x - 1.2 * s, y - 0.5 * s), (x - 0.9 * s, y - 1.25 * s), (x + 0.9 * s, y - 1.25 * s), (x + 1.2 * s, y - 0.5 * s)]); cr.fill()
        setc(cr, '#2a7a3a'); cr.rectangle(x - 1.05 * s, y - 0.72 * s, 2.1 * s, 0.14 * s); cr.fill()
    elif c['hat'] == 'beret':
        setc(cr, c.get('hatc', '#1a1a1a')); ellipse(cr, x - 0.1 * s, y - 0.75 * s, 1.1 * s, 0.4 * s); cr.fill()
    # ---- cara
    bl = blink_amount(t, seed)
    eye_r = 0.30 * s
    pr = {'scared': 0.075, 'creepy': 0.12, 'shock': 0.06}.get(expr, 0.135) * s
    lid = {'creepy': 0.45, 'sad': 0.18, 'tired': 0.4, 'angry': 0.25, 'drunk': 0.5}.get(expr, 0.0)
    lid = max(lid, bl)
    lx, ly = look
    for side in (-1, 1):
        ex, ey = x + side * 0.37 * s, y - 0.06 * s
        setc(cr, '#ffffff'); cr.arc(ex, ey, eye_r, 0, TAU); cr.fill()
        setc(cr, c['eyes']); cr.arc(ex + lx * 0.12 * s, ey + ly * 0.1 * s, pr, 0, TAU); cr.fill()
        setc(cr, '#ffffff'); cr.arc(ex + lx * 0.12 * s + pr * 0.35, ey + ly * 0.1 * s - pr * 0.4, pr * 0.32, 0, TAU); cr.fill()
        if lid > 0:
            cr.save(); cr.arc(ex, ey, eye_r + 0.01 * s, 0, TAU); cr.clip()
            setc(cr, shade(skin, 0.92)); cr.rectangle(ex - eye_r, ey - eye_r - 1, 2 * eye_r, 2 * eye_r * lid + 1); cr.fill()
            cr.restore()
            if lid > 0.95:
                setc(cr, '#1a1a1a'); cr.set_line_width(0.05 * s); cr.arc(ex, ey, eye_r * 0.8, 0.2, math.pi - 0.2); cr.stroke()
        setc(cr, '#151515'); cr.set_line_width(0.055 * s); cr.arc(ex, ey, eye_r, 0, TAU); cr.stroke()
    # cejas
    setc(cr, shade(hair, 0.8) if st != 'bald' else '#3a2a20'); cr.set_line_width(0.1 * s); cr.set_line_cap(cairo.LINE_CAP_ROUND)
    for side in (-1, 1):
        ex = x + side * 0.37 * s
        by = y - 0.48 * s
        k = 0.0
        if expr in ('scared', 'shock'):
            k, by = -0.7, by - 0.12 * s
        elif expr in ('angry', 'creepy'):
            k = 1.0
        elif expr in ('sad', 'drunk'):
            k = -1.0
        cr.move_to(ex - side * 0.22 * s, by + k * 0.1 * s)
        cr.line_to(ex + side * 0.22 * s, by - k * 0.1 * s)
        cr.stroke()
    if c['glasses']:
        setc(cr, c['glasses'] if isinstance(c['glasses'], str) else '#1b1b1b'); cr.set_line_width(0.06 * s)
        for side in (-1, 1):
            cr.arc(x + side * 0.37 * s, y - 0.06 * s, 0.38 * s, 0, TAU); cr.stroke()
        cr.move_to(x - 0.05 * s, y - 0.1 * s); cr.line_to(x + 0.05 * s, y - 0.1 * s); cr.stroke()
    # nariz
    setc(cr, shade(skin, 0.82)); ellipse(cr, x + 0.02 * s, y + 0.3 * s, 0.11 * s, 0.08 * s); cr.fill()
    # mejillas / arrugas
    if c['cheeks']:
        setc(cr, '#ff6b6b', 0.25)
        for side in (-1, 1):
            cr.arc(x + side * 0.62 * s, y + 0.38 * s, 0.14 * s, 0, TAU); cr.fill()
    if c['old']:
        setc(cr, shade(skin, 0.75)); cr.set_line_width(0.03 * s)
        for side in (-1, 1):
            cr.move_to(x + side * 0.72 * s, y - 0.15 * s); cr.line_to(x + side * 0.82 * s, y - 0.05 * s); cr.stroke()
            cr.move_to(x + side * 0.3 * s, y + 0.42 * s); cr.curve_to(x + side * 0.36 * s, y + 0.5 * s, x + side * 0.36 * s, y + 0.55 * s, x + side * 0.32 * s, y + 0.62 * s); cr.stroke()
    # bigote
    if c['mustache']:
        setc(cr, shade(hair, 0.9)); ellipse(cr, x, y + 0.47 * s, 0.32 * s, 0.09 * s); cr.fill()
    # boca
    my = y + 0.6 * s
    mo = (abs(math.sin(t * 13)) * 0.6 + 0.2) if talk else 0
    setc(cr, '#3a1414'); cr.set_line_width(0.06 * s)
    if expr in ('scared', 'shock'):
        ellipse(cr, x, my + 0.03 * s, 0.13 * s, 0.17 * s); cr.fill()
    elif expr == 'creepy':
        cr.move_to(x - 0.45 * s, my - 0.08 * s); cr.curve_to(x - 0.2 * s, my + 0.28 * s, x + 0.2 * s, my + 0.28 * s, x + 0.45 * s, my - 0.08 * s)
        cr.close_path(); cr.fill()
        setc(cr, '#f2f2f2'); cr.rectangle(x - 0.32 * s, my - 0.02 * s, 0.64 * s, 0.07 * s); cr.fill()
    elif expr == 'smile':
        cr.arc(x, my - 0.12 * s, 0.25 * s, 0.25, math.pi - 0.25); cr.stroke()
    elif expr in ('sad', 'angry'):
        cr.arc(x, my + 0.18 * s, 0.2 * s, math.pi + 0.5, -0.5); cr.stroke()
    elif mo > 0.25:
        ellipse(cr, x, my, 0.15 * s, 0.05 * s + mo * 0.08 * s); cr.fill()
    else:
        cr.move_to(x - 0.17 * s, my); cr.line_to(x + 0.17 * s, my); cr.stroke()
    if c['lips']:
        setc(cr, c['lips'], 0.6); cr.set_line_width(0.04 * s); cr.move_to(x - 0.14 * s, my + 0.03 * s); cr.line_to(x + 0.14 * s, my + 0.03 * s); cr.stroke()
    cr.restore()


def silhouette(cr, x, y, s, col='#05060a', eyes=None, t=0.0, hat=False):
    """Figura oscura. (x,y) centro de cabeza."""
    setc(cr, col)
    ellipse(cr, x, y, 0.95 * s, 1.0 * s); cr.fill()
    rrect(cr, x - 1.3 * s, y + 0.8 * s, 2.6 * s, 4.5 * s, 0.9 * s); cr.fill()
    if hat:
        ellipse(cr, x, y - 0.55 * s, 1.5 * s, 0.25 * s); cr.fill()
        rrect(cr, x - 0.8 * s, y - 1.4 * s, 1.6 * s, 0.9 * s, 0.2 * s); cr.fill()
    if eyes:
        fl = 0.75 + 0.25 * math.sin(t * 7)
        for side in (-1, 1):
            glow(cr, x + side * 0.33 * s, y - 0.05 * s, 0.5 * s, eyes, 0.35 * fl)
            setc(cr, eyes, fl); ellipse(cr, x + side * 0.33 * s, y - 0.05 * s, 0.13 * s, 0.07 * s); cr.fill()
