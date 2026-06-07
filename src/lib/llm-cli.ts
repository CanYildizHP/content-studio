import { spawn } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { RewriteProvider } from './brand-voice';

// Shared, dev-only LLM runner used by the editor's /api/rewrite and /api/derive
// routes. NO API KEYS — we shell out to the locally-authenticated CLIs the way
// the skill runner does, so calls use existing subscriptions, not per-token
// billing:
//   - Anthropic models -> `claude --print` (Claude subscription via CLAUDE_CODE_OAUTH_TOKEN)
//   - OpenAI models     -> `codex exec`    (ChatGPT subscription; `codex login`)

const TIMEOUT_MS = 110_000;
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;

/** Run a model by provider. `system` is the full instruction set; `text` is the
 *  source/input the model acts on. Returns the trimmed model output. */
export function runModel(
  provider: RewriteProvider,
  modelId: string,
  system: string,
  text: string,
): Promise<string> {
  return provider === 'openai' ? runCodex(text, system, modelId) : runClaude(text, system, modelId);
}

/** Claude Code CLI as a one-shot transformer using the Claude subscription.
 *  `--system-prompt` fully replaces Claude Code's agent persona so it behaves as
 *  a pure copy editor; `--exclude-dynamic-system-prompt-sections` strips the rest.
 *  The user-controlled input is fed via stdin (NOT argv) so input that begins
 *  with `-` (e.g. a markdown bullet) can't be smuggled in as a CLI flag. `system`
 *  stays in argv but is bound to `--system-prompt`, which consumes it as a value,
 *  so it isn't subject to flag parsing. */
function runClaude(text: string, system: string, modelId: string): Promise<string> {
  return runCli(
    'claude',
    ['--print', '--model', modelId, '--system-prompt', system,
      '--exclude-dynamic-system-prompt-sections', '--output-format', 'text'],
    text,
  );
}

/** `codex exec` as a one-shot transformer using the ChatGPT subscription. Codex
 *  has no system-prompt flag, so the instructions are folded into the prompt
 *  (sent via stdin). `-o <file>` writes just the final message, avoiding fragile
 *  JSONL parsing. */
async function runCodex(text: string, system: string, modelId: string): Promise<string> {
  const outFile = join(tmpdir(), `cs-llm-${randomBytes(6).toString('hex')}.txt`);
  const prompt = `${system}\n\n---\nINPUT:\n${text}`;
  try {
    await runCli(
      'codex',
      ['exec', '-m', modelId, '--sandbox', 'read-only', '--skip-git-repo-check',
        '--cd', tmpdir(), '-o', outFile],
      prompt,
    );
    const result = await readFile(outFile, 'utf8').catch(() => '');
    return result.replace(ANSI_RE, '').trim();
  } finally {
    void unlink(outFile).catch(() => {});
  }
}

function quoteArg(a: string): string {
  return /[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a;
}

/** Spawn a CLI, optionally feed `stdin`, capture stdout, enforce a timeout.
 *  Returns trimmed, ANSI-stripped stdout; rejects with stderr on failure.
 *
 *  `codex` is an npm `.cmd` shim on Windows, which spawn(shell:false) can't
 *  execute directly — so we run it through a shell there (args are fixed flags
 *  plus an allow-listed model id and program-generated paths, which we quote;
 *  the prompt itself goes via stdin, never the command line). The `claude`
 *  launcher is a real executable and runs without a shell. */
function runCli(cmd: string, args: string[], stdin: string | null): Promise<string> {
  return new Promise((resolve, reject) => {
    const useShell = process.platform === 'win32' && cmd === 'codex';
    const proc = spawn(
      useShell ? `${cmd} ${args.map(quoteArg).join(' ')}` : cmd,
      useShell ? [] : args,
      {
        shell: useShell,
        cwd: tmpdir(),
        stdio: [stdin === null ? 'ignore' : 'pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      },
    );

    let out = '';
    let err = '';
    const timer = setTimeout(() => { proc.kill(); reject(new Error('Generation timed out')); }, TIMEOUT_MS);

    proc.stdout?.on('data', (d: Buffer) => { out += d.toString(); });
    proc.stderr?.on('data', (d: Buffer) => { err += d.toString(); });
    proc.on('error', (e: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(new Error(e.code === 'ENOENT' ? `\`${cmd}\` CLI not found in PATH` : e.message));
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) { resolve(out.replace(ANSI_RE, '').trim()); return; }
      reject(new Error(cleanCliError(err) || `${cmd} exited with code ${code}`));
    });

    if (stdin !== null && proc.stdin) { proc.stdin.write(stdin); proc.stdin.end(); }
  });
}

/** Pull a human-readable message out of CLI stderr (codex emits `ERROR: {json}`). */
function cleanCliError(stderr: string): string {
  const clean = stderr.replace(ANSI_RE, '').trim();
  const match = clean.match(/"message"\s*:\s*"([^"]+)"/);
  if (match) return match[1];
  return clean.split('\n').filter(Boolean).pop() ?? '';
}
