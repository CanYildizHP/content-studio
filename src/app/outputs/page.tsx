import Link from 'next/link';
import Image from 'next/image';
import type { OutputEntry } from '../api/outputs/route';

async function getOutputs(): Promise<OutputEntry[]> {
  try {
    const res = await fetch('http://localhost:3000/api/outputs', { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function OutputsPage() {
  const outputs = await getOutputs();

  return (
    <>
      <header className="page-head">
        <span className="page-head__kicker">outputs</span>
        <h1 className="page-head__title">Published pieces.</h1>
        <p className="page-head__sub">Finished articles from the Brain vault — written, GEO-optimised, ready.</p>
      </header>

      {outputs.length === 0 ? (
        <p className="empty-state">No outputs yet. Run <code>/can-yildiz-writer</code> to publish one.</p>
      ) : (
        <ul className="item-list item-list--outputs">
          {outputs.map((o) => (
            <li key={o.slug} className="item-list__item">
              <Link href={`/outputs/${o.slug}`} className="item-card item-card--output">
                {o.hasThumbnail && (
                  <div className="item-card__thumb">
                    <Image
                      src={`/api/outputs/${o.slug}/thumbnail`}
                      alt={o.title || o.slug}
                      width={120}
                      height={63}
                      unoptimized
                    />
                  </div>
                )}
                <div className="item-card__body">
                  <span className="item-card__date">{o.date}</span>
                  <span className="item-card__title">{o.title || o.slug}</span>
                  <span className="item-card__note">{o.slug}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
