# Recorta uma folha de sprites em grade, remove o fundo branco (preenchimento a partir das bordas) e salva PNGs.
# uso: python3 tools/cutsheet.py folha.png COLS ROWS saida/ nome1,nome2,...
import sys, collections
from PIL import Image, ImageFilter
import numpy as np
src, cols, rows, out, names = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5].split(',')
I = int(sys.argv[6]) if len(sys.argv) > 6 else 6  # margem interna (pula linhas de grade)
MAX = int(sys.argv[7]) if len(sys.argv) > 7 else 240
im = Image.open(src).convert('RGB'); W, H = im.size; a = np.array(im).astype(int)
cw, ch = W / cols, H / rows
for k, name in enumerate(names):
    if not name or name == '-': continue
    c, r = k % cols, k // cols
    x0, y0, x1, y1 = int(c * cw) + I, int(r * ch) + I, int((c + 1) * cw) - I, int((r + 1) * ch) - I
    cell = a[y0:y1, x0:x1]; h, w, _ = cell.shape
    white = (cell.min(axis=2) > 222) & ((cell.max(axis=2) - cell.min(axis=2)) < 22)
    bg = np.zeros((h, w), bool); q = collections.deque()
    for x in range(w):
        for y in (0, h - 1):
            if white[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if white[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w and not bg[yy, xx] and white[yy, xx]: bg[yy, xx] = True; q.append((yy, xx))
    alpha = Image.fromarray(np.where(bg, 0, 255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.7))
    rgba = Image.fromarray(cell.astype('uint8')).convert('RGBA'); rgba.putalpha(alpha)
    bbox = rgba.getbbox(); rgba = rgba.crop(bbox)
    s = min(1, MAX / max(rgba.size)); rgba = rgba.resize((max(1, round(rgba.width * s)), max(1, round(rgba.height * s))), Image.LANCZOS)
    rgba.save(f'{out}/{name}.png', optimize=True); print(name, rgba.size)
