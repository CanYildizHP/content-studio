import Link from 'next/link';
import type { StudioEntry } from '../api/studios/route';

async function getStudios(): Promise<StudioEntry[]> {
  try {
    const res = await fetch('http://localhost:3000/api/studios', { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function StudiosPage() {
  const studios = await getStudios();

  return (
    <>
      <header className="page-head">
        <span className="page-head__kicker">studios</span>
        <h1 className="page-head__title">Research sessions.</h1>
        <p className="page-head__sub">Every research-studio run — dossiers and NotebookLM notebooks.</p>
      </header>

      {studios.length === 0 ? (
        <p className="empty-state">No studios yet. Run <code>/research-studio</code> to create one.</p>
      ) : (
        <ul className="item-list">
          {studios.map((s) => (
            <li key={s.slug} className="item-list__item">
              <Link href={`/studios/${s.slug}`} className="item-card">
                <span className="item-card__date">{s.date}</span>
                <span className="item-card__title">{s.slug}</span>
                {s.summary && <span className="item-card__note">{s.summary}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
