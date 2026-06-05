# PRD: Content Studio Control Panel

## Overview

The Content Studio is a local Next.js web app that serves as Can Yildiz's content cockpit. Three sections are currently stubbed but unbuilt: **Studios** (browse research-studio dossiers + NotebookLM notebooks), **Outputs** (browse and edit finished articles from `/can-yildiz-writer`), and **Runner** (trigger and stream `/research`, `/can-yildiz-writer`, `/research-studio` as Claude Code CLI subprocesses). This PRD covers building all three. The app is local-only and will never be published.

The Brain vault lives at `C:\Users\CanYildiz\Desktop\Git\Brain`. Studios map to `Brain/research/<slug>/`, Outputs to `Brain/output/<date>-<slug>/`. The `notebooklm-py` CLI + the `notebooklm` skill are both available for NLM metadata.

---

## Goals

- Give Can a single browser tab to see all research and published output without touching the terminal
- Allow triggering the three core content skills from the UI and watching their stdout stream in real time
- Surface NotebookLM notebook metadata (title, source count, link) alongside each dossier
- Allow editing published articles and dossiers directly from the UI (save back to disk)
- Keep the app local-only — no auth, no deployment concerns

---

## Quality Gates

These commands must pass for every user story:

- `npm run typecheck` — TypeScript type checking
- `npm run lint` — ESLint
- `npm run build` — Full Next.js build (catches type + lint errors together)

For UI stories, also include:
- Verify in browser using `verify` / `dev-browser` skill — confirm the page renders and interactive elements work

---

## User Stories

### US-001: Studios list page

**Description:** As Can, I want to browse all research-studio sessions at `/studios` so I can see what research I've done without opening the file system.

**Acceptance Criteria:**
- [ ] Route `/studios` renders a list of studio entries
- [ ] Each entry shows: slug, date, one-line summary (first non-empty line of dossier `.md`)
- [ ] Entries are sorted newest-first by folder mtime or slug date prefix
- [ ] GET `/api/studios` reads `Brain/research/` — one entry per subfolder that contains a `.md` dossier file
- [ ] Empty state shown when no studios exist

---

### US-002: Studio detail view

**Description:** As Can, I want to open a studio and see its dossier content plus its NotebookLM notebook details so I can pick up where I left off.

**Acceptance Criteria:**
- [ ] Route `/studios/[slug]` renders the dossier markdown (rendered HTML, not raw)
- [ ] GET `/api/studios/[slug]` reads `Brain/research/_studio.json` to resolve the notebook ID for this slug
- [ ] If a notebook ID exists, the API calls `notebooklm-py` CLI to fetch notebook title and source count
- [ ] UI shows: notebook title, source count, and a direct link to open the notebook in the browser
- [ ] If no notebook ID found, the NLM section shows "No notebook linked"
- [ ] If `notebooklm-py` CLI errors, show a soft error ("NLM unavailable") — do not crash the page

---

### US-003: Outputs list page

**Description:** As Can, I want to browse all published articles at `/outputs` so I can review what has been written and published to the Brain vault.

**Acceptance Criteria:**
- [ ] Route `/outputs` renders a list of output entries
- [ ] Each entry shows: slug, date, article title (first H1 from `article.md`), and thumbnail image if `thumbnail.png` exists in the folder
- [ ] Entries are sorted newest-first by folder name date prefix (`Brain/output/<date>-<slug>/`)
- [ ] GET `/api/outputs` reads `Brain/output/` — one entry per subfolder containing `article.md`
- [ ] Empty state shown when no outputs exist

---

### US-004: Output detail view

**Description:** As Can, I want to open a published output and review the article, variants, and GEO report in one place.

**Acceptance Criteria:**
- [ ] Route `/outputs/[slug]` renders the article markdown
- [ ] Thumbnail PNG is displayed if it exists in the output folder
- [ ] Tab or accordion shows: Article / Variants / GEO Report (reads `variants/*.md` and `geo-report.md` if they exist)
- [ ] GET `/api/outputs/[slug]` returns: article content, variant files, geo-report content, thumbnail path
- [ ] Missing optional files (variants, geo-report) degrade gracefully — tabs/sections simply don't appear

---

### US-005: Output editing

**Description:** As Can, I want to edit an article or variant directly in the browser and save it back to disk so I can make final adjustments without opening a text editor.

**Acceptance Criteria:**
- [ ] Output detail view has an "Edit" toggle that switches the article (or active variant) from rendered markdown to a plain textarea
- [ ] PATCH `/api/outputs/[slug]` accepts `{ file: 'article' | 'variant/<name>', content: string }` and writes the file back to `Brain/output/<date>-<slug>/`
- [ ] Save button is visible in edit mode; on success shows a brief "Saved" confirmation
- [ ] Unsaved changes prompt a browser confirmation before navigating away
- [ ] Edit mode is available for: `article.md` and each file in `variants/`

---

### US-006: Runner — skill selector and input form

**Description:** As Can, I want to select a skill and fill in its inputs at `/runner` so I can trigger a content pipeline run without opening the terminal.

**Acceptance Criteria:**
- [ ] Route `/runner` shows a skill selector with three options: `research`, `can-yildiz-writer`, `research-studio`
- [ ] Selecting `research` shows a single text input: Topic
- [ ] Selecting `can-yildiz-writer` shows: Slug (required), Language toggle (English / German, default English)
- [ ] Selecting `research-studio` shows: Topic (required), Purpose/Direction (optional textarea)
- [ ] Submit button is disabled until required fields are filled
- [ ] Form is reset after submission

---

### US-007: Runner — execute skill and stream output

**Description:** As Can, I want to trigger a skill run and watch the stdout stream in the browser so I know what the agent is doing in real time.

**Acceptance Criteria:**
- [ ] POST `/api/runner/run` spawns `claude /<skill> <args>` as a child process (using Node.js `child_process.spawn`)
- [ ] Returns a `runId` immediately
- [ ] GET `/api/runner/stream/[runId]` is a Server-Sent Events (SSE) endpoint that streams stdout lines as they arrive
- [ ] UI connects to the SSE stream after submit and displays output in a scrollable terminal-style `<pre>` block
- [ ] Stream auto-scrolls to the latest line
- [ ] When the process exits, the stream closes and the UI shows "Run complete" or "Run failed" with the exit code
- [ ] A "Cancel" button kills the subprocess (SIGTERM) and closes the stream

---

### US-008: Runner — run history

**Description:** As Can, I want to see a list of past runs in the Runner so I can check what was triggered and when.

**Acceptance Criteria:**
- [ ] Below the form, a "Recent Runs" section lists the last 10 runs (in-memory for the server process lifetime — no persistence needed)
- [ ] Each entry shows: skill name, args, start time, status (running / complete / failed), exit code
- [ ] Clicking a past run re-opens its streamed output (buffered in memory while the process ran)
- [ ] Running entries show a live indicator

---

## Functional Requirements

- FR-1: All Brain vault reads/writes must use the path `C:\Users\CanYildiz\Desktop\Git\Brain` — defined as a single constant in `src/lib/paths.ts`
- FR-2: `_studio.json` at `Brain/research/_studio.json` maps slugs to `{ notebookId, dossierPath, deliverables }` — parse this for NLM lookups
- FR-3: The `notebooklm-py` CLI is invoked server-side (API route) — never client-side
- FR-4: The Runner spawns `claude /<skill> <args>` — the `claude` binary must be resolvable on the server's PATH
- FR-5: SSE stream must send a heartbeat comment (`: keep-alive`) every 15 seconds to prevent proxy timeouts
- FR-6: All API routes must return structured JSON error responses `{ error: string }` with appropriate HTTP status codes
- FR-7: The existing Thumbnail route and all current functionality must remain untouched
- FR-8: File writes (editing) must be atomic — write to a `.tmp` file then rename to avoid partial writes

---

## Non-Goals

- Authentication or multi-user support
- Deploying to Vercel or any remote server
- Triggering deferred GEO tools (`geo-technical`, `geo-crawlers`) — these require a live URL and are run post-publish in the terminal
- A separate geo/SEO trigger in the Runner — GEO is already embedded in the `can-yildiz-writer` pipeline at Gate 3
- Persistent run history across server restarts
- Real-time NLM source sync (just display metadata from the CLI)
- WYSIWYG rich-text editing — plain textarea is sufficient for MVP

---

## Technical Considerations

- All new routes follow the existing Next.js App Router pattern in `src/app/`
- API routes live in `src/app/api/`
- Brain path constant in `src/lib/paths.ts`: `export const BRAIN_PATH = 'C:/Users/CanYildiz/Desktop/Git/Brain'`
- SSE in Next.js App Router: use `new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })`
- `child_process.spawn` runs in Node.js API routes — confirm `next.config.ts` does not use Edge runtime for these routes
- `_studio.json` schema (from `can-yildiz-writer`): `Record<slug, { notebookId: string, dossierPath: string, deliverables: string[] }>`
- Atomic writes: `fs.writeFile(path + '.tmp')` then `fs.rename(tmp, path)`

---

## Success Metrics

- Can can browse all studios and outputs without opening a file explorer
- Can can trigger a full `/research → /can-yildiz-writer` run and read the output stream in the browser
- NLM notebook metadata loads correctly for linked studios
- Can can edit and save articles directly from the browser
- All three quality gate commands pass cleanly

---

## Open Questions

- Does `_studio.json` already exist in the Brain vault, or does it need to be created/seeded?
- What is the exact CLI syntax for `notebooklm-py` to fetch notebook metadata by ID?
- Should the Runner stream gate prompts back and allow Can to respond inline? Deferred to v2 — MVP is read-only streaming.
