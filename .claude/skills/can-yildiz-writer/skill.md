---
name: can-yildiz-writer
description: Turn /research-studio research into a publish-ready, on-brand Can Yildiz article — in his voice, GEO/SEO-optimized, with a branded thumbnail and JSON-LD schema, delivered to the Brain vault and a standing NotebookLM library. Use when Can wants to write an article/post from research, mentions "can-yildiz-writer", wants to turn a research-studio studio/slug into published writing, or wants branded content drafted in his tonality.
---

# Can Yildiz Writer

Pipeline: **load research → write in voice → GEO loop → variants → branded thumbnail → schema → publish**.
Gated at every stage (Can reviews and approves each). The voice and the truth of every claim are non-negotiable.

## Standing assets (read EVERY run, before writing)

| File | Role |
|---|---|
| `voice/voice-guide.md` | The tonality. Hard rules for how Can writes. This governs all output. |
| `voice/samples.md` | Few-shot exemplars + learned phrasings. **Append to this after each published piece** (see REFERENCE → Voice learning). |
| `proof/proof-bank.md` | Can's real shipped/built/failed artifacts, roles, metrics, vocabulary. **First-hand claims may ONLY come from here.** Read-only per run; Can maintains it. |
| `brand/brand-system.md` | Visual tokens (color, type, the Star) for the thumbnail. |

If a first-hand "I built / I shipped / it failed" claim is not traceable to `proof-bank.md`, **do not write it.** Ask Can at Gate 1 or leave it out. Never invent experience, numbers, or named artifacts.

## Inputs

```
/can-yildiz-writer <slug> [--direction "angle"] [--audience "who"] [--lang de]
```

- A research-studio **slug** (preferred) → look it up in `research/_studio.json` to resolve the dossier path, notebook id, and deliverables. Fallback: a direct path to `research/{date}-{slug}.md`.
- `--direction` — the story thread or argument angle to anchor the piece (pre-populated by Content Studio Runner).
- `--audience` — the primary audience for this article (pre-populated by Content Studio Runner).
- Language: **English by default**; produce German only when Can asks (`--lang de`).

## Intake (ask before loading research if not already provided)

When invoked without `--direction` / `--audience` or inline context, ask Can **before** the pipeline:

1. **Angle / direction** — what story thread, argument, or claim should anchor this piece? Any narrative from the research you want to foreground?
2. **Key proof points to highlight** — which entries from the proof-bank should headline this? (optional — you may prefer Can proposes at Gate 1)
3. **Target audience** — who should this article resonate with most?
4. **Constraints / tone notes** — any word-count target, topics to avoid, or specific tone emphasis for this piece?

If `--direction`, `--audience`, or the invocation already contains this context, treat it as pre-answered — do **not** re-ask. If invoked via Content Studio Runner, all intake is pre-populated.

## Pipeline (5 gates)

1. **Load research** — resolve slug → dossier (+ notebook id). Read the dossier, `voice-guide.md`, `samples.md`, `proof-bank.md`.
2. **🚦 Gate 1 — Angle** — propose 1 angle + outline, built from `dossier × proof-bank`. Show which proof points anchor it. Get approval before writing.
3. **Draft** — write the canonical long-form article in voice. Every claim traces to the dossier (topical) or proof-bank (first-hand).
4. **🚦 Gate 2 — Draft** — present the draft; Can confirms every claim is real.
5. **GEO loop (capped, 1 iteration)** — run `geo-citability` + `geo-content` on the local draft text → apply suggestions **only where they don't violate `voice-guide.md`** (voice wins on ties) → re-score once. See REFERENCE → GEO.
6. **🚦 Gate 3 — GEO rewrite** — show a tight diff; Can approves the optimized version.
7. **Variants** — derive LinkedIn post, X/Twitter thread, newsletter section. Each re-checked against the voice guide (watch X cadence vs. "no hype").
8. **Thumbnail** — slotted system. Constants: the **Star corner-bug** + brand colors. Pick a **mode**: `type` (default) · `photo` · `sketch`. Render PNG 1200×630 via the **Content Studio generator** (`~/Desktop/Git/content-studio/scripts/render-thumbnail.mjs --json '<ThumbnailProps>'`), which uses the real fonts/tokens/Star + Nabla; bundled HTML is the offline fallback. See REFERENCE → Thumbnail.
9. **🚦 Gate 4 — Thumbnail** — show the PNG; Can approves.
10. **Schema** — `geo-schema` emits Article + Person JSON-LD as a publish artifact.
11. **🚦 Gate 5 — Publish** — on approval: write `Brain/output/{date}-{slug}/` (article.md, variants/, thumbnail.svg+png, schema.json, geo-report.md) **and** push the final article to the standing **"Can Yildiz — Final Outputs"** NotebookLM notebook. Then append a voice-learning note to `samples.md`.

Keep every gate **tight** — a short summary or diff, not a wall of text.

## Deferred (need a live site, run separately post-publish)

`geo-technical`, `geo-crawlers`, `geo-platform-optimizer`, `geo-llmstxt` — these audit a deployed URL. Run them after the piece is live on can-yildiz.com, not here.

See [REFERENCE.md](REFERENCE.md) for: GEO command mapping, the voice↔citability tension rule, thumbnail render steps, output structure, NotebookLM publish, and voice learning.
