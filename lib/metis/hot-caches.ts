// lib/metis/hot-caches.ts
import fs from "node:fs/promises";
import path from "node:path";
import { wikiRoot } from "@/lib/metis/wiki";

export interface HotCaches {
  readonly index: string;
  readonly practice: string;
  readonly research: string;
  readonly clients: string;
  readonly personal: string;
  readonly totalChars: number;
}

// In-flight promise dedupe: prevents duplicate cold-start I/O when multiple
// requests race the first call. On failure, the promise is cleared so the
// next request retries — never memoize a broken cache.
let inflight: Promise<HotCaches> | null = null;

const HOT_FILES = [
  "index.md",
  "hot-practice.md",
  "hot-research.md",
  "hot-clients.md",
  "hot-personal.md",
] as const;

async function readOne(metaDir: string, name: string): Promise<string> {
  const filePath = path.join(metaDir, name);
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      console.warn(
        `[hot-caches] ${name} not found at ${filePath} (continuing with empty)`
      );
      return "";
    }
    console.error(`[hot-caches] failed to read ${name}: ${code ?? err}`);
    throw err;
  }
}

async function doLoad(): Promise<HotCaches> {
  const metaDir = path.join(wikiRoot(), "_meta");
  const [index, practice, research, clients, personal] = await Promise.all(
    HOT_FILES.map((n) => readOne(metaDir, n))
  );
  if (!index || index.length === 0) {
    throw new Error(
      `[hot-caches] index.md is empty or missing at ${path.join(metaDir, "index.md")}; refusing to memoize broken cache`
    );
  }
  const totalChars =
    index.length +
    practice.length +
    research.length +
    clients.length +
    personal.length;
  return Object.freeze({
    index,
    practice,
    research,
    clients,
    personal,
    totalChars,
  });
}

export function loadHotCaches(): Promise<HotCaches> {
  if (!inflight) {
    inflight = doLoad().catch((err) => {
      inflight = null; // never pin broken state
      throw err;
    });
  }
  return inflight;
}

/**
 * Force a re-read of the hot caches.
 * Use after a wiki write that should be visible immediately
 * (e.g., admin-triggered refresh; routine refresh happens on cold-start).
 */
export function forceReloadHotCaches(): Promise<HotCaches> {
  inflight = null;
  return loadHotCaches();
}
