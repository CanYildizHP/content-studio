# Research — Reference

Detailed specs for the `research` skill. SKILL.md drives the workflow; this file holds the contracts, prompts, and templates.

<a id="recency"></a>
## Recency auto-detection

Classify the topic before planning:

- **fast-moving** — products, releases, markets, politics, ongoing events, anything where "what's true" changed in the last few months. Surface the **last ~12 months** prominently; older material only to explain development.
- **evergreen** — concepts, methods, history, biographies, stable how-tos. Recency matters less; prioritize authority and canonical sources, but still note any recent developments.

When unsure, lean fast-moving but keep a fuller background section. Record the choice in `meta.recency_mode`.

<a id="lane-contract"></a>
## Lane sub-agent output contract

Every lane sub-agent must return **only** a JSON object (no prose) shaped like:

```json
{
  "lane": "news|primary|community|youtube|user|notebooklm",
  "sources": [
    {
      "title": "...",
      "url": "...",
      "type": "news|primary|community|youtube|user|notebooklm",
      "date": "YYYY-MM-DD or null",
      "author": "... or null",
      "channel": "... (youtube only) or null",
      "view_count": 0,
      "summary": "2-4 sentence neutral summary of what this source actually says",
      "key_points": ["atomic claim 1", "atomic claim 2"],
      "quotes": [{"text_verbatim": "...", "lang": "en|tr|...", "english_gloss": "... or null", "timestamp": "mm:ss or null"}],
      "stats": [{"value": "...", "context": "..."}]
    }
  ],
  "notes": "gaps, dead ends, language coverage, anything the synthesizer should know"
}
```

Tell each sub-agent: gather broadly, then deep-read the top 3–5 with `WebFetch`; search in any language; prefer primary over secondary; capture verbatim quotes with attribution; never fabricate URLs or dates — use `null` when unknown.

<a id="lane-prompts"></a>
## Lane prompts (templates)

Fill `{topic}`, `{focus}`, `{recency_mode}`. All lanes end with: *"Return ONLY the JSON object in the lane output contract. Do not include prose outside the JSON."*

- **News:** "Find the most significant recent news/press coverage of {topic}{focus}. Topic recency mode is {recency_mode}; weight the last 12 months heavily. Use WebSearch, then WebFetch the top 3–5. Capture dates, outlets, and verbatim quotes."
- **Authoritative/primary:** "Find authoritative and primary sources on {topic}{focus}: official docs, standards, papers, datasets, organization/maker sites. Prefer primary over secondary. Deep-read the top 3–5 with WebFetch."
- **Community/discussion:** "Find substantive community discussion of {topic}{focus} on Reddit, Hacker News, Stack Exchange, and relevant forums. Capture consensus, disagreements, and notable first-hand reports. Deep-read the most upvoted/substantive threads."
- **YouTube:** "Run `python scripts/yt_research.py --query \"{topic} {focus}\" --max 6` to get top videos' metadata + transcripts (no media). Read the JSON it prints, synthesize the most informative videos, and cite quotes with timestamps. If the script reports yt-dlp is missing, say so and stop this lane."
- **User material:** "Ingest the user's own saved material on {topic}: (1) read every file in `./research/_inbox/`; (2) search Google Drive via `mcp__claude_ai_Google_Drive__search_files` then read matches; (3) ingest any links/text the user pasted. Summarize and extract claims/quotes/stats. Type = `user`."
- **NotebookLM:** invoke the `notebooklm` companion skill to export notebook `{name}` to Markdown, then summarize it. Type = `notebooklm`.

<a id="verify"></a>
## Adversarial verify pass

Select the top ~8–15 load-bearing claims. Spawn verifier sub-agents (batch claims across 2–4 agents). Prompt:

> "You are a skeptical fact-checker. For each claim below, try to REFUTE it using independent sources (WebSearch/WebFetch). Default to skepticism. Return JSON: `[{claim, verdict: 'supported'|'refuted'|'contested'|'unverifiable', evidence_urls:[...], note}]`. A claim is `multi` only if ≥2 independent reliable sources agree; `single` if only one; `contested` if credible sources disagree."

Apply results: set each fact's `confidence`, drop refuted claims (or move to tensions with a note), and populate `tensions` + the "Open questions / disputes" section.

<a id="output"></a>
## Output file layout

Path: `./research/{YYYY-MM-DD}-{slug}.md`. Structure — JSON block first, then Markdown:

````
```json
{SCHEMA BELOW}
```

# {Topic} — Research Dossier

## Executive summary
3–6 sentences. Inline [S1] citations.

## Key findings
Bulleted/short-para findings, each with [S#] and a confidence note where relevant.

## How we got here / background
Short narrative of how the subject developed.

## Notable quotes & stats
Verbatim quotes (original language + English gloss) and hard numbers, attributed [S#].

## Open questions / disputes
Contested points, gaps, and what couldn't be verified.

## Sources
Numbered list mirroring the JSON registry: [S1] Title — Author/Channel — Outlet/Type — Date — URL
````

### JSON schema (top block)

```json
{
  "meta": {
    "topic": "string",
    "slug": "kebab-case",
    "date": "YYYY-MM-DD",
    "depth": "quick|deep",
    "language": "en",
    "recency_mode": "fast-moving|evergreen",
    "focus": "string or null",
    "lanes_run": ["news","primary","community","youtube","user","notebooklm"]
  },
  "sources": [
    {"id":"S1","title":"...","url":"...","type":"news|primary|community|youtube|user|notebooklm","date":"YYYY-MM-DD|null","author":"...|null","channel":"...|null","view_count":0}
  ],
  "facts": [
    {"claim":"...","source_ids":["S1","S2"],"confidence":"multi|single|contested","recency_note":"e.g. 'as of 2026-05' or null"}
  ],
  "quotes": [
    {"text_verbatim":"...","lang":"en|tr|...","english_gloss":"...|null","source_id":"S1","timestamp_if_youtube":"mm:ss|null"}
  ],
  "stats": [
    {"value":"...","context":"...","source_id":"S1"}
  ],
  "angles": ["suggested narrative angle 1", "..."],
  "outline": ["section idea 1", "section idea 2"],
  "tensions": ["point of disagreement 1", "..."]
}
```

Keep the JSON valid (no trailing commas, real `null`s, escaped quotes). Every `source_id` in facts/quotes/stats must exist in `sources`. This block is the writing skill's contract — completeness matters more than prose.

<a id="registry"></a>
## INDEX.md registry

`scripts/append_index.py` creates `./research/INDEX.md` (with header) if missing and appends:

```
| date | topic | slug | path | one-line summary | depth |
```

Call it after writing the dossier (see script `--help`).
