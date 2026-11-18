import cv2, numpy as np, mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions
TABLE_Y = 668
class Matter:
    def __init__(self):
        o = vision.ImageSegmenterOptions(base_options=BaseOptions(model_asset_path='models/selfie_multiclass_256x256.tflite'), output_confidence_masks=True)
        self.seg = vision.ImageSegmenter.create_from_options(o)
        self.prev = None
        self.pcache = None; self.k = 0
    def person(self, rgb):
        H, W = rgb.shape[:2]
        acc = np.zeros((H, W), np.float32)
        for x0 in (0, 560, 1120):
            c = np.ascontiguousarray(rgb[0:820, x0:x0+800])
            r = self.seg.segment(mp.Image(image_format=mp.ImageFormat.SRGB, data=c))
            m = 1 - r.confidence_masks[0].numpy_view().squeeze()
            # feather crop borders so seams don't show
            wx = np.ones(800, np.float32)
            if x0 > 0: wx[:60] = np.linspace(0, 1, 60)
            if x0 + 800 < W: wx[-60:] = np.linspace(1, 0, 60)
            acc[0:820, x0:x0+800] = np.maximum(acc[0:820, x0:x0+800], m * wx[None, :])
        return acc
    @staticmethod
    def guided(I, p, r, eps):
        mI = cv2.boxFilter(I, -1, (r, r)); mp_ = cv2.boxFilter(p, -1, (r, r))
        cov = cv2.boxFilter(I * p, -1, (r, r)) - mI * mp_
        var = cv2.boxFilter(I * I, -1, (r, r)) - mI * mI
        a = cov / (var + eps); b = mp_ - a * mI
        return cv2.boxFilter(a, -1, (r, r)) * I + cv2.boxFilter(b, -1, (r, r))
    def alpha(self, rgb):
        """foreground alpha (1 = keep original) for the region above the table"""
        H, W = rgb.shape[:2]
        if self.prev is None or self.k % 2 == 0 or self.pcache is None:
            self.pcache = self.person(rgb)
        self.k += 1
        p = self.pcache
        # wall colour key: lit yellow wall
        hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
        h, s, v = [hsv[..., i].astype(np.float32) for i in range(3)]
        wall = ((h >= 20) & (h <= 30) & (s > 85) & (v > 140)).astype(np.float32)
        # bottle zone: non-wall pixels inside box count as foreground
        box = np.zeros((H, W), np.float32); box[335:TABLE_Y, 660:880] = 1
        wood = ((h >= 6) & (h <= 32) & (s > 70) & (v > 60)).astype(np.float32)
        notwall = cv2.morphologyEx((1 - wall) * (1 - wood), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        bottle = (box * cv2.morphologyEx(notwall, cv2.MORPH_CLOSE, np.ones((31, 15), np.uint8))).astype(np.uint8)
        cnts, _ = cv2.findContours(bottle, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cnts = [c for c in cnts if cv2.contourArea(c) > 1500]
        bottle = np.zeros_like(bottle); cv2.drawContours(bottle, cnts, -1, 1, -1)
        bottle = bottle.astype(np.float32)
        a = np.maximum(p, bottle)
        # within the person edge band, lit wall pixels are definitely background
        a = np.where((wall > 0) & (p < 0.97), np.minimum(a, 0.15 * p), a)
        yel = (h >= 19) & (h <= 32) & (s > 70) & (v > 80)
        a = np.where(yel & (p < 0.9), np.minimum(a, 0.3 * p), a)
        chair = (h >= 8) & (h <= 21) & (s > 175) & (v < 130)
        chair = cv2.morphologyEx(chair.astype(np.uint8), cv2.MORPH_OPEN, np.ones((7, 7), np.uint8)) > 0
        a = np.where(chair, 0.0, a)
        a = np.maximum(a, cv2.GaussianBlur(bottle, (0, 0), 1.0))
        a = np.where(cv2.dilate(chair.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0, 0.0, a)
        # refine with guided filter on downscaled gray
        small = cv2.resize(rgb, (W // 2, H // 2), interpolation=cv2.INTER_AREA)
        g = cv2.cvtColor(small, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
        asm = cv2.resize(a, (W // 2, H // 2), interpolation=cv2.INTER_AREA)
        ref = self.guided(g, asm, 9, 1e-3)
        ref = np.clip(cv2.resize(ref, (W, H), interpolation=cv2.INTER_LINEAR), 0, 1)
        # sharpen transition
        ref = np.clip((ref - 0.58) * 2.4 + 0.5, 0, 1)
        # temporal smoothing
        if self.prev is not None:
            ref = 0.55 * ref + 0.45 * self.prev
        self.prev = ref
        # below table: always keep (table/flag handled separately)
        ref[TABLE_Y:, :] = 1
        # soften the table seam a bit
        return ref
