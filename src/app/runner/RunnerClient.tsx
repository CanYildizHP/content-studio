'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { RunRecord } from '@/lib/runner-store';

type Skill = 'research' | 'can-yildiz-writer' | 'research-studio';
type Step = 'form' | 'intake' | 'running';

interface IntakeQuestion {
  id: string;
  label: string;
  placeholder: string;
  required: boolean;
  multiline?: boolean;
  hint?: string;
}

const INTAKE: Record<Skill, IntakeQuestion[]> = {
  research: [
    { id: 'audience', label: 'Target audience', placeholder: 'e.g. senior engineers, CMOs, general tech readers', required: true, hint: 'Shapes depth, framing, and source weighting.' },
    { id: 'angle', label: 'Angle / perspective', placeholder: 'e.g. skeptical practitioner take, beginner-friendly, enterprise ROI focus', required: false },
    { id: 'sources', label: 'Sources to prioritize', placeholder: 'Specific sites, people, papers, or URLs to include or avoid (optional)', required: false },
    { id: 'depth', label: 'Depth', placeholder: 'deep (default) or quick', required: false },
  ],
  'can-yildiz-writer': [
    { id: 'direction', label: 'Angle / direction', placeholder: 'What story thread or argument should anchor this piece?', required: true, hint: 'This seeds Gate 1. Be specific — e.g. "position Can as skeptical of AI hype in enterprise".' },
    { id: 'audience', label: 'Target audience', placeholder: 'Who should this article resonate with most?', required: true },
    { id: 'proofPoints', label: 'Proof points to highlight', placeholder: 'Which of Can\'s experiences or projects should feature? (optional — can propose at Gate 1)', required: false, multiline: true },
    { id: 'constraints', label: 'Constraints / tone notes', placeholder: 'Word count target, topics to avoid, tone emphasis (optional)', required: false },
  ],
  'research-studio': [
    { id: 'audience', label: 'Target audience', placeholder: 'e.g. technical leads, startup founders, product managers', required: false },
    { id: 'deliverables', label: 'Deliverables', placeholder: 'infographic / flashcards / mind-map / slide-deck / quiz — or leave blank for none', required: false },
    { id: 'material', label: 'Existing material', placeholder: 'Local file paths, URLs, or Google Drive links to include (optional)', required: false, multiline: true },
    { id: 'depth', label: 'Depth', placeholder: 'deep (default) or quick', required: false },
  ],
};

// Text outcomes the writer/studio skills can produce. Each id doubles as the
// deliverable filename the skill writes (<id>.md), which the output editor then
// surfaces as its own editable tab.
interface Outcome {
  id: string;
  label: string;
  hint: string;
}

const OUTCOMES: Outcome[] = [
  { id: 'blog-post', label: 'Article / blog post', hint: 'Long-form canonical piece' },
  { id: 'linkedin-post', label: 'LinkedIn post', hint: 'Hook + spare body + one takeaway' },
  { id: 'linkedin-first-comment-hook', label: 'LinkedIn first-comment hook', hint: 'Short hook that drives clicks to the link in the first comment' },
  { id: 'x-thread', label: 'X / Twitter thread', hint: 'Numbered thread' },
  { id: 'newsletter', label: 'Newsletter section', hint: 'Subject line + intro + spine' },
];

// Skills that accept the text-outcomes picker.
const OUTCOME_SKILLS: Skill[] = ['can-yildiz-writer', 'research-studio'];

type FormValues = Record<string, string>;

export default function RunnerClient() {
  const [step, setStep] = useState<Step>('form');
  const [skill, setSkill] = useState<Skill>('research');
  const [form, setForm] = useState<FormValues>({ topic: '', slug: '', language: 'en', purpose: '' });
  const [intake, setIntake] = useState<FormValues>({});
  const [outcomes, setOutcomes] = useState<string[]>(['blog-post']);
  const [outcomeCustom, setOutcomeCustom] = useState('');

  const showOutcomes = OUTCOME_SKILLS.includes(skill);

  function toggleOutcome(id: string) {
    setOutcomes((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  // Comma-joined list of selected outcome ids plus any custom outcome, e.g.
  // "blog-post, linkedin-first-comment-hook, x-thread, custom: a press one-liner".
  function composeOutcomes(): string {
    const parts = [...outcomes];
    if (outcomeCustom.trim()) parts.push(`custom: ${outcomeCustom.trim()}`);
    return parts.join(', ');
  }

  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [output, setOutput] = useState<string[]>([]);
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'complete' | 'failed'>('idle');
  const [stdinLine, setStdinLine] = useState('');
  const [history, setHistory] = useState<RunRecord[]>([]);

  const outputRef = useRef<HTMLPreElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const stdinRef = useRef<HTMLInputElement>(null);

  const isFormValid =
    skill === 'can-yildiz-writer'
      ? form.slug?.trim().length > 0 && form.purpose?.trim().length > 0
      : form.topic?.trim().length > 0 && form.purpose?.trim().length > 0;

  const isIntakeValid = INTAKE[skill].every(
    (q) => !q.required || (intake[q.id] ?? '').trim().length > 0
  );

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/runner/run');
      if (res.ok) setHistory(await res.json() as RunRecord[]);
    } catch { /* ignore */ }
  }, []);

  // Initial load — inlined to avoid triggering set-state-in-effect lint rule
  useEffect(() => {
    let alive = true;
    fetch('/api/runner/run')
      .then((r) => (r.ok ? (r.json() as Promise<RunRecord[]>) : null))
      .then((data) => { if (alive && data) setHistory(data); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  function startStream(runId: string) {
    esRef.current?.close();
    const es = new EventSource(`/api/runner/stream/${runId}`);
    esRef.current = es;
    es.onmessage = (e) => {
      try { setOutput((prev) => [...prev, JSON.parse(e.data) as string]); } catch { /* ignore */ }
    };
    es.addEventListener('done', () => {
      setRunStatus((s) => s === 'running' ? 'complete' : s);
      es.close();
      fetchHistory();
    });
    es.onerror = () => { setRunStatus('failed'); es.close(); };
  }

  async function handleRun() {
    setOutput([]);
    setRunStatus('running');
    setStep('running');

    const body = {
      skill,
      args: {
        ...form,
        ...intake,
        ...(showOutcomes ? { outcomes: composeOutcomes() } : {}),
      },
    };

    try {
      const res = await fetch('/api/runner/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { runId?: string; error?: string };
      if (!res.ok || !data.runId) {
        setOutput([`[Error: ${data.error ?? `HTTP ${res.status}`}]`]);
        setRunStatus('failed');
        return;
      }
      setActiveRunId(data.runId);
      startStream(data.runId);
      setTimeout(() => stdinRef.current?.focus(), 50);
    } catch {
      setOutput(['[Error: failed to reach server]']);
      setRunStatus('failed');
    }
  }

  async function handleCancel() {
    if (!activeRunId) return;
    await fetch(`/api/runner/run/${activeRunId}`, { method: 'DELETE' });
    esRef.current?.close();
    setRunStatus('failed');
    fetchHistory();
  }

  async function handleStdinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeRunId || !stdinLine.trim()) return;
    const line = stdinLine.trim();
    setStdinLine('');
    try {
      await fetch(`/api/runner/input/${activeRunId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line }),
      });
    } catch { /* ignore */ }
  }

  function replayRun(run: RunRecord) {
    setOutput(run.outputBuffer);
    setRunStatus(run.status === 'running' ? 'running' : run.status as 'complete' | 'failed');
    setActiveRunId(run.runId);
    setStep('running');
    if (run.status === 'running') {
      startStream(run.runId);
      setTimeout(() => stdinRef.current?.focus(), 50);
    }
  }

  async function deleteRun(runId: string) {
    await fetch(`/api/runner/run/${runId}`, { method: 'DELETE' });
    setHistory((h) => h.filter((r) => r.runId !== runId));
    if (activeRunId === runId) resetToForm();
  }

  async function clearFinished() {
    await fetch('/api/runner/run', { method: 'DELETE' });
    setHistory((h) => h.filter((r) => r.status === 'running'));
  }

  function resetToForm() {
    esRef.current?.close();
    setStep('form');
    setRunStatus('idle');
    setOutput([]);
    setActiveRunId(null);
    setIntake({});
    setOutcomes(['blog-post']);
    setOutcomeCustom('');
  }

  const statusLabel =
    runStatus === 'running' ? '● running' :
    runStatus === 'complete' ? '✓ complete' :
    runStatus === 'failed' ? '✕ failed' : '';

  // ── Step 1: Basic form ──────────────────────────────────────────────────────
  if (step === 'form') {
    return (
      <div className="runner-layout">
        <form className="runner-form" onSubmit={(e) => { e.preventDefault(); setStep('intake'); }}>

          <fieldset className="runner-form__skills">
            {(['research', 'can-yildiz-writer', 'research-studio'] as Skill[]).map((s) => (
              <label key={s} className={`skill-pill${skill === s ? ' skill-pill--active' : ''}`}>
                <input type="radio" name="skill" value={s} checked={skill === s}
                  onChange={() => { setSkill(s); setIntake({}); setOutcomes(['blog-post']); setOutcomeCustom(''); }} />
                /{s}
              </label>
            ))}
          </fieldset>

          <div className="runner-form__inputs">
            {skill !== 'can-yildiz-writer' && (
              <label className="field">
                <span className="field__label">Topic <span className="field__required">*</span></span>
                <input className="field__input" type="text" value={form.topic ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                  placeholder="e.g. AI agents in enterprise — 2025" required />
              </label>
            )}

            {skill === 'can-yildiz-writer' && (
              <label className="field">
                <span className="field__label">Research slug <span className="field__required">*</span></span>
                <input className="field__input" type="text" value={form.slug ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="e.g. 2025-01-ai-agents" required />
                <span className="field__hint">The slug from the research dossier in Brain/research/</span>
              </label>
            )}

            <label className="field">
              <span className="field__label">Purpose / direction <span className="field__required">*</span></span>
              <textarea className="field__input field__input--ta" rows={3}
                value={form.purpose ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                placeholder={
                  skill === 'research'
                    ? 'e.g. Feed a LinkedIn article for CTOs. Focus on ROI and adoption barriers.'
                    : skill === 'can-yildiz-writer'
                    ? "e.g. Write a take-piece that positions Can as a skeptical practitioner on AI hype."
                    : 'e.g. Build a study workspace for a talk I\'m giving to product leads next month.'
                }
                required
              />
              <span className="field__hint">How will this be used? What piece, goal, or decision does it feed?</span>
            </label>

            {skill === 'can-yildiz-writer' && (
              <fieldset className="field field--inline">
                <span className="field__label">Language</span>
                {(['en', 'de'] as const).map((l) => (
                  <label key={l} className="lang-pill">
                    <input type="radio" name="lang" value={l}
                      checked={(form.language ?? 'en') === l}
                      onChange={() => setForm((f) => ({ ...f, language: l }))} />
                    {l === 'en' ? 'English' : 'German'}
                  </label>
                ))}
              </fieldset>
            )}
          </div>

          <div className="runner-form__actions">
            <button type="submit" className="btn btn--primary" disabled={!isFormValid}>
              Next: configure →
            </button>
          </div>
        </form>

        <RunHistory history={history} onReplay={replayRun} onDelete={deleteRun} onClearAll={clearFinished} />
      </div>
    );
  }

  // ── Step 2: Skill-specific intake ───────────────────────────────────────────
  if (step === 'intake') {
    const questions = INTAKE[skill];
    return (
      <div className="runner-layout">
        <div className="intake-header">
          <button className="btn btn--sm" onClick={() => setStep('form')}>← back</button>
          <span className="intake-header__skill">/{skill}</span>
          <span className="intake-header__topic">{skill === 'can-yildiz-writer' ? form.slug : form.topic}</span>
        </div>

        <p className="intake-intro">
          A few more questions to give the skill the full picture before it runs.
          Required fields are marked <span className="field__required">*</span>.
        </p>

        <form className="runner-form" onSubmit={(e) => { e.preventDefault(); handleRun(); }}>
          <div className="runner-form__inputs">
            {questions.map((q) => (
              <label key={q.id} className="field">
                <span className="field__label">
                  {q.label}
                  {q.required && <span className="field__required"> *</span>}
                </span>
                {q.multiline ? (
                  <textarea
                    className="field__input field__input--ta"
                    rows={3}
                    value={intake[q.id] ?? ''}
                    onChange={(e) => setIntake((v) => ({ ...v, [q.id]: e.target.value }))}
                    placeholder={q.placeholder}
                    required={q.required}
                  />
                ) : (
                  <input
                    className="field__input"
                    type="text"
                    value={intake[q.id] ?? ''}
                    onChange={(e) => setIntake((v) => ({ ...v, [q.id]: e.target.value }))}
                    placeholder={q.placeholder}
                    required={q.required}
                  />
                )}
                {q.hint && <span className="field__hint">{q.hint}</span>}
              </label>
            ))}

            {showOutcomes && (
              <fieldset className="field outcomes">
                <span className="field__label">Expected text outcomes</span>
                <span className="field__hint">
                  Which pieces should this run produce? Each becomes its own editable output.
                </span>
                <div className="outcomes__grid">
                  {OUTCOMES.map((o) => (
                    <label
                      key={o.id}
                      className={`outcome-pill${outcomes.includes(o.id) ? ' outcome-pill--active' : ''}`}
                      title={o.hint}
                    >
                      <input
                        type="checkbox"
                        checked={outcomes.includes(o.id)}
                        onChange={() => toggleOutcome(o.id)}
                      />
                      <span className="outcome-pill__label">{o.label}</span>
                      <span className="outcome-pill__hint">{o.hint}</span>
                    </label>
                  ))}
                </div>
                <input
                  className="field__input"
                  type="text"
                  value={outcomeCustom}
                  onChange={(e) => setOutcomeCustom(e.target.value)}
                  placeholder="Custom outcome (optional) — e.g. a one-line press blurb"
                />
              </fieldset>
            )}
          </div>

          <div className="runner-form__actions">
            <button type="submit" className="btn btn--primary" disabled={!isIntakeValid}>
              Run /{skill}
            </button>
            <button type="button" className="btn" onClick={() => setStep('form')}>Back</button>
          </div>
        </form>
      </div>
    );
  }

  // ── Step 3: Running ─────────────────────────────────────────────────────────
  return (
    <div className="runner-layout">
      <div className="runner-run-header">
        <div className="runner-run-header__left">
          <span className="runner-run-header__skill">/{skill}</span>
          <span className="runner-run-header__topic">
            {skill === 'can-yildiz-writer' ? form.slug : form.topic}
          </span>
        </div>
        <div className="runner-run-header__right">
          {runStatus !== 'running' && (
            <button className="btn btn--sm" onClick={resetToForm}>New run</button>
          )}
          {runStatus === 'running' && (
            <button className="btn btn--sm" onClick={handleCancel}>Cancel</button>
          )}
        </div>
      </div>

      <div className="runner-output">
        <div className="runner-output__header">
          <span className="runner-output__status">{statusLabel}</span>
        </div>
        <pre className="runner-output__pre" ref={outputRef}>
          {output.join('')}
          {runStatus === 'running' && <span className="runner-cursor">▋</span>}
        </pre>

        {runStatus === 'running' && (
          <form className="runner-stdin" onSubmit={handleStdinSubmit}>
            <input
              ref={stdinRef}
              className="runner-stdin__input"
              type="text"
              value={stdinLine}
              onChange={(e) => setStdinLine(e.target.value)}
              placeholder="Type a response and press Enter…"
              autoComplete="off"
            />
            <button type="submit" className="btn btn--sm btn--primary"
              disabled={!stdinLine.trim()}>
              Send
            </button>
          </form>
        )}
      </div>

      <RunHistory history={history} onReplay={replayRun} onDelete={deleteRun} onClearAll={clearFinished} />
    </div>
  );
}

function RunHistory({ history, onReplay, onDelete, onClearAll }: {
  history: RunRecord[];
  onReplay: (r: RunRecord) => void;
  onDelete: (runId: string) => void;
  onClearAll: () => void;
}) {
  if (!history.length) return null;
  const hasFinished = history.some((r) => r.status !== 'running');
  return (
    <section className="run-history">
      <div className="run-history__header">
        <h2 className="run-history__title">Recent runs</h2>
        {hasFinished && (
          <button className="btn btn--sm" onClick={onClearAll}>Clear finished</button>
        )}
      </div>
      <ul className="run-history__list">
        {history.map((run) => (
          <li key={run.runId} className="run-history__item">
            <button className="run-entry" onClick={() => onReplay(run)}>
              <span className={`run-entry__status run-entry__status--${run.status}`}>
                {run.status === 'running' ? '●' : run.status === 'complete' ? '✓' : '✕'}
              </span>
              <span className="run-entry__skill">/{run.skill}</span>
              <span className="run-entry__args">{run.args}</span>
              <span className="run-entry__time">{run.startTime.slice(0, 19).replace('T', ' ')}</span>
              {run.exitCode !== null && <span className="run-entry__exit">exit {run.exitCode}</span>}
            </button>
            <button
              className="run-entry__delete"
              onClick={() => onDelete(run.runId)}
              title="Remove from history"
            >×</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
