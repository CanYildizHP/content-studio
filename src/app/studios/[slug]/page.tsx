import Link from 'next/link';
import { marked } from 'marked';
import { notFound } from 'next/navigation';
import { safeHtml } from '@/lib/sanitize';

interface NotebookMeta {
  id: string;
  title: string;
  sourceCount: number;
  url: string;
}

interface StudioDetail {
  slug: string;
  dossier: string;
  notebook: NotebookMeta | null;
  nlmWarning?: string;
}

async function getStudio(slug: string): Promise<StudioDetail | null> {
  try {
    const res = await fetch(`http://localhost:3000/api/studios/${slug}`, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed');
    return res.json();
  } catch {
    return null;
  }
}

export default async function StudioDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const studio = await getStudio(slug);
  if (!studio) notFound();

  const dossierHtml = safeHtml(await marked(studio.dossier));

  return (
    <>
      <header className="page-head">
        <span className="page-head__kicker">
          <Link href="/studios">studios</Link> / {slug}
        </span>
        <h1 className="page-head__title">{slug}</h1>
      </header>

      <div className="detail-layout">
        <aside className="detail-sidebar">
          <div className="nlm-card">
            <span className="nlm-card__label">NotebookLM</span>
            {studio.notebook ? (
              <>
                <span className="nlm-card__title">{studio.notebook.title}</span>
                <span className="nlm-card__meta">{studio.notebook.sourceCount} sources</span>
                <a
                  href={studio.notebook.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nlm-card__link"
                >
                  Open notebook →
                </a>
              </>
            ) : studio.nlmWarning ? (
              <span className="nlm-card__warn">{studio.nlmWarning}</span>
            ) : (
              <span className="nlm-card__empty">No notebook linked</span>
            )}
          </div>
        </aside>

        <article
          className="prose"
          dangerouslySetInnerHTML={{ __html: dossierHtml }}
        />
      </div>
    </>
  );
}
