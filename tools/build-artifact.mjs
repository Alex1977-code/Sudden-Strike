// Baut eine eigenständige HTML-Datei (alles inline) – z. B. für ein Claude-Artifact oder zum Teilen als Einzeldatei.
// Aufruf: node tools/build-artifact.mjs <pfad-zu-esbuild-modul> [ausgabe.html]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const esbuildPath = process.argv[2] || 'esbuild';
const out = process.argv[3] || path.join(root, 'dist', 'steppensturm.html');
const esbuild = await import(esbuildPath.startsWith('/') ? pathToFileURL(esbuildPath).href : esbuildPath);

const res = await esbuild.build({
  entryPoints: [path.join(root, 'js/main.js')],
  bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', legalComments: 'none',
  alias: { three: path.join(root, 'vendor/three/build/three.module.min.js') },
  plugins: [{
    name: 'three-addons',
    setup(b) { b.onResolve({ filter: /^three\/addons\// }, (a) => ({ path: path.join(root, 'vendor/three/addons', a.path.slice('three/addons/'.length)) })); },
  }],
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script type="module"')).trim();
const icon = 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(root, 'assets/icon.svg')).toString('base64');

const page = `<title>Steppensturm</title>
<meta name="theme-color" content="#0d1117">
<link rel="icon" href="${icon}">
<style>
:root { color-scheme: dark; }
html, body { background: #0d1117; height: 100%; }
${css}
</style>
${body}
<script>window.__ARTIFACT = true;</script>
<script>
/* Three.js r170 (MIT License, © 2010-2024 three.js authors) – gebündelt */
${js}
</script>
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, page);
console.log('geschrieben:', out, (page.length / 1024).toFixed(0) + ' KB');
