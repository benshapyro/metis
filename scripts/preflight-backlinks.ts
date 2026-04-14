// scripts/preflight-backlinks.ts
import fs from 'node:fs/promises';
import path from 'node:path';

const WIKI = process.env.WIKI_ROOT ?? path.resolve(process.env.HOME!, 'Projects/my-brain');

async function* walkMarkdown(dir: string): AsyncGenerator<string> {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || entry.name === '_meta' || entry.name === 'raw') continue;
      yield* walkMarkdown(full);
    } else if (entry.name.endsWith('.md')) {
      yield full;
    }
  }
}

async function main() {
  const wikiDir = path.join(WIKI, 'wiki');
  let total = 0;
  let missing = 0;
  const missingList: string[] = [];
  for await (const file of walkMarkdown(wikiDir)) {
    total++;
    const content = await fs.readFile(file, 'utf8');
    if (!/^## Referenced By\b/m.test(content)) {
      missing++;
      missingList.push(path.relative(wikiDir, file));
    }
  }
  const pct = total === 0 ? 0 : (missing / total) * 100;
  console.log(`Total pages: ${total}`);
  console.log(`Missing "## Referenced By": ${missing} (${pct.toFixed(1)}%)`);
  if (missing > 0 && missing <= 25) {
    console.log('\nMissing files:');
    for (const f of missingList) console.log(`  - ${f}`);
  }
  if (pct > 10) {
    console.error('\n❌ >10% missing. Run `backlink_repair.py` before proceeding.');
    process.exit(1);
  } else {
    console.log('\n✅ Coverage acceptable for v1.');
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
