import type { Metadata } from 'next';
import ThumbnailEditor from './ThumbnailEditor';

export const metadata: Metadata = {
  title: 'Thumbnails — Content Studio',
  robots: { index: false, follow: false },
};

export default function ThumbnailPage() {
  return (
    <>
      <header className="page-head">
        <span className="page-head__kicker">thumbnails · 1200×630</span>
        <h1 className="page-head__title">Brand thumbnail generator.</h1>
        <p className="page-head__sub">
          Real fonts, tokens, and the Star — rendered as DOM and captured with Playwright. Edit, preview,
          download. The same render route is what the can-yildiz-writer skill calls.
        </p>
      </header>
      <ThumbnailEditor />
    </>
  );
}
