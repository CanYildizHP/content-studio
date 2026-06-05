#!/usr/bin/env node
// Re-copy the brand layer from can-yildiz.com so the thumbnail stays faithful as
// the site's design system evolves. Copies Star.svg + Emphasis, and re-extracts
// the :root token block + Nabla palettes + brand-emphasis CSS from globals.css.
//
// Usage:  node scripts/sync-brand.mjs [path-to-can-yildiz.com]
// Default site path: ../can-yildiz.com (sibling repo) or $CANYILDIZ_REPO.

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const studio = resolve(here, '..');
const site = resolve(
  process.argv[2] || process.env.CANYILDIZ_REPO || join(studio, '..', 'can-yildiz.com')
);

if (!existsSync(site)) {
  console.error(`! site repo not found: ${site}\n  pass it: node scripts/sync-brand.mjs <path-to-can-yildiz.com>`);
  process.exit(1);
}

function section(css, startMarker, endChar) {
  const i = css.indexOf(startMarker);
  if (i === -1) return null;
  // grab from the marker to the matching closing brace of the LAST block we want
  return { i };
}

// 1. Star.svg + Emphasis.tsx — straight copies
copyFileSync(join(site, 'public/Star.svg'), join(studio, 'public/Star.svg'));
copyFileSync(
  join(site, 'src/app/components/posts/Emphasis.tsx'),
  join(studio, 'src/components/Emphasis.tsx')
);
console.log('✓ Star.svg, Emphasis.tsx');

// 2. tokens.css — re-extract :root {...}, the three @font-palette-values blocks,
//    and the .brand-emphasis* rules + keyframes from the site globals.css.
const g = readFileSync(join(site, 'src/app/globals.css'), 'utf8');

function block(open) {
  const start = g.indexOf(open);
  if (start === -1) throw new Error(`marker not found: ${open}`);
  let depth = 0, i = g.indexOf('{', start);
  for (let j = i; j < g.length; j++) {
    if (g[j] === '{') depth++;
    else if (g[j] === '}') { depth--; if (depth === 0) return g.slice(start, j + 1); }
  }
  throw new Error(`unbalanced braces after ${open}`);
}

const parts = [
  block(':root'),
  block('@font-palette-values --nabla-orange'),
  block('@font-palette-values --nabla-ink'),
  block('@font-palette-values --nabla-bone'),
  block('.brand-emphasis '),
  block('.brand-emphasis--ink'),
  block('.brand-emphasis--bone'),
  block('.brand-emphasis--chromatic '),
  block('.brand-emphasis--chromatic.brand-emphasis--ink'),
  block('.brand-emphasis--chromatic.brand-emphasis--bone'),
  block('.brand-emphasis__letter'),
  block('@keyframes brandEmphasisLetterIn'),
];

const header = `/* AUTO-SYNCED from can-yildiz.com by scripts/sync-brand.mjs — do not hand-edit. */\n\n`;
const still = `\n/* Still mode for deterministic capture (studio-local addition). */\n[data-still] .brand-emphasis__letter { opacity: 1; transform: none; animation: none; }\n`;
writeFileSync(join(studio, 'src/styles/tokens.css'), header + parts.join('\n\n') + '\n' + still);
console.log('✓ tokens.css (root + nabla palettes + brand-emphasis)');
console.log(`Synced from: ${site}`);
