import { mkdir, rm, copyFile, cp } from 'node:fs/promises';
import { build } from 'esbuild';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/admin', { recursive: true });
for (const file of ['index.html', 'style.css', 'main.js', 'data.json', 'site-content.js']) {
  await copyFile(file, `dist/${file}`);
}
for (const file of ['index.html', 'admin.css']) {
  await copyFile(`admin/${file}`, `dist/admin/${file}`);
}
await cp('shared', 'dist/shared', { recursive: true });
await build({
  entryPoints: ['admin/admin.js'],
  outfile: 'dist/admin/admin.bundle.js',
  bundle: true,
  format: 'esm',
  target: ['safari15', 'chrome100'],
  minify: true,
  sourcemap: false
});
console.log('Vercel static output built. Serverless endpoints remain in /api.');
