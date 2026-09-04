/**
 * Downloads icons for EVERY central-market item (not just recipe items) into
 * public/icons/items/<id>.webp, so the market scanner shows pictures too.
 * Source: bdolytics market snapshot (icon paths) -> bdocodex image host.
 * Existing files are skipped; safe to re-run.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICON_DIR = path.resolve(__dirname, "..", "public", "icons", "items");
const CONCURRENCY = 4;
const DELAY_MS = 60;
const UA = "Mozilla/5.0 (compatible; bdo-lifeskill-studio importer; personal guild tool)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchBuf(url) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await sleep(2000 * attempt);
      continue;
    }
    throw new Error(`HTTP ${res.status}`);
  }
}

async function main() {
  fs.mkdirSync(ICON_DIR, { recursive: true });
  const input = encodeURIComponent(JSON.stringify({ language: "en", region: "ASIA" }));
  const res = await fetch(`https://bdolytics.com/api/trpc/market.getMarket?input=${input}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`snapshot HTTP ${res.status}`);
  const rows = (await res.json()).result.data;
  const todo = rows.filter((r) => r.icon && !fs.existsSync(path.join(ICON_DIR, `${r.itemId}.webp`)));
  console.log(`market items ${rows.length}, icons to download ${todo.length}`);
  let done = 0;
  let failed = 0;
  const queue = [...todo];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const r = queue.shift();
        const rel = r.icon.replace(/^\/assets\/ui_texture\/icon\//, "");
        const candidates = [`https://bdocodex.com/items/${rel}`, `https://bdolytics.com${r.icon}`];
        let ok = false;
        for (const url of candidates) {
          try {
            await sleep(DELAY_MS);
            const buf = await fetchBuf(url);
            if (buf.length < 100) throw new Error("empty");
            fs.writeFileSync(path.join(ICON_DIR, `${r.itemId}.webp`), buf);
            ok = true;
            break;
          } catch {
            /* try next host */
          }
        }
        if (ok) done += 1;
        else failed += 1;
        if ((done + failed) % 250 === 0) console.log(`  ${done + failed}/${todo.length} (failed ${failed})`);
      }
    }),
  );
  console.log(`Done: downloaded ${done}, failed ${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
