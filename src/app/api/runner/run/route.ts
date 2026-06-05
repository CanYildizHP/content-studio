import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { randomBytes } from 'crypto';
import { runnerStore, runnerProcesses, getRecentRuns } from '@/lib/runner-store';
import { isValidTopicArg, isValidSlug, isValidContextArg } from '@/lib/validate';
import { BRAIN_PATH } from '@/lib/paths';

const ALLOWED_SKILLS = new Set(['research', 'can-yildiz-writer', 'research-studio']);

interface RunBody {
  skill: string;
  args: {
    topic?: string;
    slug?: string;
    language?: string;
    purpose?: string;
    // intake fields — research
    audience?: string;
    angle?: string;
    sources?: string;
    depth?: string;
    // intake fields — can-yildiz-writer
    direction?: string;
    proofPoints?: string;
    constraints?: string;
    // intake fields — research-studio
    deliverables?: string;
    material?: string;
  };
}

function buildFocusContext(parts: (string | undefined)[], labels: string[]): string {
  return parts
    .map((v, i) => (v?.trim() ? `${labels[i]}: ${v.trim()}` : ''))
    .filter(Boolean)
    .join('. ');
}

// Extract displayable text from a stream-json event.
// Returns null for event types we want to ignore (hooks, tool results, thinking, etc.).
function extractEventText(event: Record<string, unknown>): string | null {
  if (event.type !== 'assistant') return null;
  const content = (event.message as Record<string, unknown>)?.content as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(content)) return null;

  const parts: string[] = [];
  for (const block of content) {
    if (block.type === 'text' && typeof block.text === 'string' && block.text) {
      parts.push(block.text);
    } else if (block.type === 'tool_use' && typeof block.name === 'string') {
      const inputSummary = JSON.stringify(block.input ?? {}).slice(0, 120);
      parts.push(`[${block.name}] ${inputSummary}\n`);
    }
    // thinking blocks: skip — internal reasoning, not useful in the runner UI
  }
  return parts.length > 0 ? parts.join('') : null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as RunBody;
    const { skill, args } = body;

    if (!skill || !ALLOWED_SKILLS.has(skill)) {
      return NextResponse.json({ error: 'Unknown skill' }, { status: 400 });
    }

    // Validate context fields
    const contextFields = [args.purpose, args.audience, args.angle, args.sources,
      args.direction, args.proofPoints, args.constraints, args.deliverables, args.material];
    for (const f of contextFields) {
      if (f !== undefined && !isValidContextArg(f)) {
        return NextResponse.json({ error: 'Invalid context field' }, { status: 400 });
      }
    }

    // Build a single prompt string — everything after `--print` must be ONE argument
    // so that skill flags like --depth, --focus, --direction are not parsed by the claude CLI itself.
    let prompt: string;

    if (skill === 'research') {
      const topic = (args.topic ?? '').trim();
      if (!isValidTopicArg(topic)) return NextResponse.json({ error: 'Invalid topic' }, { status: 400 });

      const focus = buildFocusContext(
        [args.purpose, args.audience, args.angle, args.sources],
        ['Purpose', 'Audience', 'Angle', 'Prioritize']
      );
      const depth = args.depth === 'quick' ? 'quick' : 'deep';

      prompt = `/research ${topic} --depth ${depth} --auto-confirm`;
      if (focus) prompt += ` --focus ${focus}`;

    } else if (skill === 'can-yildiz-writer') {
      const slug = (args.slug ?? '').trim();
      if (!isValidSlug(slug)) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });

      const context = buildFocusContext(
        [args.purpose, args.direction, args.audience, args.proofPoints, args.constraints],
        ['Purpose', 'Direction', 'Audience', 'Proof points', 'Constraints']
      );

      prompt = `/can-yildiz-writer ${slug}`;
      if (context) prompt += ` --direction ${context}`;
      if (args.language === 'de') prompt += ` --lang de`;

    } else {
      // research-studio
      const topic = (args.topic ?? '').trim();
      if (!isValidTopicArg(topic)) return NextResponse.json({ error: 'Invalid topic' }, { status: 400 });

      const focus = buildFocusContext(
        [args.purpose, args.audience],
        ['Purpose', 'Audience']
      );
      const depth = args.depth === 'quick' ? 'quick' : 'deep';

      prompt = `/research-studio ${topic} --depth ${depth} --auto-confirm`;
      if (focus) prompt += ` --focus ${focus}`;
      if (args.deliverables?.trim()) prompt += ` --deliverables ${args.deliverables.trim()}`;
      if (args.material?.trim()) prompt += ` --material ${args.material.trim()}`;
    }

    const runId = randomBytes(6).toString('hex');

    runnerStore.set(runId, {
      runId,
      skill,
      args: prompt,
      startTime: new Date().toISOString(),
      status: 'running',
      exitCode: null,
      outputBuffer: [],
      hasStdin: false,
    });

    // --print: non-interactive, produces stdout output (conversational mode does not in piped env)
    // --output-format stream-json --verbose: NDJSON events stream in real-time as Claude works
    // --include-partial-messages: text appears token-by-token instead of after full response
    // --dangerously-skip-permissions: prevents permission prompts from blocking in non-TTY mode
    // stdio 'ignore' for stdin: equivalent to < /dev/null, avoids the 3s "no stdin data" warning
    const proc = spawn('claude', [
      '--print', prompt,
      '--output-format', 'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--dangerously-skip-permissions',
    ], {
      shell: false,
      cwd: BRAIN_PATH,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    runnerProcesses.set(runId, proc);

    const ANSI_RE = /\x1b\[[0-9;]*[mGKHF]/g;
    let lineBuffer = '';

    proc.stdout.on('data', (data: Buffer) => {
      lineBuffer += data.toString().replace(ANSI_RE, '');
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const record = runnerStore.get(runId);
        if (!record) return;
        try {
          const event = JSON.parse(trimmed) as Record<string, unknown>;
          const text = extractEventText(event);
          if (text) record.outputBuffer.push(text);
        } catch {
          // Not JSON — output as plain text (shouldn't normally happen in stream-json mode)
          record.outputBuffer.push(trimmed + '\n');
        }
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      runnerStore.get(runId)?.outputBuffer.push(`[stderr] ${data.toString().replace(ANSI_RE, '')}`);
    });

    proc.on('error', (err: NodeJS.ErrnoException) => {
      const record = runnerStore.get(runId);
      if (record) {
        record.outputBuffer.push(`[spawn error: ${err.code === 'ENOENT' ? '`claude` not found in PATH' : err.message}]\n`);
        record.status = 'failed';
        record.exitCode = -1;
      }
      runnerProcesses.delete(runId);
    });

    proc.on('close', (code) => {
      const record = runnerStore.get(runId);
      if (record && record.status === 'running') {
        record.status = code === 0 ? 'complete' : 'failed';
        record.exitCode = code;
      }
      runnerProcesses.delete(runId);
    });

    return NextResponse.json({ runId });
  } catch (err) {
    console.error('[api/runner/run POST]', err);
    return NextResponse.json({ error: 'Failed to start run' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(getRecentRuns());
}

// DELETE /api/runner/run — remove all completed/failed runs from history
export async function DELETE() {
  for (const [id, record] of runnerStore) {
    if (record.status !== 'running') runnerStore.delete(id);
  }
  return NextResponse.json({ ok: true });
}
