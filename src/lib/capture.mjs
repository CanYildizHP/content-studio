// Shared thumbnail capture helper — used by the Download API route and the CLI
// script so they never drift. Drives the already-installed Playwright chromium
// to the /thumbnail/render route and screenshots the #thumb element.

import { chromium } from '@playwright/test';

const DEFAULTS = {
  kicker: 'can-yildiz.com',
  emphasisStyle: 'chromatic',
  mode: 'type',
  variant: 'ink',
  format: 'web',
  name: 'Can Yildiz',
  role: 'Chief Innovation Officer · WEFRA LIFE · Frankfurt',
};

// Parallel to FORMATS in thumbnail-params.ts — keep the dimensions in sync.
export const FORMAT_DIMS = {
  web: { w: 1200, h: 630 },
  'li-square': { w: 1200, h: 1200 },
  'li-portrait': { w: 1080, h: 1350 },
  'x-landscape': { w: 1600, h: 900 },
};

export function dimsForFormat(format) {
  return FORMAT_DIMS[format] ?? FORMAT_DIMS.web;
}

/** Build the headless render URL from a (possibly partial) props object.
 *  Mirrors propsToSearchParams in thumbnail-params.ts — keep the names in sync. */
export function buildRenderUrl(baseUrl, props = {}) {
  const u = new URL('/thumbnail/render', baseUrl);
  const s = u.searchParams;
  s.set('title', props.title ?? '');
  s.set('kicker', props.kicker ?? DEFAULTS.kicker);
  if (props.sub) s.set('sub', props.sub);
  if (props.emphasis) s.set('emphasis', props.emphasis);
  s.set('emphasisStyle', props.emphasisStyle ?? DEFAULTS.emphasisStyle);
  s.set('mode', props.mode ?? DEFAULTS.mode);
  s.set('variant', props.variant ?? DEFAULTS.variant);
  s.set('format', props.format ?? DEFAULTS.format);
  if (props.align) s.set('align', props.align);
  if (props.titleSize) s.set('titleSize', String(props.titleSize));
  if (props.subSize) s.set('subSize', String(props.subSize));
  if (props.portrait) s.set('portrait', props.portrait);
  s.set('name', props.byline?.name ?? props.name ?? DEFAULTS.name);
  s.set('role', props.byline?.role ?? props.role ?? DEFAULTS.role);
  return u.toString();
}

/** Navigate to a render URL and return a PNG Buffer of the #thumb element.
 *  Pass the format's width/height so the viewport fits the canvas. */
export async function captureToBuffer(url, { scale = 2, timeout = 30000, width = 1200, height = 630 } = {}) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
    await page.goto(url, { waitUntil: 'networkidle', timeout });
    await page.waitForFunction(() => window.__thumbReady === true, { timeout });
    return await page.locator('#thumb').screenshot({ type: 'png' });
  } finally {
    await browser.close();
  }
}
