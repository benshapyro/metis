import fs from 'node:fs/promises';
import path from 'node:path';
import { wikiRoot } from '@/lib/metis/wiki';

export interface HotCaches {
  index: string;
  practice: string;
  research: string;
  clients: string;
  personal: string;
  total_chars: number;
}

let cached: HotCaches | null = null;

export async function loadHotCaches(): Promise<HotCaches> {
  if (cached) return cached;
  const metaDir = path.join(wikiRoot(), '_meta');
  const read = (name: string) =>
    fs.readFile(path.join(metaDir, name), 'utf8').catch(() => '');
  const [index, practice, research, clients, personal] = await Promise.all([
    read('index.md'),
    read('hot-practice.md'),
    read('hot-research.md'),
    read('hot-clients.md'),
    read('hot-personal.md'),
  ]);
  const total_chars =
    index.length + practice.length + research.length + clients.length + personal.length;
  cached = { index, practice, research, clients, personal, total_chars };
  return cached;
}

export async function forceReloadHotCaches(): Promise<HotCaches> {
  cached = null;
  return loadHotCaches();
}
