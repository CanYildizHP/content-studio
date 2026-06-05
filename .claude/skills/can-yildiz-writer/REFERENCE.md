# can-yildiz-writer — Reference

Operational detail for the pipeline in [SKILL.md](SKILL.md). Read the section you need.

## 1. Loading research (slug → registry)

1. The user gives a **slug** (or it's inferable from the request). Resolve it from the studio registry:
   `python <research-studio>/scripts/studio_registry.py get --slug <slug>` (or read `research/_studio.json`).
   That yields: dossier path `research/{date}-{slug}.md`, the **notebook id**, and any deliverables.
2. **Fallback:** if no registry entry, accept a direct path to `research/{date}-{slug}.md`.
3. Read the **dossier** — both the top ```json block (sources, claims) and the Markdown synthesis.
4. Read the three standing assets (`voice-guide.md`, `samples.md`, `proof-bank.md`).
5. The studio **brief** (`research/{date}-{slug}-studio.md`) is human-only — don't treat it as a dossier.

## 2. Angle (Gate 1)

Propose **one** angle + a section outline. For each major beat, name the **proof-bank entry** or
**dossier source** that anchors it. Flag any place where a first-hand claim would strengthen the
piece but isn't in the proof-bank — ask Can to confirm it (and, if real, it gets added to
`proof-bank.md`). Do not proceed to drafting without sign-off.

## 3. Drafting

- Canonical piece is **long-form** (≈900–1800 words). English unless Can asked for German.
- Two claim sources only: **dossier** (topical facts, cited) and **proof-bank** (first-hand).
  Nothing invented — no fabricated metrics, named systems, or "I" claims absent from the proof-bank.
- Apply `voice-guide.md` continuously. Run its self-check before presenting at Gate 2.

## 4. GEO loop (Gates 3) — capped at one iteration

Run on the **local draft text**, not a URL (the piece isn't published yet). Invoke the geo skills
and feed them the draft file:

| Skill | Output | What we use |
|---|---|---|
| `geo-citability` | citability score (0–100) + rewrite suggestions | answer-block extractability, self-contained 134–167-word passages, definition openings |
| `geo-content` | E-E-A-T scores + **AI-content detection** + readability | flag AI-tells, confirm Experience signal is strong, depth/structure |

**The tension rule (decisive):** geo-citability pushes formulaic "X is…" answer blocks; the voice is
spare and anti-formulaic. **Apply a GEO suggestion only if it does not violate `voice-guide.md`.**
Voice wins on ties. In practice: adopt citability's *structural* wins (lead each section with the
answer, specific nouns/numbers, self-contained passages — these align with "bias to shipped / lead
with the result") and **reject** its *stylistic* ones (boilerplate definitions, keyword padding,
hype). Re-run the two skills once to confirm scores moved up, then present a tight diff at Gate 3.

`geo-content`'s AI-content detection is also the explicit **"don't sound like AI"** gate — if it
flags tells, fix them before Gate 3, leaning on `samples.md` exemplars.

## 5. Variants

Derive from the approved canonical article:
- **LinkedIn** — hook + spare body + one takeaway. Institutional, not influencer.
- **X/Twitter thread** — number the posts; **watch cadence** so the punchy format doesn't drift into
  hype. Re-check against the voice guide's "avoid" list.
- **Newsletter section** — subject line + short intro + the piece's spine.

## 6. Thumbnail (Gate 4)

The thumbnail is a **slotted system**: constants never change; one imagery layer swaps per piece.

**Constants (every thumbnail, all modes):**
- The **Star corner-bug** — orange `#FF1B00`, −12° tilt, bottom-right stamp. The identity anchor.
  On an orange/light surface its fill swaps to bone `#F4F2EE`.
- Color tokens (ink/cream + one orange accent) and the Space Grotesk title / mono kicker / CY byline.

**Mode (pick per piece) — the swappable imagery layer:**
- **type** — typographic only (no portrait). Default.
- **photo** — Can's real photo, brand-treated, in a right-hand column (~38% width). Source from
  `brand/portraits/`.
- **sketch** — a line/illustration of Can in the same slot.

**Photo/sketch treatment (deterministic, on-brand — mirrors the site's treated photo column):**
**photo** = `grayscale(1)` + slight contrast in a right-hand ~38% column with a thin seam border
(matches the site's hero/work photos). **sketch** = an SVG `feColorMatrix` duotone (shadows → ink
`#0E0E0E`, highlights → bone `#F4F2EE`) over the same column. No image model needed; likeness always
comes from Can's real photo. With a portrait present the frame is 2-column (text left, portrait right).

### Render path A — Content Studio generator (PRIMARY)

The brand thumbnail generator lives in the local **`content-studio`** app
(`~/Desktop/Git/content-studio`). It renders a real-DOM `<Thumbnail>` with the actual fonts, tokens,
the Nabla chromatic emphasis, and the Star, then screenshots it with Playwright at 1200×630 (×2).

Call the CLI (it reuses a running `next dev`, or starts one for the capture):

```
node ~/Desktop/Git/content-studio/scripts/render-thumbnail.mjs \
  --json '<ThumbnailProps JSON>' --out "<output-dir>/thumbnail.png"
```

`ThumbnailProps` (the shared contract):
`{ title, kicker?, sub?, emphasis?, emphasisStyle?: "chromatic"|"plain", mode?: "type"|"photo"|"sketch",
variant?: "ink"|"cream", format?: "web"|"li-square"|"li-portrait"|"x-landscape",
portrait?: "/portraits/<file>", byline?: { name, role } }`.

**Formats** (pick per channel; render one piece in several):
- `web` 1200×630 (1.91:1) — website/OG hero, LinkedIn link-share, X summary card.
- `li-square` 1200×1200 (1:1) — LinkedIn single image.
- `li-portrait` 1080×1350 (4:5) — LinkedIn portrait + carousel page, X portrait.
- `x-landscape` 1600×900 (16:9) — X/Twitter in-stream.
In `photo`/`sketch` mode, `land` formats put the portrait in a right column; `square`/`portrait`
formats render it full-bleed behind a scrim. Generate the relevant formats per channel when
producing the LinkedIn/X variants (§5). Multi-page carousel PDFs are a future addition.

Defaults fill kicker (`can-yildiz.com`) and byline (Can Yildiz / CIO · WEFRA LIFE · Frankfurt). For
photo/sketch, `portrait` must be one of the app's allow-listed `public/portraits/*` (add new portraits
there + to `src/components/thumbnail/portraits.ts`). Equivalent path: navigate the Chrome MCP to
`http://localhost:<port>/thumbnail/render?<params>`, wait for `window.__thumbReady`, screenshot `#thumb`.
Keep the same param names: `title, kicker, sub, emphasis, emphasisStyle, mode, variant, portrait, name, role`.

### Render path B — bundled HTML (offline fallback only)

If `content-studio` isn't available, fall back to the bundled `templates/thumbnail.html` (type-only,
Google-Fonts, Star corner-bug) rendered via headless Chrome at 1200×630. Lower fidelity (no Nabla, no
photo treatment) — use only when path A can't run.

**Optional from-scratch AI-image hook (off by default):** abstract background *textures* only (never
a depiction of Can — likeness must come from his real photo). Gate explicitly; it risks the "looks
like AI" problem. The generator is always the baseline.

## 7. Schema

Run `geo-schema` to emit JSON-LD for the piece: an **Article** (headline, author, datePublished,
about, the canonical body) plus a reference to the **Person** entity (Can Yildiz — reuse the
`#person` identity from can-yildiz.com so it resolves to one entity). Save as `schema.json`.

## 8. Publish (Gate 5)

On approval, write:

```
Brain/output/{date}-{slug}/
├── article.md            # canonical long-form, with the schema in frontmatter or alongside
├── variants/
│   ├── linkedin.md
│   ├── x-thread.md
│   └── newsletter.md
├── thumbnail.html        # filled template
├── thumbnail.png         # rendered 1200×630
├── schema.json           # Article + Person JSON-LD
└── geo-report.md         # before/after citability + content scores, what was applied/rejected
```

Then push the final article to the standing **"Can Yildiz — Final Outputs"** NotebookLM notebook
(via the `notebooklm` skill): if the notebook doesn't exist yet, `notebooklm create
"Can Yildiz — Final Outputs"` and record its id in `brand/../_final_notebook.txt` (or note it in the
output folder) so future runs reuse the same library; then `notebooklm use <id>` and
`notebooklm source add "<path to article.md>"`. Log success/failure; don't abort the run on a
notebook failure — the Brain folder is the source of truth.

## 9. Voice learning (after every publish)

Append a short entry to `voice/samples.md` under "Learned phrasings": the opening that worked, one
move to reuse, one thing to avoid next time. Over runs this sharpens the voice. If Can pastes a full
real piece, add it as a `## Sample —` exemplar. This is how the skill "learns his tone over time"
without ever overwriting the canonical `voice-guide.md`.

## Dependencies

- `research` / `research-studio` / `notebooklm` skills installed (they are).
- `geo-citability`, `geo-content`, `geo-schema` skills (in `geo-seo-claude`, installed).
- Headless Chrome MCP (wired) **or** Playwright/Puppeteer for thumbnail rendering.
- Deferred to post-publish on the live URL: `geo-technical`, `geo-crawlers`,
  `geo-platform-optimizer`, `geo-llmstxt`.
