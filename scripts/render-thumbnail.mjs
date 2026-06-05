#!/usr/bin/env node
// Render a brand thumbnail to PNG from the command line.
// The can-yildiz-writer skill calls this as its primary thumbnail path.
//
// Examples:
//   node scripts/render-thumbnail.mjs --title "Innovation that ships revenue" --emphasis revenue --out thumb.png
//   node scripts/render-thumbnail.mjs --json '{"title":"...","mode":"photo","portrait":"/portraits/portrait.png"}' --out t.png
//
// Flags: --title --emphasis --emphasis-style --kicker --sub --mode --variant
//        --portrait --name --role --out --base-url --scale --json --help
// If the dev server isn't already running at --base-url, the script starts
// `next dev` for the duration of the capture and shuts it down afterwards.

import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildRenderUrl, captureToBuffer, dimsForFormat } from '../src/lib/capture.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const { values } = parseArgs({
  options: {
    title: { type: 'string' }, emphasis: { type: 'string' }, 'emphasis-style': { type: 'string' },
    kicker: { type: 'string' }, sub: { type: 'string' }, mode: { type: 'string' },
    variant: { type: 'string' }, format: { type: 'string' }, portrait: { type: 'string' },
    name: { type: 'string' }, role: { type: 'string' }, out: { type: 'string' },
    'base-url': { type: 'string' }, scale: { type: 'string' }, json: { type: 'string' },
    help: { type: 'boolean' },
  },
});

if (values.help) {
  console.log('See header of scripts/render-thumbnail.mjs for usage.');
  process.exit(0);
}

// Merge: --json as base, individual flags override.
const base = values.json ? JSON.parse(values.json) : {};
const props = {
  ...base,
  ...(values.title !== undefined ? { title: values.title } : {}),
  ...(values.emphasis !== undefined ? { emphasis: values.emphasis } : {}),
  ...(values['emphasis-style'] !== undefined ? { emphasisStyle: values['emphasis-style'] } : {}),
  ...(values.kicker !== undefined ? { kicker: values.kicker } : {}),
  ...(values.sub !== undefined ? { sub: values.sub } : {}),
  ...(values.mode !== undefined ? { mode: values.mode } : {}),
  ...(values.variant !== undefined ? { variant: values.variant } : {}),
  ...(values.format !== undefined ? { format: values.format } : {}),
  ...(values.portrait !== undefined ? { portrait: values.portrait } : {}),
};
if (values.name !== undefined || values.role !== undefined) {
  props.byline = { ...(base.byline ?? {}) };
  if (values.name !== undefined) props.byline.name = values.name;
  if (values.role !== undefined) props.byline.role = values.role;
}

const out = resolve(values.out ?? 'thumbnail.png');
const scale = values.scale ? Number(values.scale) : 2;
const baseUrl = values['base-url'] ?? `http://localhost:${process.env.PORT ?? 3000}`;

async function reachable(url) {
  try {
    const ctrl = AbortSignal.timeout(2000);
    const res = await fetch(url, { signal: ctrl });
    return res.ok || res.status === 404; // server is up even if path 404s
  } catch {
    return false;
  }
}

function startServer(port) {
  const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const child = spawn(cmd, ['next', 'dev', '-p', String(port)], {
    cwd: root, stdio: 'ignore', shell: process.platform === 'win32',
  });
  return child;
}

function killTree(child) {
  if (!child || child.killed) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

async function waitUntilReachable(url, ms = 60000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await reachable(url)) return true;
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}

const main = async () => {
  let server = null;
  if (!(await reachable(baseUrl))) {
    const port = Number(new URL(baseUrl).port || 3000);
    console.log(`· starting next dev on :${port} (no server reachable at ${baseUrl})`);
    server = startServer(port);
    if (!(await waitUntilReachable(baseUrl))) {
      killTree(server);
      throw new Error(`dev server did not come up at ${baseUrl}`);
    }
  }
  try {
    const url = buildRenderUrl(baseUrl, props);
    const { w, h } = dimsForFormat(props.format);
    console.log(`· capturing [${props.format ?? 'web'} ${w}×${h}] ${url}`);
    const png = await captureToBuffer(url, { scale, width: w, height: h });
    writeFileSync(out, png);
    console.log(`✓ wrote ${out} (${(png.length / 1024).toFixed(0)} KB)`);
  } finally {
    if (server) killTree(server);
  }
};

main().catch((e) => {
  console.error('✗', e.message);
  process.exit(1);
});
