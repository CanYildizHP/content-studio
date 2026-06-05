import { NextResponse } from 'next/server';
import { runnerStore, runnerProcesses } from '@/lib/runner-store';

function validateRequest(req: Request): { valid: boolean; error?: string } {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return { valid: false, error: 'Runner API not available in production' };
  }

  // Require secret header for CSRF protection
  const secret = req.headers.get('x-runner-secret');
  if (secret !== process.env.RUNNER_SECRET && process.env.RUNNER_SECRET) {
    return { valid: false, error: 'Unauthorized' };
  }

  return { valid: true };
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const validation = validateRequest(req);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 403 });
  }

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
