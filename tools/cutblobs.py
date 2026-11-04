# Recorta itens soltos (sem grade) de uma folha com fundo branco: acha manchas conectadas, ordena por linha e coluna.
# uso: python3 tools/cutblobs.py folha.png saida/ nome1,nome2,... [MAX]
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
src, out, names = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
MAX = int(sys.argv[4]) if len(sys.argv) > 4 else 240
a = np.asarray(Image.open(src).convert('RGB')).astype(int)
white = (a.min(axis=2) > 222) & ((a.max(axis=2) - a.min(axis=2)) < 22)
bg_lab, _ = ndimage.label(white); edge = set(np.unique(np.r_[bg_lab[0], bg_lab[-1], bg_lab[:, 0], bg_lab[:, -1]])) - {0}
bg = np.isin(bg_lab, list(edge))
lab, n = ndimage.label(ndimage.binary_dilation(~bg, iterations=12))
objs = ndimage.find_objects(lab); areas = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
keep = sorted(range(n), key=lambda i: -areas[i])[:len(names)]
assert len(keep) == len(names), f'achei {len(keep)} itens, esperava {len(names)}'
boxes = [objs[i] for i in keep]
rowh = np.median([b[0].stop - b[0].start for b in boxes])
boxes.sort(key=lambda b: (round(((b[0].start + b[0].stop) / 2) / rowh), b[1].start))
alpha = Image.fromarray(np.where(bg, 0, 255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.7))
full = Image.fromarray(a.astype('uint8')).convert('RGBA'); full.putalpha(alpha)
for name, (sy, sx) in zip(names, boxes):
    im = full.crop((sx.start, sy.start, sx.stop, sy.stop)); im = im.crop(im.getbbox())
    s = min(1, MAX / max(im.size)); im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    im.save(f'{out}/{name}.png', optimize=True); print(name, im.size)
