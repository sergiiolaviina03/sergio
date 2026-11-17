#!/usr/bin/env python3
"""Genera la guía de Niza (HTML) con mapas SVG proyectados desde coordenadas reales."""
import math, pathlib

OUT = pathlib.Path(__file__).with_name("niza.html")

# ───────────────────────── PALETA ─────────────────────────
INK = "#0D1B2E"; SEA1 = "#0B3D91"; SEA2 = "#2F7DE1"; SEA3 = "#8CCBFF"
SUN = "#FF7A3D"; CORAL = "#FF4F6D"; OCHRE = "#E8A33D"; OLIVE = "#5E8C3A"
LAND = "#FBF4E8"; CREAM = "#FFFBF5"

# ───────────────────────── GEO ─────────────────────────
COAST = [
 (43.640,7.180),(43.652,7.195),(43.652,7.205),(43.650,7.212),(43.652,7.222),(43.660,7.228),
 (43.670,7.232),(43.680,7.240),(43.687,7.2475),(43.6905,7.2525),(43.6928,7.2580),(43.6940,7.2640),
 (43.6945,7.2700),(43.6946,7.2750),(43.6941,7.2790),(43.6930,7.2820),(43.6934,7.2840),(43.6948,7.2846),
 (43.6995,7.2852),(43.6998,7.2876),(43.6958,7.2884),(43.6940,7.2882),(43.6928,7.2900),(43.6912,7.2935),
 (43.6898,7.2975),(43.6885,7.3020),(43.6880,7.3050),(43.6915,7.3075),(43.6970,7.3090),(43.7025,7.3110),
 (43.7015,7.3160),(43.6960,7.3190),(43.6890,7.3215),(43.6820,7.3250),(43.6770,7.3300),(43.6800,7.3365),
 (43.6880,7.3390),(43.6925,7.3345),(43.6960,7.3330),(43.7030,7.3320),(43.7060,7.3360),(43.7095,7.3460),
 (43.7125,7.3560),(43.7145,7.3660),(43.7120,7.3760),(43.7135,7.3850),(43.7180,7.3960),(43.7180,7.4060),
 (43.7240,7.4140),(43.7300,7.4195),(43.7340,7.4240),(43.7360,7.4265),(43.7410,7.4300),(43.7460,7.4380),
 (43.7520,7.4460),(43.7600,7.4550),(43.7700,7.4700)]


class Proj:
    def __init__(s, lon0, lon1, lat0, lat1, width=1000):
        s.lon0, s.lat1 = lon0, lat1
        s.c = math.cos(math.radians((lat0 + lat1) / 2))
        s.k = width / ((lon1 - lon0) * s.c)
        s.w = width
        s.h = (lat1 - lat0) * s.k

    def __call__(s, lat, lon):
        return ((lon - s.lon0) * s.c * s.k, (s.lat1 - lat) * s.k)

    def path(s, pts, close=False):
        d = " ".join(("M" if i == 0 else "L") + f"{x:.1f},{y:.1f}"
                     for i, (x, y) in enumerate(s(a, b) for a, b in pts))
        return d + (" Z" if close else "")

    def smooth(s, pts):
        """Catmull-Rom → Bézier para líneas suaves."""
        P = [s(a, b) for a, b in pts]
        d = f"M{P[0][0]:.1f},{P[0][1]:.1f}"
        for i in range(len(P) - 1):
            p0 = P[i - 1] if i else P[i]; p1 = P[i]; p2 = P[i + 1]
            p3 = P[i + 2] if i + 2 < len(P) else p2
            c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
            c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
            d += f" C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}"
        return d

    def px_per_m(s):
        return s.k / 111320


def sea_path(p):
    pts = COAST + [(43.770, 7.60), (43.55, 7.60), (43.55, 7.10), (43.640, 7.10)]
    return p.smooth(COAST) + " " + " ".join(
        f"L{x:.1f},{y:.1f}" for x, y in (p(a, b) for a, b in pts[len(COAST):])) + " Z"


def defs(uid):
    return f"""
<defs>
  <linearGradient id="sea{uid}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{SEA3}"/><stop offset=".35" stop-color="{SEA2}"/><stop offset="1" stop-color="{SEA1}"/>
  </linearGradient>
  <radialGradient id="glow{uid}" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </radialGradient>
  <pattern id="dots{uid}" width="14" height="14" patternUnits="userSpaceOnUse">
    <circle cx="2" cy="2" r="1" fill="{INK}" opacity=".07"/>
  </pattern>
  <pattern id="waves{uid}" width="60" height="18" patternUnits="userSpaceOnUse">
    <path d="M0 9 Q15 3 30 9 T60 9" fill="none" stroke="#fff" stroke-opacity=".13" stroke-width="1.2"/>
  </pattern>
  <filter id="shadow{uid}" x="-50%" y="-50%" width="200%" height="200%">
    <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="{INK}" flood-opacity=".35"/>
  </filter>
</defs>"""


def coast_rings(p, uid):
    d = p.smooth(COAST)
    out = []
    for i, (off, op) in enumerate([(5, .55), (11, .35), (19, .22), (30, .13)]):
        out.append(f'<path d="{d}" transform="translate(0,{off})" fill="none" stroke="#fff" '
                   f'stroke-opacity="{op}" stroke-width="1.3" stroke-dasharray="{"" if i == 0 else "2 5"}"/>')
    return "".join(out)


def pin(p, lat, lon, label, color, dx=0, dy=0, size=15, text="#fff"):
    x, y = p(lat, lon)
    bx, by = x + dx, y + dy
    g = ""
    if dx or dy:
        g += f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{bx:.1f}" y2="{by:.1f}" stroke="{color}" stroke-width="2"/>'
        g += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="4" fill="{color}" stroke="#fff" stroke-width="1.5"/>'
        g += (f'<g filter="url(#shadowc)"><circle cx="{bx:.1f}" cy="{by:.1f}" r="{size}" fill="{color}" stroke="#fff" stroke-width="2.5"/></g>')
    else:
        # chincheta en forma de gota
        r = size
        g += (f'<g filter="url(#shadowc)" transform="translate({x:.1f},{y:.1f})">'
              f'<path d="M0,0 C-4,-8 -{r},-{r*0.9:.1f} -{r},-{r*1.6:.1f} A{r},{r} 0 1 1 {r},-{r*1.6:.1f} C{r},-{r*0.9:.1f} 4,-8 0,0 Z" '
              f'fill="{color}" stroke="#fff" stroke-width="2.5"/></g>')
        by = y - r * 1.6
        bx = x
    fs = size * (1.05 if len(label) == 1 else 0.85)
    g += (f'<text x="{bx:.1f}" y="{by + fs*0.36:.1f}" text-anchor="middle" font-family="Inter" font-weight="800" '
          f'font-size="{fs:.1f}" fill="{text}">{label}</text>')
    return g


def label(p, lat, lon, txt, dx=0, dy=0, anchor="start", size=13, weight=700, color=INK, italic=False, halo="#FBF4E8", ls=0):
    x, y = p(lat, lon)
    st = ' font-style="italic"' if italic else ""
    return (f'<text x="{x+dx:.1f}" y="{y+dy:.1f}" text-anchor="{anchor}" font-family="Inter" font-size="{size}" '
            f'font-weight="{weight}" fill="{color}"{st} letter-spacing="{ls}" stroke="{halo}" stroke-width="4" '
            f'stroke-linejoin="round" paint-order="stroke">{txt}</text>')


def line(p, pts, color, w=5, dash="", op=1, cap="round"):
    return (f'<path d="{p.smooth(pts)}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="{cap}" '
            f'stroke-linejoin="round" stroke-dasharray="{dash}" opacity="{op}"/>')


def stations(p, pts, color, r=4.5):
    return "".join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="#fff" stroke="{color}" stroke-width="2.5"/>'
                   for x, y in (p(a, b) for a, b in pts))


def compass(x, y, s=1):
    return f"""<g transform="translate({x},{y}) scale({s})">
  <circle r="34" fill="#fff" fill-opacity=".9" stroke="{INK}" stroke-opacity=".15"/>
  <circle r="26" fill="none" stroke="{INK}" stroke-opacity=".2" stroke-dasharray="1 3"/>
  <path d="M0,-28 L7,0 L0,6 L-7,0 Z" fill="{CORAL}"/><path d="M0,28 L7,0 L0,-6 L-7,0 Z" fill="{INK}" opacity=".8"/>
  <text y="-37" text-anchor="middle" font-family="Inter" font-weight="800" font-size="12" fill="{INK}">N</text>
</g>"""


def scalebar(p, x, y, meters, txt):
    L = meters * p.px_per_m()
    return f"""<g transform="translate({x},{y})" font-family="Inter" font-size="11" font-weight="700" fill="{INK}">
  <rect x="-10" y="-22" width="{L+20:.0f}" height="38" rx="10" fill="#fff" fill-opacity=".9"/>
  <rect width="{L/2:.1f}" height="6" fill="{INK}"/><rect x="{L/2:.1f}" width="{L/2:.1f}" height="6" fill="#fff" stroke="{INK}"/>
  <text y="-8">0</text><text x="{L:.1f}" y="-8" text-anchor="end">{txt}</text>
</g>"""


# ───────────────────────── MAPA 1 · CENTRO ─────────────────────────
def map_center():
    p = Proj(7.2525, 7.2905, 43.6905, 43.7145)
    u = "c"
    s = [f'<svg viewBox="0 0 {p.w:.0f} {p.h:.0f}" xmlns="http://www.w3.org/2000/svg" class="map">', defs(u)]
    s.append(f'<rect width="100%" height="100%" fill="{LAND}"/><rect width="100%" height="100%" fill="url(#dots{u})"/>')
    # colinas / parques
    s.append(f'<ellipse cx="{p(43.7175,7.2735)[0]:.0f}" cy="{p(43.7175,7.2735)[1]:.0f}" rx="170" ry="70" fill="{OLIVE}" opacity=".10"/>')
    # Vieux Nice
    vn = [(43.6950,7.2722),(43.6964,7.2732),(43.6986,7.2762),(43.7004,7.2797),(43.6992,7.2806),(43.6968,7.2798),(43.6947,7.2792),(43.6946,7.2750)]
    s.append(f'<path d="{p.path(vn, True)}" fill="{OCHRE}" opacity=".22" stroke="{OCHRE}" stroke-width="2" stroke-dasharray="4 4"/>')
    # Colina del castillo
    cx, cy = p(43.6950, 7.2812)
    s.append(f'<ellipse cx="{cx:.0f}" cy="{cy:.0f}" rx="58" ry="34" fill="{OLIVE}" opacity=".35"/>')
    s.append(f'<ellipse cx="{cx:.0f}" cy="{cy:.0f}" rx="38" ry="20" fill="{OLIVE}" opacity=".25"/>')
    # Promenade du Paillon
    s.append(line(p, [(43.6950,7.2700),(43.6974,7.2722),(43.6995,7.2747),(43.7013,7.2774),(43.7025,7.2800)], "#7DB55A", w=26, op=.55))
    s.append(f'<text x="712" y="418" text-anchor="end" font-family="Inter" font-size="10.5" font-weight="700" font-style="italic" fill="#3F6B22" stroke="#FBF4E8" stroke-width="4" paint-order="stroke">Promenade du Paillon</text>')
    # Calles principales
    for pts in [
        [(43.6982,7.2702),(43.7015,7.2672),(43.7048,7.2641),(43.7120,7.2600)],          # Jean Médecin
        [(43.6900,7.2475),(43.6915,7.2510),(43.6930,7.2570),(43.6942,7.2640),(43.6948,7.2700),(43.6949,7.2750),(43.6944,7.2790)],  # Promenade
        [(43.6955,7.2560),(43.7120,7.2565)],  # Gambetta
        [(43.7046,7.2640),(43.7050,7.2750),(43.7040,7.2850)],
        [(43.6995,7.2855),(43.7080,7.2830),(43.7150,7.2810)],  # Bd Carabacel-ish
    ]:
        s.append(line(p, pts, "#fff", w=9)); s.append(line(p, pts, "#E9DCC6", w=1.2))
    # Mar
    s.append(f'<path d="{sea_path(p)}" fill="url(#sea{u})"/><path d="{sea_path(p)}" fill="url(#waves{u})"/>')
    s.append(coast_rings(p, u))
    s.append(f'<path d="{p.smooth(COAST)}" fill="none" stroke="#fff" stroke-width="3"/>')
    s.append(f'<text x="150" y="{p.h-62:.0f}" font-family="Fraunces" font-style="italic" font-size="44" fill="#fff" opacity=".85">Baie des Anges</text>')
    s.append(f'<text x="152" y="{p.h-37:.0f}" font-family="Inter" font-size="11" letter-spacing="4" font-weight="700" fill="#fff" opacity=".7">MAR MEDITERRÁNEO</text>')
    s.append(label(p, 43.6936, 7.2600, "PROMENADE DES ANGLAIS", size=10, weight=800, color="#fff", halo=SEA2, ls=2.5, dx=-80, dy=18))
    # Tranvías
    T2 = [(43.6915,7.2470),(43.6950,7.2530),(43.6995,7.2605),(43.7005,7.2665),(43.7010,7.2735),(43.7008,7.2808),(43.6990,7.2858)]
    T1 = [(43.7150,7.2610),(43.7130,7.2617),(43.7046,7.2640),(43.7005,7.2680),(43.6980,7.2705),(43.6985,7.2735),(43.6993,7.2775),(43.7005,7.2808),(43.7045,7.2850),(43.7080,7.2885),(43.7100,7.2925)]
    s.append(line(p, T1, "#fff", w=11)); s.append(line(p, T1, CORAL, w=6))
    s.append(line(p, T2, "#fff", w=11)); s.append(line(p, T2, "#0FA3B1", w=6))
    s.append(stations(p, [T2[1], T2[2], T2[3], T2[4], T2[5], T2[6]], "#0FA3B1"))
    s.append(stations(p, [T1[1], T1[2], T1[4], T1[5], T1[6], T1[7]], CORAL))
    s.append(label(p, 43.6995, 7.2605, "Alsace-Lorraine", size=10, weight=600, dx=-6, dy=-10, anchor="end"))
    s.append(label(p, 43.7005, 7.2665, "Jean Médecin", size=10, weight=600, dx=-10, dy=-10, anchor="end"))
    s.append(label(p, 43.7010, 7.2735, "Durandy", size=10, weight=600, dx=-2, dy=-11, anchor="middle"))
    s.append(label(p, 43.6990, 7.2858, "Port Lympia", size=10, weight=600, dx=-2, dy=-12, anchor="middle"))
    s.append(label(p, 43.7130, 7.2617, "Libération", size=10, weight=600, dx=-10, dy=4, anchor="end"))
    s.append(f'<text x="14" y="640" font-family="Inter" font-size="10.5" font-weight="800" fill="#0A7C87" stroke="#FBF4E8" stroke-width="4" paint-order="stroke">← Aeropuerto · T2 · 30 min</text>')
    # Bus 5 a Cimiez
    B5 = [(43.6995,7.2695),(43.7060,7.2700),(43.7092,7.2693),(43.7150,7.2725)]
    s.append(line(p, B5, "#7C4DFF", w=4, dash="2 7"))
    s.append(label(p, 43.7135, 7.2722, "↑ Bus 5 · Musée Matisse &amp; Arènes de Cimiez (1,2 km)", size=10.5, weight=800, color="#5B2FD6", dx=10, dy=-6))
    # Nombres de barrios
    for la, lo, t in [(43.7080,7.2585,"QUARTIER DES MUSICIENS"),(43.7115,7.2690,"CIMIEZ"),(43.7015,7.2875,"LE PORT"),(43.7075,7.2775,"CARABACEL"),(43.6985,7.2600,"CARRÉ D'OR")]:
        s.append(label(p, la, lo, t, size=9.5, weight=800, color="#9A8C77", ls=2.5, anchor="middle"))

    # Lugares (azul)
    POI = [
        ("A",43.6977,7.2706,None),("B",43.6947,7.2577,None),("C",43.6955,7.2754,None),("D",43.6973,7.2760,None),
        ("E",43.6982,7.2778,None),("F",43.6952,7.2808,None),("G",43.6936,7.2833,None),("H",43.6985,7.2838,None),
        ("I",43.7008,7.2806,None),("J",43.6990,7.2730,None),("K",43.7092,7.2693,None),("M",43.7038,7.2532,(70,330)),
        ("N",43.7046,7.2617,None),("O",43.7124,7.2628,None),
    ]
    def put(l, la, lo, at, col, size):
        if at:
            x, y = p(la, lo); s.append(pin(p, la, lo, l, col, at[0]-x, at[1]-y, size=size))
        else:
            s.append(pin(p, la, lo, l, col, size=size))
    for l, la, lo, at in POI:
        put(l, la, lo, at, SEA1, 15)
    FOOD = [
        ("1",43.6956,7.2767,(642,782)),("2",43.6983,7.2768,(626,512)),("3",43.6974,7.2764,(704,556)),("4",43.7016,7.2856,None),
        ("5",43.7010,7.2813,(806,446)),("6",43.6966,7.2746,(584,782)),("7",43.6960,7.2733,(470,782)),("8",43.6964,7.2738,(527,782)),
    ]
    for l, la, lo, at in FOOD:
        put(l, la, lo, at, CORAL, 13)
    s.append(f'<text x="672" y="672" text-anchor="middle" font-family="Inter" font-size="12" font-weight="900" fill="#B9741A" letter-spacing="3" font-style="italic" stroke="#FBF4E8" stroke-width="4" paint-order="stroke">VIEUX NICE</text>')
    s.append(f'<text x="470" y="{p.h-14:.0f}" font-family="Inter" font-size="9.5" font-weight="800" fill="#fff" letter-spacing="1.5" opacity=".9">↑ DÓNDE COMER EN EL VIEUX NICE</text>')
    s.append(compass(p.w - 56, 64))
    s.append(scalebar(p, p.w - 200, p.h - 34, 500, "500 m · 6 min a pie"))
    s.append("</svg>")
    return "".join(s)


# ───────────────────────── MAPA 2 · RIVIERA ─────────────────────────
def map_riviera():
    p = Proj(7.195, 7.445, 43.6430, 43.7600)
    u = "r"
    s = [f'<svg viewBox="0 0 {p.w:.0f} {p.h:.0f}" xmlns="http://www.w3.org/2000/svg" class="map">', defs(u)]
    s.append(f'<rect width="100%" height="100%" fill="{LAND}"/><rect width="100%" height="100%" fill="url(#dots{u})"/>')
    # relieve
    for la, lo, rx, ry, op in [(43.735,7.300,180,70,.10),(43.745,7.370,150,60,.12),(43.728,7.330,90,40,.10),(43.722,7.250,170,55,.07)]:
        x, y = p(la, lo)
        s.append(f'<ellipse cx="{x:.0f}" cy="{y:.0f}" rx="{rx}" ry="{ry}" fill="{OLIVE}" opacity="{op}"/>')
    # ciudad de Niza
    x, y = p(43.703, 7.262)
    s.append(f'<ellipse cx="{x:.0f}" cy="{y:.0f}" rx="120" ry="50" fill="{OCHRE}" opacity=".18"/>')
    # Var
    s.append(line(p, [(43.760,7.190),(43.720,7.196),(43.690,7.199),(43.660,7.200),(43.651,7.200)], "#9FD3F5", w=6))
    s.append(label(p, 43.735, 7.196, "Var", size=11, italic=True, color="#3B8AC4", dx=8))
    s.append(f'<path d="{sea_path(p)}" fill="url(#sea{u})"/><path d="{sea_path(p)}" fill="url(#waves{u})"/>')
    s.append(coast_rings(p, u))
    s.append(f'<path d="{p.smooth(COAST)}" fill="none" stroke="#fff" stroke-width="2.5"/>')
    s.append(f'<text x="640" y="{p.h-46:.0f}" font-family="Fraunces" font-style="italic" font-size="52" fill="#fff" opacity=".85">Côte d\'Azur</text>')
    s.append(f'<text x="642" y="{p.h-22:.0f}" font-family="Inter" font-size="11" letter-spacing="4" font-weight="700" fill="#fff" opacity=".7">MAR MEDITERRÁNEO</text>')
    # Tren
    TR = [(43.7046,7.2617),(43.7055,7.2920),(43.7050,7.3040),(43.7045,7.3100),(43.7080,7.3310),(43.7135,7.3480),(43.7170,7.3600),(43.7200,7.3850),(43.7235,7.4040),(43.7330,7.4150),(43.7390,7.4200)]
    s.append(line(p, TR, INK, w=7)); s.append(line(p, TR, "#fff", w=3, dash="10 8", cap="butt"))
    s.append(stations(p, [TR[0], TR[3], TR[4], TR[6], TR[8], TR[10]], INK, r=5.5))
    # Bus 82 Èze
    B82 = [(43.7020,7.2860),(43.7120,7.2950),(43.7180,7.3100),(43.7230,7.3300),(43.7265,7.3500),(43.7277,7.3615)]
    s.append(line(p, B82, "#fff", w=10)); s.append(line(p, B82, SUN, w=5))
    # Sentier Nietzsche
    NZ = [(43.7277,7.3615),(43.7240,7.3625),(43.7215,7.3600),(43.7190,7.3615),(43.7170,7.3600)]
    s.append(line(p, NZ, "#2E7D32", w=4, dash="1 7"))
    # T2
    T2 = [(43.6584,7.2159),(43.6640,7.2260),(43.6800,7.2400),(43.6900,7.2500),(43.6995,7.2605),(43.7008,7.2808),(43.6990,7.2858)]
    s.append(line(p, T2, "#fff", w=10)); s.append(line(p, T2, "#0FA3B1", w=5))
    # Bus 100 costa (alternativa)
    B100 = [(43.6990,7.2870),(43.6920,7.2960),(43.6930,7.3060),(43.7010,7.3125),(43.7060,7.3330),(43.7105,7.3470),(43.7150,7.3620),(43.7145,7.3780),(43.7190,7.3970),(43.7250,7.4130),(43.7330,7.4215)]
    s.append(line(p, B100, "#7C4DFF", w=3, dash="2 6", op=.9))
    # Pines
    PR = [("✈",43.6584,7.2159,"#0FA3B1"),("NI",43.7000,7.2700,SEA1),("VF",43.7045,7.3110,SEA1),("ÈZ",43.7277,7.3615,SUN),("MC",43.7395,7.4230,CORAL)]
    for l, la, lo, c in PR:
        s.append(pin(p, la, lo, l, c, size=17))
    s.append(label(p, 43.6584, 7.2159, "Aeropuerto Nice Côte d'Azur", dx=26, dy=-14, size=13, weight=800))
    s.append(label(p, 43.6584, 7.2159, "Llegas vie 22:00 · sales lun 12:00", dx=26, dy=2, size=10.5, weight=600, color="#4A5568"))
    s.append(label(p, 43.7000, 7.2700, "NIZA", dx=-26, dy=-26, size=20, weight=900, anchor="end", ls=3))
    s.append(label(p, 43.7045, 7.3110, "Villefranche-sur-Mer", dx=-6, dy=-36, size=12, weight=800, anchor="middle"))
    s.append(label(p, 43.7277, 7.3615, "Èze Village · 429 m", dx=0, dy=-40, size=13, weight=800, anchor="middle"))
    s.append(label(p, 43.7170, 7.3600, "Èze-sur-Mer", dx=10, dy=18, size=10.5, weight=700))
    s.append(label(p, 43.7395, 7.4230, "MONACO", dx=-22, dy=-30, size=16, weight=900, anchor="end", ls=2))
    s.append(label(p, 43.6820, 7.3300, "Cap Ferrat", dx=0, dy=30, size=11, weight=700, italic=True, anchor="middle", color="#fff", halo=SEA2))
    s.append(label(p, 43.6890, 7.3010, "Mont Boron", dx=0, dy=-14, size=10, weight=700, italic=True, anchor="middle", color="#5E6B4E"))
    s.append(label(p, 43.7225, 7.3640, "Sentier Nietzsche ↓ 1 h", dx=8, dy=4, size=10.5, weight=800, color="#2E7D32"))
    s.append(label(p, 43.7135, 7.3480, "Beaulieu", dx=0, dy=22, size=10, weight=600, anchor="middle"))
    s.append(label(p, 43.7235, 7.4040, "Cap d'Ail", dx=0, dy=-12, size=10, weight=600, anchor="middle"))
    s.append(label(p, 43.7180, 7.3150, "Bus 82 · Moyenne Corniche", dx=-50, dy=-22, size=10.5, weight=800, color="#D2541C"))
    s.append(label(p, 43.6800, 7.2380, "T2 · 30 min", dx=10, dy=0, size=10.5, weight=800, color="#0A7C87"))
    s.append(label(p, 43.7090, 7.2800, "Tren TER", dx=0, dy=-10, size=10.5, weight=800, color=INK, anchor="middle"))
    s.append(compass(p.w - 52, 60, .9))
    s.append(scalebar(p, p.w - 190, 40, 2000, "2 km"))
    s.append("</svg>")
    return "".join(s)


# ───────────────────────── CONTENIDO ─────────────────────────
POI_LEG = [
 ("A","Place Masséna","Damero rojo-ocre 1840s · 7 figuras de Jaume Plensa"),
 ("B","Promenade des Anglais · Negresco","7 km de paseo · hotel de cúpula rosa (1913)"),
 ("C","Cours Saleya","Mercado de flores y frutas (mar–dom)"),
 ("D","Cathédrale Sainte-Réparate","Barroco nissart del s. XVII"),
 ("E","Palais Lascaris","Palacio aristocrático genovés, 1648"),
 ("F","Colline du Château","Ascensor gratuito · cascada · mejores vistas"),
 ("G","Rauba Capeù · «I ♥ Nice»","Mirador sobre la Baie des Anges"),
 ("H","Port Lympia","Puerto del s. XVIII, casas ocres"),
 ("I","Place Garibaldi","Plaza saboyana porticada"),
 ("J","Miroir d'eau","Espejo de agua del Paillon"),
 ("K","Musée Chagall","Mensaje Bíblico · bus 5"),
 ("M","Catedral ortodoxa rusa","San Nicolás, 1912"),
 ("N","Gare Nice-Ville","Trenes a Èze-sur-Mer y Mónaco"),
 ("O","Marché de la Libération","Mercado de barrio auténtico"),
]
FOOD_LEG = [
 ("1","Chez Thérésa","socca en el mercado","€"),
 ("2","Lou Pilha Leva","socca · pissaladière · farcis","€"),
 ("3","Fenocchio","helados desde 1966","€"),
 ("4","Chez Pipo","la socca de leña desde 1923","€"),
 ("5","Café de Turin","ostras y marisco desde 1908","€€€"),
 ("6","Le Bistrot d'Antoine","bistró nissart moderno","€€"),
 ("7","La Merenda","mítico, sin teléfono, efectivo","€€€"),
 ("8","Maison Auer","confitería de 1820","€"),
]

HISTORY = [
 ("350 a.C.","Nikaia","Griegos de Massalia fundan un puerto bajo la colina y lo llaman «Victoria»."),
 ("s. I","Cemenelum","Roma levanta su capital alpina en Cimiez: aún quedan las arenas y termas."),
 ("1388","Saboya","La «Dédition»: Niza se entrega a la Casa de Saboya. Será saboyana casi 500 años."),
 ("1706","El castillo cae","Luis XIV arrasa la fortaleza. Hoy la colina es un jardín sin castillo."),
 ("1807","Garibaldi","Nace en el puerto el héroe de la unificación italiana."),
 ("1822","Los ingleses","Aristócratas británicos pagan un camino junto al mar: la Promenade des Anglais."),
 ("1860","Francia","Tratado de Turín: Niza pasa a Francia tras un plebiscito."),
 ("1917","Matisse","Llega «por una semana» y se queda hasta su muerte en 1954."),
 ("2021","UNESCO","Patrimonio Mundial como ciudad de veraneo de invierno de la Riviera."),
]


def chip(t, kind="t2"):
    return f'<span class="chip {kind}">{t}</span>'


def badge(l, food=False):
    return f'<span class="badge {"food" if food else ""}">{l}</span>'


def step(time, title, body, refs="", tags="", star=False, tipo=""):
    return f"""<div class="step{' star' if star else ''}">
  <div class="time">{time}</div>
  <div class="dot"></div>
  <div class="card"><div class="ct">{refs}<h4>{title}</h4></div><p>{body}</p><div class="tags">{tags}</div></div>
</div>"""


def page(content, cls="", n=None):
    foot = f'<div class="folio"><span>NICE · NIKAIA · 2026</span><span>{n:02d}</span></div>' if n else ""
    return f'<section class="page {cls}">{content}{foot}</section>'


# ── páginas ──
def p_cover():
    return page(f"""
<div class="cv-sky"></div>
<div class="cv-sun"></div>
<div class="cv-sea">
  <svg viewBox="0 0 800 300" preserveAspectRatio="none"><defs><linearGradient id="cvs" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#2F7DE1"/><stop offset="1" stop-color="#0A2E6E"/></linearGradient></defs>
  <path d="M0 40 Q200 0 400 30 T800 20 V300 H0Z" fill="url(#cvs)"/>
  {''.join(f'<path d="M{-40+i*7} {70+i*26} Q{180} {50+i*26} {400} {72+i*26} T{840} {64+i*26}" stroke="#fff" stroke-opacity="{.35-i*.04:.2f}" fill="none" stroke-width="1.4"/>' for i in range(8))}
  </svg>
</div>
<div class="cv-chairs">{''.join(f'<div class="chair" style="left:{x}%;transform:scale({s})"></div>' for x,s in [(12,1),(22,.8),(78,.9)])}</div>
<div class="cv-top"><span>GUÍA HISTÓRICA PRIVADA</span><span>EDICIÓN Nº 01 · PARA DOS</span></div>
<div class="cv-title">
  <div class="kicker">Côte d'Azur · Alpes-Maritimes</div>
  <h1>Ni<em>z</em>a</h1>
  <div class="dates"><b>20</b><i>→</i><b>23</b><span>NOVIEMBRE<br>2026</span></div>
  <p class="lead">Tres noches entre la Baie des Anges, las callejuelas saboyanas del Vieux Nice y los pueblos colgados de la Riviera. Todo a pie, en tranvía o en bus de 1,70 €.</p>
</div>
<div class="cv-stats">
  <div><b>62</b><span>horas en la Riviera</span></div>
  <div><b>450 €</b><span>presupuesto para dos</span></div>
  <div><b>22</b><span>lugares en el mapa</span></div>
  <div><b>2 400</b><span>años de historia</span></div>
</div>
""", "cover")


def p_overview():
    days = [
        ("VIE", "20", "Llegada", "Aterrizaje 22:00 · tranvía T2 · primer paseo nocturno", "#0FA3B1"),
        ("SÁB", "21", "La Riviera", "Èze Village · Sentier Nietzsche · Mónaco", SUN),
        ("DOM", "22", "Nikaia", "Mercado · Vieux Nice · Castillo · Puerto · Cimiez", CORAL),
        ("LUN", "23", "Au revoir", "Amanecer en la Promenade · vuelo 12:00", "#7C4DFF"),
    ]
    d = "".join(f"""<div class="day" style="--c:{c}"><div class="dn"><span>{a}</span><b>{b}</b></div>
<h3>{t}</h3><p>{x}</p></div>""" for a, b, t, x, c in days)
    h = "".join(f"""<li><span class="y">{y}</span><div><b>{t}</b><p>{x}</p></div></li>""" for y, t, x in HISTORY)
    return page(f"""
<header class="ph"><span class="eyebrow">00 · El viaje de un vistazo</span><h2>Cuatro días,<br><em>veinticuatro siglos.</em></h2></header>
<div class="days">{d}</div>
<div class="ov-grid">
  <div class="hist"><h5>Breve historia de Niza</h5><ul class="tl">{h}</ul></div>
  <div class="side">
    <div class="wx"><h5>Noviembre en Niza</h5>
      <div class="wxrow"><div><b>16°</b><span>máx.</span></div><div><b>9°</b><span>mín.</span></div><div><b>16:55</b><span>atardecer</span></div><div><b>07:35</b><span>amanecer</span></div></div>
      <p>Días suaves y luminosos, noches frescas. Lleva capas, chaqueta ligera y calzado cómodo para cuestas y escaleras. Puede llover: hay un <b>plan B</b> en la pág. 08.</p>
    </div>
    <div class="note"><h5>Cómo leer esta guía</h5>
      <p>{badge('A')} Letras azules = lugares del centro.</p>
      <p>{badge('MC')} Siglas = pueblos del mapa de la Riviera.</p>
      <p>{badge('1',True)} Números coral = dónde comer.</p>
      <p>{chip('T2')} {chip('T1','t1')} {chip('Bus 82','b82')} {chip('Tren','tr')} = transporte.</p>
      <p>Cada parada del itinerario lleva su marca del mapa. Busca la letra y llegarás.</p>
    </div>
    <div class="note dark"><h5>Lo esencial en el móvil</h5>
      <p><b>App Lignes d'Azur</b> · billetes de bus y tranvía.<br><b>App SNCF Connect</b> · trenes TER de la costa.<br><b>Emergencias</b> · 112.</p>
    </div>
  </div>
</div>
<div class="must"><h5>Los cinco imprescindibles</h5><div class="mg">
  <div><b>01</b><span>Socca caliente en el Cours Saleya</span></div>
  <div><b>02</b><span>La Baie des Anges desde la Colline du Château</span></div>
  <div><b>03</b><span>El Sentier Nietzsche de Èze al mar</span></div>
  <div><b>04</b><span>Atardecer en las sillas azules de la Promenade</span></div>
  <div><b>05</b><span>Un helado imposible en Fenocchio</span></div>
</div></div>""", "overview", 2)


def p_map_center():
    leg1 = "".join(f'<li>{badge(l)}<div><b>{t}</b><small>{x}</small></div></li>' for l, t, x in POI_LEG)
    leg2 = "".join(f'<li>{badge(l,True)}<div><b>{t} <i>{pr}</i></b><small>{x}</small></div></li>' for l, t, x, pr in FOOD_LEG)
    return page(f"""
<header class="ph slim"><span class="eyebrow">01 · Mapa del centro</span><h2>Niza <em>a pie.</em></h2>
<p class="sub">Del Negresco al puerto hay 35 minutos andando. Casi todo está en este rectángulo.</p></header>
<div class="mapbox">{map_center()}</div>
<div class="legend">
  <div><h6>Lugares</h6><ul class="lg">{leg1}</ul></div>
  <div><h6>Comer</h6><ul class="lg">{leg2}</ul>
  <h6 class="mt">Líneas</h6>
  <ul class="ln">
    <li><i style="background:#0FA3B1"></i><b>Tranvía T2</b> Aeropuerto ↔ Port Lympia</li>
    <li><i style="background:{CORAL}"></i><b>Tranvía T1</b> Libération ↔ Vieux Nice</li>
    <li><i class="dash" style="--c:#7C4DFF"></i><b>Bus 5</b> hacia Chagall y Matisse</li>
  </ul></div>
</div>""", "mappage", 3)


def p_map_riviera():
    return page(f"""
<header class="ph slim"><span class="eyebrow">02 · Mapa de la Riviera</span><h2>Del aeropuerto <em>a Mónaco.</em></h2>
<p class="sub">Todo el transporte que necesitas: un tranvía, un bus y un tren.</p></header>
<div class="mapbox">{map_riviera()}</div>
<div class="tp">
  <div class="tpc" style="--c:#0FA3B1"><div class="tph">{chip('T2')}<b>Aeropuerto ↔ Centro</b></div>
    <p>Para en las dos terminales. ~30 min hasta Jean Médecin. Billete en la máquina de la parada (tarjeta) y <b>valídalo</b> al subir.</p><div class="pr">1,70 € p.p.</div></div>
  <div class="tpc" style="--c:{SUN}"><div class="tph">{chip('Bus 82','b82')}<b>Niza ↔ Èze Village</b></div>
    <p>Sale de la parada <b>Vauban</b> (cerca del tranvía Garibaldi). 30–40 min por la Moyenne Corniche. Siéntate a la derecha: vistas al mar.</p><div class="pr">1,70 € p.p.</div></div>
  <div class="tpc" style="--c:{INK}"><div class="tph">{chip('Tren TER','tr')}<b>Èze-sur-Mer · Mónaco · Niza</b></div>
    <p>Trenes cada 15–30 min por la costa. Èze-sur-Mer → Mónaco 7 min; Mónaco → Niza-Ville 20 min. Compra en la app SNCF Connect o en máquina.</p><div class="pr">≈ 2–5 € p.p.</div></div>
  <div class="tpc" style="--c:#7C4DFF"><div class="tph">{chip('Bus 100','b100')}<b>Plan B por la costa</b></div>
    <p>Port Lympia → Villefranche → Èze-sur-Mer → Mónaco por la Basse Corniche. Más lento (≈ 45 min) pero muy panorámico.</p><div class="pr">1,70 € p.p.</div></div>
</div>
<div class="route"><h6>La ruta del sábado, paso a paso</h6><div class="rt">
  <div class="rs" style="--c:{SEA1}"><b>Niza</b><span>Vauban · 09:15</span></div><div class="ra" style="--c:{SUN}"><i>Bus 82</i><span>35 min</span></div>
  <div class="rs" style="--c:{SUN}"><b>Èze Village</b><span>429 m</span></div><div class="ra" style="--c:#2E7D32"><i>A pie</i><span>1 h ↓</span></div>
  <div class="rs" style="--c:#2E7D32"><b>Èze-sur-Mer</b><span>estación</span></div><div class="ra" style="--c:{INK}"><i>Tren</i><span>7 min</span></div>
  <div class="rs" style="--c:{CORAL}"><b>Mónaco</b><span>13:30–18:00</span></div><div class="ra" style="--c:{INK}"><i>Tren</i><span>20 min</span></div>
  <div class="rs" style="--c:{SEA1}"><b>Niza</b><span>18:30</span></div></div></div>
<div class="taxi"><b>¿Llegas muy tarde o con mucho cansancio?</b> Taxi oficial aeropuerto → centro de Niza con tarifa fija ≈ 32–35 €. El tranvía funciona hasta pasada la medianoche.</div>
""", "mappage", 4)


def day_header(num, wd, date, title, sub, color):
    return f"""<header class="dh" style="--c:{color}">
  <div class="dhn"><span>{wd}</span><b>{date}</b><span>NOV</span></div>
  <div><span class="eyebrow">Día {num}</span><h2>{title}</h2><p class="sub">{sub}</p></div>
</header>"""


def p_day1_2():
    d1 = "".join([
        step("22:00", "Aterrizaje en Nice Côte d'Azur", "Sal por la terminal y busca el tranvía <b>T2</b> justo enfrente. Si tenéis cena pendiente, compra algo en el aeropuerto: en Niza las cocinas cierran pronto.", chip("T2"), chip("1,70 € p.p.", "eur")),
        step("22:45", "Tranvía al centro y check-in", "Bájate en <b>Jean Médecin</b> o <b>Alsace-Lorraine</b> según tu hotel (≈ 30 min).", chip("T2"), chip("30 min", "min")),
        step("23:30", "Primer paseo: Masséna de noche", "Las siete figuras de <b>Jaume Plensa</b> —un artista catalán— se iluminan sobre columnas y cambian de color. Representan los siete continentes «conversando». Bajad a la Promenade y escuchad el mar sobre los guijarros.", badge("A") + badge("B"), chip("gratis", "eur"), star=True),
    ])
    d2 = "".join([
        step("08:30", "Petit-déjeuner de boulangerie", "Croissant, pain au chocolat y café en la barra. Pide <i>«un café crème»</i> si lo quieres con leche.", "", chip("≈ 14 € los dos", "eur")),
        step("09:15", "Bus 82 a Èze Village", "Desde la parada <b>Vauban</b>. El bus serpentea por la Moyenne Corniche, la carretera de las películas de Hitchcock y Grace Kelly.", chip("Bus 82", "b82"), chip("1,70 € p.p.", "eur") + chip("35 min", "min")),
        step("10:00", "Èze, el nido de águila", "Pueblo medieval colgado a <b>429 m</b> sobre el mar. Callejones de piedra, sin coches. Arriba, el <b>Jardin Exotique</b> sobre las ruinas del castillo: cactus, esculturas de diosas y la vista más alta de la Riviera.", badge("ÈZ"), chip("jardín ≈ 8 € p.p.", "eur"), star=True),
        step("12:00", "Bajada por el Sentier Nietzsche", "El filósofo pensó aquí parte de <i>Así habló Zaratustra</i>. Sendero de 1 h cuesta abajo entre olivos y pinos hasta Èze-sur-Mer. Calzado con suela. Si llueve, bus 82 de vuelta y tren.", "", chip("gratis", "eur") + chip("1 h", "min")),
        step("13:15", "Tren a Mónaco", "Desde la estación de Èze-sur-Mer, 7 minutos.", chip("Tren", "tr"), chip("≈ 2,50 € p.p.", "eur")),
        step("13:30", "Comida en el Marché de la Condamine", "Mercado cubierto con puestos de pasta fresca, barbajuans (empanadillas monegascas) y socca. El sitio barato de Mónaco.", badge("MC"), chip("≈ 35 € los dos", "eur")),
        step("14:30", "Le Rocher", "La roca de los Grimaldi. En 1297 François Grimaldi entró disfrazado de monje y tomó la fortaleza: por eso los monjes armados del escudo. Palacio del Príncipe, catedral con la <b>tumba de Grace Kelly</b>, jardines de Saint-Martin.", badge("MC"), chip("gratis por fuera", "eur")),
        step("16:30", "Casino de Monte-Carlo al atardecer", "Garnier, el arquitecto de la Ópera de París, en 1878. Ferraris en la puerta y luz dorada sobre el puerto.", "", chip("gratis por fuera", "eur")),
        step("18:00", "Tren de vuelta a Niza", "20 min hasta Nice-Ville.", chip("Tren", "tr"), chip("≈ 4,50 € p.p.", "eur")),
        step("20:00", "Cena especial", "<b>Le Bistrot d'Antoine</b> {6} (reserva) o <b>La Merenda</b> {7}, mítica, sin teléfono: pásate a reservar en persona y lleva efectivo. Pide <i>petits farcis</i> y <i>daube</i>.".replace("{6}", badge("6", True)).replace("{7}", badge("7", True)), "", chip("≈ 80 € los dos", "eur"), star=True),
    ])
    return page(f"""
<div class="cols2">
  <div>{day_header(1, "VIE", "20", "Llegada <em>nocturna</em>", "Brisa de mar y luces de Masséna.", "#0FA3B1")}<div class="steps">{d1}</div>
  <div class="story"><span>Sabías que…</span><p>La Promenade nació en 1822, cuando la colonia inglesa que pasaba aquí el invierno pagó a jornaleros sin trabajo para abrir un camino junto al mar. Los niçois lo bautizaron «el camino de los ingleses».</p></div>
  <div class="story alt"><span>Truco de llegada</span><p>Haz una foto al plano del tranvía en la parada y guarda la dirección del hotel escrita. A esa hora quedan pocos taxis libres en el centro.</p></div>
  <div class="mcfacts"><h5>Mónaco en cifras</h5><div><b>2 km²</b><span>segundo país más pequeño del mundo</span></div><div><b>1297</b><span>los Grimaldi reinan desde entonces</span></div><div><b>1956</b><span>Grace Kelly se casa con Rainiero III</span></div><div><b>0 €</b><span>pasear por el Rocher y el puerto</span></div></div>
  </div>
  <div>{day_header(2, "SÁB", "21", "La <em>Riviera</em>", "Pueblo colgado, sendero filosófico y un principado.", SUN)}<div class="steps">{d2}</div></div>
</div>""", "daypage", 5)


def p_day3():
    d3 = "".join([
        step("08:30", "Desayuno con mercado", "El <b>Cours Saleya</b> se llena de flores, cítricos y aceitunas. Desayunad allí: socca recién salida del horno en <b>Chez Thérésa</b>.", badge("C") + badge("1", True), chip("≈ 15 € los dos", "eur"), star=True),
        step("10:00", "Vieux Nice", "Laberinto de casas ocres que parece Génova, no Francia. La <b>Cathédrale Sainte-Réparate</b>, barroco del s. XVII, y el <b>Palais Lascaris</b>, palacio de 1648 con una colección de instrumentos antiguos.", badge("D") + badge("E"), chip("Lascaris ≈ 10 € p.p.", "eur")),
        step("11:30", "Colline du Château", "Sube en el <b>ascensor gratuito</b> junto a la Tour Bellanda (o por las escaleras). Del castillo que voló Luis XIV quedan ruinas, una cascada romántica del s. XIX y la mejor vista de la Baie des Anges.", badge("F"), chip("gratis", "eur"), star=True),
        step("13:00", "Comida nissarde", "<b>Lou Pilha Leva</b>: mesas compartidas, socca, pissaladière, petits farcis y beignets de courgette. Postre: helado de <b>Fenocchio</b> (prueba tomate-albahaca o violeta).", badge("2", True) + badge("3", True), chip("≈ 35 € los dos", "eur")),
        step("14:30", "Rauba Capeù y el puerto", "«Roba sombreros», por el viento. El mirador del «I ♥ Nice» y, al girar la esquina, <b>Port Lympia</b> con sus fachadas ocres y yates. Garibaldi nació aquí.", badge("G") + badge("H"), chip("gratis", "eur")),
        step("15:30", "Opción A · Cimiez romano + Matisse", "Bus 5 hasta las <b>Arènes de Cimiez</b>: anfiteatro de Cemenelum, olivar centenario, el <b>Musée Matisse</b> y su tumba en el cementerio del monasterio.", chip("Bus 5", "b5") + badge("K"), chip("Matisse ≈ 10 € p.p.", "eur")),
        step("15:30", "Opción B · Paseo de los ingleses", "Promenade des Anglais completa hasta el <b>Negresco</b> y su cúpula rosa. Sentaos en las <i>chaises bleues</i>, las sillas azules icónicas.", badge("B"), chip("gratis", "eur")),
        step("16:55", "Atardecer en la Baie des Anges", "Desde la Promenade, con el sol cayendo detrás del aeropuerto y el cabo de Antibes.", badge("B"), chip("gratis", "eur"), star=True),
        step("19:00", "Apéro en Place Garibaldi", "Una copa de rosado de Provenza bajo los soportales saboyanos.", badge("I"), chip("≈ 15 € los dos", "eur")),
        step("20:00", "Cena de mar", "<b>Café de Turin</b>, ostras desde 1908 (plateau para dos) o, más económico, la socca de leña de <b>Chez Pipo</b> cerca del puerto.", badge("5", True) + badge("4", True), chip("≈ 30–70 € los dos", "eur")),
    ])
    return page(f"""
{day_header(3, "DOM", "22", "<em>Nikaia</em>, la ciudad vieja", "Mercado, barroco, castillo sin castillo y el puerto de Garibaldi.", CORAL)}
<div class="cols2 wide">
  <div class="steps">{d3}</div>
  <aside>
    <div class="photo"><svg viewBox="0 0 300 380">
      <defs><linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF9A62"/><stop offset=".55" stop-color="#FF4F6D"/><stop offset="1" stop-color="#5B2FD6"/></linearGradient></defs>
      <rect width="300" height="380" fill="url(#dusk)"/><circle cx="150" cy="232" r="62" fill="#FFD27A"/>
      <path d="M0 252 L0 236 Q30 222 60 230 T120 238 L300 252Z" fill="#3A2470"/>
      <rect y="250" width="300" height="130" fill="#1B2B6B"/>
      {''.join(f'<rect x="{150-60+i*3}" y="{258+i*11}" width="{120-i*6}" height="2.5" fill="#FFD27A" opacity="{.8-i*.08:.2f}"/>' for i in range(10))}
      <text x="20" y="40" font-family="Fraunces" font-style="italic" font-size="30" fill="#fff">16:55</text>
      <text x="20" y="60" font-family="Inter" font-size="10" letter-spacing="3" font-weight="700" fill="#fff" opacity=".85">PUESTA DE SOL · BAIE DES ANGES</text>
    </svg></div>
    <div class="story"><span>Leyenda</span><p>La Baie des Anges debe su nombre, dicen, a los angelotes —tiburones ángel— que poblaban sus aguas. Otros cuentan que unos ángeles trajeron aquí en barca el cuerpo de santa Reparata, patrona de la ciudad.</p></div>
    <div class="story alt"><span>Ojo, domingo</span><p>El mercado de flores cierra hacia las 13:30 y algunos restaurantes no abren por la noche. Reservad la cena por la mañana.</p></div>
    <div class="story"><span>La socca</span><p>Torta finísima de harina de garbanzo, aceite de oliva y pimienta, cocida en una plancha de cobre en horno de leña. Se come con los dedos, quemando, en un cucurucho de papel.</p></div>
  </aside>
</div>""", "daypage", 6)


def p_day4_food():
    d4 = "".join([
        step("07:30", "Amanecer en la Promenade", "El sol sale por el cabo de Mont Boron y tiñe la bahía de rosa. Última foto en las sillas azules.", badge("B"), chip("gratis", "eur"), star=True),
        step("08:00", "Último desayuno", "Café y croissant. Comprad un <b>pan bagnat</b> (bocadillo de salade niçoise) para el avión.", "", chip("≈ 20 € los dos", "eur")),
        step("09:00", "Check-out y tranvía", "T2 desde Jean Médecin hasta la terminal de tu vuelo. Comprueba si es <b>Terminal 1 o 2</b>: el tranvía para en las dos.", chip("T2"), chip("1,70 € p.p.", "eur") + chip("30 min", "min")),
        step("10:00", "En el aeropuerto", "Dos horas antes de un vuelo a las 12:00. <i>Au revoir, Nice.</i>", "", ""),
    ])
    crav = [
        ("Algo muy niçois", "Socca, pissaladière (tarta de cebolla y anchoa), petits farcis y salade niçoise de verdad: sin patata ni maíz.", "Lou Pilha Leva {2} · Chez Pipo {4}", "8–15 € p.p.", OCHRE),
        ("Barato y rápido", "Socca en cucurucho, pan bagnat de boulangerie o barbajuans en Mónaco. Comer de pie, mirando el mar.", "Chez Thérésa {1} · Condamine (Mónaco)", "5–10 € p.p.", "#0FA3B1"),
        ("Marisco y mar", "Ostras, erizos (en temporada desde noviembre) y un plateau de fruits de mer con vino blanco de Bellet.", "Café de Turin {5}", "30–40 € p.p.", SEA2),
        ("Cena especial", "Cocina nissarde de toda la vida: daube con ravioles, tripes, tarta de acelgas. Reservad.", "Bistrot d'Antoine {6} · La Merenda {7}", "35–45 € p.p.", CORAL),
        ("Algo dulce", "Tourte de blettes (tarta dulce de acelgas con piñones), frutas confitadas y helados imposibles.", "Fenocchio {3} · Maison Auer {8}", "3–8 € p.p.", "#7C4DFF"),
        ("Apéro", "Pastis o rosado de Provenza con aceitunas de Niza: pequeñas, negras, la «cailletier».", "Place Garibaldi · Cours Saleya", "5–8 € copa", OLIVE),
    ]
    import re
    def b(s): return re.sub(r"\{(\d)\}", lambda m: badge(m.group(1), True), s)
    cv = "".join(f"""<div class="crave" style="--c:{c}"><h4>{t}</h4><p>{x}</p><div class="where">{b(w)}</div><div class="pr">{p}</div></div>""" for t, x, w, p, c in crav)
    return page(f"""
<div class="d4">{day_header(4, "LUN", "23", "<em>Au revoir</em>", "Una mañana tranquila y al aeropuerto.", "#7C4DFF")}<div class="steps compact">{d4}</div></div>
<header class="ph slim"><span class="eyebrow">03 · ¿Qué te apetece comer?</span><h2>Menú de <em>antojos.</em></h2>
<p class="sub">Elige según el hambre, la hora y el bolsillo. Pide siempre <i>«une carafe d'eau»</i>: el agua del grifo es gratis.</p></header>
<div class="craves">{cv}</div>
<div class="gl"><h5>Diccionario del sabor nissart</h5><div class="glg">
  <div><b>Socca</b><span>Crêpe crujiente de garbanzo al horno de leña.</span></div>
  <div><b>Pissaladière</b><span>Masa de pan con cebolla pochada, anchoas y olivas.</span></div>
  <div><b>Pan bagnat</b><span>«Pan mojado»: la salade niçoise dentro de un bollo.</span></div>
  <div><b>Petits farcis</b><span>Verduras rellenas de carne y hierbas, gratinadas.</span></div>
  <div><b>Daube</b><span>Estofado de ternera al vino tinto, con ravioles.</span></div>
  <div><b>Tourte de blettes</b><span>Tarta dulce de acelgas, pasas y piñones.</span></div>
  <div><b>Barbajuan</b><span>Empanadilla frita monegasca de acelga y ricotta.</span></div>
  <div><b>Bellet</b><span>Vino AOC de las colinas de Niza: diminuto y raro.</span></div>
</div></div>
<div class="phr"><b>Frases útiles</b><span><i>Bonjour / Bonsoir</i> — saluda siempre al entrar</span><span><i>Une socca, s'il vous plaît</i></span><span><i>L'addition, s'il vous plaît</i> — la cuenta</span><span><i>C'est délicieux !</i></span></div>
""", "daypage", 7)


def p_budget():
    items = [
        ("Transporte", "T2 ×4, bus 82 ×2, trenes Èze–Mónaco–Niza ×4, bus 5 opcional", 45, "#0FA3B1"),
        ("Desayunos", "3 mañanas de boulangerie y mercado", 50, OCHRE),
        ("Comidas", "Mónaco (Condamine) + Vieux Nice (Lou Pilha Leva)", 70, SUN),
        ("Cenas", "Sáb. cena especial ≈ 80 € + dom. cena de mar ≈ 70 €", 150, CORAL),
        ("Caprichos", "Helados, socca, cafés, apéro, pan bagnat", 45, "#7C4DFF"),
        ("Entradas", "Jardin Exotique de Èze + Matisse o Lascaris", 40, SEA2),
        ("Colchón", "Imprevistos, taxi de emergencia o un souvenir", 50, "#8C99AD"),
    ]
    total = sum(i[2] for i in items)
    bars = "".join(f'<div style="flex:{v};background:{c}" title="{t}"></div>' for t, _, v, c in items)
    rows = "".join(f"""<div class="brow"><i style="background:{c}"></i><div><b>{t}</b><span>{x}</span></div><em>{v} €</em><div class="bb"><div style="width:{v/150*100:.0f}%;background:{c}"></div></div></div>""" for t, x, v, c in items)
    rain = [
        ("Musée Matisse", "Cimiez · bus 5 · cerrado los martes"),
        ("Musée Chagall", "Mensaje Bíblico · vidrieras azules"),
        ("MAMAC", "Arte moderno, terraza con vistas · Paillon"),
        ("Catedral rusa", "Cúpulas de cebolla, 1912 · gratis"),
    ]
    rr = "".join(f"<li><b>{a}</b><span>{b}</span></li>" for a, b in rain)
    return page(f"""
<header class="ph"><span class="eyebrow">04 · Presupuesto</span><h2>450 € <em>para dos.</em></h2>
<p class="sub">Vuelo y hotel ya pagados. Esto cubre todo lo demás, con margen.</p></header>
<div class="bigbar">{bars}</div>
<div class="btot"><div><b>{total} €</b><span>total estimado</span></div><div><b>≈ 75 €</b><span>por persona y día completo</span></div><div><b>50 €</b><span>de colchón incluido</span></div></div>
<div class="budget">{rows}</div>
<div class="cols3">
  <div class="note"><h5>Plan B si llueve</h5><ul class="rain">{rr}</ul></div>
  <div class="note"><h5>Para ahorrar</h5><p>Agua del grifo gratis. Menú del mediodía (<i>formule</i>) más barato que la cena. Socca y pan bagnat = comida completa por 6 €. Monumentos, miradores y paseos: casi todo gratis.</p></div>
  <div class="note dark"><h5>Antes de ir</h5><p>✓ Reservar cena del sábado<br>✓ Instalar Lignes d'Azur y SNCF Connect<br>✓ Llevar algo de efectivo<br>✓ Mirar la terminal del vuelo de vuelta<br>✓ Calzado para el Sentier Nietzsche</p></div>
</div>
<p class="disclaimer">Precios y horarios orientativos según las tarifas habituales recientes; confirmadlos en las apps oficiales, sobre todo los horarios de domingo y los días de cierre de restaurantes y museos.</p>
<svg class="wave" viewBox="0 0 800 280" preserveAspectRatio="none"><defs><linearGradient id="wv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2F7DE1"/><stop offset="1" stop-color="#0B3D91"/></linearGradient></defs>
<path d="M0 90 Q200 50 400 85 T800 70 V280 H0Z" fill="#8CCBFF" opacity=".35"/><path d="M0 120 Q200 85 400 115 T800 105 V280 H0Z" fill="url(#wv)"/>
<path d="M0 160 Q200 130 400 155 T800 148" stroke="#fff" stroke-opacity=".25" fill="none"/><path d="M0 195 Q200 168 400 190 T800 182" stroke="#fff" stroke-opacity=".18" fill="none"/></svg>
<div class="end"><span>Bon voyage</span><b>Nissa la Bella</b></div>
""", "budgetpage", 8)


CSS = f"""
@page {{ size: A4; margin: 0 }}
* {{ box-sizing: border-box; margin: 0; padding: 0 }}
:root {{ --ink:{INK}; --sea:{SEA2}; --sun:{SUN}; --coral:{CORAL}; --ochre:{OCHRE}; --cream:{CREAM}; --muted:#5B6678 }}
body {{ font-family: Inter, sans-serif; color: var(--ink); background: #ddd; -webkit-print-color-adjust: exact; print-color-adjust: exact }}
em {{ font-family: Fraunces, serif; font-style: italic; font-weight: 400 }}
.page {{ width: 210mm; height: 297mm; position: relative; overflow: hidden; background: var(--cream); page-break-after: always; padding: 15mm 14mm 16mm }}
.folio {{ position: absolute; bottom: 7mm; left: 14mm; right: 14mm; display: flex; justify-content: space-between; font: 700 8px Inter; letter-spacing: 3px; color: #9AA3B2; border-top: 1px solid #E8E1D4; padding-top: 3mm }}
.eyebrow {{ font: 800 9px Inter; letter-spacing: 3px; text-transform: uppercase; color: var(--coral) }}
.ph h2, .dh h2 {{ font: 800 40px/1 Inter; letter-spacing: -1.5px; margin-top: 6px }}
.ph h2 em, .dh h2 em {{ font-weight: 300; letter-spacing: -.5px; color: var(--sea) }}
.ph.slim h2 {{ font-size: 32px }}
.sub {{ color: var(--muted); font-size: 11px; margin-top: 6px }}
.ph {{ margin-bottom: 14px }}

/* COVER */
.cover {{ padding: 0; background: #0A1F44; color: #fff }}
.cv-sky {{ position: absolute; inset: 0; background: linear-gradient(180deg,#0B1E4A 0%,#3B2C83 32%,#E1527A 58%,#FF9A5A 70%,#FFC97A 76%) }}
.cv-sun {{ position: absolute; width: 230px; height: 230px; border-radius: 50%; left: 50%; top: 520px; transform: translateX(-50%);
  background: radial-gradient(circle at 50% 40%,#FFF3C4,#FFC56B 55%,#FF8A4C); box-shadow: 0 0 120px 40px rgba(255,170,90,.55) }}
.cv-sea {{ position: absolute; left: 0; right: 0; bottom: 0; height: 410px }}
.cv-sea svg {{ width: 100%; height: 100% }}
.cv-chairs {{ position: absolute; left: 0; right: 0; bottom: 140px; height: 60px }}
.chair {{ position: absolute; bottom: 0; width: 46px; height: 52px; transform-origin: bottom }}
.chair::before {{ content: ""; position: absolute; left: 0; bottom: 18px; width: 46px; height: 8px; background: #8CCBFF; border-radius: 3px; box-shadow: 0 0 0 1px rgba(0,0,0,.1) }}
.chair::after {{ content: ""; position: absolute; left: 2px; bottom: 22px; width: 9px; height: 34px; background: #8CCBFF; border-radius: 3px; transform: rotate(-14deg) }}
.cv-top {{ position: absolute; top: 13mm; left: 14mm; right: 14mm; display: flex; justify-content: space-between; font: 700 8.5px Inter; letter-spacing: 3.5px; opacity: .8 }}
.cv-title {{ position: absolute; top: 34mm; left: 14mm; right: 14mm }}
.kicker {{ font: 600 11px Inter; letter-spacing: 5px; text-transform: uppercase; opacity: .8 }}
.cv-title h1 {{ font: 900 205px/0.86 Inter; letter-spacing: -11px; margin: 10px 0 0 -8px;
  background: linear-gradient(180deg,#fff 30%,#FFD9B0); -webkit-background-clip: text; color: transparent }}
.cv-title h1 em {{ font-family: Fraunces; font-weight: 300; letter-spacing: -6px; -webkit-text-fill-color: #FFB27A }}
.dates {{ display: flex; align-items: center; gap: 14px; margin-top: 14px }}
.dates b {{ font: 300 52px Fraunces; font-style: italic }}
.dates i {{ font-style: normal; font-size: 28px; opacity: .6 }}
.dates span {{ font: 800 10px/1.4 Inter; letter-spacing: 4px; margin-left: 10px; padding-left: 14px; border-left: 1px solid rgba(255,255,255,.4) }}
.lead {{ max-width: 112mm; font-size: 12.5px; line-height: 1.6; opacity: .92; margin-top: 16px }}
.cv-stats {{ position: absolute; left: 14mm; right: 14mm; bottom: 14mm; display: grid; grid-template-columns: repeat(4,1fr);
  background: rgba(255,255,255,.1); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,.25); border-radius: 18px; overflow: hidden }}
.cv-stats div {{ padding: 14px 16px; border-right: 1px solid rgba(255,255,255,.18) }}
.cv-stats div:last-child {{ border: 0 }}
.cv-stats b {{ display: block; font: 800 24px Inter; letter-spacing: -.5px }}
.cv-stats span {{ font-size: 9px; letter-spacing: 1px; opacity: .8; text-transform: uppercase }}

/* OVERVIEW */
.days {{ display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-bottom: 16px }}
.day {{ background: #fff; border-radius: 16px; padding: 12px; border-top: 5px solid var(--c); box-shadow: 0 6px 18px -10px rgba(13,27,46,.35) }}
.dn {{ display: flex; align-items: baseline; gap: 6px; color: var(--c) }}
.dn span {{ font: 800 9px Inter; letter-spacing: 2px }}
.dn b {{ font: 900 30px Inter; letter-spacing: -1px }}
.day h3 {{ font: 300 19px Fraunces; font-style: italic; margin: 2px 0 4px }}
.day p {{ font-size: 9.5px; line-height: 1.45; color: var(--muted) }}
.ov-grid {{ display: grid; grid-template-columns: 1.25fr 1fr; gap: 16px }}
h5 {{ font: 800 9.5px Inter; letter-spacing: 2.5px; text-transform: uppercase; margin-bottom: 10px; color: var(--ink) }}
.hist {{ background: #0D1B2E; color: #fff; border-radius: 22px; padding: 18px 18px 8px }}
.hist h5 {{ color: #FFB27A }}
.tl {{ list-style: none; position: relative }}
.tl::before {{ content: ""; position: absolute; left: 58px; top: 6px; bottom: 14px; width: 1px; background: linear-gradient(#FFB27A,#2F7DE1) }}
.tl li {{ display: flex; gap: 22px; margin-bottom: 10px; position: relative }}
.tl li::after {{ content: ""; position: absolute; left: 55px; top: 4px; width: 7px; height: 7px; border-radius: 50%; background: #FFB27A; box-shadow: 0 0 0 3px #0D1B2E }}
.tl .y {{ width: 48px; flex: none; text-align: right; font: 700 10px JetBrains Mono, monospace; color: #8CCBFF; padding-top: 1px }}
.tl b {{ font: 400 14px Fraunces; font-style: italic; color: #fff }}
.tl p {{ font-size: 9.5px; line-height: 1.45; opacity: .78; margin-top: 1px }}
.side {{ display: flex; flex-direction: column; gap: 12px }}
.wx {{ background: linear-gradient(135deg,#2F7DE1,#0B3D91); color: #fff; border-radius: 22px; padding: 16px }}
.wx h5 {{ color: #fff; opacity: .85 }}
.wxrow {{ display: grid; grid-template-columns: repeat(4,1fr); gap: 4px; margin-bottom: 10px }}
.wxrow b {{ display: block; font: 800 20px Inter; letter-spacing: -.5px }}
.wxrow span {{ font-size: 8.5px; opacity: .8; text-transform: uppercase; letter-spacing: 1px }}
.wx p {{ font-size: 10px; line-height: 1.5; opacity: .92 }}
.note {{ background: #fff; border-radius: 20px; padding: 14px 16px; box-shadow: 0 6px 18px -12px rgba(13,27,46,.4) }}
.note p {{ font-size: 10px; line-height: 1.6; color: #344055; margin-bottom: 4px }}
.note.dark {{ background: var(--ink); color: #fff }}
.note.dark h5 {{ color: #FFB27A }} .note.dark p {{ color: #E3E8F0 }}

.badge {{ display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 9px; background: {SEA1}; color: #fff; font: 800 10px Inter; margin-right: 3px; vertical-align: -3px; border: 1.5px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25) }}
.badge.food {{ background: var(--coral) }}
.chip {{ display: inline-block; font: 800 8.5px Inter; letter-spacing: .5px; padding: 3px 7px; border-radius: 20px; background: #0FA3B1; color: #fff; margin-right: 4px; white-space: nowrap }}
.chip.t1 {{ background: var(--coral) }} .chip.b82 {{ background: var(--sun) }} .chip.tr {{ background: var(--ink) }} .chip.b100, .chip.b5 {{ background: #7C4DFF }}
.chip.eur {{ background: #FFF1E2; color: #B4561A }} .chip.min {{ background: #E8F1FD; color: #1F5FBF }}

/* MAPAS */
.mappage {{ background: #F4EEE3 }}
.mapbox {{ border-radius: 22px; overflow: hidden; box-shadow: 0 18px 40px -22px rgba(13,27,46,.6), 0 0 0 1px rgba(13,27,46,.06); background: #fff }}
.map {{ display: block; width: 100% }}
.legend {{ display: grid; grid-template-columns: 1.15fr 1fr; gap: 14px; margin-top: 12px }}
h6 {{ font: 800 8.5px Inter; letter-spacing: 2.5px; text-transform: uppercase; color: var(--muted); margin-bottom: 6px }}
h6.mt {{ margin-top: 10px }}
.lg {{ list-style: none; columns: 2; column-gap: 10px }}
.legend > div:last-child .lg {{ columns: 2 }}
.lg li {{ display: flex; gap: 5px; break-inside: avoid; margin-bottom: 5px; align-items: flex-start }}
.lg b {{ display: block; font-size: 9px; line-height: 1.2 }} .lg b i {{ font-style: normal; color: var(--coral); font-weight: 800 }}
.lg small {{ display: block; font-size: 7.8px; color: var(--muted); line-height: 1.3 }}
.ln {{ list-style: none }} .ln li {{ font-size: 9px; display: flex; align-items: center; gap: 6px; margin-bottom: 4px }}
.ln i {{ width: 22px; height: 5px; border-radius: 3px; display: inline-block }}
.ln i.dash {{ background: repeating-linear-gradient(90deg,var(--c) 0 3px,transparent 3px 7px) }}
.tp {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px }}
.tpc {{ background: #fff; border-radius: 18px; padding: 12px 14px; border-left: 5px solid var(--c); position: relative }}
.tph {{ display: flex; align-items: center; gap: 4px; margin-bottom: 6px }} .tph b {{ font-size: 11px }}
.tpc p {{ font-size: 9.5px; line-height: 1.5; color: #344055; padding-right: 60px }}
.tpc .pr {{ position: absolute; right: 12px; bottom: 12px; font: 300 15px Fraunces; font-style: italic; color: var(--c) }}
.taxi {{ margin-top: 10px; font-size: 9.5px; line-height: 1.5; background: var(--ink); color: #E3E8F0; border-radius: 14px; padding: 10px 14px }}
.taxi b {{ color: #FFB27A }}

/* DÍAS */
.cols2 {{ display: grid; grid-template-columns: 1fr 1.12fr; gap: 16px }}
.cols2.wide {{ grid-template-columns: 1.55fr 1fr; margin-top: 4px }}
.dh {{ display: flex; gap: 12px; align-items: center; margin-bottom: 12px }}
.dhn {{ width: 62px; height: 74px; flex: none; border-radius: 16px; background: var(--c); color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 10px 20px -10px var(--c) }}
.dhn span {{ font: 800 7.5px Inter; letter-spacing: 2px }} .dhn b {{ font: 900 30px/1 Inter; letter-spacing: -1px }}
.dh h2 {{ font-size: 27px; margin-top: 2px }} .dh h2 em {{ color: var(--c) }}
.dh .eyebrow {{ color: var(--c) }} .dh .sub {{ margin-top: 3px; font-size: 10px }}
.steps {{ position: relative; padding-left: 2px }}
.steps::before {{ content: ""; position: absolute; left: 47px; top: 6px; bottom: 6px; width: 2px; background: repeating-linear-gradient(#D9CFBF 0 4px, transparent 4px 8px) }}
.step {{ display: grid; grid-template-columns: 38px 18px 1fr; gap: 0; margin-bottom: 6px; align-items: start }}
.time {{ font: 700 9.5px JetBrains Mono, monospace; padding-top: 9px; color: var(--ink) }}
.dot {{ width: 10px; height: 10px; margin: 10px 0 0 4px; border-radius: 50%; background: var(--cream); border: 2.5px solid var(--ink); position: relative; z-index: 1 }}
.star .dot {{ background: var(--sun); border-color: var(--sun); box-shadow: 0 0 0 3px #FFE2CF }}
.card {{ background: #fff; border-radius: 12px; padding: 7px 10px 7px; box-shadow: 0 4px 14px -10px rgba(13,27,46,.5) }}
.star .card {{ background: linear-gradient(135deg,#fff,#FFF4EA); box-shadow: inset 0 0 0 1px #FFD6B8, 0 4px 14px -10px rgba(255,122,61,.6) }}
.ct {{ display: flex; align-items: center; gap: 2px; flex-wrap: wrap }}
.card h4 {{ font: 800 10.5px Inter; margin-left: 2px }}
.card p {{ font-size: 8.9px; line-height: 1.45; color: #3A4659; margin: 3px 0 4px }}
.tags {{ display: flex; flex-wrap: wrap; gap: 2px }}
.story {{ margin-top: 10px; background: var(--ink); color: #fff; border-radius: 16px; padding: 12px 14px }}
.story span {{ font: 800 8px Inter; letter-spacing: 2.5px; text-transform: uppercase; color: #FFB27A }}
.story p {{ font: 400 11px/1.5 Fraunces; font-style: italic; margin-top: 4px }}
.story.alt {{ background: #FFE9DA; color: var(--ink) }} .story.alt span {{ color: var(--coral) }}
.photo {{ border-radius: 20px; overflow: hidden; box-shadow: 0 16px 30px -18px rgba(91,47,214,.8) }}
.photo svg {{ display: block; width: 100% }}
.d4 {{ background: #fff; border-radius: 22px; padding: 14px 16px 6px; margin-bottom: 16px; box-shadow: 0 8px 22px -16px rgba(13,27,46,.5) }}
.d4 .dh {{ margin-bottom: 8px }} .d4 .dhn {{ height: 62px }}
.steps.compact {{ display: grid; grid-template-columns: 1fr 1fr; column-gap: 12px }}
.steps.compact::before {{ display: none }}
.craves {{ display: grid; grid-template-columns: repeat(3,1fr); gap: 10px }}
.crave {{ background: #fff; border-radius: 18px; padding: 13px 13px 34px; position: relative; overflow: hidden; box-shadow: 0 6px 18px -14px rgba(13,27,46,.5) }}
.crave::before {{ content: ""; position: absolute; top: -30px; right: -30px; width: 80px; height: 80px; border-radius: 50%; background: var(--c); opacity: .14 }}
.crave h4 {{ font: 400 18px/1.1 Fraunces; font-style: italic; color: var(--c); margin-bottom: 6px }}
.crave p {{ font-size: 9.3px; line-height: 1.5; color: #3A4659 }}
.where {{ font: 700 8.8px Inter; margin-top: 7px }}
.crave .pr {{ position: absolute; bottom: 11px; left: 13px; font: 800 9px Inter; letter-spacing: 1px; color: #fff; background: var(--c); border-radius: 20px; padding: 3px 9px }}
.phr {{ margin-top: 14px; background: var(--ink); color: #fff; border-radius: 16px; padding: 12px 16px; display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 9.5px }}
.phr b {{ width: 100%; font: 800 8.5px Inter; letter-spacing: 2.5px; text-transform: uppercase; color: #FFB27A }}
.phr i {{ font-family: Fraunces; font-size: 11.5px; color: #8CCBFF }}

/* PRESUPUESTO */
.bigbar {{ display: flex; height: 26px; border-radius: 14px; overflow: hidden; gap: 3px; margin: 6px 0 12px }}
.btot {{ display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-bottom: 14px }}
.btot div {{ background: var(--ink); color: #fff; border-radius: 16px; padding: 12px 14px }}
.btot div:first-child {{ background: linear-gradient(135deg,{SUN},{CORAL}) }}
.btot b {{ display: block; font: 900 26px Inter; letter-spacing: -1px }} .btot span {{ font-size: 9px; opacity: .85; text-transform: uppercase; letter-spacing: 1px }}
.budget {{ background: #fff; border-radius: 20px; padding: 8px 16px; margin-bottom: 14px }}
.brow {{ display: grid; grid-template-columns: 12px 1fr 50px 150px; gap: 10px; align-items: center; padding: 7px 0; border-bottom: 1px solid #F1EBE0 }}
.brow:last-child {{ border: 0 }}
.brow > i {{ width: 12px; height: 12px; border-radius: 4px }}
.brow b {{ font-size: 11px; display: block }} .brow span {{ font-size: 9px; color: var(--muted) }}
.brow em {{ font: 300 17px Fraunces; font-style: italic; text-align: right }}
.bb {{ height: 8px; background: #F4EEE3; border-radius: 4px; overflow: hidden }} .bb div {{ height: 100% }}
.cols3 {{ display: grid; grid-template-columns: repeat(3,1fr); gap: 10px }}
.rain {{ list-style: none }} .rain li {{ margin-bottom: 6px }} .rain b {{ display: block; font-size: 10px }} .rain span {{ font-size: 9px; color: var(--muted) }}
.disclaimer {{ font-size: 8px; color: #8A94A6; margin-top: 12px; line-height: 1.5 }}
.end {{ margin-top: 16px; display: flex; align-items: baseline; justify-content: space-between; border-top: 2px solid var(--ink); padding-top: 10px }}
.end span {{ font: 800 9px Inter; letter-spacing: 4px; text-transform: uppercase; color: var(--coral) }}
.end b {{ font: 300 38px Fraunces; font-style: italic; color: var(--sea) }}

.route {{ margin-top: 12px; background: #fff; border-radius: 18px; padding: 12px 14px }}
.rt {{ display: flex; align-items: center; gap: 4px }}
.rs {{ flex: 1; border-radius: 12px; background: var(--c); color: #fff; padding: 8px 8px; text-align: center }}
.rs b {{ display: block; font-size: 10.5px }} .rs span {{ font-size: 8px; opacity: .85 }}
.ra {{ text-align: center; color: var(--c); flex: none; width: 52px; position: relative; padding-bottom: 8px }}
.ra::after {{ content: ""; position: absolute; left: 4px; right: 4px; bottom: 2px; height: 2px; background: var(--c) }}
.ra i {{ display: block; font: 800 8.5px Inter; font-style: normal }} .ra span {{ font: 300 12px Fraunces; font-style: italic }}
.must {{ margin-top: 14px; background: linear-gradient(120deg,#FF7A3D,#FF4F6D 50%,#7C4DFF); border-radius: 22px; padding: 14px 16px; color: #fff }}
.must h5 {{ color: #fff }}
.mg {{ display: grid; grid-template-columns: repeat(5,1fr); gap: 8px }}
.mg div {{ background: rgba(255,255,255,.16); border-radius: 14px; padding: 10px }}
.mg b {{ display: block; font: 300 22px Fraunces; font-style: italic }} .mg span {{ font-size: 9.5px; line-height: 1.35; font-weight: 600 }}
.gl {{ margin-top: 14px; background: #fff; border-radius: 20px; padding: 14px 16px }}
.glg {{ display: grid; grid-template-columns: repeat(4,1fr); gap: 10px 14px }}
.glg b {{ display: block; font: 400 15px Fraunces; font-style: italic; color: var(--coral) }} .glg span {{ font-size: 9px; line-height: 1.4; color: #3A4659 }}
.mcfacts {{ margin-top: 10px; background: #fff; border-radius: 16px; padding: 12px 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px }}
.mcfacts h5 {{ grid-column: 1/-1; margin: 0 }}
.mcfacts b {{ display: block; font: 300 22px Fraunces; font-style: italic; color: var(--coral) }} .mcfacts span {{ font-size: 9px; color: var(--muted) }}
.budgetpage .end {{ position: absolute; left: 14mm; right: 14mm; bottom: 20mm; border-color: #fff }}
.budgetpage .end b {{ color: #fff }} .budgetpage .end span {{ color: #fff }}
.wave {{ position: absolute; left: 0; right: 0; bottom: 0; height: 75mm }}
"""

HTML = f"""<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Niza · 20–23 noviembre 2026</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;1,9..144,300;1,9..144,400&family=Inter:wght@400;600;700;800;900&family=JetBrains+Mono:wght@700&display=block" rel="stylesheet">
<style>{CSS}</style></head><body>
{p_cover()}{p_overview()}{p_map_center()}{p_map_riviera()}{p_day1_2()}{p_day3()}{p_day4_food()}{p_budget()}
</body></html>"""

OUT.write_text(HTML, encoding="utf-8")
print("ok", OUT)
