import * as esbuild from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

const outdir = path.join(__dirname, 'dist');
if (existsSync(outdir)) await rm(outdir, { recursive: true });
await mkdir(outdir, { recursive: true });

const entryPoints = {
  'content/content': path.join(__dirname, 'src/content/main.ts'),
  'popup/popup': path.join(__dirname, 'src/popup/popup.ts'),
  'background/background': path.join(__dirname, 'src/background/service-worker.ts'),
  'viewer/viewer': path.join(__dirname, 'src/viewer/viewer.ts'),
};

const config = {
  entryPoints,
  outdir,
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  platform: 'browser',
  sourcemap: 'inline',
  minify: false,
  logLevel: 'info',
};

// Copy static assets (manifest, popup html/css, icons, viewer html/css + PDF.js worker).
async function copyStatic() {
  await cp(path.join(__dirname, 'manifest.json'), path.join(outdir, 'manifest.json'));
  await mkdir(path.join(outdir, 'popup'), { recursive: true });
  await cp(path.join(__dirname, 'src/popup/popup.html'), path.join(outdir, 'popup/popup.html'));
  await cp(path.join(__dirname, 'src/popup/popup.css'), path.join(outdir, 'popup/popup.css'));
  if (existsSync(path.join(__dirname, 'public/icons'))) {
    await cp(path.join(__dirname, 'public/icons'), path.join(outdir, 'icons'), { recursive: true });
  }
  await mkdir(path.join(outdir, 'viewer'), { recursive: true });
  await cp(path.join(__dirname, 'src/viewer/viewer.html'), path.join(outdir, 'viewer/viewer.html'));
  await cp(path.join(__dirname, 'src/viewer/viewer.css'), path.join(outdir, 'viewer/viewer.css'));
  // PDF.js worker — not bundled; copied verbatim and referenced via chrome.runtime.getURL.
  await cp(
    path.join(__dirname, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'),
    path.join(outdir, 'viewer/pdf.worker.mjs'),
  );
  // PDF.js stock text-layer + annotation CSS (required for correct text-layer alignment).
  await cp(
    path.join(__dirname, 'node_modules/pdfjs-dist/web/pdf_viewer.css'),
    path.join(outdir, 'viewer/pdf_viewer.css'),
  );
}

if (watch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  await copyStatic();
  console.log('watching…');
} else {
  await esbuild.build(config);
  await copyStatic();
  console.log('build complete →', outdir);
}
