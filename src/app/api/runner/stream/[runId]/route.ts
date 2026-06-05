import { runnerStore } from '@/lib/runner-store';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  const encoder = new TextEncoder();
  let sentIndex = 0;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      function enqueue(line: string) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(line)}\n\n`));
        } catch { /* stream closed */ }
      }

      function close() {
        if (pollTimer) clearInterval(pollTimer);
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        try { controller.close(); } catch { /* already closed */ }
      }

      function flush() {
        const record = runnerStore.get(runId);
        if (!record) {
          enqueue('[run not found]');
          close();
          return;
        }

        while (sentIndex < record.outputBuffer.length) {
          enqueue(record.outputBuffer[sentIndex++]);
        }

        if (record.status !== 'running') {
          const msg = record.status === 'complete'
            ? `[Run complete (exit ${record.exitCode})]`
            : `[Run failed (exit ${record.exitCode})]`;
          enqueue(msg);
          try {
            controller.enqueue(
              encoder.encode(`event: done\ndata: ${JSON.stringify(record.status)}\n\n`)
            );
          } catch { /* closed */ }
          close();
        }
      }

      flush();

      pollTimer = setInterval(flush, 250);

      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch {
          close();
        }
      }, 15000);
    },
    cancel() {
      if (pollTimer) clearInterval(pollTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
