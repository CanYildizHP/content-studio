import { type NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

// Dev-only photo upload. Saves into public/uploads/ so BOTH the live editor preview
// and the headless Playwright capture can load it by URL (a browser blob URL would
// be invisible to the capture's separate browser). Returns the public path, which
// paramsToProps allows via the /uploads/ pattern.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OK_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/avif']);
const OK_EXTS: Record<string, string> = { png: 'png', jpg: 'jpg', jpeg: 'jpg', webp: 'webp', avif: 'avif' };
const MAX_BYTES = 12 * 1024 * 1024;

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('disabled in production', { status: 404 });
  }
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'no file' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'file too large (max 12MB)' }, { status: 413 });

    // accept by MIME, or fall back to extension (some clients send octet-stream)
    const nameExt = (file.name.split('.').pop() || '').toLowerCase();
    const ext = OK_TYPES.has(file.type) ? file.type.split('/')[1].replace('jpeg', 'jpg') : OK_EXTS[nameExt];
    if (!ext) return NextResponse.json({ error: `unsupported image (${file.type || nameExt || 'unknown'})` }, { status: 415 });

    const base = (file.name || 'upload')
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .slice(0, 40) || 'upload';
    const name = `${base}-${Date.now()}.${ext}`;

    const dir = join(process.cwd(), 'public', 'uploads');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, name), Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({ path: `/uploads/${name}`, label: file.name || name });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'upload failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
