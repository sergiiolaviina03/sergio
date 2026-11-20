"""Genera la intro 'tenebrosa' (video + audio) y la une al video original.
Uso: python3 make_intro.py ORIGINAL.mov SALIDA.mp4 [escudo_palinka.png] [escudo_palace.png]
"""
import sys, os, math, subprocess, random, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

W, H, FPS, SR = 576, 1024, 30, 44100
SRC, OUT = sys.argv[1], sys.argv[2]
PAL_LOGO = sys.argv[3] if len(sys.argv) > 3 else None
CP_LOGO = sys.argv[4] if len(sys.argv) > 4 else None
TMP = os.path.join(os.path.dirname(os.path.abspath(OUT)), "_tmp_intro")
os.makedirs(TMP, exist_ok=True)

SERIF_B = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
SERIF_I = "/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf"
SANS_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
F = lambda p, s: ImageFont.truetype(p, s)

# ---------------------------------------------------------------- escudos
def placeholder_crest(name, c1, c2):
    im = Image.new("RGBA", (400, 460), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    shield = [(20, 20), (380, 20), (380, 250), (200, 440), (20, 250)]
    d.polygon(shield, fill=c1, outline=(240, 240, 240), width=10)
    d.polygon([(200, 20), (380, 20), (380, 250), (200, 440)], fill=c2)
    d.line([(200, 20), (200, 440)], fill=(240, 240, 240), width=6)
    f = F(SANS_B, 52)
    for i, word in enumerate(name.split()):
        tw = d.textlength(word, font=f)
        d.text((200 - tw / 2, 150 + i * 64), word, font=f, fill="white",
               stroke_width=4, stroke_fill="black")
    return im

def load_crest(path, name, c1, c2):
    if path and os.path.exists(path):
        im = Image.open(path).convert("RGBA")
    else:
        im = placeholder_crest(name, c1, c2)
    return im

palinka = load_crest(PAL_LOGO, "PALINKA", (90, 30, 140), (240, 190, 40))
palace = load_crest(CP_LOGO, "CRYSTAL PALACE", (30, 60, 160), (200, 20, 40))

def fit(im, box):
    im = im.copy(); im.thumbnail((box, box), Image.LANCZOS); return im

# ---------------------------------------------------------------- guion
# (inicio, fin, tipo, datos)
T_END = 27.0
SCRATCH = 22.6          # disco rayado
CUT = T_END
scenes = [
    (0.0, 4.2, "logo", None),
    (4.2, 7.4, "text", ["Había una vez..."]),
    (7.4, 11.4, "crest", ["un equipo llamado", "KRYSTAL PALACE"]),
    (11.4, 14.6, "text", ["Se creían los reyes", "de Cobeña."]),
    (14.6, 18.6, "text", ["Su portero aún sigue", "contando los goles", "que le metieron..."]),
    (18.6, SCRATCH, "fall", ["Y desde aquella noche", "nadie ha vuelto a verles", "tocar el balón."]),
    (SCRATCH, 24.4, "freeze", None),
    (24.4, 25.9, "wait", ["...espera."]),
    (25.9, T_END, "nope", ["ASÍ NO ERA."]),
]

rng = np.random.default_rng(7)
# niebla: ruido suave pre-generado, se desplaza en el tiempo
fog_base = Image.fromarray((rng.random((H // 8, W // 4)) * 255).astype("uint8")) \
    .resize((W * 2, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(40))
vignette = Image.new("L", (W, H), 0)
vd = ImageDraw.Draw(vignette)
for i in range(60):
    r = i / 60
    vd.ellipse([-W * 0.4 + r * W * 0.5, -H * 0.25 + r * H * 0.35,
                W * 1.4 - r * W * 0.5, H * 1.25 - r * H * 0.35], fill=int(255 * r))
vignette = vignette.filter(ImageFilter.GaussianBlur(60))

def ease(x): x = max(0, min(1, x)); return x * x * (3 - 2 * x)

def base_bg(t, tint=(18, 10, 24), flash=0.0):
    img = Image.new("RGB", (W, H), tint)
    off = int((t * 18) % W)
    fog = fog_base.crop((off, 0, off + W, H))
    fog_rgb = Image.merge("RGB", [fog.point(lambda v: v * 0.35)] * 3)
    img = Image.blend(img, fog_rgb, 0.45)
    black = Image.new("RGB", (W, H), (0, 0, 0))
    img = Image.composite(img, black, vignette)
    if flash > 0:
        img = Image.blend(img, Image.new("RGB", (W, H), (230, 235, 255)), min(1, flash))
    return img

def lightning(t):
    # destellos de relámpago en momentos concretos
    v = 0
    for tt in (7.45, 7.7, 18.65):
        dt = t - tt
        if 0 <= dt < 0.35:
            v = max(v, (1 - dt / 0.35) * (0.9 if dt < 0.08 else 0.5))
    return v

FD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
def FS(fam, w, style="normal"):
    for d in os.listdir(FD):
        if d.startswith("fontsource-" + fam + "-"):
            return os.path.join(FD, d, "files", f"{fam}-latin-{w}-{style}.woff")
THIN = FS("montserrat", 200)        # narración: fina, moderna
LIGHT = FS("montserrat", 300)
BLACK = FS("montserrat", 900)
TITLE = FS("cinzel", 400)           # nombre del equipo
ITAL = FS("cormorant-garamond", 300, "italic")  # frases sueltas

def flicker(t, seed):
    r = random.Random(int(t * 30) * 131 + seed)
    return 0.55 if r.random() < 0.06 else 1.0

def tracked_width(d, text, f, tr):
    return sum(d.textlength(c, font=f) for c in text) + tr * (len(text) - 1)

def draw_lines(img, lines, t0, t, y_center, size=30, font=None, color=(220, 220, 225),
               stagger=0.55, glow=(140, 10, 10), track=0.22, upper=True, lh_mult=1.9,
               flick=True):
    font = font or THIN
    if upper: lines = [l.upper() for l in lines]
    probe = ImageDraw.Draw(Image.new("L", (1, 1)))
    f = F(font, size); tr = size * track
    while max(tracked_width(probe, l, f, tr) for l in lines) > W - 70 and size > 14:
        size -= 1; f = F(font, size); tr = size * track
    lh = size * lh_mult
    y = y_center - lh * (len(lines) - 1) / 2 - size * 0.6
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for i, ln in enumerate(lines):
        a = ease((t - t0 - i * stagger) / 0.9)
        if a <= 0:
            y += lh; continue
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        x = (W - tracked_width(d, ln, f, tr)) / 2
        al = int(255 * a * (flicker(t, i) if flick else 1))
        for c in ln:
            d.text((x, y), c, font=f, fill=color + (al,))
            x += d.textlength(c, font=f) + tr
        if a < 1:  # aparece desenfocado y se enfoca
            layer = layer.filter(ImageFilter.GaussianBlur((1 - a) * 6))
        out = Image.alpha_composite(out, layer)
        y += lh
    img.paste(out, (0, 0), out)

def hairline(img, y, a, w=140, color=(200, 200, 205)):
    if a <= 0: return
    d = ImageDraw.Draw(img, "RGBA")
    ww = w * a
    d.line([(W / 2 - ww, y), (W / 2 + ww, y)], fill=color + (int(150 * a),), width=1)

def paste_center(img, logo, cy, alpha=1.0, angle=0.0, dx=0, dy=0):
    lg = logo.rotate(angle, resample=Image.BICUBIC, expand=True) if angle else logo
    if alpha < 1:
        a = lg.getchannel("A").point(lambda v: int(v * alpha)); lg = lg.copy(); lg.putalpha(a)
    img.paste(lg, (int((W - lg.width) / 2 + dx), int(cy - lg.height / 2 + dy)), lg)

def desat_dark(logo, k):
    # versión sombría del escudo: menos color, más oscura
    rgb = logo.convert("RGB"); a = logo.getchannel("A")
    gray = rgb.convert("L").convert("RGB")
    out = Image.blend(rgb, gray, k).point(lambda v: int(v * (1 - 0.35 * k)))
    out = out.convert("RGBA"); out.putalpha(a); return out

pal_big = fit(palinka, 360)
cp_big = fit(palace, 360)
cp_dark = desat_dark(cp_big, 0.35)

def fog_over(img, t):
    # niebla muy suave por encima de todo: integra escudos y texto con el fondo
    off = int((t * 30 + W / 2) % W)
    fog = fog_base.crop((off, 0, off + W, H)).point(lambda v: int(v * 0.10))
    return ImageChops.add(img, Image.merge("RGB", [fog] * 3))

last_frame = None
def render(t):
    global last_frame
    for (a, b, kind, data) in scenes:
        if a <= t < b: break
    lt = t - a; dur = b - a
    fade_out = 1 - ease((lt - (dur - 0.45)) / 0.45) if kind not in ("freeze", "wait", "nope", "fall") else 1
    if kind in ("logo", "text", "crest"):
        img = render_scene(t, kind, a, b, lt, dur, data, fade_out)
        return fog_over(img, t)
    return render_scene(t, kind, a, b, lt, dur, data, fade_out)

def render_scene(t, kind, a, b, lt, dur, data, fade_out):
    global last_frame
    if kind == "logo":
        img = base_bg(t, (8, 4, 14))
        al = ease(lt / 1.6) * fade_out
        paste_center(img, pal_big, H * 0.42, al)
        draw_lines(img, ["Palinka CF"], 1.0, lt, H * 0.72, 30, LIGHT, (215, 228, 245),
                   glow=(20, 50, 130), track=0.45)
        hairline(img, H * 0.755, ease((lt - 1.5) / 0.8) * fade_out)
        draw_lines(img, ["presenta"], 1.8, lt, H * 0.79, 20, THIN, (170, 185, 210),
                   glow=(20, 50, 130), track=0.6)
        if fade_out < 1:
            img = Image.blend(Image.new("RGB", (W, H)), img, fade_out)
    elif kind == "text":
        img = base_bg(t, flash=lightning(t))
        if len(data) == 1:
            draw_lines(img, data, a, t, H * 0.48, 58, ITAL, (230, 225, 220), upper=False, track=0.02)
        else:
            draw_lines(img, data, a, t, H * 0.48, 28, THIN)
        img = Image.blend(Image.new("RGB", (W, H)), img, fade_out)
    elif kind == "crest":
        img = base_bg(t, flash=lightning(t))
        al = ease((lt - 0.2) / 0.5)
        paste_center(img, cp_dark, H * 0.38, al, dy=(1 - al) * 30)
        draw_lines(img, data[:1], a + 0.9, t, H * 0.69, 21, THIN, (190, 190, 200), track=0.5)
        draw_lines(img, data[1:], a + 1.5, t, H * 0.755, 46, TITLE, (215, 40, 45),
                   glow=(150, 0, 0), track=0.14)
        hairline(img, H * 0.80, ease((lt - 2.0) / 0.8), 110, (200, 60, 60))
        img = Image.blend(Image.new("RGB", (W, H)), img, fade_out)
    elif kind == "fall":
        img = base_bg(t, flash=lightning(t))
        # el escudo del Palace se hunde y gira, cada vez más oscuro
        k = ease(lt / dur)
        sm = desat_dark(fit(palace, int(300 - 110 * k)), min(1, 0.35 + 0.65 * k))
        paste_center(img, sm, H * 0.30 + k * 120, 1 - 0.6 * k, angle=-25 * k,
                     dx=math.sin(t * 40) * 3 * k)
        draw_lines(img, data, a + 0.3, t, H * 0.70, 26, THIN)
        img = fog_over(img, t)
        last_frame = img.copy()
    elif kind == "freeze":
        # congelado + efecto "disco rayado": temblor y desaturación
        img = last_frame.copy() if last_frame else base_bg(t)
        k = ease(lt / 0.5)
        img = Image.blend(img, img.convert("L").convert("RGB"), k)
        sh = int(8 * max(0, 1 - lt / 0.6) * math.sin(lt * 90))
        img = img.transform(img.size, Image.AFFINE, (1, 0, sh, 0, 1, 0))
        img = img.point(lambda v: int(v * (1 - 0.35 * k)))
    elif kind == "wait":
        img = last_frame.convert("L").convert("RGB").point(lambda v: int(v * 0.65))
        bar = Image.new("RGBA", (W, H), (0, 0, 0, 150)); img.paste(bar, (0, 0), bar)
        draw_lines(img, data, a, t, H * 0.5, 72, ITAL, (255, 255, 255), glow=(0, 0, 0),
                   upper=False, track=0.02, flick=False, stagger=0)
    elif kind == "nope":
        img = last_frame.convert("L").convert("RGB").point(lambda v: int(v * 0.4))
        d = ImageDraw.Draw(img)
        s = 1 + 0.25 * max(0, 1 - lt / 0.15)
        f = F(BLACK, int(70 * s))
        tw = d.textlength(data[0], font=f)
        d.text(((W - tw) / 2, H * 0.45), data[0], font=f, fill=(255, 210, 0),
               stroke_width=6, stroke_fill="black")
        f2 = F(LIGHT, 26)
        if lt > 0.35:
            sub = "Así fue de verdad 👇".replace(" 👇", "")
            tw = d.textlength(sub, font=f2)
            d.text(((W - tw) / 2, H * 0.57), sub, font=f2, fill="white",
                   stroke_width=3, stroke_fill="black")
        # destello blanco justo antes del corte
        if lt > dur - 0.12:
            img = Image.blend(img, Image.new("RGB", (W, H), "white"), (lt - (dur - 0.12)) / 0.12)
    return img

# ---------------------------------------------------------------- vídeo
silent = os.path.join(TMP, "intro_v.mp4")
p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
                      "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", silent],
                     stdin=subprocess.PIPE)
n = int(round(T_END * FPS))
for i in range(n):
    p.stdin.write(render(i / FPS).tobytes())
p.stdin.close(); p.wait()

# ---------------------------------------------------------------- audio
N = int(T_END * SR); t = np.arange(N) / SR
audio = np.zeros(N)

def env(start, att, dur, rel):
    e = np.zeros(N); s = int(start * SR)
    a_n, d_n, r_n = int(att * SR), int(dur * SR), int(rel * SR)
    seg = np.concatenate([np.linspace(0, 1, a_n), np.ones(max(0, d_n - a_n)), np.linspace(1, 0, r_n)])
    seg = seg[: N - s]; e[s:s + len(seg)] = seg; return e

# dron grave y tenebroso (hasta el disco rayado)
drone = sum(np.sin(2 * np.pi * f * t + rng.random() * 6) * g
            for f, g in [(55, .5), (55.4, .4), (82.4, .25), (110.3, .15), (65.4, .2)])
drone *= (0.7 + 0.3 * np.sin(2 * np.pi * 0.23 * t))
audio += 0.22 * drone * env(0, 3.0, SCRATCH - 0.5, 0.05)

# viento: ruido filtrado paso bajo
noise = rng.standard_normal(N)
k = np.exp(-np.arange(400) / 80); k /= k.sum()
wind = np.convolve(noise, k, mode="same") * (0.6 + 0.4 * np.sin(2 * np.pi * 0.13 * t + 1))
audio += 0.35 * wind * env(0, 4, SCRATCH - 0.3, 0.05)

# notas de "caja de música" siniestra (escala menor)
def bell(start, freq, amp=0.18, dur=2.5):
    s = int(start * SR); m = min(N - s, int(dur * SR)); tt = np.arange(m) / SR
    tone = (np.sin(2 * np.pi * freq * tt) + 0.4 * np.sin(2 * np.pi * freq * 2.01 * tt)
            + 0.2 * np.sin(2 * np.pi * freq * 3.02 * tt)) * np.exp(-tt * 2.2)
    audio[s:s + m] += amp * tone
A4 = 440
mel = [(4.3, 0), (4.9, 3), (5.5, 7), (6.1, 8), (6.7, 7),
       (11.5, 0), (12.1, 3), (12.7, 2), (13.3, -1),
       (14.8, 0), (15.4, 3), (16.0, 7), (16.6, 12), (17.2, 11),
       (19.0, 7), (19.7, 5), (20.4, 3), (21.1, 2), (21.8, -1)]
for st, semi in mel:
    bell(st, A4 * 2 ** ((semi - 12) / 12) * 1.0)

# golpes graves (latido) y truenos
def boom(start, amp=0.9, freq=48, decay=3.0):
    s = int(start * SR); m = min(N - s, int(2.5 * SR)); tt = np.arange(m) / SR
    f = freq * (1 + 1.5 * np.exp(-tt * 18))
    ph = 2 * np.pi * np.cumsum(f) / SR
    audio[s:s + m] += amp * np.sin(ph) * np.exp(-tt * decay)
def thunder(start, amp=0.8):
    s = int(start * SR); m = min(N - s, int(3.5 * SR)); tt = np.arange(m) / SR
    nz = rng.standard_normal(m); kk = np.exp(-np.arange(300) / 40); kk /= kk.sum()
    nz = np.convolve(nz, kk, mode="same") * 4
    e = np.exp(-tt * 1.4) * (1 + 0.6 * np.sin(2 * np.pi * 3 * tt)) * np.minimum(1, tt * 40)
    audio[s:s + m] += amp * nz * e
boom(0.4, 0.8); boom(1.6, 0.7)
thunder(7.42, 0.9); boom(7.42, 0.9, 40, 2)
for b in (8.9, 9.6, 11.4, 12.2, 14.6, 15.4):
    boom(b, 0.45, 50, 6)
thunder(18.62, 0.8); boom(18.62, 0.8, 38, 2)
# crescendo antes del corte
audio += 0.25 * np.sin(2 * np.pi * (110 + 60 * np.clip((t - 20.5) / 2.1, 0, 1)) * t) \
    * np.clip((t - 20.5) / 2.1, 0, 1) * (t < SCRATCH)

# disco rayado en SCRATCH
s = int(SCRATCH * SR); m = int(0.55 * SR); tt = np.arange(m) / SR
sweep_f = 900 * np.exp(-tt * 3) + 150 * np.sin(2 * np.pi * 9 * tt) ** 2
scr = np.sin(2 * np.pi * np.cumsum(sweep_f) / SR) * 0.6 + rng.standard_normal(m) * 0.35
scr *= np.exp(-tt * 3.5) * np.minimum(1, tt * 200)
audio[s:s + m] += scr * 0.9
audio[int((SCRATCH + 0.55) * SR):] *= 0  # silencio incómodo tras el rayado
# "pop" en "ASÍ NO ERA"
boom(25.9, 0.5, 120, 14)

audio = np.tanh(audio * 1.1) * 0.85
st = np.stack([audio, np.roll(audio, 220)], axis=1)
wav = os.path.join(TMP, "intro_a.wav")
with wave.open(wav, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype("<i2").tobytes())

# ---------------------------------------------------------------- unir
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", silent, "-i", wav, "-i", SRC,
    "-filter_complex",
    "[0:v]setsar=1,fps=30,format=yuv420p[v0];"
    "[2:v]scale=576:1024,setsar=1,fps=30,format=yuv420p[v1];"
    "[1:a]aformat=sample_rates=44100:channel_layouts=stereo[a0];"
    "[2:a]aformat=sample_rates=44100:channel_layouts=stereo[a1];"
    "[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]",
    "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "19", "-preset", "medium",
    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", OUT],
    check=True)
print("OK", OUT)
