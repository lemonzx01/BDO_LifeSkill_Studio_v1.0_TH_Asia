/**
 * Import recipes + items from bdocodex (recipes, substitute groups) and
 * bdolytics (item names th/en, categories, NPC prices) into src/data/*.json.
 *
 * Usage:
 *   node scripts/import-bdocodex.mjs                 # alchemy + cooking
 *   node scripts/import-bdocodex.mjs --types alchemy
 *   node scripts/import-bdocodex.mjs --no-icons      # skip icon download
 *
 * Responses are cached under scripts/.cache so re-runs are cheap and we do not
 * hammer the source sites. Delete the cache to force a refresh.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(__dirname, ".cache");
const DATA_DIR = path.join(ROOT, "src", "data");
const ICON_DIR = path.join(ROOT, "public", "icons", "items");

const args = process.argv.slice(2);
const argVal = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const TYPES = argVal("--types", "alchemy,cooking").split(",");
const DOWNLOAD_ICONS = !args.includes("--no-icons");
const DELAY_MS = Number(argVal("--delay", "150"));

const UA = "Mozilla/5.0 (compatible; bdo-lifeskill-studio importer; personal guild tool)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(CACHE_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });
if (DOWNLOAD_ICONS) fs.mkdirSync(ICON_DIR, { recursive: true });

async function fetchCached(url, { binary = false } = {}) {
  const key = crypto.createHash("sha1").update(url).digest("hex");
  const file = path.join(CACHE_DIR, key + (binary ? ".bin" : ".txt"));
  if (fs.existsSync(file)) return binary ? fs.readFileSync(file) : fs.readFileSync(file, "utf8");
  await sleep(DELAY_MS);
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  if (binary) {
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(file, buf);
    return buf;
  }
  let text = await res.text();
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  fs.writeFileSync(file, text, "utf8");
  return text;
}

const decodeEntities = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
const stripTags = (s) => decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

// ---------- bdocodex recipe list ----------

const TIERS = ["มือใหม่", "ฝึกฝน", "คล่องแคล่ว", "เชี่ยวชาญ", "ช่าง", "ลือชื่อ", "เซียน"];

function parseSlots(html) {
  // Each material/product is an <div class="iconset_wrapper_medium inlinediv">...</div>
  const chunks = html.split('<div class="iconset_wrapper_medium').slice(1);
  return chunks.map((c) => {
    const id = Number((c.match(/\/item\/(\d+)\//) || [])[1]);
    const qtyText = (c.match(/quantity_small nowrap">([^<]+)</) || [])[1] || "1";
    const icon = (c.match(/src="([^"]+\.webp)"/) || [])[1] || null;
    const isGroup = /icon-repeat\.webp/.test(c);
    const isFixed = /icon_lock\.webp/.test(c);
    let min = 1;
    let max = 1;
    const m = qtyText.match(/^(\d+)(?:~(\d+))?$/);
    if (m) {
      min = Number(m[1]);
      max = m[2] ? Number(m[2]) : min;
    }
    return { id, min, max, icon, isGroup, isFixed };
  });
}

// our type name -> bdocodex list type; an unknown bdocodex type silently returns ALL recipes
const CODEX_TYPE = { alchemy: "alchemy", cooking: "culinary" };
const TYPE_BY_LABEL = { แปรธาตุ: "alchemy", ทำอาหาร: "cooking" };

async function fetchRecipeList(type) {
  const codexType = CODEX_TYPE[type];
  if (!codexType) throw new Error(`unknown recipe type ${type}`);
  const url = `https://bdocodex.com/query.php?a=recipes&type=${codexType}&id=1&l=th`;
  const json = JSON.parse(await fetchCached(url));
  const out = [];
  for (const row of json.aaData) {
    const id = Number(row[0]);
    const name = stripTags(row[2]);
    const rowType = TYPE_BY_LABEL[stripTags(String(row[3]))];
    if (rowType && rowType !== type) continue; // list was broader than asked (defensive)
    const skill = row[4] && typeof row[4] === "object" ? row[4] : { display: String(row[4]), sort_value: 0 };
    const sort = Number(skill.sort_value) || 0;
    const tier = Math.floor(sort / 10);
    const level = sort % 10;
    const exp = Number(String(row[5]).replace(/[^\d]/g, "")) || 0;
    const materials = parseSlots(row[6]).map((s) => ({
      id: s.id,
      qty: s.min,
      icon: s.icon,
      isGroup: s.isGroup,
      isFixed: s.isFixed,
    }));
    const products = parseSlots(row[8]).map((s, i) => ({
      id: s.id,
      min: s.min,
      max: s.max,
      icon: s.icon,
      kind: i === 0 ? "main" : "extra",
    }));
    const allMaterialIds = (() => {
      try {
        return JSON.parse(row[9]);
      } catch {
        return [];
      }
    })();
    out.push({
      id,
      type,
      name,
      skill: { display: skill.display, tier, tierName: TIERS[tier] ?? "", level, sort },
      exp,
      materials,
      products,
      weight: Number(row[7]) || 0,
      allMaterialIds,
    });
  }
  return out;
}

// ---------- bdocodex substitute groups (tip.php tiptype=recipe) ----------

async function fetchGroup(itemId) {
  const url = `https://bdocodex.com/tip.php?id=item--${itemId}&tiptype=recipe&l=th&nf=on`;
  const html = await fetchCached(url);
  // Table rows: "<a href=/th/item/ID/>NAME</a> ... <td>VALUE</td>"
  const members = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = rowRe.exec(html))) {
    const row = m[1];
    const idm = row.match(/\/item\/(\d+)\//);
    if (!idm) continue;
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => stripTags(c[1]));
    const value = Number((cells[cells.length - 1] || "").replace(/[^\d.]/g, ""));
    if (!Number.isFinite(value) || value <= 0) continue;
    const id = Number(idm[1]);
    if (!members.some((x) => x.id === id)) members.push({ id, value });
  }
  if (!members.some((x) => x.id === itemId)) members.unshift({ id: itemId, value: 1 });
  return members;
}

// ---------- item names / categories ----------

async function fetchBdolyticsMarket(lang) {
  const input = encodeURIComponent(JSON.stringify({ language: lang, region: "ASIA" }));
  const url = `https://bdolytics.com/api/trpc/market.getMarket?input=${input}`;
  const json = JSON.parse(await fetchCached(url));
  const map = new Map();
  for (const r of json.result.data) map.set(Number(r.itemId), r);
  return map;
}

async function fetchBdolyticsItem(id, lang) {
  const input = encodeURIComponent(JSON.stringify({ id: String(id), language: lang }));
  const url = `https://bdolytics.com/api/trpc/database.getItem?input=${input}`;
  try {
    const json = JSON.parse(await fetchCached(url));
    return json.result?.data ?? null;
  } catch (e) {
    console.warn(`  ! getItem ${id} ${lang} failed: ${e.message}`);
    return null;
  }
}

async function main() {
  console.log(`Importing recipe types: ${TYPES.join(", ")}`);
  const recipes = [];
  for (const t of TYPES) {
    const list = await fetchRecipeList(t);
    console.log(`  ${t}: ${list.length} recipes`);
    recipes.push(...list);
  }

  // Substitute groups
  const groupKeys = new Set();
  for (const r of recipes) for (const m of r.materials) if (m.isGroup) groupKeys.add(m.id);
  console.log(`Fetching ${groupKeys.size} substitute groups...`);
  const groups = {};
  let n = 0;
  for (const id of groupKeys) {
    groups[id] = await fetchGroup(id);
    if (++n % 25 === 0) console.log(`  ${n}/${groupKeys.size}`);
  }

  // Item universe
  const itemIds = new Set();
  const iconById = new Map();
  for (const r of recipes) {
    for (const m of r.materials) {
      itemIds.add(m.id);
      if (m.icon) iconById.set(m.id, m.icon);
      if (m.isGroup) for (const g of groups[m.id] || []) itemIds.add(g.id);
    }
    for (const p of r.products) {
      itemIds.add(p.id);
      if (p.icon) iconById.set(p.id, p.icon);
    }
  }
  itemIds.delete(0);
  itemIds.delete(NaN);
  console.log(`Item universe: ${itemIds.size} items`);

  console.log("Fetching bdolytics market snapshot (th/en)...");
  const marketTh = await fetchBdolyticsMarket("th");
  const marketEn = await fetchBdolyticsMarket("en");

  const items = {};
  const missing = [];
  for (const id of itemIds) {
    const th = marketTh.get(id);
    const en = marketEn.get(id);
    if (th) {
      items[id] = {
        id,
        th: th.name,
        en: en?.name ?? th.name,
        cat: th.mainCategory,
        sub: th.subCategory,
        grade: th.grade ?? 0,
        icon: th.icon || iconById.get(id) || null,
        market: true,
      };
    } else missing.push(id);
  }
  console.log(`Non-market items to resolve via bdolytics getItem: ${missing.length}`);
  n = 0;
  for (const id of missing) {
    const th = await fetchBdolyticsItem(id, "th");
    const en = await fetchBdolyticsItem(id, "en");
    items[id] = {
      id,
      th: th?.name ?? `#${id}`,
      en: en?.name ?? th?.name ?? `#${id}`,
      cat: th?.mainCategory ?? null,
      sub: th?.subCategory ?? null,
      grade: th?.grade ?? 0,
      icon: th?.icon || iconById.get(id) || null,
      market: false,
      npcBuy: th?.buyPrice ?? null,
      npcSell: th?.sellPrice ?? null,
      weight: th?.weight ?? null,
    };
    if (++n % 25 === 0) console.log(`  ${n}/${missing.length}`);
  }

  // Write data first so the app can start while icons are still downloading
  writeData(recipes, groups, items);

  // Icons (download once, served from /icons/items/<id>.webp)
  if (DOWNLOAD_ICONS) {
    console.log("Downloading icons...");
    n = 0;
    for (const id of itemIds) {
      const dest = path.join(ICON_DIR, `${id}.webp`);
      if (fs.existsSync(dest)) continue;
      const it = items[id];
      const src = iconById.get(id) || null;
      let url = null;
      if (src) url = `https://bdocodex.com${src}`;
      else if (it?.icon) url = `https://bdolytics.com${it.icon}`;
      if (!url) continue;
      try {
        const buf = await fetchCached(url, { binary: true });
        fs.writeFileSync(dest, buf);
      } catch (e) {
        console.warn(`  ! icon ${id}: ${e.message}`);
      }
      if (++n % 100 === 0) console.log(`  ${n} icons`);
    }
  }

  console.log(`Done: ${recipes.length} recipes, ${Object.keys(items).length} items -> src/data/`);
}

function writeData(recipes, groups, items) {
  // Final recipe shape (drop importer-only fields)
  const outRecipes = recipes.map((r) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    skill: r.skill,
    exp: r.exp,
    weight: r.weight,
    materials: r.materials.map((m) => ({
      id: m.id,
      qty: m.qty,
      fixed: m.isFixed,
      group: m.isGroup ? groups[m.id] : undefined,
    })),
    products: r.products.map((p) => ({ id: p.id, min: p.min, max: p.max, kind: p.kind })),
  }));

  fs.writeFileSync(path.join(DATA_DIR, "recipes.json"), JSON.stringify(outRecipes, null, 0), "utf8");
  fs.writeFileSync(path.join(DATA_DIR, "items.json"), JSON.stringify(items, null, 0), "utf8");
  fs.writeFileSync(
    path.join(DATA_DIR, "meta.json"),
    JSON.stringify(
      {
        importedAt: new Date().toISOString(),
        types: [...new Set(recipes.map((r) => r.type))],
        recipeCount: outRecipes.length,
        itemCount: Object.keys(items).length,
        sources: {
          recipes: "bdocodex.com (query.php recipes, tip.php substitute groups)",
          items: "bdolytics.com (market snapshot ASIA th/en, database.getItem)",
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`Wrote src/data: ${outRecipes.length} recipes, ${Object.keys(items).length} items`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
