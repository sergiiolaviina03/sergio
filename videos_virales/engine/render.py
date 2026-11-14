"""Pipeline: TTS (edge-tts) -> timings por palabra -> frames (pycairo) -> ffmpeg + música sintetizada."""
import asyncio, json, math, os, ssl, subprocess, sys, wave, hashlib, random
import numpy as np
import cairo
import edge_tts, edge_tts.communicate as _c
from draw import *
from scenes import SCENES, vignette, ease, back_out

_c._SSL_CTX = ssl.create_default_context(cafile=os.environ.get('SSL_CERT_FILE', '/root/.ccr/ca-bundle.crt'))
FPS = 30
SR = 24000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'cache')
GAP = 0.32


# ------------------------------------------------------------ TTS
async def _tts(text, voice, rate, pitch, path_mp3):
    com = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary='WordBoundary')
    words = []
    with open(path_mp3, 'wb') as f:
        async for ch in com.stream():
            if ch['type'] == 'audio':
                f.write(ch['data'])
            elif ch['type'] == 'WordBoundary':
                words.append((ch['offset'] / 1e7, (ch['offset'] + ch['duration']) / 1e7, ch['text']))
    return words


def tts(text, voice, rate='-4%', pitch='-2Hz'):
    key = hashlib.md5(f'{voice}|{rate}|{pitch}|{text}'.encode()).hexdigest()[:16]
    mp3 = os.path.join(CACHE, key + '.mp3'); js = os.path.join(CACHE, key + '.json'); wav = os.path.join(CACHE, key + '.wav')
    if not os.path.exists(js):
        for attempt in range(4):
            try:
                words = asyncio.run(_tts(text, voice, rate, pitch, mp3)); break
            except Exception as e:
                print('tts retry', e, file=sys.stderr)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', mp3, '-ac', '1', '-ar', str(SR), wav], check=True)
        json.dump(words, open(js, 'w'))
    words = json.load(open(js))
    with wave.open(wav) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return a, words


# ------------------------------------------------------------ subtítulos
def attach_punct(text, words):
    """edge-tts devuelve palabras sin puntuación; recuperamos la forma escrita del texto original."""
    toks = text.split()
    out, ti = [], 0
    for (s, e, w) in words:
        best = None
        for j in range(ti, min(ti + 4, len(toks))):
            clean = ''.join(ch for ch in toks[j].lower() if ch.isalnum())
            if clean and (clean == ''.join(ch for ch in w.lower() if ch.isalnum()) or clean.startswith(''.join(ch for ch in w.lower() if ch.isalnum())[:3])):
                best = j; break
        if best is not None:
            out.append((s, e, toks[best])); ti = best + 1
        else:
            out.append((s, e, w))
    return out


def chunk_words(words, maxc=16, maxw=3):
    chunks, cur = [], []
    for w in words:
        cur.append(w)
        txt = ' '.join(x[2] for x in cur)
        if len(cur) >= maxw or len(txt) >= maxc or w[2][-1:] in '.,:;?!—':
            chunks.append(cur); cur = []
    if cur:
        chunks.append(cur)
    return chunks


def draw_captions(cr, tt, chunks):
    cur = None
    for i, ch in enumerate(chunks):
        nxt = chunks[i + 1][0][0] if i + 1 < len(chunks) else ch[-1][1] + 0.6
        if ch[0][0] - 0.05 <= tt < nxt:
            cur = ch; break
    if not cur:
        return
    fs = 58
    y = 360
    words = [w[2] for w in cur]
    widths = [text_w(cr, w, fs) + fs * 0.34 for w in words]
    total = sum(widths)
    if total > 640:
        fs = fs * 640 / total; widths = [text_w(cr, w, fs) + fs * 0.34 for w in words]; total = sum(widths)
    x = 360 - total / 2
    pop = min(1, (tt - cur[0][0]) / 0.12)
    for (s, e, w), wd in zip(cur, widths):
        active = s - 0.03 <= tt < e + 0.08
        done = tt >= e + 0.08
        col = '#FFD84D' if active else ('#ffffff' if done else '#ffffff')
        a = 1.0 if (active or done) else 0.45
        sc = 1.0 + (0.08 * (1 - min(1, (tt - s) / 0.15)) if active else 0)
        cr.save(); cr.translate(x + wd / 2, y); cr.scale(sc * (0.9 + 0.1 * pop), sc * (0.9 + 0.1 * pop))
        cr.select_font_face('Inter', cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD); cr.set_font_size(fs)
        ext = cr.text_extents(w)
        cr.move_to(-ext.x_advance / 2 + 0, 0); cr.text_path(w)
        cr.set_source_rgba(0, 0, 0, 0.85 * a); cr.set_line_width(9); cr.set_line_join(cairo.LINE_JOIN_ROUND); cr.stroke_preserve()
        setc(cr, col, a); cr.fill()
        cr.restore()
        x += wd


def draw_chip(cr, label, t):
    if not label:
        return
    fs = 22
    lab = label.upper()
    tw = text_w(cr, lab, fs) + 56
    x = 360 - tw / 2; y = 418
    setc(cr, '#000000', 0.55); rrect(cr, x, y, tw, 40, 20); cr.fill()
    setc(cr, '#ff3b3b', 0.9); cr.set_line_width(1.6); rrect(cr, x, y, tw, 40, 20); cr.stroke()
    setc(cr, '#ff3b3b', 0.6 + 0.4 * math.sin(t * 6)); cr.arc(x + 22, y + 20, 6, 0, TAU); cr.fill()
    text(cr, lab, x + 36, y + 28, fs, '#ffffff', align='left')


# ------------------------------------------------------------ audio
def music(dur, seed, mood='dark'):
    rnd = np.random.default_rng(seed)
    n = int(dur * SR); t = np.arange(n) / SR
    root = [43.65, 46.25, 49.0, 41.2, 55.0][seed % 5]
    out = np.zeros(n, np.float32)
    lfo = 0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * t)
    for mult, amp in ((1, 0.22), (1.5, 0.09), (2, 0.07), (2.4, 0.04), (3, 0.03)):
        out += amp * np.sin(2 * np.pi * root * mult * t + np.sin(2 * np.pi * 0.11 * t * mult)) * lfo
        out += amp * 0.6 * np.sin(2 * np.pi * root * mult * 1.004 * t)
    noise = rnd.standard_normal(n).astype(np.float32)
    k = 400
    noise = np.convolve(noise, np.ones(k) / k, mode='same') * 6
    out += noise * 0.05 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.05 * t))
    # notas de piano sueltas (campanas tristes)
    scale = [1, 1.189, 1.335, 1.498, 1.782, 2.0]
    tt = 2.0
    while tt < dur - 2:
        f = root * 8 * scale[rnd.integers(len(scale))]
        i0 = int(tt * SR); L = min(int(3.5 * SR), n - i0)
        env = np.exp(-np.arange(L) / SR * 1.6)
        out[i0:i0 + L] += 0.05 * env * (np.sin(2 * np.pi * f * np.arange(L) / SR) + 0.3 * np.sin(2 * np.pi * f * 2.01 * np.arange(L) / SR))
        tt += rnd.uniform(2.5, 5.0)
    fade = np.minimum(1, np.minimum(t / 2.0, (dur - t) / 2.0))
    return out * fade * 0.55


def boom(strength=1.0):
    L = int(1.4 * SR); t = np.arange(L) / SR
    f = 70 * np.exp(-t * 2.2) + 32
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 3.0)
    nz = np.random.default_rng(1).standard_normal(L) * np.exp(-t * 25) * 0.3
    return (s + nz).astype(np.float32) * 0.55 * strength


def whoosh():
    L = int(0.5 * SR); t = np.arange(L) / SR
    nz = np.random.default_rng(2).standard_normal(L)
    nz = np.convolve(nz, np.ones(30) / 30, mode='same')
    env = np.sin(np.pi * t / 0.5) ** 2
    return (nz * env * 0.9).astype(np.float32)


def heartbeat(n_beats=4):
    one = np.zeros(int(0.9 * SR), np.float32)
    for off, a in ((0, 1.0), (0.22, 0.7)):
        L = int(0.18 * SR); t = np.arange(L) / SR
        one[int(off * SR):int(off * SR) + L] += a * np.sin(2 * np.pi * 50 * t) * np.exp(-t * 22)
    return np.tile(one, n_beats) * 0.8


# ------------------------------------------------------------ render
def build(story, outdir, preview=False, only_frames=None):
    voice = story.get('voice', 'es-ES-AlvaroNeural')
    rate = story.get('rate', '+7%'); pitch = story.get('pitch', '-2Hz')
    cast = story.get('cast', {})
    segs = []
    t0 = 0.4
    voice_parts = []
    for b in story['beats']:
        txt = b['say']
        a, words = tts(txt, b.get('voice', voice), rate, pitch)
        words = attach_punct(txt, words)
        dur = len(a) / SR + b.get('hold', 0) + GAP
        segs.append(dict(start=t0, dur=dur, beat=b, chunks=chunk_words([(s + t0, e + t0, w) for s, e, w in words])))
        voice_parts.append((t0, a))
        t0 += dur
    total = t0 + 1.2
    # ---- audio
    n = int(total * SR)
    vtrack = np.zeros(n, np.float32)
    for st, a in voice_parts:
        i = int(st * SR); vtrack[i:i + len(a)] += a[:n - i]
    seed = int(hashlib.md5(story['id'].encode()).hexdigest(), 16) % 1000
    mtrack = music(total, seed)
    fx = np.zeros(n, np.float32)
    for k, sg in enumerate(segs):
        b = sg['beat']
        i = int(max(0, sg['start'] - 0.05) * SR)
        snd = boom(1.0 if b.get('hit') or k == 0 else 0.35) if (b.get('hit') or k == 0 or k % 2 == 0) else whoosh() * 0.25
        fx[i:i + len(snd)] += snd[:n - i]
        if b.get('heart'):
            hb = heartbeat(int(sg['dur'] / 0.9) + 1)
            fx[i:i + len(hb)] += hb[:n - i] * 0.7
    mix = vtrack * 1.0 + mtrack * 0.55 + fx * 0.6
    mix = np.tanh(mix * 1.1) * 0.9
    os.makedirs(outdir, exist_ok=True)
    wavp = os.path.join(outdir, story['id'] + '.wav')
    with wave.open(wavp, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())
    # ---- vídeo
    outp = os.path.join(outdir, story['id'] + '.mp4')
    nframes = int(total * FPS)
    surf = cairo.ImageSurface(cairo.FORMAT_RGB24, W, H)
    cr = cairo.Context(surf)
    cr.set_antialias(cairo.ANTIALIAS_GOOD)
    grains = []
    rng = np.random.default_rng(7)
    for g in range(4):
        gs = cairo.ImageSurface(cairo.FORMAT_ARGB32, W // 2, H // 2)
        arr = np.ndarray(shape=(H // 2, W // 2, 4), dtype=np.uint8, buffer=gs.get_data())
        v = rng.integers(0, 255, (H // 2, W // 2), dtype=np.uint8)
        al = 11
        arr[..., 0] = arr[..., 1] = arr[..., 2] = (v.astype(np.uint16) * al // 255).astype(np.uint8); arr[..., 3] = al
        gs.mark_dirty(); grains.append(gs)
    if only_frames is not None:
        frames_iter = only_frames
        ff = None
    else:
        frames_iter = range(nframes)
        ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', f'{W}x{H}', '-r', str(FPS),
                               '-i', '-', '-i', wavp, '-c:v', 'libx264', '-preset', 'medium', '-crf', '24', '-maxrate', '3500k', '-bufsize', '7000k', '-pix_fmt', 'yuv420p',
                               '-c:a', 'aac', '-b:a', '160k', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-shortest', '-movflags', '+faststart', outp],
                              stdin=subprocess.PIPE)
    shots = []
    for fi in frames_iter:
        tt = fi / FPS
        idx = 0
        for k, sg in enumerate(segs):
            if tt >= sg['start'] - (0.4 if k == 0 else 0):
                idx = k
        sg = segs[idx]; b = sg['beat']
        lt = tt - sg['start'] + 0.0
        p = max(0.0, min(1.0, lt / sg['dur']))
        sc = b['scene']
        cr.save()
        punch = 1.0 + 0.07 * (1 - ease(lt / 0.35)) if lt < 0.35 else 1.0
        zoom = punch * (1.0 + sc.get('push', 0.06) * p)
        shake = sc.get('shake', 0) or (6 if b.get('hit') and lt < 0.4 else 0)
        sx = math.sin(tt * 47) * shake * (1 - min(1, lt / 0.5)); sy = math.cos(tt * 39) * shake * (1 - min(1, lt / 0.5))
        cr.translate(W / 2 + sx, H / 2 + sy); cr.scale(zoom, zoom); cr.translate(-W / 2, -H / 2)
        SCENES[sc['type']](cr, max(0, lt), p, sc, cast)
        cr.restore()
        vignette(cr, 0.7)
        # grano y parpadeo
        cr.save(); cr.scale(2, 2); cr.set_source_surface(grains[(fi // 3) % 4], 0, 0); cr.paint(); cr.restore()
        if lt < 0.12 and idx > 0:
            setc(cr, '#000000', 1 - lt / 0.12); cr.paint()
        if b.get('hit') and lt < 0.08:
            setc(cr, '#ffffff', 0.5 * (1 - lt / 0.08)); cr.paint()
        draw_captions(cr, tt, sg['chunks'] if lt >= -0.1 else [])
        draw_chip(cr, b.get('chip', sc.get('chip', '')), tt)
        if fi < FPS * 0.0:
            pass
        surf.flush()
        if ff:
            ff.stdin.write(surf.get_data())
        else:
            pth = os.path.join(outdir, f"{story['id']}_f{fi:05d}.png"); surf.write_to_png(pth); shots.append(pth)
    if ff:
        ff.stdin.close(); ff.wait()
        os.remove(wavp)
    return outp if ff else shots, total
