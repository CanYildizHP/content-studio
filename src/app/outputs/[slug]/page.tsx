import Link from 'next/link';
import { notFound } from 'next/navigation';
import { marked } from 'marked';
import { safeHtml } from '@/lib/sanitize';
import OutputDetail from './OutputDetail';

interface OutputDoc { name: string; file: string; content: string; primary?: boolean }
interface OutputDetailData {
  slug: string;
  documents: OutputDoc[];
  geoReport: string | null;
  thumbnailPath: string | null;
  purpose?: string;
}

async function getOutput(slug: string): Promise<OutputDetailData | null> {
  try {
    const res = await fetch(`http://localhost:3000/api/outputs/${slug}`, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed');
    return res.json();
  } catch {
    return null;
  }
}

export default async function OutputDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const output = await getOutput(slug);
  if (!output) notFound();

  // All markdown → HTML conversion and sanitization happens here (server-side)
  const documents = await Promise.all(
    output.documents.map(async (d) => ({
      name: d.name,
      file: d.file,
      html: safeHtml(await marked(d.content)),
      content: d.content,
      primary: d.primary ?? false,
    }))
  );
  const geoReportHtml = output.geoReport
    ? safeHtml(await marked(output.geoReport))
    : null;

  return (
    <>
      <header className="page-head">
        <span className="page-head__kicker">
          <Link href="/outputs">outputs</Link> / {slug}
        </span>
        <h1 className="page-head__title">{slug}</h1>
      </header>

      <OutputDetail
        slug={slug}
        documents={documents}
        geoReportHtml={geoReportHtml}
        thumbnailPath={output.thumbnailPath}
        purpose={output.purpose ?? ''}
      />
    </>
  );
}
