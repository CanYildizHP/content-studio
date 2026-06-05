---
name: research-studio
description: End-to-end research workspace builder. Asks what you want to research and the purpose/direction, runs the `research` skill to gather and synthesize sources, then uses the `notebooklm` skill to create a NotebookLM notebook loaded with the discovered sources, your own material, and the research dossier — and optionally generates deliverables (infographic, flashcards, mind-map, slide-deck, quiz, audio/video). Finishes with a single combined Markdown brief. Use when the user wants to research a topic AND build a NotebookLM notebook/study workspace from it, mentions "research-studio", wants a research-to-notebook pipeline, or wants to turn research into NotebookLM deliverables.
---

# Research Studio

Orchestrates `research` + `notebooklm` into one workspace: gather → synthesize → build a notebook → (optional) deliverables → one combined brief.

## Intake (always ask first)

When invoked, ask the user these — accept inline answers if already given:
1. **Topic** — what are we researching?
2. **Purpose / direction** — how will this be used? (audience, angle, the piece it feeds, what "good" looks like). This steers `--focus`.
3. **Material you already have** — local paths, links, Google Drive files, or a NotebookLM notebook id. (Optional.)
4. **Deliverables?** — infographic / flashcards / mind-map / slide-deck / quiz / audio / video. **Default: none** if not specified.
5. **Depth** — `deep` (default) or `quick`.

If the user's request clearly maps to an **existing** studio (same topic/slug, or they passed a notebook id) and only asks for a deliverable, run **deliverable-only mode** (see [REFERENCE.md](REFERENCE.md#add-later)) — skip research and notebook creation.

## Full pipeline

### 1. Research
Invoke the **`research`** skill with the topic, `--focus "<purpose/direction>"`, the chosen `--depth`, and any links/material the user supplied. Let it run its own plan-confirm + lanes + verify. It writes `research/{date}-{slug}.md` and registers it in `research/INDEX.md`. **Capture the exact dossier filename it wrote** and its top ```json block.

> **Derive everything from that filename — never re-slugify the topic.** The `research` skill owns slug generation; if you kebab-case the topic yourself it may not match (punctuation, Turkish chars like ı/ş/ğ, trimming), breaking the brief→dossier link, the deliverables folder, and the registry key. From the captured filename `{date}-{slug}.md`, set `date` = the leading date and `slug` = the middle part (filename minus the date prefix and `.md`). Use that one `slug`/`date` for the brief name, `deliverables/{slug}/`, and the `_studio.json` key.

### 2. Assemble sources for the notebook
Build the source list to load (per the locked decision — all three):
- **Discovered sources:** every `sources[].url` from the dossier JSON that has a real URL.
- **Your material:** files in `research/_inbox/`, any local paths/links you gave, and Google Drive files (download Drive files to `research/_inbox/` first so they're local paths).
- **The dossier itself:** the captured dossier file from step 1 (`research/{date}-{slug}.md`).

### 3. Build the notebook (via `notebooklm` skill)
First ensure NotebookLM is installed + authenticated (the `notebooklm` skill checks this; `login` is user-run via `!`). Then:
- Create: `notebooklm create "<Topic> — studio {date}"` → capture the **notebook id**.
- `notebooklm use <id>`.
- For each source in the list: `notebooklm source add "<url-or-path>"`. Log successes/failures; skip and note any that fail (don't abort the run).

### 4. Deliverables (only if requested)
For each requested deliverable, run the matching `notebooklm generate ... --wait` then `notebooklm download ...` into `research/deliverables/{slug}/`. Command map + filenames are in [REFERENCE.md](REFERENCE.md#deliverables). If none requested, skip.

### 5. Combined brief
Write `research/{date}-{slug}-studio.md` (same `date`/`slug` derived in step 1, so it pairs with the dossier) using the template in [REFERENCE.md](REFERENCE.md#brief): topic, purpose/direction, executive summary, link to the full dossier, notebook id + how to open it, the exact source list loaded (with any failures noted), and deliverables with their download paths. This brief is **human-only** — it is NOT added to `INDEX.md`, so the downstream writing skill never mistakes it for a dossier.

### 6. Register
Run `python scripts/studio_registry.py upsert --slug <slug> --json '{...}'` to record the studio (notebook id, paths, sources, deliverables, dates) in `research/_studio.json`, so deliverable-only mode can find it later. Then give the user the brief path + a one-line summary.

## Dependencies
- The **`research`** and **`notebooklm`** skills must be installed (they are).
- `notebooklm-py` installed + logged in for steps 3–4; `yt-dlp` for the research YouTube lane.
- Sub-agents inherit your session model — run on Opus for best results.

See [REFERENCE.md](REFERENCE.md) for the deliverable command map, brief template, registry schema, and deliverable-only mode.
