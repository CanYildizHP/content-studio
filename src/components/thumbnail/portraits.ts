// Allow-list of portraits the generator can place. These live in public/portraits
// (copied from can-yildiz.com via scripts/sync-brand or by hand). The render route
// validates `portrait` against this list — an unknown path downgrades to type mode,
// so the headless route can't be pointed at arbitrary files.

export type Portrait = { value: string; label: string };

export const PORTRAITS: Portrait[] = [
  { value: '/portraits/portrait.png', label: 'Studio portrait' },
  { value: '/portraits/Can-Yildiz-WEFRA-LIFE.webp', label: 'WEFRA LIFE' },
  { value: '/portraits/Can-Yildiz-Healthy-Programmatic.webp', label: 'Healthy Programmatic' },
];

export const PORTRAIT_VALUES = new Set(PORTRAITS.map((p) => p.value));
export const DEFAULT_PORTRAIT = PORTRAITS[0].value;
