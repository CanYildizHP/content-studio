import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { brainPath } from '@/lib/paths';
import { isValidSlug, assertInsideDir } from '@/lib/validate';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

export interface OutputDetail {
  slug: string;
  article: string;
  variants: { name: string; content: string }[];
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

    const folderFiles = fs.readdirSync(folderPath);
    const articleFile = folderFiles.find((f) => f.endsWith('.md'));
    if (!articleFile) return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    const articlePath = path.join(folderPath, articleFile);

    const article = fs.readFileSync(articlePath, 'utf-8');

    const variants: { name: string; content: string }[] = [];
    const variantsDir = path.join(folderPath, 'variants');
    if (fs.existsSync(variantsDir)) {
      for (const f of fs.readdirSync(variantsDir)) {
        if (f.endsWith('.md') && isValidSlug(f.replace('.md', ''))) {
          variants.push({ name: f.replace('.md', ''), content: fs.readFileSync(path.join(variantsDir, f), 'utf-8') });
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

    return NextResponse.json({ slug, article, variants, geoReport, thumbnailPath });
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

    let targetPath: string;
    if (file === 'article') {
      // Resolve to the actual .md file that GET reads, not a hardcoded name.
      const existingMd = fs.readdirSync(folderPath).find((f) => f.endsWith('.md'));
      targetPath = path.join(folderPath, existingMd ?? 'article.md');
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
