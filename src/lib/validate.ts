import fs from 'fs';
import path from 'path';

// Must start with an alphanumeric — prevents a slug like "-flag" being parsed as a CLI flag
const SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

export function isValidTopicArg(s: string): boolean {
  // Leading `-` would be parsed as a flag by the subprocess CLI (shell: false, so no shell injection risk)
  return s.length > 0 && s.length <= 200 && !s.startsWith('-');
}

/** Freeform context strings (purpose, direction, audience, etc.).
 *  shell: false means no shell parsing — only guard against flag smuggling and length. */
export function isValidContextArg(s: string): boolean {
  return s.length <= 2000 && !s.startsWith('-');
}

/** Resolve path and assert it stays inside rootDir (prevents path traversal). */
export function assertInsideDir(resolvedPath: string, rootDir: string): void {
  const realRoot = fs.realpathSync(rootDir);
  let realTarget: string;
  try {
    realTarget = fs.realpathSync(resolvedPath);
  } catch {
    // Path doesn't exist yet — resolve the nearest existing parent and check that
    const parent = fs.realpathSync(path.dirname(resolvedPath));
    if (!parent.startsWith(realRoot + path.sep) && parent !== realRoot) {
      throw new Error('Path traversal detected');
    }
    return;
  }
  if (!realTarget.startsWith(realRoot + path.sep) && realTarget !== realRoot) {
    throw new Error('Path traversal detected');
  }
}
