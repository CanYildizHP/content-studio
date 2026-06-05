# Research Studio — Reference

Detail for the `research-studio` orchestrator. SKILL.md drives the flow; this holds the maps, templates, and the add-later mode.

<a id="deliverables"></a>
## Deliverable command map

Each deliverable = a `generate` (always with `--wait`) then a `download` into `research/deliverables/{slug}/`. Create that folder first.

| User asks for | Generate | Download |
|---------------|----------|----------|
| infographic | `notebooklm generate infographic --orientation portrait` | `notebooklm download infographic research/deliverables/{slug}/infographic.png` |
| mind-map | `notebooklm generate mind-map` | `notebooklm download mind-map research/deliverables/{slug}/mindmap.json` |
| flashcards | `notebooklm generate flashcards --quantity more` | `notebooklm download flashcards --format json research/deliverables/{slug}/flashcards.json` |
| quiz | `notebooklm generate quiz --difficulty hard` | `notebooklm download quiz --format markdown research/deliverables/{slug}/quiz.md` |
| slide-deck | `notebooklm generate slide-deck` | `notebooklm download slide-deck research/deliverables/{slug}/slides.pdf` |
| data-table | `notebooklm generate data-table "<structure>"` | `notebooklm download data-table research/deliverables/{slug}/data.csv` |
| audio (podcast) | `notebooklm generate audio "<instructions>" --wait` | `notebooklm download audio research/deliverables/{slug}/audio.mp3` |
| video | `notebooklm generate video --style whiteboard --wait` | `notebooklm download video research/deliverables/{slug}/video.mp4` |

Notes:
- Make sure the active notebook is correct (`notebooklm use <id>`) before generating.
- Generation can be slow; `--wait` blocks until ready. If a generate fails, note it in the brief and continue with the others.
- Record every produced file in the registry (step 6) so it shows up in the brief and in future runs.

<a id="brief"></a>
## Combined brief template

Write to `research/{date}-{slug}-studio.md`:

```md
# {Topic} — Research Studio Brief

- **Date:** {date}
- **Purpose / direction:** {purpose}
- **Depth:** {deep|quick}
- **Full dossier:** [{date}-{slug}.md](./{date}-{slug}.md)
- **NotebookLM notebook:** `{notebook_id}`  (open in browser, or `notebooklm use {notebook_id}`)

## Executive summary
3–6 sentences pulled from the dossier, framed toward the stated purpose.

## What's in the notebook
Sources loaded into the notebook:
- ✅ [S1] Title — URL/path
- ✅ [S2] ...
- ⚠️ Failed to add: <url/path> — <reason>
- 📄 Dossier: {date}-{slug}.md

## Deliverables
- infographic → [research/deliverables/{slug}/infographic.png](...)   (or: _none requested_)

## Suggested next step
One line pointing at the downstream writing skill (reads research/INDEX.md + the dossier JSON block).
```

Keep it a true front-door: short, links out to the dossier for depth rather than duplicating it.

<a id="registry"></a>
## Studio registry (`research/_studio.json`)

Managed by `scripts/studio_registry.py`. Shape:

```json
{
  "studios": {
    "<slug>": {
      "topic": "...",
      "purpose": "...",
      "depth": "deep",
      "notebook_id": "...",
      "dossier": "research/2026-06-04-<slug>.md",
      "brief": "research/2026-06-04-<slug>-studio.md",
      "sources_loaded": ["https://...", "research/_inbox/x.pdf"],
      "deliverables": [
        {"type": "infographic", "path": "research/deliverables/<slug>/infographic.png", "date": "2026-06-04"}
      ],
      "created": "2026-06-04",
      "updated": "2026-06-04"
    }
  }
}
```

Usage:
- `python scripts/studio_registry.py get --slug <slug>` → prints the studio object (or `{}` if none).
- `python scripts/studio_registry.py list` → prints all studios.
- `python scripts/studio_registry.py upsert --slug <slug> --json '<json-object>'` → deep-merges the fields into that studio (creates the file/entry if missing). Pass dates explicitly (use today's date from context). `deliverables` passed in are appended, not replaced.

<a id="add-later"></a>
## Deliverable-only mode (add a deliverable later)

Trigger this instead of the full pipeline when the user wants a new artifact from work already done — e.g. "make a mind-map from my 'ai-agents' studio" or they pass a notebook id.

1. Resolve the studio: `python scripts/studio_registry.py get --slug <slug>` (or match by topic; or use the notebook id the user gave).
2. If found: `notebooklm use <notebook_id>` — **do not re-research, do not re-add sources.**
3. Generate + download the requested deliverable(s) per the map above into `research/deliverables/{slug}/`.
4. `upsert` the new deliverable(s) into the registry (they append).
5. Update the brief's Deliverables section (or append a dated line) and tell the user the new file path.

If no matching studio/notebook is found, tell the user and offer to run the full pipeline instead.
