// Build: bundles src/js/*.js (in filename order) into src/template.html.
//
//   node build.mjs              -> index.html                   complete single-file game (GitHub Pages serves this)
//                                  dist/weird-little-guys.html  same page without <html>/<head>/<body>, for hosts
//                                                               that wrap pages in their own document
//   node build.mjs dev guys.js  -> dist/dev.html                a visual harness page from dev/<file> instead of the game
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2] || 'all';
const jsDir = path.join(root, 'src/js');

let files = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js')).sort();
let extra = '';
if (mode === 'dev') {
  files = files.filter((f) => !/main/.test(f));
  extra = fs.readFileSync(path.join(root, 'dev', process.argv[3] || 'guys.js'), 'utf8');
}

const js = '(() => {\n' + files.map((f) => `// ---- ${f}\n` + fs.readFileSync(path.join(jsDir, f), 'utf8')).join('\n') + '\n' + extra + '\n})();';
const tpl = fs.readFileSync(path.join(root, 'src/template.html'), 'utf8');
const page = tpl.replace('/*__JS__*/', () => js);
const [head, body] = page.replace(/<meta name="claude:[^>]*>\n/, '').split('<!--HEAD-END-->');
const full =
  '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
  head + '</head>\n<body>\n' + body + '\n</body>\n</html>\n';

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
if (mode === 'dev') {
  fs.writeFileSync(path.join(root, 'dist/dev.html'), full);
  console.log('dev harness built -> dist/dev.html');
} else {
  fs.writeFileSync(path.join(root, 'index.html'), full);
  fs.writeFileSync(path.join(root, 'dist/standalone.html'), full);
  fs.writeFileSync(path.join(root, 'dist/weird-little-guys.html'), page.replace('<!--HEAD-END-->\n', ''));
  console.log(`built index.html (${(full.length / 1024).toFixed(1)} KB) and dist/weird-little-guys.html`);
}
