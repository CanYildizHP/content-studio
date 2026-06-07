import { type NextRequest, NextResponse } from 'next/server';
import { CAN_YILDIZ_VOICE, CURIOSITY_DIRECTIVE, deriveInstructionFor, findModel } from '@/lib/brand-voice';
import { runModel } from '@/lib/llm-cli';

// Dev-only "derive a deliverable from the article" endpoint. Given the latest
// canonical blog-post text plus the target deliverable kind (linkedin post,
// first-comment hook, x thread, …), it regenerates that deliverable in Can's
// voice, engineered to open a curiosity gap that pulls readers to the full
// piece. Runs through the shared no-API-key CLI runner (Claude/ChatGPT subs).
// Guarded by NODE_ENV like the other AI endpoints.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_SOURCE = 30000;
const MAX_GUIDANCE = 2000;

const PREAMBLE =
  'You will be given the full text of a published article by Can Yildiz. From it, produce ' +
  'the deliverable described below. Everything must trace to the article — invent no facts.';

// Keep the deliverable on-message: preserve WHY the piece exists, don't trade its
// occasion for a catchier-but-off-topic angle.
const PRESERVE_PURPOSE =
  'Stay anchored to the article\'s core occasion, subject, and framing. Do NOT swap its ' +
  'purpose for a different angle just to manufacture curiosity — the curiosity must serve ' +
  'the original intent, not replace it.';

const OUTPUT_RULES =
  '\n\nOutput rules: Return ONLY the deliverable text. No preamble, no explanation of what ' +
  'you did, no surrounding quotes, no follow-up questions. Write in the same language as the ' +
  'source article. Use markdown where natural. Do not use em dashes (—) or en dashes (–) ' +
  'anywhere; use periods, commas, colons, parentheses, or separate sentences instead.';

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('disabled in production', { status: 404 });
  }
  try {
    const body = await req.json().catch(() => ({}));

    const source = typeof body?.source === 'string' ? body.source : '';
    const basename = typeof body?.basename === 'string' ? body.basename : '';
    const name = typeof body?.name === 'string' ? body.name : basename;
    const instruction = typeof body?.instruction === 'string' ? body.instruction.trim() : '';
    const purpose = typeof body?.purpose === 'string' ? body.purpose.trim() : '';
    const modelId = typeof body?.modelId === 'string' ? body.modelId : '';

    if (!source.trim()) {
      return NextResponse.json({ error: 'source article is empty — nothing to derive from' }, { status: 400 });
    }
    if (source.length > MAX_SOURCE) {
      return NextResponse.json({ error: `article too long (max ${MAX_SOURCE} chars)` }, { status: 413 });
    }
    if (instruction.length > MAX_GUIDANCE) {
      return NextResponse.json({ error: `guidance too long (max ${MAX_GUIDANCE} chars)` }, { status: 413 });
    }

    const model = findModel(modelId);
    if (!model) {
      return NextResponse.json({ error: 'unknown model' }, { status: 400 });
    }

    const formatInstruction = deriveInstructionFor(basename, name);
    const system =
      CAN_YILDIZ_VOICE +
      '\n\n' + PREAMBLE +
      (purpose ? `\n\nPurpose / intent of this piece (anchor everything to it): ${purpose}` : '') +
      '\n\n' + PRESERVE_PURPOSE +
      '\n\n' + CURIOSITY_DIRECTIVE +
      '\n\nFormat: ' + formatInstruction +
      (instruction ? `\n\nAdditional guidance: ${instruction}` : '') +
      OUTPUT_RULES;

    const text = await runModel(model.provider, model.id, system, source);

    if (!text) {
      return NextResponse.json({ error: 'The model returned nothing. Try again.' }, { status: 502 });
    }
    return NextResponse.json({ text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'derive failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
