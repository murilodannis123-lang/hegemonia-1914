// Junta todo o JS num arquivo só (dist/game.js) e atualiza a versão no index.html,
// para o navegador nunca usar uma versão velha guardada em cache.
import { build } from 'esbuild'; import fs from 'fs'; import crypto from 'crypto';
await build({ entryPoints: ['src/ui/main.js'], bundle: true, format: 'esm', minify: true, outfile: 'dist/game.js', target: 'es2020' });
const css = fs.readFileSync('styles.css'); const js = fs.readFileSync('dist/game.js');
const v = crypto.createHash('md5').update(js).update(css).digest('hex').slice(0, 8);
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/<script type="module" src="[^"]*"><\/script>/, `<script type="module" src="dist/game.js?v=${v}"></script>`).replace(/href="styles\.css[^"]*"/, `href="styles.css?v=${v}"`);
fs.writeFileSync('index.html', html); console.log('versão', v, (js.length / 1024).toFixed(0) + ' KB');
