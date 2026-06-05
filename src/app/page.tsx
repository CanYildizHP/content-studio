import Link from 'next/link';

const PANELS = [
  { href: '/thumbnail', label: 'Thumbnails', note: 'Generate brand-faithful 1200×630 thumbnails.', live: true },
  { href: '/studios', label: 'Studios', note: 'Browse research-studio notebooks + dossiers.', live: true },
  { href: '/outputs', label: 'Outputs', note: 'Browse finished pieces in the Brain vault.', live: true },
  { href: '/runner', label: 'Runner', note: 'Trigger + watch skill runs.', live: true },
];

export default function Home() {
  return (
    <>
      <header className="page-head">
        <span className="page-head__kicker">content-studio · local</span>
        <h1 className="page-head__title">The content cockpit.</h1>
        <p className="page-head__sub">
          One local surface for the pipeline: research → write → optimize → ship. Thumbnails are live;
          the rest land in later phases.
        </p>
      </header>
      <div className="home-grid">
        {PANELS.map((p) => (
          <Link key={p.href} href={p.href} className={`home-card${p.live ? '' : ' home-card--soon'}`}>
            <span className="home-card__label">{p.label}</span>
            <span className="home-card__note">{p.note}</span>
            <span className="home-card__tag">{p.live ? 'open →' : 'soon'}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
