// Shared config for the "rewrite selection" feature, imported by both the API
// route (src/app/api/rewrite/route.ts) and the editor UI (RewriteBubbleMenu).
// Keeping the tone presets and model allow-list here means the two sides can
// never drift — the route validates against the same lists the UI offers.

/**
 * The baseline brand voice applied to every rewrite, distilled from the
 * can-yildiz-writer skill's voice-guide.md. Per-selection tone + guidance is
 * layered on top of this.
 */
export const CAN_YILDIZ_VOICE = `You are rewriting prose in the voice of Can Yildiz, a C-level intrapreneur in European healthcare media (incoming Chief Innovation Officer at WEFRA LIFE) who builds the things he ships: Django, Next.js, AI-agent workflows. The register is "executive operator who builds": institutional editorial like Stripe Press or Notion/Figma editorial. Not personal-brand-guru, not motivational-LinkedIn.

Core qualities:
- Bias to shipped. Concrete, built, live, not plans and frameworks in the abstract.
- Precise over expansive. Real operating vocabulary used because it's the language of the work, never to perform expertise.
- Calm authority. Declarative and grounded; claims tied to specifics, numbers, or shipped artifacts.
- Spare. Engineering-document sensibility. Short sentences carry weight. No filler.
- European, bilingual; never Americanized hustle-speak.

Hard avoid list:
- Hype words: "game-changer," "revolutionary," "unlock," "supercharge," "seamless," "cutting-edge."
- False humility ("just a simple…", "I'm no expert, but…").
- Motivational/LinkedIn cadence (one-line crescendos, "Here's the thing."), rhetorical-question openers, "Let that sink in."
- Em dashes, entirely. Never use an em dash (—) or an en dash (–) as a sentence break or aside. Use a period, comma, colon, parentheses, or split into separate sentences instead. This also kills the em-dash-and-tricolon AI tell. Vary sentence structure like a human engineer would.

Numbers are specific or absent. No "significantly," "dramatically," "a lot." Lead with the result or artifact, then the how.`;

export interface TonePreset {
  id: string;
  label: string;
  instruction: string;
}

/** Tone chips offered in the bubble menu. `instruction` is appended to the system prompt. */
export const TONE_PRESETS: TonePreset[] = [
  { id: 'concise', label: 'Concise', instruction: 'Tighten the passage. Cut filler and redundancy; keep every load-bearing fact. Make it shorter without losing meaning.' },
  { id: 'punchier', label: 'Punchier', instruction: 'Sharpen the passage. Lead with the strongest point, prefer concrete nouns and active verbs, vary sentence length so short sentences land.' },
  { id: 'formal', label: 'More formal', instruction: 'Raise the register to institutional-editorial. Remove colloquialisms while keeping it spare and direct.' },
  { id: 'simplify', label: 'Simplify', instruction: 'Make the passage clearer and easier to read for a non-specialist, without dumbing down the substance or adding hype.' },
  { id: 'expand', label: 'Expand', instruction: 'Develop the passage with one concrete supporting detail or chain of reasoning. Stay grounded. Do not invent facts, numbers, or claims.' },
  { id: 'grammar', label: 'Fix grammar', instruction: 'Correct grammar, spelling, and punctuation only. Preserve the wording, voice, and meaning as closely as possible.' },
];

// `provider` selects which local CLI the route shells out to — no API keys.
// 'anthropic' → the `claude` CLI (Claude subscription); 'openai' → `codex exec`
// (ChatGPT subscription).
export type RewriteProvider = 'anthropic' | 'openai';

export interface RewriteModel {
  provider: RewriteProvider;
  id: string;
  label: string;
}

/** Models selectable in the bubble menu and accepted by the API route.
 *  OpenAI ids are limited to what a ChatGPT account allows through Codex
 *  (gpt-5.5 / gpt-5.4 verified; the -mini / -codex variants are rejected). */
export const REWRITE_MODELS: RewriteModel[] = [
  { provider: 'anthropic', id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
  { provider: 'anthropic', id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { provider: 'anthropic', id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  { provider: 'openai', id: 'gpt-5.5', label: 'OpenAI GPT-5.5' },
  { provider: 'openai', id: 'gpt-5.4', label: 'OpenAI GPT-5.4' },
];

export const DEFAULT_MODEL_ID = 'claude-opus-4-8';

// ── Derive: regenerate a short-form deliverable from the canonical article ──
// The directive every derive shares: open a real curiosity gap, never clickbait.
export const CURIOSITY_DIRECTIVE =
  'Goal: make the reader want to read the full article. Open a genuine curiosity gap — ' +
  'surface the tension, the surprising result, or the question the article answers, and ' +
  'stop before giving the payoff away. The curiosity must be earned by a real insight from ' +
  'the article, never manufactured. No clickbait, no fake suspense, no "you won\'t believe", ' +
  'no hype. It should read like Can, not like a growth hacker.';

export interface DeriveFormat {
  /** Matched against the deliverable's file basename. */
  match: (basename: string) => boolean;
  instruction: string;
}

// Format spec per deliverable kind, keyed by the file basename the editor uses.
// Order matters — first match wins (so 'linkedin-first-comment-hook' is tested
// before the generic 'linkedin' fallback).
const DERIVE_FORMATS: DeriveFormat[] = [
  {
    match: (b) => b.includes('first-comment'),
    instruction: 'Produce a LinkedIn first-comment hook: 2–4 lines that give a genuine foreshadow — name the article\'s occasion, the tension it holds, or the specific result it documents, just enough to make the reader want more without giving the payoff away. End with exactly this phrase on its own line: "Full article in the first comment." No link in the body.',
  },
  {
    match: (b) => b.includes('hook'),
    instruction: 'Produce 3–5 standalone LinkedIn hooks (one per line or short block), each a different curiosity angle on the article. Each must stand alone as a scroll-stopping opener. No body, just the hooks.',
  },
  {
    match: (b) => b.includes('linkedin'),
    instruction: 'Produce a LinkedIn post derived from the article. Three parts:\n1. Opening hook — one or two sentences that name a specific tension, result, or revealing moment from the piece. Not a rhetorical question. Not a listicle opener ("X things I learned"). Name something real and concrete from the article.\n2. Body — 2–3 short paragraphs that advance the foreshadow: the occasion or context the article documents, the question it answers, or the change it describes. Tease the argument without resolving it. Spare. No filler. No hype.\n3. Closing line — exactly this phrase, nothing else on that line: "Full article in the first comment."\n\nInstitutional, not influencer. No link in the body.',
  },
  {
    match: (b) => b.includes('thread') || b === 'x' || b.includes('twitter'),
    instruction: 'Produce a numbered X/Twitter thread derived from the article. Post 1 is a curiosity hook; each following post advances one idea; the last points to the full article. Watch cadence so it never drifts into hype.',
  },
  {
    match: (b) => b.includes('newsletter'),
    instruction: 'Produce a newsletter section: a curiosity-driven subject line, a short intro that opens the gap, and the spine of the piece, ending with a pull to read the full article.',
  },
];

/** Resolve the format instruction for a deliverable, falling back to a generic
 *  short-form curiosity piece labelled with its human name. */
export function deriveInstructionFor(basename: string, label: string): string {
  const fmt = DERIVE_FORMATS.find((f) => f.match(basename.toLowerCase()));
  if (fmt) return fmt.instruction;
  return `Produce a short "${label}" derived from the article, in Can's voice, opening a curiosity gap that pulls the reader to the full piece.`;
}

/** Look up a model by id, used by the route to validate the requested model. */
export function findModel(id: string): RewriteModel | undefined {
  return REWRITE_MODELS.find((m) => m.id === id);
}

/** Look up a tone preset by id. */
export function findTone(id: string | undefined): TonePreset | undefined {
  return id ? TONE_PRESETS.find((t) => t.id === id) : undefined;
}
