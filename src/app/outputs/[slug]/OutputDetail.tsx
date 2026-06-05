'use client';

import { useReducer, useEffect, useCallback } from 'react';
import Image from 'next/image';

interface Variant {
  name: string;
  html: string;
  content: string;
}

interface OutputDetailProps {
  slug: string;
  articleHtml: string;     // sanitized server-side
  articleRaw: string;
  variants: Variant[];
  geoReportHtml: string | null; // sanitized server-side
  thumbnailPath: string | null;
}

type Tab = 'article' | `variant:${string}` | 'geo';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface EditState {
  activeTab: Tab;
  editMode: boolean;
  editContent: string;
  isDirty: boolean;
  saveStatus: SaveStatus;
}

type Action =
  | { type: 'SET_TAB'; tab: Tab; raw: string }
  | { type: 'ENTER_EDIT'; raw: string }
  | { type: 'EXIT_EDIT' }
  | { type: 'CHANGE'; content: string }
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
  articleHtml,
  articleRaw,
  variants,
  geoReportHtml,
  thumbnailPath,
}: OutputDetailProps) {
  const [state, dispatch] = useReducer(reducer, {
    activeTab: 'article',
    editMode: false,
    editContent: articleRaw,
    isDirty: false,
    saveStatus: 'idle',
  });

  const { activeTab, editMode, editContent, isDirty, saveStatus } = state;

  function getTabData(): { raw: string; html: string; file: string } {
    if (activeTab === 'article') return { raw: articleRaw, html: articleHtml, file: 'article' };
    if (activeTab.startsWith('variant:')) {
      const name = activeTab.slice('variant:'.length);
      const v = variants.find((x) => x.name === name);
      return { raw: v?.content ?? '', html: v?.html ?? '', file: `variant/${name}` };
    }
    return { raw: '', html: geoReportHtml ?? '', file: '' };
  }

  const { raw, html, file } = getTabData();

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleSave = useCallback(async () => {
    dispatch({ type: 'SAVE_START' });
    try {
      const res = await fetch(`/api/outputs/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file, content: editContent }),
      });
      if (!res.ok) throw new Error('Save failed');
      dispatch({ type: 'SAVE_OK' });
      setTimeout(() => dispatch({ type: 'SAVE_RESET' }), 2000);
    } catch {
      dispatch({ type: 'SAVE_ERR' });
    }
  }, [slug, file, editContent]);

  const canEdit = activeTab !== 'geo';

  return (
    <div className="detail-layout">
      {thumbnailPath && (
        <div className="output-thumb">
          <Image src={thumbnailPath} alt="thumbnail" width={600} height={315} unoptimized />
        </div>
      )}

      <div className="tabs">
        <button
          className={`tab${activeTab === 'article' ? ' tab--active' : ''}`}
          onClick={() => dispatch({ type: 'SET_TAB', tab: 'article', raw: articleRaw })}
        >
          Article
        </button>
        {variants.map((v) => (
          <button
            key={v.name}
            className={`tab${activeTab === `variant:${v.name}` ? ' tab--active' : ''}`}
            onClick={() => dispatch({ type: 'SET_TAB', tab: `variant:${v.name}`, raw: v.content })}
          >
            {v.name}
          </button>
        ))}
        {geoReportHtml && (
          <button
            className={`tab${activeTab === 'geo' ? ' tab--active' : ''}`}
            onClick={() => dispatch({ type: 'SET_TAB', tab: 'geo', raw: '' })}
          >
            GEO Report
          </button>
        )}

        <div className="tabs__actions">
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
          <textarea
            className="edit-area"
            value={editContent}
            onChange={(e) => dispatch({ type: 'CHANGE', content: e.target.value })}
            spellCheck
          />
        ) : (
          /* html is sanitized server-side in page.tsx before being passed here */
          <article className="prose" dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>
    </div>
  );
}
