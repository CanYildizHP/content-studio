import { NextResponse } from 'next/server';
import { runnerStore, runnerProcesses } from '@/lib/runner-store';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const proc = runnerProcesses.get(runId);
  if (proc) {
    proc.kill('SIGTERM');
    runnerProcesses.delete(runId);
  }
  const record = runnerStore.get(runId);
  if (record) {
    if (record.status === 'running') {
      record.status = 'failed';
      record.exitCode = -1;
    } else {
      // Non-running run: remove from history entirely
      runnerStore.delete(runId);
    }
  }
  return NextResponse.json({ ok: true });
}
