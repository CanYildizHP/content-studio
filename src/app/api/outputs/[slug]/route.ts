import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { brainPath } from '@/lib/paths';
import { isValidSlug, assertInsideDir } from '@/lib/validate';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

export interface OutputDoc {
  name: string;          // human label for the tab
  file: string;          // PATCH save target: "doc/<basename>" or "variant/<name>"
  content: string;       // raw markdown
  primary?: boolean;     // the canonical/article-like doc (default tab)
}

export interface OutputDetail {
  slug: string;
  documents: OutputDoc[];
  geoReport: string | null;
  thumbnailPath: string | null;
}

function findOutputFolder(slug: string): string | null {
  const outputDir = brainPath('research', 'deliverables');
  if (!fs.existsSync(outputDir)) return null;
  const direct = path.join(outputDir, slug);
  if (fs.existsSync(direct)) return direct;
  return null;
}

/** "linkedin-first-comment-hook" -> "Linkedin first comment hook" */
function humanize(basename: string): string {
  const spaced = basename.replace(/[-_]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Pick the canonical/article-like doc: slug match, then blog-post/article/index, else first. */
function choosePrimary(basenames: string[], slug: string): string | undefined {
  if (!basenames.length) return undefined;
  const prefer = [slug, 'blog-post', 'article', 'index'];
  for (const p of prefer) {
    if (basenames.includes(p)) return p;
  }
  return basenames[0];
}

const MAX_PURPOSE = 2000;

/** Per-output sidecar metadata (e.g. the piece's purpose/intent that anchors AI
 *  rewrites). Stored as `_meta.json`, which is invisible to the documents list
 *  since that only scans `.md` files. */
function readMeta(folderPath: string): { purpose: string } {
  const metaPath = path.join(folderPath, '_meta.json');
  if (fs.existsSync(metaPath)) {
    try {
      const m = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      return { purpose: typeof m?.purpose === 'string' ? m.purpose : '' };
    } catch { /* corrupt sidecar — treat as empty */ }
  }
  return { purpose: '' };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }

  try {
    const outputRoot = brainPath('research', 'deliverables');
    const folderPath = findOutputFolder(slug);
    if (!folderPath) return NextResponse.json({ error: 'Output not found' }, { status: 404 });
    assertInsideDir(folderPath, outputRoot);

    // Every top-level .md (except geo-report) is an editable document — not just
    // the first one. This surfaces all skill deliverables (blog-post, linkedin-post,
    // linkedin-hooks, x-thread, …) as their own editable tabs.
    const topLevelBasenames = fs.readdirSync(folderPath)
      .filter((f) => f.endsWith('.md') && f !== 'geo-report.md')
      .map((f) => f.replace(/\.md$/, ''))
      .filter((b) => isValidSlug(b))
      .sort();

    if (!topLevelBasenames.length) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const primary = choosePrimary(topLevelBasenames, slug);
    // Primary first, then the rest alphabetically.
    const ordered = [primary, ...topLevelBasenames.filter((b) => b !== primary)].filter(Boolean) as string[];

    const documents: OutputDoc[] = ordered.map((base) => ({
      name: humanize(base),
      file: `doc/${base}`,
      content: fs.readFileSync(path.join(folderPath, `${base}.md`), 'utf-8'),
      primary: base === primary,
    }));

    // Variants subfolder — appended after the top-level docs.
    const variantsDir = path.join(folderPath, 'variants');
    if (fs.existsSync(variantsDir)) {
      for (const f of fs.readdirSync(variantsDir)) {
        if (f.endsWith('.md') && isValidSlug(f.replace('.md', ''))) {
          const name = f.replace('.md', '');
          documents.push({
            name: humanize(name),
            file: `variant/${name}`,
            content: fs.readFileSync(path.join(variantsDir, f), 'utf-8'),
          });
        }
      }
    }

    let geoReport: string | null = null;
    const geoPath = path.join(folderPath, 'geo-report.md');
    if (fs.existsSync(geoPath)) geoReport = fs.readFileSync(geoPath, 'utf-8');

    let thumbnailPath: string | null = null;
    for (const ext of ['png', 'jpg', 'jpeg']) {
      if (fs.existsSync(path.join(folderPath, `thumbnail.${ext}`))) {
        thumbnailPath = `/api/outputs/${slug}/thumbnail`;
        break;
      }
    }

    const { purpose } = readMeta(folderPath);

    return NextResponse.json({ slug, documents, geoReport, thumbnailPath, purpose });
  } catch (err) {
    console.error('[api/outputs/[slug] GET]', err);
    return NextResponse.json({ error: 'Failed to read output' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }

  try {
    const body = await req.json() as { file: string; content: string };
    const { file, content } = body;
    if (!file || typeof content !== 'string') {
      return NextResponse.json({ error: 'Missing file or content' }, { status: 400 });
    }

    const outputRoot = brainPath('research', 'deliverables');
    const folderPath = findOutputFolder(slug);
    if (!folderPath) return NextResponse.json({ error: 'Output not found' }, { status: 404 });
    assertInsideDir(folderPath, outputRoot);

    // Purpose/intent is metadata, not a deliverable — store it in the JSON sidecar.
    if (file === 'purpose') {
      if (content.length > MAX_PURPOSE) {
        return NextResponse.json({ error: `purpose too long (max ${MAX_PURPOSE})` }, { status: 413 });
      }
      const metaPath = path.join(folderPath, '_meta.json');
      const meta = readMeta(folderPath);
      meta.purpose = content;
      const tmpPath = path.join(tmpdir(), `cs-meta-${randomBytes(8).toString('hex')}.tmp`);
      fs.writeFileSync(tmpPath, JSON.stringify(meta, null, 2), 'utf-8');
      fs.renameSync(tmpPath, metaPath);
      return NextResponse.json({ ok: true });
    }

    let targetPath: string;
    if (file === 'article') {
      // Legacy target — resolve to the actual first .md file. New clients use doc/<basename>.
      const existingMd = fs.readdirSync(folderPath).find((f) => f.endsWith('.md'));
      targetPath = path.join(folderPath, existingMd ?? 'article.md');
    } else if (file.startsWith('doc/')) {
      const base = file.slice('doc/'.length);
      if (!isValidSlug(base)) {
        return NextResponse.json({ error: 'Invalid document name' }, { status: 400 });
      }
      targetPath = path.join(folderPath, `${base}.md`);
      assertInsideDir(targetPath, outputRoot);
    } else if (file.startsWith('variant/')) {
      const variantName = file.slice('variant/'.length);
      if (!isValidSlug(variantName)) {
        return NextResponse.json({ error: 'Invalid variant name' }, { status: 400 });
      }
      const variantsDir = path.join(folderPath, 'variants');
      if (!fs.existsSync(variantsDir)) fs.mkdirSync(variantsDir, { recursive: true });
      targetPath = path.join(variantsDir, `${variantName}.md`);
      assertInsideDir(targetPath, outputRoot);
    } else {
      return NextResponse.json({ error: 'Invalid file target' }, { status: 400 });
    }

    const tmpPath = path.join(tmpdir(), `cs-edit-${randomBytes(8).toString('hex')}.tmp`);
    fs.writeFileSync(tmpPath, content, 'utf-8');
    fs.renameSync(tmpPath, targetPath);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/outputs/[slug] PATCH]', err);
    return NextResponse.json({ error: 'Failed to save file' }, { status: 500 });
  }
}
