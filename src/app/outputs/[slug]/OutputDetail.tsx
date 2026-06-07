'use client';

import { useReducer, useEffect, useCallback, useState } from 'react';
import Image from 'next/image';
import RichTextEditor from './RichTextEditor';
import { REWRITE_MODELS, DEFAULT_MODEL_ID } from '@/lib/brand-voice';

interface OutputDoc {
  name: string;     // tab label
  file: string;     // PATCH save target: "doc/<basename>" or "variant/<name>"
  html: string;     // sanitized server-side
  content: string;  // raw markdown
  primary: boolean;
}

interface OutputDetailProps {
  slug: string;
  documents: OutputDoc[];
  geoReportHtml: string | null; // sanitized server-side
  thumbnailPath: string | null;
  purpose: string;              // the piece's intent, anchors AI rewrites
}

const GEO_TAB = 'geo';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface EditState {
  activeTab: string; // a document's `file`, or GEO_TAB
  editMode: boolean;
  editContent: string;
  isDirty: boolean;
  saveStatus: SaveStatus;
}

type Action =
  | { type: 'SET_TAB'; tab: string; raw: string }
  | { type: 'ENTER_EDIT'; raw: string }
  | { type: 'EXIT_EDIT' }
  | { type: 'CHANGE'; content: string }
  | { type: 'LOAD_DERIVED'; content: string }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_OK' }
  | { type: 'SAVE_ERR' }
  | { type: 'SAVE_RESET' };

function reducer(state: EditState, action: Action): EditState {
  switch (action.type) {
    case 'SET_TAB':
      return { ...state, activeTab: action.tab, editMode: false, editContent: action.raw, isDirty: false, saveStatus: 'idle' };
    case 'ENTER_EDIT':
      return { ...state, editMode: true, editContent: action.raw };
    case 'EXIT_EDIT':
      return { ...state, editMode: false, isDirty: false };
    case 'CHANGE':
      return { ...state, editContent: action.content, isDirty: true };
    case 'LOAD_DERIVED':
      // Drop the freshly generated deliverable into the editor for review.
      return { ...state, editMode: true, editContent: action.content, isDirty: true, saveStatus: 'idle' };
    case 'SAVE_START':
      return { ...state, saveStatus: 'saving' };
    case 'SAVE_OK':
      return { ...state, saveStatus: 'saved', isDirty: false };
    case 'SAVE_ERR':
      return { ...state, saveStatus: 'error' };
    case 'SAVE_RESET':
      return { ...state, saveStatus: 'idle' };
    default:
      return state;
  }
}

export default function OutputDetail({
  slug,
  documents,
  geoReportHtml,
  thumbnailPath,
  purpose: initialPurpose,
}: OutputDetailProps) {
  const initialDoc = documents.find((d) => d.primary) ?? documents[0];

  const [state, dispatch] = useReducer(reducer, {
    activeTab: initialDoc?.file ?? GEO_TAB,
    editMode: false,
    editContent: initialDoc?.content ?? '',
    isDirty: false,
    saveStatus: 'idle',
  });

  const { activeTab, editMode, editContent, isDirty, saveStatus } = state;

  const [deriveModel, setDeriveModel] = useState(DEFAULT_MODEL_ID);
  const [deriving, setDeriving] = useState(false);
  const [deriveError, setDeriveError] = useState<string | null>(null);

  const [purpose, setPurpose] = useState(initialPurpose);
  const [purposeSaved, setPurposeSaved] = useState(true);

  // Persist the purpose to the output's _meta.json so it anchors every future rewrite.
  const savePurpose = useCallback(async () => {
    if (purpose === initialPurpose && purposeSaved) return;
    try {
      const res = await fetch(`/api/outputs/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: 'purpose', content: purpose }),
      });
      setPurposeSaved(res.ok);
    } catch {
      setPurposeSaved(false);
    }
  }, [purpose, initialPurpose, purposeSaved, slug]);

  const activeDoc = documents.find((d) => d.file === activeTab) ?? null;
  const sourceDoc = documents.find((d) => d.primary) ?? documents[0] ?? null;
  const isGeo = activeTab === GEO_TAB;
  const raw = activeDoc?.content ?? '';
  const html = isGeo ? (geoReportHtml ?? '') : (activeDoc?.html ?? '');
  // The derive button only makes sense on a deliverable that isn't the source itself.
  const canDerive = !!activeDoc && !activeDoc.primary && !!sourceDoc;

  // Regenerate the active deliverable from the LATEST saved blog post, tuned to
  // open a curiosity gap. Result lands in the editor (dirty) for review + Save.
  const handleDerive = useCallback(async () => {
    if (!activeDoc || activeDoc.primary || !sourceDoc) return;
    setDeriving(true);
    setDeriveError(null);
    try {
      // Pull the freshest blog-post text from disk (the in-memory copy may be
      // stale if it was edited in another tab since page load).
      let source = sourceDoc.content;
      try {
        const r = await fetch(`/api/outputs/${slug}`);
        if (r.ok) {
          const data = (await r.json()) as { documents?: { content: string; primary?: boolean }[] };
          const p = data.documents?.find((d) => d.primary) ?? data.documents?.[0];
          if (p?.content) source = p.content;
        }
      } catch { /* fall back to in-memory copy */ }

      if (!source.trim()) throw new Error('No blog post found to derive from');

      const basename = activeDoc.file.split('/').slice(1).join('/');
      const res = await fetch('/api/derive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, basename, name: activeDoc.name, purpose, modelId: deriveModel }),
      });
      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      dispatch({ type: 'LOAD_DERIVED', content: typeof data.text === 'string' ? data.text : '' });
    } catch (err) {
      setDeriveError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setDeriving(false);
    }
  }, [activeDoc, sourceDoc, slug, deriveModel, purpose]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleSave = useCallback(async () => {
    if (!activeDoc) return;
    dispatch({ type: 'SAVE_START' });
    try {
      const res = await fetch(`/api/outputs/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: activeDoc.file, content: editContent }),
      });
      if (!res.ok) throw new Error('Save failed');
      dispatch({ type: 'SAVE_OK' });
      setTimeout(() => dispatch({ type: 'SAVE_RESET' }), 2000);
    } catch {
      dispatch({ type: 'SAVE_ERR' });
    }
  }, [slug, activeDoc, editContent]);

  const canEdit = !isGeo && !!activeDoc;

  return (
    <div className="detail-layout">
      {thumbnailPath && (
        <div className="output-thumb">
          <Image src={thumbnailPath} alt="thumbnail" width={600} height={315} unoptimized />
        </div>
      )}

      <label className="purpose-bar">
        <span className="purpose-bar__label">Purpose / intent</span>
        <input
          className="purpose-bar__input"
          type="text"
          value={purpose}
          onChange={(e) => { setPurpose(e.target.value); setPurposeSaved(false); }}
          onBlur={savePurpose}
          placeholder="What is this piece for? e.g. Celebrate 5 years at WEFRA LIFE and show what I learned — anchors every AI rewrite"
        />
        <span className="purpose-bar__status">{purposeSaved ? '' : '• unsaved'}</span>
      </label>

      <div className="tabs">
        {documents.map((d) => (
          <button
            key={d.file}
            className={`tab${activeTab === d.file ? ' tab--active' : ''}`}
            onClick={() => dispatch({ type: 'SET_TAB', tab: d.file, raw: d.content })}
          >
            {d.name}
          </button>
        ))}
        {geoReportHtml && (
          <button
            className={`tab${activeTab === GEO_TAB ? ' tab--active' : ''}`}
            onClick={() => dispatch({ type: 'SET_TAB', tab: GEO_TAB, raw: '' })}
          >
            GEO Report
          </button>
        )}

        <div className="tabs__actions">
          {canDerive && !editMode && (
            <>
              <select
                className="derive-model"
                value={deriveModel}
                onChange={(e) => setDeriveModel(e.target.value)}
                title="Model"
                disabled={deriving}
              >
                {REWRITE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
              <button
                className="btn btn--sm"
                onClick={handleDerive}
                disabled={deriving}
                title="Rewrite this from the latest blog post, tuned to invoke curiosity"
              >
                {deriving ? 'Reading blog post…' : '✦ From blog post'}
              </button>
              {deriveError && <span className="save-error">{deriveError}</span>}
            </>
          )}
          {canEdit && !editMode && (
            <button className="btn btn--sm" onClick={() => dispatch({ type: 'ENTER_EDIT', raw })}>
              Edit
            </button>
          )}
          {editMode && (
            <>
              <button
                className="btn btn--sm btn--primary"
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
              >
                {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved ✓' : 'Save'}
              </button>
              <button className="btn btn--sm" onClick={() => dispatch({ type: 'EXIT_EDIT' })}>
                Cancel
              </button>
              {saveStatus === 'error' && <span className="save-error">Save failed</span>}
            </>
          )}
        </div>
      </div>

      <div className="tab-content">
        {editMode && canEdit ? (
          <RichTextEditor
            key={activeTab}
            initialMarkdown={editContent}
            onChange={(md) => dispatch({ type: 'CHANGE', content: md })}
          />
        ) : (
          /* html is sanitized server-side in page.tsx before being passed here */
          <article className="prose" dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>
    </div>
  );
}
