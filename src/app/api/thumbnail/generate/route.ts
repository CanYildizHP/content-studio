import { type NextRequest, NextResponse } from 'next/server';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { generateImage } from '@/lib/higgsfield.mjs';

// Dev-only AI image generation via the Higgsfield CLI. Takes a text prompt,
// shells out to an already-authenticated `higgsfield` binary, downloads the
// result into public/uploads/, and returns the public path — same shape as
// the upload route, so the editor can drop it straight into color-image mode.
// Guarded by NODE_ENV like the other thumbnail endpoints.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // generation + download can take a while

const MAX_PROMPT = 2000;

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('disabled in production', { status: 404 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    const model = typeof body?.model === 'string' && body.model.trim() ? body.model.trim() : undefined;
    if (!prompt) return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    if (prompt.length > MAX_PROMPT) {
      return NextResponse.json({ error: `prompt too long (max ${MAX_PROMPT})` }, { status: 413 });
    }

    const outDir = join(process.cwd(), 'public', 'uploads');
    await mkdir(outDir, { recursive: true });

    const log: string[] = [];
    const result = await generateImage({
      prompt,
      model,
      outDir,
      filenameStamp: Date.now(),
      onLog: (m: string) => log.push(m),
    });

    return NextResponse.json({
      path: result.path,
      label: `✦ ${prompt.slice(0, 32)}${prompt.length > 32 ? '…' : ''}`,
      jobId: result.jobId,
      model: result.model,
      sourceUrl: result.url,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
