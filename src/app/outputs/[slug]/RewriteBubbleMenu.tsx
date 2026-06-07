'use client';

import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { TONE_PRESETS, REWRITE_MODELS, DEFAULT_MODEL_ID } from '@/lib/brand-voice';

interface RewriteBubbleMenuProps {
  editor: Editor;
  // Lets the parent keep the bubble menu mounted while the panel is open, even
  // when focus leaves the editor (clicking into the guidance input blurs it).
  onPanelOpenChange: (open: boolean) => void;
}

type Range = { from: number; to: number };

export default function RewriteBubbleMenu({ editor, onPanelOpenChange }: RewriteBubbleMenuProps) {
  const [open, setOpen] = useState(false);
  const [toneId, setToneId] = useState<string | undefined>(undefined);
  const [modelId, setModelId] = useState<string>(DEFAULT_MODEL_ID);
  const [guidance, setGuidance] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<Range | null>(null);

  function setPanel(next: boolean) {
    setOpen(next);
    onPanelOpenChange(next);
  }

  function reset() {
    setResult(null);
    setError(null);
    setRange(null);
    setLoading(false);
    setPanel(false);
  }

  async function runRewrite(selectionRange: Range) {
    const text = editor.state.doc.textBetween(selectionRange.from, selectionRange.to, '\n');
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, instruction: guidance, toneId, modelId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Rewrite failed');
      setResult(typeof data.rewritten === 'string' ? data.rewritten : '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rewrite failed');
    } finally {
      setLoading(false);
    }
  }

  function onRewriteClick() {
    const { from, to } = editor.state.selection;
    const r = { from, to };
    setRange(r);
    void runRewrite(r);
  }

  function onAccept() {
    if (!range || result == null) return;
    editor.chain().focus().insertContentAt(range, result).run();
    reset();
  }

  // Collapsed: a single entry button. Clicking it opens the panel.
  if (!open) {
    return (
      <div className="rewrite-menu">
        <button
          type="button"
          className="rewrite-menu__trigger"
          onClick={() => setPanel(true)}
          title="Rewrite selection with AI"
        >
          ✦ Rewrite
        </button>
      </div>
    );
  }

  return (
    <div className="rewrite-menu rewrite-menu--open">
      <div className="rewrite-menu__row rewrite-menu__tones">
        {TONE_PRESETS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`rewrite-menu__chip${toneId === t.id ? ' is-active' : ''}`}
            onClick={() => setToneId(toneId === t.id ? undefined : t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rewrite-menu__row">
        <select
          className="rewrite-menu__model"
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
        >
          {REWRITE_MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      <input
        className="rewrite-menu__guidance"
        type="text"
        placeholder="Extra guidance (optional) — e.g. more skeptical of AI hype"
        value={guidance}
        onChange={(e) => setGuidance(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onRewriteClick(); } }}
      />

      <div className="rewrite-menu__row rewrite-menu__actions">
        <button
          type="button"
          className="rewrite-menu__btn rewrite-menu__btn--primary"
          onClick={onRewriteClick}
          disabled={loading}
        >
          {loading ? 'Rewriting…' : result != null ? 'Regenerate' : 'Rewrite'}
        </button>
        <button type="button" className="rewrite-menu__btn" onClick={reset}>
          {result != null ? 'Reject' : 'Close'}
        </button>
      </div>

      {error && <p className="rewrite-menu__error">{error}</p>}

      {result != null && (
        <div className="rewrite-menu__result">
          <div className="rewrite-menu__preview">{result}</div>
          <button
            type="button"
            className="rewrite-menu__btn rewrite-menu__btn--accept"
            onClick={onAccept}
          >
            Accept ✓
          </button>
        </div>
      )}
    </div>
  );
}
