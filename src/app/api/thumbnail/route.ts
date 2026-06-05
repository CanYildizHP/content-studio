import { type NextRequest, NextResponse } from 'next/server';
import { fromPartial, propsToSearchParams } from '@/components/thumbnail/thumbnail-params';

// Dev-only convenience endpoint behind the editor's Download button. Renders the
// thumbnail server-side via Playwright (same path as scripts/render-thumbnail.mjs)
// and streams back a PNG. The CLI script is the source of truth; this is a wrapper.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('disabled in production', { status: 404 });
  }
  try {
    const body = await req.json();
    const props = fromPartial(body ?? {});
    const url = `${req.nextUrl.origin}/thumbnail/render?${propsToSearchParams(props).toString()}`;

    // import the shared .mjs helper lazily so Playwright only loads on demand
    const { captureToBuffer, dimsForFormat } = await import('@/lib/capture.mjs');
    const { w, h } = dimsForFormat(props.format);
    const png = await captureToBuffer(url, { scale: 2, width: w, height: h });

    return new NextResponse(new Uint8Array(png), {
      headers: {
        'content-type': 'image/png',
        'content-disposition': 'inline; filename="thumbnail.png"',
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'capture failed';
    return new NextResponse(msg, { status: 500 });
  }
}
