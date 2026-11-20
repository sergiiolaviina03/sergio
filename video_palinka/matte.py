# Recorta el escudo del Palace quitando el fondo claro sin halos blancos
import sys, numpy as np
from PIL import Image, ImageFilter
from collections import deque
src, out = sys.argv[1], sys.argv[2]
im = np.array(Image.open(src).convert("RGB")).astype(float)
h, w, _ = im.shape
bgc = np.median(np.concatenate([im[0], im[-1], im[:, 0], im[:, -1]]), axis=0)
diff = np.abs(im - bgc).max(2)
light = diff < 18
bg = np.zeros((h, w), bool); q = deque()
for y in range(h):
    for x in (0, w - 1):
        if light[y, x]: bg[y, x] = 1; q.append((y, x))
for x in range(w):
    for y in (0, h - 1):
        if light[y, x] and not bg[y, x]: bg[y, x] = 1; q.append((y, x))
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < h and 0 <= nx < w and light[ny, nx] and not bg[ny, nx]:
            bg[ny, nx] = 1; q.append((ny, nx))
# franja de borde: 3 px alrededor del fondo -> alpha suave según distancia al color del fondo
bgimg = Image.fromarray((bg * 255).astype("uint8"))
near = np.array(bgimg.filter(ImageFilter.MaxFilter(7))) > 0
alpha = np.ones((h, w))
alpha[bg] = 0
edge = near & ~bg
# el fondo es claro: estimar alpha a partir de cuánto se aleja del blanco
lum_bg = bgc.mean(); lum = im.mean(2)
a_est = np.clip((lum_bg - lum) / (lum_bg - 40), 0, 1)
a_est = np.maximum(a_est, np.clip(diff / 120, 0, 1))
alpha[edge] = a_est[edge]
alpha[alpha < 0.08] = 0
# descontaminar color: quitar el blanco mezclado en el borde
a3 = np.maximum(alpha, 1e-3)[..., None]
col = np.clip((im - (1 - a3) * bgc) / a3, 0, 255)
col[alpha == 0] = 0
rgba = np.dstack([col, alpha * 255]).astype("uint8")
res = Image.fromarray(rgba, "RGBA")
res = res.crop(res.getbbox())
res.save(out); print(res.size, bgc)
