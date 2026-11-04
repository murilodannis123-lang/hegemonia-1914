# Torna uma textura repetível sem emenda: mistura a imagem com ela mesma deslocada meia volta.
# uso: python3 tools/seamless.py entrada.jpg saida.jpg LADO
import sys
import numpy as np
from PIL import Image
src, out, S = sys.argv[1], sys.argv[2], int(sys.argv[3])
a = np.asarray(Image.open(src).convert('RGB').resize((S, S), Image.LANCZOS)).astype(float)
r = np.roll(a, (S // 2, S // 2), axis=(0, 1))
t = np.abs(np.linspace(-1, 1, S)); w1 = np.clip((1 - t) / 0.35, 0, 1)  # 1 no miolo, 0 nas bordas
w = np.minimum.outer(w1, w1)[..., None]
o = a * w + r * (1 - w)
assert np.allclose(o[0], o[0]) and o.shape == a.shape
Image.fromarray(o.clip(0, 255).astype('uint8')).save(out, quality=82, optimize=True, progressive=True)
