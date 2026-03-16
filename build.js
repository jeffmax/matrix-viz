#!/usr/bin/env node
/**
 * Build script: bundles matmul-3d.html + all JS modules + Three.js
 * into a single self-contained matrix.html file.
 *
 * Usage: node build.js
 */

import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';
import https from 'https';

const THREE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString()));
    }).on('error', reject);
  });
}

async function main() {
  // 1. Bundle all ES modules into a single IIFE
  const result = await build({
    entryPoints: ['js/app.js'],
    bundle: true,
    format: 'iife',
    minify: true,
    write: false,
    // THREE is a global loaded before this script
    external: [],
    // Silence warnings about top-level this
    logLevel: 'warning',
  });
  const bundledJs = result.outputFiles[0].text;

  // 2. Fetch Three.js from CDN
  console.log('Fetching Three.js from CDN...');
  const threeJs = await fetchUrl(THREE_CDN);
  console.log(`Three.js: ${(threeJs.length / 1024).toFixed(0)} KB`);

  // 3. Read the HTML template
  let html = readFileSync('matmul-3d.html', 'utf8');

  // 4. Minify inline CSS: collapse whitespace in <style> blocks
  html = html.replace(/<style>([\s\S]*?)<\/style>/g, (match, css) => {
    const minCss = css
      .replace(/\/\*[\s\S]*?\*\//g, '')  // remove comments
      .replace(/\s+/g, ' ')              // collapse whitespace
      .replace(/\s*([{}:;,>~+])\s*/g, '$1') // remove space around symbols
      .replace(/;}/g, '}')               // remove trailing semicolons
      .trim();
    return `<style>${minCss}</style>`;
  });

  // 5. Replace the two <script> tags with inlined versions
  html = html.replace(
    /<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.min\.js"><\/script>\s*\n?\s*<script type="module" src="js\/app\.js"><\/script>/,
    `<script>${threeJs}</script>\n<script>${bundledJs}</script>`
  );

  // 6. Remove the comment about inline script
  html = html.replace(/\n<!-- INLINE SCRIPT REMOVED.*?-->/g, '');

  // 7. Collapse blank lines
  html = html.replace(/\n{3,}/g, '\n\n');

  writeFileSync('matrix.html', html, 'utf8');
  const sizeKB = (Buffer.byteLength(html) / 1024).toFixed(0);
  console.log(`✓ matrix.html written (${sizeKB} KB)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
