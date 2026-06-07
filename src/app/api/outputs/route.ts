import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { brainPath } from '@/lib/paths';

export interface OutputEntry {
  slug: string;
  date: string;
  title: string;
  hasThumbnail: boolean;
}

function extractTitle(articlePath: string): string {
  try {
    const content = fs.readFileSync(articlePath, 'utf-8');
    for (const line of content.split('\n')) {
      const match = line.match(/^#\s+(.+)/);
      if (match) return match[1].trim();
    }
  } catch {
    // ignore
  }
  return '';
}

export async function GET() {
  try {
    const outputDir = brainPath('research', 'deliverables');
    if (!fs.existsSync(outputDir)) {
      return NextResponse.json([]);
    }

    const entries: OutputEntry[] = [];
    const items = fs.readdirSync(outputDir, { withFileTypes: true });

    for (const item of items) {
      if (!item.isDirectory()) continue;
      const slug = item.name;
      const folderPath = path.join(outputDir, slug);
      const files = fs.readdirSync(folderPath);
      const articleFile = files.find((f) => f.endsWith('.md'));
      if (!articleFile) continue;
      const articlePath = path.join(folderPath, articleFile);

      const dateMatch = slug.match(/^(\d{4}-\d{2}-\d{2})/);
      const date = dateMatch ? dateMatch[1] : fs.statSync(folderPath).mtime.toISOString().slice(0, 10);

      entries.push({
        slug,
        date,
        title: extractTitle(articlePath),
        hasThumbnail:
          fs.existsSync(path.join(folderPath, 'thumbnail.png')) ||
          fs.existsSync(path.join(folderPath, 'thumbnail.jpg')),
      });
    }

    entries.sort((a, b) => b.date.localeCompare(a.date));
    return NextResponse.json(entries);
  } catch (err) {
    console.error('[api/outputs]', err);
    return NextResponse.json({ error: 'Failed to read outputs' }, { status: 500 });
  }
}
