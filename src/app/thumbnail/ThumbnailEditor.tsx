'use client';

import { useMemo, useState } from 'react';
import { Thumbnail } from '@/components/thumbnail/Thumbnail';
import { PORTRAITS } from '@/components/thumbnail/portraits';
import {
  DEFAULTS,
  FORMATS,
  FORMAT_BY_ID,
  propsToSearchParams,
  type ThumbnailProps,
  type ThumbnailMode,
  type ThumbnailVariant,
  type EmphasisStyle,
  type ThumbnailFormat,
} from '@/components/thumbnail/thumbnail-params';
import './thumbnail.css';

// preview fits within this box (the live preview scales the real 1200/1080/1600 canvas down)
const PREVIEW_MAX_W = 540;
const PREVIEW_MAX_H = 620;

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'thumbnail';
}

export default function ThumbnailEditor() {
  const [p, setP] = useState<ThumbnailProps>(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [zoom, setZoom] = useState<'fit' | 'full'>('fit');

  const [uploaded, setUploaded] = useState<{ value: string; label: string }[]>([]);

  const set = <K extends keyof ThumbnailProps>(k: K, v: ThumbnailProps[K]) => setP((s) => ({ ...s, [k]: v }));
  const setByline = (k: 'name' | 'role', v: string) => setP((s) => ({ ...s, byline: { ...s.byline, [k]: v } }));
  const needsPortrait = p.mode !== 'type';

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('uploading photo…');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'upload failed');
      setUploaded((u) => [{ value: data.path, label: `↑ ${data.label}` }, ...u]);
      setP((s) => ({ ...s, portrait: data.path, mode: s.mode === 'type' ? 'photo' : s.mode }));
      setStatus('photo uploaded ✓');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'upload error');
    } finally {
      e.target.value = '';
    }
  }

  const portraitOptions = [...uploaded, ...PORTRAITS];

  const query = useMemo(() => propsToSearchParams(p).toString(), [p]);
  const spec = FORMAT_BY_ID[p.format] ?? FORMAT_BY_ID[DEFAULTS.format];
  const previewScale = Math.min(PREVIEW_MAX_W / spec.w, PREVIEW_MAX_H / spec.h);

  async function download() {
    setBusy(true);
    setStatus('rendering…');
    try {
      const res = await fetch('/api/thumbnail', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(p),
      });
      if (!res.ok) throw new Error(`render failed (${res.status}): ${await res.text()}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slugify(p.title)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus('downloaded ✓');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ed">
      <div className="ed__controls">
        <Field label="Title">
          <input value={p.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Row>
          <Field label="Emphasis word">
            <input value={p.emphasis ?? ''} onChange={(e) => set('emphasis', e.target.value)} placeholder="(optional)" />
          </Field>
          <Field label="Emphasis style">
            <select value={p.emphasisStyle} onChange={(e) => set('emphasisStyle', e.target.value as EmphasisStyle)}>
              <option value="chromatic">chromatic (Nabla)</option>
              <option value="plain">plain orange</option>
            </select>
          </Field>
        </Row>
        <Field label="Kicker">
          <input value={p.kicker} onChange={(e) => set('kicker', e.target.value)} />
        </Field>
        <Field label="Sub-line">
          <input value={p.sub ?? ''} onChange={(e) => set('sub', e.target.value)} placeholder="(optional)" />
        </Field>
        <Field label="Format">
          <select value={p.format} onChange={(e) => set('format', e.target.value as ThumbnailFormat)}>
            {FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label} · {f.w}×{f.h} ({f.ratio}) — {f.serves}
              </option>
            ))}
          </select>
        </Field>
        <Row>
          <Field label="Mode">
            <select value={p.mode} onChange={(e) => set('mode', e.target.value as ThumbnailMode)}>
              <option value="type">type</option>
              <option value="photo">photo (b&w)</option>
              <option value="color-image">color image</option>
              <option value="sketch">sketch (duotone)</option>
            </select>
          </Field>
          <Field label="Variant">
            <select value={p.variant} onChange={(e) => set('variant', e.target.value as ThumbnailVariant)}>
              <option value="ink">ink</option>
              <option value="cream">cream</option>
            </select>
          </Field>
        </Row>
        <Field label="Portrait">
          <select
            value={p.portrait ?? ''}
            disabled={!needsPortrait}
            onChange={(e) => set('portrait', e.target.value)}
          >
            {portraitOptions.map((pt) => (
              <option key={pt.value} value={pt.value}>{pt.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Upload photo">
          <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={onUpload} disabled={!needsPortrait} />
        </Field>

        <Field label="Text alignment">
          <select value={p.align} onChange={(e) => set('align', e.target.value as 'left' | 'center')}>
            <option value="left">left</option>
            <option value="center">center</option>
          </select>
        </Field>
        <Row>
          <SizeField label="Title size" value={p.titleSize} fallback={64} min={28} max={160}
            onChange={(v) => set('titleSize', v)} />
          <SizeField label="Sub size" value={p.subSize} fallback={20} min={12} max={48}
            onChange={(v) => set('subSize', v)} />
        </Row>

        <Row>
          <Field label="Name">
            <input value={p.byline.name} onChange={(e) => setByline('name', e.target.value)} />
          </Field>
          <Field label="Role">
            <input value={p.byline.role} onChange={(e) => setByline('role', e.target.value)} />
          </Field>
        </Row>
        <Row>
          <SizeField label="Name size" value={p.nameSize} fallback={20} min={12} max={40}
            onChange={(v) => set('nameSize', v)} />
          <SizeField label="Role size" value={p.roleSize} fallback={16} min={10} max={32}
            onChange={(v) => set('roleSize', v)} />
        </Row>

        <div className="ed__actions">
          <button className="ed__btn" onClick={download} disabled={busy}>
            {busy ? 'Rendering…' : 'Download PNG'}
          </button>
          <span className="ed__status">{status}</span>
        </div>

        <details className="ed__contract">
          <summary>render URL / CLI</summary>
          <code className="ed__code">/thumbnail/render?{query}</code>
          <code className="ed__code">node scripts/render-thumbnail.mjs --json &apos;{JSON.stringify(p)}&apos; --out thumb.png</code>
        </details>
      </div>

      <div className="ed__preview">
        <div className="ed__zoom">
          <button className={`ed__zoom-btn${zoom === 'fit' ? ' is-on' : ''}`} onClick={() => setZoom('fit')}>
            Fit
          </button>
          <button className={`ed__zoom-btn${zoom === 'full' ? ' is-on' : ''}`} onClick={() => setZoom('full')}>
            100%
          </button>
          <a className="ed__zoom-open" href={`/thumbnail/render?${query}`} target="_blank" rel="noreferrer">
            open ↗
          </a>
        </div>
        <div
          className={`ed__stage${zoom === 'full' ? ' ed__stage--scroll' : ''}`}
          style={
            zoom === 'full'
              ? { width: '100%', maxHeight: '74vh' }
              : { width: spec.w * previewScale, height: spec.h * previewScale }
          }
        >
          <div
            style={{
              transform: `scale(${zoom === 'full' ? 1 : previewScale})`,
              transformOrigin: 'top left',
              width: spec.w,
              height: spec.h,
            }}
          >
            <Thumbnail {...p} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="ed__field">
      <span className="ed__label">{label}</span>
      {children}
    </label>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <div className="ed__row">{children}</div>;
}

function SizeField({
  label, value, fallback, min, max, onChange,
}: {
  label: string;
  value: number | undefined;
  fallback: number;
  min: number;
  max: number;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <Field label={label}>
      <div className="ed__size">
        <input
          type="range"
          min={min}
          max={max}
          value={value ?? fallback}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="ed__size-val">{value ? `${value}px` : 'auto'}</span>
        <button type="button" className="ed__mini" onClick={() => onChange(undefined)} disabled={value === undefined}>
          auto
        </button>
      </div>
    </Field>
  );
}
