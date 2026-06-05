import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { brainPath } from '@/lib/paths';
import { isValidSlug, assertInsideDir } from '@/lib/validate';

const execFileAsync = promisify(execFile);

interface StudioJson {
  [slug: string]: {
    notebookId?: string;
    dossierPath?: string;
    deliverables?: string[];
  };
}

interface NotebookMeta {
  id: string;
  title: string;
  sourceCount: number;
  url: string;
}

// Must start with alphanumeric — prevents a leading `-` being parsed as a CLI flag
const NOTEBOOK_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;

async function fetchNotebookMeta(notebookId: string): Promise<NotebookMeta | null> {
  if (!NOTEBOOK_ID_RE.test(notebookId)) return null;
  try {
    const { stdout } = await execFileAsync('notebooklm-py', ['info', notebookId], { timeout: 10000 });
    const lines = stdout.split('\n');
    let title = notebookId;
    let sourceCount = 0;
    for (const line of lines) {
      const titleMatch = line.match(/title[:\s]+(.+)/i);
      if (titleMatch) title = titleMatch[1].trim();
      const srcMatch = line.match(/sources?[:\s]+(\d+)/i);
      if (srcMatch) sourceCount = parseInt(srcMatch[1], 10);
    }
    return { id: notebookId, title, sourceCount, url: `https://notebooklm.google.com/notebook/${notebookId}` };
  } catch {
    return null;
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }

  try {
    const researchRoot = brainPath('research');
    const folderPath = path.join(researchRoot, slug);
    assertInsideDir(folderPath, researchRoot);

    if (!fs.existsSync(folderPath)) {
      return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
    }

    const files = fs.readdirSync(folderPath);
    const dossierFile = files.find((f) => f.endsWith('.md'));
    if (!dossierFile) {
      return NextResponse.json({ error: 'Dossier not found' }, { status: 404 });
    }

    const dossierPath = path.join(folderPath, dossierFile);
    assertInsideDir(dossierPath, researchRoot);
    const dossier = fs.readFileSync(dossierPath, 'utf-8');

    let notebook: NotebookMeta | null = null;
    let nlmWarning: string | undefined;

    const studioJsonPath = brainPath('research', '_studio.json');
    if (fs.existsSync(studioJsonPath)) {
      try {
        const studioJson: StudioJson = JSON.parse(fs.readFileSync(studioJsonPath, 'utf-8'));
        const entry = studioJson[slug];
        if (entry?.notebookId) {
          const meta = await fetchNotebookMeta(entry.notebookId);
          if (meta) notebook = meta;
          else nlmWarning = 'NLM unavailable — could not fetch notebook metadata';
        }
      } catch {
        nlmWarning = 'NLM unavailable — error reading studio index';
      }
    }

    return NextResponse.json({ slug, dossier, notebook, nlmWarning });
  } catch (err) {
    console.error('[api/studios/[slug]]', err);
    return NextResponse.json({ error: 'Failed to read studio' }, { status: 500 });
  }
}
