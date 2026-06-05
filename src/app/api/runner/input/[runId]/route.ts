import { NextResponse } from 'next/server';
import { runnerStore, runnerProcesses } from '@/lib/runner-store';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  try {
    const { line } = await req.json() as { line: string };
    if (typeof line !== 'string') {
      return NextResponse.json({ error: 'Missing line' }, { status: 400 });
    }

    const record = runnerStore.get(runId);
    if (!record || record.status !== 'running') {
      return NextResponse.json({ error: 'Run not active' }, { status: 404 });
    }

    const proc = runnerProcesses.get(runId);
    if (!proc?.stdin?.writable) {
      return NextResponse.json({ error: 'Stdin not available' }, { status: 400 });
    }

    proc.stdin.write(line + '\n');
    record.outputBuffer.push(`> ${line}\n`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/runner/input]', err);
    return NextResponse.json({ error: 'Failed to send input' }, { status: 500 });
  }
}
