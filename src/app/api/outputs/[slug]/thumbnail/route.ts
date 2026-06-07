import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { brainPath } from '@/lib/paths';
import { isValidSlug, assertInsideDir } from '@/lib/validate';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }

  const outputRoot = brainPath('research', 'deliverables');
  const folderPath = path.join(outputRoot, slug);

  try {
    assertInsideDir(folderPath, outputRoot);
  } catch {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  for (const ext of ['png', 'jpg', 'jpeg']) {
    const p = path.join(folderPath, `thumbnail.${ext}`);
    if (fs.existsSync(p)) {
      const data = fs.readFileSync(p);
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
      return new NextResponse(data, {
        headers: { 'Content-Type': mime, 'Cache-Control': 'no-store' },
      });
    }
  }

  return NextResponse.json({ error: 'Thumbnail not found' }, { status: 404 });
}
