import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { brainPath } from '@/lib/paths';

export interface StudioEntry {
  slug: string;
  date: string;
  summary: string;
}

function extractDate(slug: string, mtime: Date): string {
  const match = slug.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : mtime.toISOString().slice(0, 10);
}

function extractSummary(dossierPath: string): string {
  try {
    const content = fs.readFileSync(dossierPath, 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.replace(/^#+\s*/, '').trim();
      if (trimmed) return trimmed.slice(0, 120);
    }
  } catch {
    // ignore
  }
  return '';
}

export async function GET() {
  try {
    const researchDir = brainPath('research');
    if (!fs.existsSync(researchDir)) {
      return NextResponse.json([]);
    }

    const entries: StudioEntry[] = [];
    const items = fs.readdirSync(researchDir, { withFileTypes: true });

    for (const item of items) {
      if (!item.isDirectory()) continue;
      const slug = item.name;
      const folderPath = path.join(researchDir, slug);
      const files = fs.readdirSync(folderPath);
      const dossierFile = files.find((f) => f.endsWith('.md'));
      if (!dossierFile) continue;

      const dossierPath = path.join(folderPath, dossierFile);
      const stat = fs.statSync(folderPath);

      entries.push({
        slug,
        date: extractDate(slug, stat.mtime),
        summary: extractSummary(dossierPath),
      });
    }

    entries.sort((a, b) => b.date.localeCompare(a.date));
    return NextResponse.json(entries);
  } catch (err) {
    console.error('[api/studios]', err);
    return NextResponse.json({ error: 'Failed to read studios' }, { status: 500 });
  }
}
