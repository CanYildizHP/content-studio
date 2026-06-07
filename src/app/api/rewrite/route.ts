import { type NextRequest, NextResponse } from 'next/server';
import { CAN_YILDIZ_VOICE, findModel, findTone } from '@/lib/brand-voice';
import { runModel } from '@/lib/llm-cli';

// Dev-only text rewriting for the article editor. Takes a selected passage plus
// a tone preset and free-text guidance, wraps them around the Can Yildiz brand
// voice, and returns the rewritten passage. Generation runs through the shared,
// no-API-key CLI runner in @/lib/llm-cli (Claude/ChatGPT subscriptions).
// Guarded by NODE_ENV like the other AI endpoints — this never runs in prod.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120; // codex exec (agent runner) can take 10–30s

const MAX_TEXT = 8000;
const MAX_GUIDANCE = 2000;

const OUTPUT_RULES =
  '\n\nOutput rules: Return ONLY the rewritten passage. No preamble, no explanation, ' +
  'no surrounding quotes, no follow-up questions. Write in the same language as the input. ' +
  'Preserve any markdown formatting (links, emphasis, lists) present in the input. ' +
  'Do not use em dashes (—) or en dashes (–) anywhere in the output; use periods, commas, ' +
  'colons, parentheses, or separate sentences instead.';

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('disabled in production', { status: 404 });
  }
  try {
    const body = await req.json().catch(() => ({}));

    const text = typeof body?.text === 'string' ? body.text : '';
    const instruction = typeof body?.instruction === 'string' ? body.instruction.trim() : '';
    const toneId = typeof body?.toneId === 'string' ? body.toneId : undefined;
    const modelId = typeof body?.modelId === 'string' ? body.modelId : '';

    if (!text.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }
    if (text.length > MAX_TEXT) {
      return NextResponse.json({ error: `selection too long (max ${MAX_TEXT} chars)` }, { status: 413 });
    }
    if (instruction.length > MAX_GUIDANCE) {
      return NextResponse.json({ error: `guidance too long (max ${MAX_GUIDANCE} chars)` }, { status: 413 });
    }

    const model = findModel(modelId);
    if (!model) {
      return NextResponse.json({ error: 'unknown model' }, { status: 400 });
    }

    const tone = findTone(toneId);
    const system =
      CAN_YILDIZ_VOICE +
      (tone ? `\n\nTone: ${tone.instruction}` : '') +
      (instruction ? `\n\nAdditional guidance: ${instruction}` : '') +
      OUTPUT_RULES;

    const rewritten = await runModel(model.provider, model.id, system, text);

    if (!rewritten) {
      return NextResponse.json({ error: 'The model returned an empty rewrite. Try again.' }, { status: 502 });
    }
    return NextResponse.json({ rewritten });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'rewrite failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
