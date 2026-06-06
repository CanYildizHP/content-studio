// Single source of truth for the thumbnail's shape and its URL/CLI/JSON codec.
// The editor, the /thumbnail/render route, the Playwright script, and the
// can-yildiz-writer skill all agree on these names.

import { PORTRAIT_VALUES, DEFAULT_PORTRAIT } from './portraits';

export type ThumbnailMode = 'type' | 'photo' | 'sketch' | 'color-image';
export type ThumbnailVariant = 'ink' | 'cream';
export type EmphasisStyle = 'plain' | 'chromatic';
export type ThumbnailFormat = 'web' | 'li-square' | 'li-carousel' | 'li-portrait' | 'x-landscape';
export type Orient = 'land' | 'square' | 'portrait';

export interface FormatSpec {
  id: ThumbnailFormat;
  label: string;
  w: number;
  h: number;
  ratio: string;
  serves: string;
}

// 4 canvases by aspect ratio (dims verified against 2026 platform specs).
// NOTE: capture.mjs keeps a parallel FORMAT_DIMS map — keep the numbers in sync.
export const FORMATS: FormatSpec[] = [
  { id: 'web',          label: 'Web / OG',        w: 1200, h: 630,  ratio: '1.91:1', serves: 'website hero · LinkedIn link-share · X summary card' },
  { id: 'li-square',    label: 'LinkedIn square',   w: 1200, h: 1200, ratio: '1:1',    serves: 'LinkedIn single image post' },
  { id: 'li-carousel',  label: 'LinkedIn carousel', w: 1080, h: 1080, ratio: '1:1',    serves: 'LinkedIn carousel slide (document post)' },
  { id: 'li-portrait',  label: 'Portrait 4:5',      w: 1080, h: 1350, ratio: '4:5',    serves: 'LinkedIn portrait carousel slide · X portrait' },
  { id: 'x-landscape',  label: 'X in-stream',     w: 1600, h: 900,  ratio: '16:9',   serves: 'X/Twitter in-stream image' },
];
export const FORMAT_BY_ID: Record<string, FormatSpec> = Object.fromEntries(FORMATS.map((f) => [f.id, f]));

export function orientOf(f: FormatSpec): Orient {
  const r = f.w / f.h;
  if (r > 1.2) return 'land';
  if (r < 0.95) return 'portrait';
  return 'square';
}

export interface Byline {
  name: string;
  role: string;
}

export interface ThumbnailProps {
  kicker: string;
  title: string;
  emphasis?: string;        // one word inside `title` rendered in the brand orange
  emphasisStyle: EmphasisStyle;
  sub?: string;
  byline: Byline;
  mode: ThumbnailMode;
  portrait?: string;        // /public path; required for photo|sketch
  variant: ThumbnailVariant;
  format: ThumbnailFormat;
  align: 'left' | 'center'; // horizontal alignment of the text block
  titleSize?: number;       // px override; undefined = auto (length-based × format scale)
  subSize?: number;         // px override for the sub-line
  nameSize?: number;        // px override for the byline name
  roleSize?: number;        // px override for the byline role
}

export const DEFAULTS: ThumbnailProps = {
  kicker: 'can-yildiz.com',
  title: 'Innovation that ships revenue.',
  emphasis: 'revenue',
  emphasisStyle: 'chromatic',
  sub: '',
  byline: { name: 'Can Yildiz', role: 'Chief Innovation Officer · WEFRA LIFE · Frankfurt' },
  mode: 'type',
  portrait: DEFAULT_PORTRAIT,
  variant: 'ink',
  format: 'web',
  align: 'left',
};

const MODES: ThumbnailMode[] = ['type', 'photo', 'sketch', 'color-image'];
const VARIANTS: ThumbnailVariant[] = ['ink', 'cream'];
const EMPH: EmphasisStyle[] = ['plain', 'chromatic'];
const FORMAT_IDS: ThumbnailFormat[] = ['web', 'li-square', 'li-portrait', 'x-landscape'];

type FlatInput = Record<string, string | undefined> | URLSearchParams;

function get(src: FlatInput, key: string): string | undefined {
  const v = src instanceof URLSearchParams ? src.get(key) ?? undefined : src[key];
  return v == null || v === '' ? undefined : v;
}
function oneOf<T extends string>(v: string | undefined, allow: T[], fallback: T): T {
  return v && (allow as string[]).includes(v) ? (v as T) : fallback;
}
function num(v: string | undefined): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const UPLOAD_RE = /^\/uploads\/[A-Za-z0-9._-]+$/;
export function isAllowedPortrait(path: string | undefined): boolean {
  return !!path && (PORTRAIT_VALUES.has(path) || UPLOAD_RE.test(path));
}

/** Build validated props from flat URL params / a plain object. Safe for the
 *  headless render route: validates enums and the portrait allow-list. */
export function paramsToProps(src: FlatInput): ThumbnailProps {
  const mode = oneOf(get(src, 'mode'), MODES, DEFAULTS.mode);
  let portrait: string | undefined = get(src, 'portrait') ?? DEFAULTS.portrait;
  if (!isAllowedPortrait(portrait)) portrait = undefined;

  // photo/sketch need a valid portrait; otherwise fall back to type
  const safeMode: ThumbnailMode = mode !== 'type' && !portrait ? 'type' : mode;

  return {
    kicker: get(src, 'kicker') ?? DEFAULTS.kicker,
    title: get(src, 'title') ?? DEFAULTS.title,
    emphasis: get(src, 'emphasis'),
    emphasisStyle: oneOf(get(src, 'emphasisStyle'), EMPH, DEFAULTS.emphasisStyle),
    sub: get(src, 'sub'),
    byline: {
      name: get(src, 'name') ?? DEFAULTS.byline.name,
      role: get(src, 'role') ?? DEFAULTS.byline.role,
    },
    mode: safeMode,
    portrait,
    variant: oneOf(get(src, 'variant'), VARIANTS, DEFAULTS.variant),
    format: oneOf(get(src, 'format'), FORMAT_IDS, DEFAULTS.format),
    align: oneOf(get(src, 'align'), ['left', 'center'], DEFAULTS.align),
    titleSize: num(get(src, 'titleSize')),
    subSize: num(get(src, 'subSize')),
    nameSize: num(get(src, 'nameSize')),
    roleSize: num(get(src, 'roleSize')),
  };
}

/** Merge a partial object (editor state, JSON from the API/skill) onto defaults. */
export function fromPartial(input: Partial<ThumbnailProps> & { byline?: Partial<Byline> }): ThumbnailProps {
  return {
    ...DEFAULTS,
    ...input,
    byline: { ...DEFAULTS.byline, ...(input.byline ?? {}) },
  };
}

/** Flatten props to URL search params (for the render route + the CLI). */
export function propsToSearchParams(p: ThumbnailProps): URLSearchParams {
  const sp = new URLSearchParams();
  sp.set('title', p.title);
  sp.set('kicker', p.kicker);
  if (p.sub) sp.set('sub', p.sub);
  if (p.emphasis) sp.set('emphasis', p.emphasis);
  sp.set('emphasisStyle', p.emphasisStyle);
  sp.set('mode', p.mode);
  sp.set('variant', p.variant);
  sp.set('format', p.format);
  sp.set('align', p.align);
  if (p.titleSize) sp.set('titleSize', String(p.titleSize));
  if (p.subSize) sp.set('subSize', String(p.subSize));
  if (p.nameSize) sp.set('nameSize', String(p.nameSize));
  if (p.roleSize) sp.set('roleSize', String(p.roleSize));
  if (p.portrait) sp.set('portrait', p.portrait);
  sp.set('name', p.byline.name);
  sp.set('role', p.byline.role);
  return sp;
}

/** Split a title around the emphasis word (first whole-word, case-insensitive). */
export function splitTitle(title: string, emphasis?: string): { before: string; word?: string; after: string } {
  if (!emphasis) return { before: title, after: '' };
  const re = new RegExp(`\\b(${emphasis.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'i');
  const m = title.match(re);
  if (!m || m.index === undefined) return { before: title, after: '' };
  return {
    before: title.slice(0, m.index),
    word: title.slice(m.index, m.index + m[0].length),
    after: title.slice(m.index + m[0].length),
  };
}

/** Length-based title size (mirrors the site OG heuristic). */
export function titleFontSize(title: string): number {
  const n = title.length;
  if (n <= 22) return 68;
  if (n <= 38) return 58;
  if (n <= 56) return 48;
  return 40;
}
