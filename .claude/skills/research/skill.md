---
name: research
description: Parallel multi-source research engine for content generation. Researches a topic deeply across news, authoritative sources, community discussion, YouTube transcripts, the user's own saved material, and optionally a NotebookLM notebook, then writes a structured dossier (machine-readable JSON block + human-readable Markdown) for a downstream writing skill. Use when the user wants to research a topic for content, asks to "research", build a dossier/brief, gather sources on a subject, or prepare material before writing a piece.
---

# Research

A parallel, multi-source research engine. Given a topic, fan out concurrent research sub-agents, synthesize, adversarially verify, and write a dossier that a separate writing skill will consume.

## Invocation

```
/research <topic> [--depth quick|deep] [--focus "angle"] [--audience "who"] [--notebook <name>] [--auto-confirm]
```
The user may also paste links or raw text inline — treat those as user-supplied sources. Default depth is **deep**.

`--auto-confirm` — **Content Studio Runner mode**. The user already gave all direction via the intake form. In this mode you MUST:
- Output at most 4–5 lines summarising topic + lanes (no table, no "say go", no confirmation request)
- Then **immediately call the `Agent` tool** to spawn sub-agents — do this in the SAME response, right after the plan lines, without ending your turn

## Intake (ask before planning if not already provided)

When invoked without `--focus` / `--audience` or an explicit direction already given inline, ask the user **before** step 1:

1. **Purpose / direction** — how will this research be used? What piece, goal, or decision does it feed?
2. **Target audience** — who is this for? (shapes depth, framing, and source weighting)
3. **Angle / focus** — any specific perspective, sub-topic, or slant to emphasize? Any competing views to cover?
4. **Sources to prioritize** — any specific sites, people, papers, links, or existing material to include or avoid?
5. **Depth** — `deep` (default) or `quick`?

If `--focus`, `--audience`, or the invocation already contains this context, treat it as pre-answered — do **not** re-ask. If invoked via Content Studio Runner with `--auto-confirm`, all intake is pre-populated; skip to step 1.

## Workflow (follow in order)

### 1. Parse & plan
- Read the topic, flags, and any pasted links/text.
- Decide `recency_mode`: **fast-moving** (news, releases, fast-changing) vs **evergreen** (concepts, history, stable subjects). See [REFERENCE.md](REFERENCE.md#recency).
- Pick lanes (see step 2). Echo a SHORT plan: lanes to run, recency read, rough number of sources.
- **If `--auto-confirm` is NOT set:** output the full plan table, say "Ready to fan out? Say **go**." and STOP — wait for the user before continuing.
- **If `--auto-confirm` IS set:** output at most 4–5 lines (topic + lane names only), then **immediately call `Agent` to spawn the sub-agents without ending your response**. Do not output "say go", a table, or any confirmation message.
- Ensure `./research/` and `./research/_inbox/` exist (create if missing).

### 2. Fan out parallel sub-agents (one per lane)
Spawn all lanes concurrently in a single message with multiple `Agent` calls (`subagent_type: general-purpose`). Each lane returns structured findings per the contract in [REFERENCE.md](REFERENCE.md#lane-contract). Lane prompts are in [REFERENCE.md](REFERENCE.md#lane-prompts).

**deep (default) — ~5–6 lanes:**
1. Recent news / press
2. Authoritative / primary (official docs, papers, standards, org sites)
3. Discussion / community (Reddit, HN, forums)
4. YouTube — transcripts + metadata only, via `scripts/yt_research.py` (no media download)
5. User's saved material — `./research/_inbox/`, Google Drive (`mcp__claude_ai_Google_Drive__*`), pasted links/text
6. NotebookLM — **only if `--notebook <name>`** given; delegate to the `notebooklm` companion skill to export the notebook to Markdown

**quick — ~2–3 lanes:** news + authoritative + user material; top hits only.

Search sources in **any language** (incl. Turkish). Dedupe across lanes, then deep-read the top ~3–5 sources per lane with `WebFetch` (use Chrome browser automation only as a fallback for JS-heavy/paywalled pages).

### 3. Synthesize
Merge lane findings into a unified source registry (`S1`, `S2`, …) and draft facts, quotes, stats, angles, outline, tensions. Weight by recency + authority per `recency_mode`. Always include a short "How we got here / background" section.

### 4. Adversarial verify pass (REQUIRED)
Spawn verifier sub-agents that try to **refute** the top claims before they are locked in (see [REFERENCE.md](REFERENCE.md#verify)). Tag every key claim: `multi` / `single` / `contested`. Route disputes into the JSON `tensions` and the "Open questions / disputes" section.

### 5. Write the dossier
Write `./research/{YYYY-MM-DD}-{slug}.md` (today's date from context; slug = kebab-case topic). Exact file layout, JSON schema, and section list are in [REFERENCE.md](REFERENCE.md#output). The dossier is written in **English**; verbatim quotes stay in original language with an English gloss; citations are inline `[S1]`.

### 6. Register
Run `python scripts/append_index.py` to append a row to `./research/INDEX.md` (creates it with a header if missing). Then tell the user the file path and a one-line summary.

## Dependencies
- Python 3.11 + pip are available. `scripts/yt_research.py` needs **yt-dlp**; if missing, the script prints an install hint — offer to run `python -m pip install yt-dlp`. ffmpeg is NOT needed (transcripts are text).
- NotebookLM lane requires the `notebooklm` companion skill.

## Handoff
The downstream writing skill reads `./research/INDEX.md` to pick a dossier and parses the top ```json block. Keep that block valid and complete — it is the contract.

**Canonical artifact:** the dossier `{date}-{slug}.md` registered in `INDEX.md` is the machine-readable source of truth. The `research-studio` skill also writes a `{date}-{slug}-studio.md` brief, but that is **human-only and is NOT listed in `INDEX.md`**. The writing skill must select dossiers via `INDEX.md` (or the JSON block), never by globbing `*{slug}*.md`, so it never ingests a studio brief as a dossier.
