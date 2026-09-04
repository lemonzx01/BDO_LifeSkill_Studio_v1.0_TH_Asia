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
const DEFAULT_TYPES =
  "alchemy,cooking,heating,grinding,drying,shaking,filtering,chopping,simple-alchemy,simple-cooking,imperial-cooking,imperial-alchemy";
const TYPES = argVal("--types", DEFAULT_TYPES).split(",");
const DOWNLOAD_ICONS = !args.includes("--no-icons");
const DELAY_MS = Number(argVal("--delay", "150"));

const UA = "Mozilla/5.0 (compatible; bdo-lifeskill-studio importer; personal guild tool)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(CACHE_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });
if (DOWNLOAD_ICONS) fs.mkdirSync(ICON_DIR, { recursive: true });

function cachePath(url, binary = false) {
  const key = crypto.createHash("sha1").update(url).digest("hex");
  return path.join(CACHE_DIR, key + (binary ? ".bin" : ".txt"));
}

/** Cached response text, or null when the URL was never fetched (no network). */
function readCache(url) {
  const file = cachePath(url);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}

async function fetchCached(url, { binary = false } = {}) {
  const file = cachePath(url, binary);
  if (fs.existsSync(file)) return binary ? fs.readFileSync(file) : fs.readFileSync(file, "utf8");
  await sleep(DELAY_MS);
  let res;
  for (let attempt = 1; ; attempt++) {
    res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) break;
    // back off politely on rate limits / transient server errors
    if ((res.status === 429 || res.status >= 500) && attempt < 6) {
      const wait = Math.min(30000, 2000 * 2 ** (attempt - 1));
      console.warn(`  ! HTTP ${res.status}, retry ${attempt} in ${wait / 1000}s: ${url.slice(0, 80)}`);
      await sleep(wait);
      continue;
    }
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
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

// our type name -> bdocodex list (a=recipes for alchemy/cooking, a=mrecipes for processing);
// an unknown bdocodex type silently returns ALL recipes, so every entry is verified by its label
const CODEX_TYPE = {
  alchemy: { a: "recipes", type: "alchemy", label: "แปรธาตุ" },
  cooking: { a: "recipes", type: "culinary", label: "ทำอาหาร" },
  heating: { a: "mrecipes", type: "heating", label: "หลอม" },
  grinding: { a: "mrecipes", type: "grind", label: "บด" },
  drying: { a: "mrecipes", type: "dry", label: "ตากแห้ง" },
  shaking: { a: "mrecipes", type: "shake", label: "เขย่า" },
  filtering: { a: "mrecipes", type: "thinning", label: "กรอง" },
  chopping: { a: "mrecipes", type: "woodcutting", label: "ตัดฟืน" },
  "simple-alchemy": { a: "mrecipes", type: "malchemy", label: "แปรธาตุอย่างง่าย" },
  "simple-cooking": { a: "mrecipes", type: "mculinary", label: "ทำอาหารอย่างง่าย" },
  // imperial lists are written as "box -> N dishes" (unboxing); we invert them into packing recipes
  "imperial-cooking": { a: "mrecipes", type: "rcooking", label: "ห่ออาหารราชวัง", imperial: true },
  "imperial-alchemy": { a: "mrecipes", type: "ralchemy", label: "ห่อแร่แปรธาตุราชวัง", imperial: true },
};
// bdocodex recipe ids and mrecipe ids overlap; keep ours unique
const MRECIPE_ID_OFFSET = 100000;

/** Imperial packing recipes: 1 box <- N of the dish/elixir. Box payout is read from the item page later. */
function parseImperialList(type, rows) {
  const out = [];
  for (const row of rows) {
    const mats = parseSlots(row[6]);
    const prods = parseSlots(row[8]);
    if (mats.length !== 1 || prods.length !== 1) continue; // event / key variants
    // bdocodex lists both directions (box -> N dishes, and N dishes -> box); which side is the
    // box is decided later from the item names, so keep both sides for now
    const a = mats[0];
    const b = prods[0];
    if (!a.id || !b.id) continue;
    const id = Number(row[0]) + MRECIPE_ID_OFFSET;
    out.push({
      id,
      type,
      name: stripTags(row[2]),
      skill: { display: "", tier: 0, tierName: "", level: 0, sort: 0 },
      exp: 0,
      weight: 0,
      materials: [{ id: b.id, qty: b.min, icon: b.icon, isGroup: false, isFixed: true }],
      products: [{ id: a.id, min: 1, max: 1, icon: a.icon, kind: "main" }],
      allMaterialIds: [a.id, b.id],
      imperialPair: { a: { id: a.id, qty: a.min, icon: a.icon }, b: { id: b.id, qty: b.min, icon: b.icon } },
      imperialBox: a.id, // provisional
    });
  }
  return out;
}

async function fetchRecipeList(type) {
  const codex = CODEX_TYPE[type];
  if (!codex) throw new Error(`unknown recipe type ${type}`);
  const url = `https://bdocodex.com/query.php?a=${codex.a}&type=${codex.type}&id=1&l=th`;
  const json = JSON.parse(await fetchCached(url));
  if (codex.imperial) return parseImperialList(type, json.aaData.filter((row) => stripTags(String(row[3])) === codex.label));
  const out = [];
  for (const row of json.aaData) {
    const id = Number(row[0]) + (codex.a === "mrecipes" ? MRECIPE_ID_OFFSET : 0);
    const name = stripTags(row[2]);
    if (stripTags(String(row[3])) !== codex.label) continue; // list was broader than asked (defensive)
    const skill = row[4] && typeof row[4] === "object" ? row[4] : { display: String(row[4]), sort_value: 0 };
    const sort = Number(skill.sort_value) || 0;
    // bdocodex sort_value is not a clean tier*10+level (Guru shows as 70), so read the tier from the label
    const display = String(skill.display ?? "");
    const tierIdx = TIERS.findIndex((t) => display.startsWith(t));
    const tier = tierIdx >= 0 ? tierIdx : Math.min(6, Math.floor(sort / 10));
    const level = Number((display.match(/Lv\.\s*(\d+)/) || [])[1] ?? sort % 10) || 0;
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

function bdolyticsItemUrl(id, lang) {
  const input = encodeURIComponent(JSON.stringify({ id: String(id), language: lang }));
  return `https://bdolytics.com/api/trpc/database.getItem?input=${input}`;
}

/** bdolytics item details, but only if already cached (their API rate-limits at ~1 req/s). */
function cachedBdolyticsItem(id, lang) {
  const raw = readCache(bdolyticsItemUrl(id, lang));
  if (!raw) return null;
  try {
    return JSON.parse(raw).result?.data ?? null;
  } catch {
    return null;
  }
}

/** Name / grade / icon from the bdocodex tooltip (fast, no rate limit observed). lang: "th" | "us" */
async function fetchCodexTip(id, lang) {
  const url = `https://bdocodex.com/tip.php?id=item--${id}&l=${lang}&nf=on`;
  try {
    const html = await fetchCached(url);
    const name = decodeEntities((html.match(/id="item_name"><b>(?:<span[^>]*><\/span>)?\s*([^<]+)<\/b>/) || [])[1] || "").trim();
    const grade = Number((html.match(/item_title item_grade_(\d)/) || [])[1] || 0);
    const icon = (html.match(/<img src="([^"]+\.webp)" class="item_icon/) || [])[1] || null;
    return name ? { name, grade, icon } : null;
  } catch (e) {
    console.warn(`  ! tip ${id} ${lang} failed: ${e.message}`);
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
  const queue = [...missing];
  const resolveOne = async (id) => {
    const th = cachedBdolyticsItem(id, "th");
    if (th) {
      // resolved on an earlier run (bdolytics has NPC prices and weight)
      const en = cachedBdolyticsItem(id, "en");
      items[id] = {
        id,
        th: th.name ?? `#${id}`,
        en: en?.name ?? th.name ?? `#${id}`,
        cat: th.mainCategory ?? null,
        sub: th.subCategory ?? null,
        grade: th.grade ?? 0,
        icon: th.icon || iconById.get(id) || null,
        market: false,
        npcBuy: th.buyPrice ?? null,
        npcSell: th.sellPrice ?? null,
        weight: th.weight ?? null,
      };
    } else {
      const [tipTh, tipEn] = await Promise.all([fetchCodexTip(id, "th"), fetchCodexTip(id, "us")]);
      items[id] = {
        id,
        th: tipTh?.name ?? tipEn?.name ?? `#${id}`,
        en: tipEn?.name ?? tipTh?.name ?? `#${id}`,
        cat: null,
        sub: null,
        grade: tipTh?.grade ?? 0,
        icon: tipTh?.icon || iconById.get(id) || null,
        market: false,
        npcBuy: null,
        npcSell: null,
        weight: null,
      };
    }
    if (++n % 50 === 0) console.log(`  ${n}/${missing.length}`);
  };
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (queue.length) await resolveOne(queue.shift());
    }),
  );

  // Imperial boxes: decide which side is the box from the item name, then read the payout
  const isBoxName = (id) => /^(กล่อง|ห่อ)/.test(items[id]?.th ?? "");
  for (const r of recipes) {
    if (!r.imperialPair) continue;
    const { a, b } = r.imperialPair;
    const boxSide = isBoxName(a.id) && !isBoxName(b.id) ? a : isBoxName(b.id) && !isBoxName(a.id) ? b : null;
    if (!boxSide) {
      r.imperialBox = null; // ambiguous (event boxes etc.) -> dropped below
      continue;
    }
    const content = boxSide === a ? b : a;
    r.materials = [{ id: content.id, qty: Math.max(1, content.qty), icon: content.icon, isGroup: false, isFixed: true }];
    r.products = [{ id: boxSide.id, min: 1, max: 1, icon: boxSide.icon, kind: "main" }];
    r.imperialBox = boxSide.id;
  }
  const boxes = [...new Set(recipes.filter((r) => r.imperialBox).map((r) => r.imperialBox))];
  if (boxes.length) {
    console.log(`Reading ${boxes.length} imperial box prices...`);
    const q = [...boxes];
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (q.length) {
          const id = q.shift();
          try {
            const page = stripTags(await fetchCached(`https://bdocodex.com/th/item/${id}/`));
            const m = page.match(/ราคาซื้อ\s*:?\s*([\d,]+)/);
            const price = m ? Number(m[1].replace(/,/g, "")) : 0;
            if (items[id]) {
              items[id].imperialPrice = price || null;
              items[id].npcBuy = null; // never "buy" a box from an NPC
            }
          } catch (e) {
            console.warn(`  ! box ${id}: ${e.message}`);
          }
        }
      }),
    );
    for (const r of recipes) {
      if (!r.imperialBox) continue;
      const box = items[r.imperialBox];
      if (box) {
        r.name = box.th;
        const tierIdx = TIERS.findIndex((t) => box.th.endsWith(t));
        if (tierIdx >= 0) r.skill = { display: TIERS[tierIdx], tier: tierIdx, tierName: TIERS[tierIdx], level: 1, sort: tierIdx * 10 + 1 };
      }
    }
    const priced = recipes.filter((r) => r.imperialBox && items[r.imperialBox]?.imperialPrice).length;
    console.log(`  imperial boxes with a payout: ${priced}/${recipes.filter((r) => r.imperialBox).length}`);
  }

  // Processing lists include melting/grinding gear (every weapon and armor piece);
  // those are never a life-skill money maker and would bloat the data, so drop them.
  const GEAR = new Set(["mainhand", "offhand", "awakening", "armor", "accessories"]);
  const isGear = (id) => GEAR.has(items[id]?.cat);
  const before = recipes.length;
  const kept = recipes.filter(
    (r) =>
      r.materials.length > 0 && // some codex rows have no parsable ingredients (would look free)
      r.products.length > 0 &&
      (r.type === "alchemy" || r.type === "cooking" || !r.materials.some((m) => isGear(m.id))) &&
      (!r.imperialPair || (r.imperialBox && items[r.imperialBox]?.imperialPrice)), // drop event/ambiguous boxes without a payout
  );
  console.log(`Dropped ${before - kept.length} gear-processing / incomplete recipes`);

  // bdocodex sometimes lists the same recipe twice (identical materials and products); keep one
  const seen = new Set();
  const unique = kept.filter((r) => {
    const key = JSON.stringify([
      r.type,
      r.products.map((p) => [p.id, p.min, p.max]),
      r.materials.map((m) => [m.id, m.qty, m.isGroup ? (groups[m.id] || []).map((g) => [g.id, g.value]) : null]),
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(`Dropped ${kept.length - unique.length} duplicate recipes`);
  recipes.length = 0;
  recipes.push(...unique);

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
