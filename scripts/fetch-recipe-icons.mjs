/**
 * Downloads icons for recipe-database items that have no file under public/icons/items yet
 * (items that are not on the market are skipped by fetch-market-icons.mjs).
 * Source: the icon path recorded in src/data/items.json -> bdocodex image host, bdolytics as fallback.
 *
 *   node scripts/fetch-recipe-icons.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ICON_DIR = path.join("public", "icons", "items");
const UA = "Mozilla/5.0 (BDO LifeSkill Studio icon fetch)";
const DELAY_MS = 400;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchBuf(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function isImage(buf) {
  const isWebp = buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP";
  const isPng = buf[0] === 0x89 && buf.subarray(1, 4).toString() === "PNG";
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
  return isWebp || isPng || isJpg;
}

async function main() {
  fs.mkdirSync(ICON_DIR, { recursive: true });
  const items = JSON.parse(fs.readFileSync(path.join("src", "data", "items.json"), "utf8"));
  const todo = Object.values(items).filter((it) => it.icon && !fs.existsSync(path.join(ICON_DIR, `${it.id}.webp`)));
  console.log(`recipe items ${Object.keys(items).length}, icons to download ${todo.length}`);
  let done = 0;
  for (const it of todo) {
    const rel = it.icon.replace(/^\/assets\/ui_texture\/icon\//, "");
    const candidates = [`https://bdocodex.com/items/${rel}`, `https://bdolytics.com${it.icon}`];
    let ok = false;
    for (const url of candidates) {
      try {
        await sleep(DELAY_MS);
        const buf = await fetchBuf(url);
        // bdocodex answers missing images with an HTML page and status 200: only accept real image bytes
        if (buf.length < 100 || !isImage(buf)) throw new Error("not an image");
        fs.writeFileSync(path.join(ICON_DIR, `${it.id}.webp`), buf);
        ok = true;
        break;
      } catch (e) {
        console.log(`  ${it.id} ${it.th}: ${url} -> ${e.message}`);
      }
    }
    if (ok) done += 1;
    else console.log(`  FAILED ${it.id} ${it.th}`);
  }
  console.log(`Done: downloaded ${done} of ${todo.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
