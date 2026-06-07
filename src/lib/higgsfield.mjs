// Thin server-side wrapper around the Higgsfield CLI (`@higgsfield/cli`, bin
// `higgsfield` / `hf`). Mirrors the "hybrid AI-image + HTML" carousel workflow:
// turn a text prompt into an image, then feed it into the thumbnail as a
// color-image portrait/background. Dev-only — the API route that calls this is
// guarded by NODE_ENV, same as the upload/render routes.
//
// The CLI is a Go binary the user installs + authenticates themselves
// (`npm i -g @higgsfield/cli` then `higgsfield auth login` — interactive
// browser OAuth). This module never installs or authenticates; it only shells
// out to an already-authenticated binary.
//
// ── Why the command construction is isolated below ──────────────────────────
// The exact flags vary by CLI version. Everything version-specific lives in the
// CONFIG block and is overridable via env, so adapting to `higgsfield generate
// create --help` is a one-line change (or zero — set the env var) rather than a
// code rewrite. Defaults follow the documented command shape:
//   higgsfield generate create <model> --prompt "<text>"
//   higgsfield generate wait   <jobId>
//   higgsfield generate get    <jobId>

import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// ── CONFIG (override via env without touching code) ─────────────────────────
const BIN = process.env.HIGGSFIELD_BIN || 'higgsfield'; // abs path to hf.exe, or name on PATH
const DEFAULT_MODEL = process.env.HIGGSFIELD_MODEL || 'text2image_soul_v2';
// Extra args appended to `generate create`, space-split. Use for e.g.
// "--aspect-ratio 1:1" once you've confirmed the flag name via --help.
const EXTRA_CREATE_ARGS = (process.env.HIGGSFIELD_CREATE_ARGS || '').trim();
const STEP_TIMEOUT_MS = Number(process.env.HIGGSFIELD_TIMEOUT_MS || 180_000);

// On Windows a global npm bin is a `.cmd` shim that needs a shell to launch;
// an absolute path to hf.exe does not. Use a shell only for the bare PATH name.
const USE_SHELL = process.platform === 'win32' && !/[\\/]/.test(BIN);

/** Spawn the CLI, capture stdout/stderr, reject on non-zero exit / missing bin. */
function runCli(args, { onLog } = {}) {
  return new Promise((resolve, reject) => {
    onLog?.(`$ ${BIN} ${args.join(' ')}`);
    // args always passed as an array (never interpolated into a shell string),
    // so a user-controlled prompt can't break out into shell commands.
    const child = spawn(BIN, args, { shell: USE_SHELL, windowsHide: true });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Higgsfield CLI timed out after ${STEP_TIMEOUT_MS}ms (${args[1] ?? args[0]})`));
    }, STEP_TIMEOUT_MS);

    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (err) => {
      clearTimeout(timer);
      if (err.code === 'ENOENT') {
        reject(new Error(
          `Higgsfield CLI not found (tried "${BIN}"). Install it with ` +
          `\`npm i -g @higgsfield/cli\`, run \`higgsfield auth login\`, then restart the dev server. ` +
          `If it's installed but not on PATH, set HIGGSFIELD_BIN to the binary path in .env.local.`,
        ));
      } else {
        reject(err);
      }
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      const out = (stdout + stderr).trim();
      if (code === 0) return resolve(stdout.trim() || out);
      // On Windows, a missing command fails via the shell (exit 1, "not
      // recognized") rather than an ENOENT 'error' event — map both to the
      // same install hint.
      if (/not recognized|not found|No such file|cannot find/i.test(out)) {
        return reject(new Error(
          `Higgsfield CLI not found (tried "${BIN}"). Install it with ` +
          `\`npm i -g @higgsfield/cli\`, run \`higgsfield auth login\`, then restart the dev server. ` +
          `If it's installed but not on PATH, set HIGGSFIELD_BIN to the binary path in .env.local.`,
        ));
      }
      // Surface auth failures with a clear hint.
      if (/auth|login|unauthor|token/i.test(out)) {
        return reject(new Error(`Higgsfield not authenticated — run \`higgsfield auth login\`.\n${out}`));
      }
      reject(new Error(`Higgsfield CLI exited ${code}: ${out || '(no output)'}`));
    });
  });
}

/** Pull the job id out of `generate create` output (JSON field or id-like token). */
function parseJobId(text) {
  // Try JSON first (CLIs often print a JSON record).
  try {
    const obj = JSON.parse(text);
    const id = obj?.id ?? obj?.jobId ?? obj?.generation_id ?? obj?.job?.id;
    if (id) return String(id);
  } catch { /* not JSON — fall through to regex */ }
  // UUID, then any "id: xxxx" pairing, then a long alphanumeric token.
  const uuid = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuid) return uuid[0];
  const labelled = text.match(/\b(?:id|job[_-]?id|generation[_-]?id)\b["'\s:=]+([A-Za-z0-9_-]{6,})/i);
  if (labelled) return labelled[1];
  const token = text.match(/\b[A-Za-z0-9_-]{16,}\b/);
  if (token) return token[0];
  return null;
}

/** Pull the first result image URL out of `generate get` output. */
function parseImageUrl(text) {
  try {
    const obj = JSON.parse(text);
    const url =
      obj?.url ?? obj?.image_url ?? obj?.output?.url ??
      obj?.result?.url ?? obj?.results?.[0]?.url ?? obj?.outputs?.[0]?.url ??
      obj?.images?.[0]?.url ?? obj?.images?.[0];
    if (typeof url === 'string' && url.startsWith('http')) return url;
  } catch { /* not JSON — fall through */ }
  // Prefer an image-extensioned URL; else the first https URL.
  const img = text.match(/https?:\/\/[^\s"'<>]+\.(?:png|jpe?g|webp|avif)/i);
  if (img) return img[0];
  const any = text.match(/https?:\/\/[^\s"'<>]+/);
  return any ? any[0] : null;
}

function extOf(url) {
  const m = url.split('?')[0].match(/\.(png|jpe?g|webp|avif)$/i);
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'png';
}

/**
 * Generate an image from a prompt and save it into `outDir`.
 * @returns {Promise<{ path: string, file: string, jobId: string, model: string, url: string }>}
 *   `path` is the public web path (e.g. /uploads/higgsfield-….png).
 */
export async function generateImage({
  prompt,
  model = DEFAULT_MODEL,
  outDir,
  publicPrefix = '/uploads',
  filenameStamp, // caller passes a stamp (Date.now is unavailable in some runtimes)
  onLog,
}) {
  if (!prompt || !prompt.trim()) throw new Error('prompt is required');
  if (!outDir) throw new Error('outDir is required');

  // Harden against argv flag smuggling: `model` is request-derived and is
  // spliced into argv as a positional before `--prompt`, so a value like
  // "--foo" could be read by the CLI as a flag. Constrain it to a safe model
  // identifier shape (must start alphanumeric — no leading "-"). `prompt` is
  // passed as the value of `--prompt`, so the CLI treats it as data, not a flag.
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(model)) {
    throw new Error(`invalid model identifier: ${JSON.stringify(model)}`);
  }

  // 1) create the generation job
  const createArgs = ['generate', 'create', model, '--prompt', prompt.trim()];
  if (EXTRA_CREATE_ARGS) createArgs.push(...EXTRA_CREATE_ARGS.split(/\s+/));
  const createOut = await runCli(createArgs, { onLog });
  const jobId = parseJobId(createOut);
  if (!jobId) {
    throw new Error(`Could not parse a job id from \`generate create\` output:\n${createOut}`);
  }
  onLog?.(`job: ${jobId}`);

  // 2) wait for completion (best-effort — if `create` already blocks, this is a no-op)
  try {
    await runCli(['generate', 'wait', jobId], { onLog });
  } catch (e) {
    onLog?.(`wait skipped: ${e instanceof Error ? e.message : e}`);
  }

  // 3) fetch the finished job and extract the result URL
  const getOut = await runCli(['generate', 'get', jobId], { onLog });
  const url = parseImageUrl(getOut);
  if (!url) throw new Error(`No image URL in \`generate get\` output:\n${getOut}`);
  onLog?.(`image: ${url}`);

  // 4) download the image into outDir (so the editor + Playwright capture can load it by path)
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Downloading generated image failed (${res.status})`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const file = `higgsfield-${filenameStamp ?? jobId}.${extOf(url)}`;
  await writeFile(join(outDir, file), bytes);

  return { path: `${publicPrefix}/${file}`, file, jobId, model, url };
}

export const HIGGSFIELD_DEFAULT_MODEL = DEFAULT_MODEL;
