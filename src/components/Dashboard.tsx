"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CostEngine } from "@/lib/engine/cost";
import { ideasFromInventory } from "@/lib/engine/ideas";
import { IMPERIAL_TYPES, PROCESSING_TYPES, RECIPE_TYPE_TH } from "@/lib/engine/mastery";
import type { Item, ItemId, MarketPrice, Recipe, RecipeEvaluation } from "@/lib/engine/types";
import { describeError, fetchJson, problemAction, type FetchProblem } from "@/lib/fetch-error";
import { signed, signedPct, silverShort } from "@/lib/format";
import { heroPicks, HOME_PICKS_TITLE, homeRank, isFeasible, isRecipeSort, RECIPE_SORT_KEY, topPicks, type HomeRank, type RecipeSort } from "@/lib/home-picks";
import { SETTINGS_TITLE, VALUE_PACK } from "@/lib/settings-labels";
import { usePersistentState } from "@/lib/use-persistent";
import type { SessionUser } from "./auth/UserMenu";
import { InventoryIdeas } from "./InventoryIdeas";
import { ItemIcon } from "./ItemIcon";
import { OnboardingCard } from "./OnboardingCard";
import { recipeTypeIcon } from "./recipe-type-icon";
import { FavoriteStar } from "./FavoriteStar";
import { SettingsDrawer } from "./SettingsDrawer";
import { TimeAgo } from "./TimeAgo";
import { useInventory, useSettings, useUserData } from "./UserDataProvider";
import { Badge } from "./ui/Badge";
import { btn } from "./ui/button";
import { Card, CardHeader } from "./ui/Card";
import { Divider } from "./ui/Divider";
import { EmptyState } from "./ui/EmptyState";
import { Icon, type IconName } from "./ui/Icon";
import { Money } from "./ui/Money";
import { Notice } from "./ui/Notice";
import { Page, PageHeader } from "./ui/Page";
import { Segmented, type SegmentedOption } from "./ui/Segmented";
import { SkeletonCards } from "./ui/Skeleton";

interface DataResponse {
  recipes: Recipe[];
  items: Record<ItemId, Item>;
  meta: { importedAt: string };
}
interface PricesResponse {
  prices: Record<ItemId, MarketPrice>;
  fetchedAt: number | null;
}
/** rows per line card */
const TOP = 5;
/** recipes in HOME_PICKS_TITLE */
const HERO = 3;

const RANK_OPTIONS: readonly SegmentedOption<HomeRank>[] = [
  { value: "profitPerUnit", label: "กำไร/ชิ้น" },
  { value: "profitPerHour", label: "กำไร/ชม." },
];

/** One "คุ้มสุดตอนนี้" card of a line, under the picks. */
interface LineSection {
  key: string;
  icon: IconName;
  title: string;
  /** a short grey line under the title, for a title that would otherwise wrap mid-phrase */
  hint?: string;
  href: string;
  rank: HomeRank;
  rows: RecipeEvaluation[];
}

/** `user` null: a visitor who is not signed in (their settings, inventory and stars are in this browser). */
export function Dashboard({ user }: { user: SessionUser | null }) {
  const [settings, setSettings] = useSettings();
  const inventory = useInventory();
  const { favorites, favoriteItems, guest, hasSavedSettings } = useUserData();
  const [data, setData] = useState<DataResponse | null>(null);
  const [prices, setPrices] = useState<Record<ItemId, MarketPrice>>({});
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [pricesLoaded, setPricesLoaded] = useState(false);
  const [problem, setProblem] = useState<FetchProblem | null>(null);
  const [attempt, setAttempt] = useState(0);
  // The first-time setup card: wanted while no settings have been saved. A guest's are only known
  // once the page is live (null until then). Besides its own buttons, it follows saved settings
  // arriving from elsewhere (copied in from this browser after signing in, a guest's first change);
  // a member's changes in the drawer do not close it. Set during render, guarded by the last value
  // seen, as React documents for state derived from props.
  const [setupWanted, setSetupWanted] = useState<boolean | null>(hasSavedSettings === null ? null : !hasSavedSettings);
  const [savedSeen, setSavedSeen] = useState(hasSavedSettings);
  if (savedSeen !== hasSavedSettings) {
    setSavedSeen(hasSavedSettings);
    setSetupWanted(hasSavedSettings === null ? null : !hasSavedSettings);
  }
  const showSetup = setupWanted === true;
  const setShowSetup = (on: boolean) => setSetupWanted(on);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // a guest's stars outside the recipe data have no price in ?ids=all: ask for those separately
  const [favPrices, setFavPrices] = useState<Record<ItemId, MarketPrice>>({});
  const extraFavKey = guest && pricesLoaded ? favorites.filter((id) => !prices[id]).join(",") : "";
  // the same saved sort as the recipes page; home offers per unit and per hour only
  const [sortKey, setSortKey] = usePersistentState<RecipeSort>(RECIPE_SORT_KEY, "profitPerUnit", isRecipeSort);
  const rank = homeRank(sortKey);

  // State is only touched inside promise callbacks so the effect body stays pure. A retry loads
  // the recipe data again only if it is still missing.
  useEffect(() => {
    if (!data) {
      fetchJson<DataResponse>("/api/data", { cache: "no-cache" })
        .then(setData)
        .catch((e) => setProblem(describeError(e)));
    }
    fetchJson<PricesResponse>("/api/prices?ids=all")
      .then((j) => {
        setPrices(j.prices);
        setFetchedAt(j.fetchedAt);
      })
      .catch((e) => setProblem(describeError(e)))
      .finally(() => setPricesLoaded(true));
    // data is read once per attempt, not on every change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);
  useEffect(() => {
    if (!extraFavKey) return;
    const ctl = new AbortController();
    fetchJson<PricesResponse>(`/api/prices?ids=${extraFavKey}`, { signal: ctl.signal })
      .then((j) => setFavPrices((cur) => ({ ...cur, ...j.prices })))
      // the card then says "ไม่มีในตลาด" for them, as for any item without a price
      .catch(() => {});
    return () => ctl.abort();
  }, [extraFavKey]);
  const retry = () => {
    setProblem(null);
    // loading again: the cards show their outlines, not "nothing profitable", until the answer
    setPricesLoaded(false);
    setAttempt((a) => a + 1);
  };

  const items = useMemo(() => data?.items ?? ({} as Record<ItemId, Item>), [data]);
  const evaluations = useMemo(() => {
    if (!data) return [] as RecipeEvaluation[];
    const engine = new CostEngine({ items: data.items, recipes: data.recipes, prices, settings, inventory, ownedCostMode: settings.ownedCostMode });
    return engine.evaluateAll();
  }, [data, prices, settings, inventory]);

  const feasible = useMemo(() => evaluations.filter(isFeasible), [evaluations]);
  const picks = useMemo(() => heroPicks(feasible, rank, HERO), [feasible, rank]);

  const ideas = useMemo(
    () => (data && pricesLoaded ? ideasFromInventory({ recipes: data.recipes, items: data.items, prices, inventory, settings }) : []),
    [data, pricesLoaded, prices, inventory, settings],
  );
  const ownedCount = Object.values(inventory).filter((v) => v && v.qty > 0).length;

  const sections = useMemo((): LineSection[] => {
    if (!data) return [];
    const top = (pred: (ev: RecipeEvaluation) => boolean, by: HomeRank) => ({ rank: by, rows: topPicks(feasible.filter(pred), by, TOP) });
    return [
      { key: "alchemy", icon: "flask", title: "แปรธาตุที่คุ้มสุดตอนนี้", href: "/recipes?tab=alchemy", ...top((ev) => ev.recipe.type === "alchemy", rank) },
      { key: "cooking", icon: "cooking-pot", title: "ทำอาหารที่คุ้มสุดตอนนี้", href: "/recipes?tab=cooking", ...top((ev) => ev.recipe.type === "cooking", rank) },
      { key: "processing", icon: "hammer", title: "แปรรูปที่คุ้มสุดตอนนี้", href: "/recipes?tab=processing", ...top((ev) => PROCESSING_TYPES.includes(ev.recipe.type), rank) },
      // imperial boxes have no per-hour value: always by profit per unit
      { key: "imperial", icon: "crown", title: "กล่องราชวังที่คุ้มสุด", href: "/recipes?tab=imperial", ...top((ev) => IMPERIAL_TYPES.includes(ev.recipe.type), "profitPerUnit") },
      {
        key: "shortage",
        icon: "trending-up",
        title: "ของที่ตลาดขาดตอนนี้",
        hint: "ทำแล้วขายได้ทันที",
        href: "/recipes?market=soldout",
        ...top((ev) => ev.saleChannel === "market" && (prices[ev.productId]?.stock ?? 1) === 0, rank),
      },
    ];
  }, [data, feasible, prices, rank]);

  // best profit per unit for each starred product, when a recipe makes it
  const bestByProduct = useMemo(() => {
    const m = new Map<ItemId, RecipeEvaluation>();
    for (const ev of evaluations) {
      if (!Number.isFinite(ev.profitPerUnit)) continue;
      const cur = m.get(ev.productId);
      if (!cur || ev.profitPerUnit > cur.profitPerUnit) m.set(ev.productId, ev);
    }
    return m;
  }, [evaluations]);

  const loaded = !!data && pricesLoaded;
  const hasFavorites = favorites.length > 0;

  return (
    <Page user={user}>
      <PageHeader
        title={user ? `สวัสดี ${user.displayName}` : "สวัสดี"}
        description={user ? undefined : "ใช้ได้เลยไม่ต้องล็อกอิน ข้อมูลของคุณเก็บไว้ในเครื่องนี้"}
        meta={[
          "ตลาดกลาง Asia",
          <>
            ราคาอัปเดต <TimeAgo at={fetchedAt} placeholder="กำลังโหลด…" />
          </>,
        ]}
      />

      <div className="space-y-4 md:space-y-6">
        {problem && (
          <Notice tone="bad" action={problemAction(problem, retry)}>
            โหลดข้อมูลไม่สำเร็จ: {problem.message}
          </Notice>
        )}

        {/* The answer first, and the one gold card on the page: what to craft now, the number it is
            ranked by in large. Its foot says which settings the numbers come from. */}
        <Card tone="highlight">
          <CardHeader
            tone="highlight"
            icon="sparkles"
            title={HOME_PICKS_TITLE}
            hint={`${HERO} อันดับแรกจากทุกสาย ไม่รวมกล่องราชวัง`}
            // pressing the option already on must not overwrite a saved ROI/cost sort of the recipes page
            action={
              <Segmented
                label="เรียงตาม"
                size="sm"
                options={RANK_OPTIONS}
                value={rank}
                onChange={(v) => {
                  if (v !== rank) setSortKey(v);
                }}
              />
            }
          />
          {problem ? (
            // the error notice above says what failed and offers the next step; not the settings' fault
            <p className="px-4 py-8 text-center text-sm text-muted">ยังจัดอันดับไม่ได้ เพราะโหลดข้อมูลไม่ครบ (ดูข้อความด้านบน)</p>
          ) : !loaded ? (
            // outlines only: the cards below already tell screen readers what is loading
            <div aria-hidden className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-3">
              {Array.from({ length: HERO }, (_, i) => (
                <div key={i} className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center lg:flex-col lg:items-stretch">
                  <div className="flex min-w-0 items-center gap-3 sm:flex-1 lg:flex-none">
                    <div className="skeleton h-10 w-10 shrink-0 rounded-md" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-3.5 w-3/4 rounded-full" />
                      <div className="skeleton h-4 w-16 rounded-full opacity-70" />
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <div className="space-y-2">
                      <div className="skeleton h-3 w-12 rounded-full opacity-70" />
                      <div className="skeleton h-7 w-28 rounded-lg" />
                    </div>
                    <div className="skeleton h-10 w-24 rounded-lg md:h-8" />
                  </div>
                </div>
              ))}
            </div>
          ) : picks.length === 0 ? (
            <EmptyState
              icon="sliders"
              title="ตอนนี้ยังไม่มีสูตรที่ทำแล้วได้กำไร"
              hint="คิดจาก Mastery และระดับทักษะที่ตั้งไว้"
              action={{ label: SETTINGS_TITLE, onClick: () => setSettingsOpen(true) }}
            />
          ) : (
            <ol className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-3">
              {picks.map((ev) => (
                <PickTile key={ev.recipe.id} ev={ev} item={items[ev.productId]} rank={rank} />
              ))}
            </ol>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-4 py-3">
            <p className="min-w-0 flex-1 basis-64 text-xs text-muted">
              คิดจาก Mastery ของคุณ: แปรธาตุ <b className="num text-foreground">{settings.mastery.alchemy ?? 0}</b> · ทำอาหาร{" "}
              <b className="num text-foreground">{settings.mastery.cooking ?? 0}</b> · แปรรูป <b className="num text-foreground">{settings.mastery.processing ?? 0}</b> · {VALUE_PACK.name}{" "}
              <b className="text-foreground">{settings.valuePack ? VALUE_PACK.on : VALUE_PACK.off}</b>
            </p>
            <button type="button" onClick={() => setSettingsOpen(true)} aria-haspopup="dialog" className={btn("secondary", "sm")}>
              <Icon name="settings" className="h-4 w-4" />
              {SETTINGS_TITLE}
            </button>
          </div>
        </Card>

        {/* first visit: right under the answer, so the numbers above can be made the member's own */}
        {showSetup && (
          <OnboardingCard
            settings={settings}
            // only the card's own fields, over the settings as they are now (the drawer may have changed others)
            onSave={(patch) => {
              setSettings({ ...settings, ...patch });
              setShowSetup(false);
            }}
            onSkip={() => setShowSetup(false)}
          />
        )}

        {!loaded && problem ? null : !loaded ? (
          <SkeletonCards n={6} label={!data ? "กำลังโหลดฐานสูตร…" : "กำลังโหลดราคาตลาด…"} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" />
        ) : (
          <>
            {/* the member's own things: what their inventory makes, and the items they starred */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card className={hasFavorites ? "" : "md:col-span-2"}>
                <CardHeader
                  icon="package"
                  title="ทำอะไรได้จากของในคลัง"
                  hint="กำไรเทียบกับขายวัตถุดิบตรง ๆ"
                  action={
                    <Link href="/inventory" className={btn("ghost", "sm")}>
                      คลังของ
                      <Icon name="chevron-right" className="h-4 w-4" />
                    </Link>
                  }
                />
                {ownedCount === 0 ? (
                  <EmptyState compact icon="package" title="ใส่ของที่มี แล้วจะบอกว่าเอาไปทำอะไรได้กำไรสุด" action={{ label: "เพิ่มของในคลัง", href: "/inventory" }} />
                ) : (
                  <InventoryIdeas ideas={ideas} items={items} limit={TOP} emptyText="ของที่มีตอนนี้ยังประกอบเป็นสูตรไหนไม่ครบ" />
                )}
              </Card>
              {hasFavorites && (
                <Card>
                  <CardHeader icon="star" title="ของที่ฉันเฝ้า" hint="ปักดาวไว้จากหน้าคำนวณสูตรหรือสแกนตลาด" />
                  <ul className="divide-y divide-border">
                    {favorites.map((id) => {
                      const it = items[id];
                      const fav = favoriteItems.find((f) => f.id === id);
                      const name = it?.th ?? fav?.th ?? `#${id}`;
                      const price = prices[id]?.price ?? favPrices[id]?.price ?? fav?.price ?? null;
                      const stock = prices[id]?.stock ?? favPrices[id]?.stock ?? fav?.stock ?? null;
                      const best = bestByProduct.get(id);
                      return (
                        // tighter on phones: two buttons and the 40px star leave the name enough room
                        <li key={id} className="flex items-center gap-2 py-3 pl-4 pr-2 md:gap-3 md:pr-4">
                          <ItemIcon id={id} grade={it?.grade ?? fav?.grade ?? 0} size={32} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{name}</p>
                            <p className="flex flex-wrap gap-x-2.5 text-xs text-muted">
                              {price ? (
                                <>
                                  <span>
                                    ราคา <span className="num">{silverShort(price)}</span>
                                  </span>
                                  <span>
                                    ค้างขาย <span className="num">{silverShort(stock ?? 0)}</span>
                                  </span>
                                </>
                              ) : (
                                <span>ไม่มีในตลาด</span>
                              )}
                              {best && (
                                <span>
                                  ทำเองกำไร <Money value={best.profitPerUnit} tone="profit" compact suffix="/ชิ้น" />
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 md:gap-1">
                            <Link href={`/market?q=${encodeURIComponent(name)}`} className={btn("secondary", "sm")}>
                              ตลาด
                            </Link>
                            {/* only when a recipe makes it: otherwise the recipe search would come up empty */}
                            {best && (
                              <Link href={`/recipes?q=${encodeURIComponent(name)}`} className={btn("secondary", "sm")}>
                                สูตร
                              </Link>
                            )}
                            <FavoriteStar id={id} name={name} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              )}
            </div>

            <Divider />

            {/* the best few of each line, each card opening that line on the recipes page */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sections.map((s) => (
                <Card key={s.key}>
                  <CardHeader
                    icon={s.icon}
                    title={s.title}
                    hint={s.hint}
                    action={
                      <Link href={s.href} className={btn("ghost", "sm")}>
                        ดูทั้งหมด
                        <Icon name="chevron-right" className="h-4 w-4" />
                      </Link>
                    }
                  />
                  {s.rows.length === 0 ? (
                    <EmptyState compact icon={s.icon} title="ยังไม่มีสูตรที่กำไรเป็นบวกในหมวดนี้ตอนนี้" />
                  ) : (
                    <ul className="divide-y divide-border">
                      {s.rows.map((ev, i) => (
                        <HighlightRow key={ev.recipe.id} rank={i + 1} by={s.rank} ev={ev} item={items[ev.productId]} stock={prices[ev.productId]?.stock} />
                      ))}
                    </ul>
                  )}
                </Card>
              ))}
            </div>
          </>
        )}

        <footer className="text-xs text-muted">
          แสดงเฉพาะสูตรที่ราคาครบ ขายได้ และไม่เกินระดับทักษะที่ตั้งไว้ · ตัวเลขเปลี่ยนตามราคาตลาดและ Mastery ของแต่ละคน · รายละเอียดและตัวกรองทั้งหมดอยู่ที่หน้า{" "}
          <Link href="/recipes" className="text-accent underline underline-offset-2 hover:text-accent-hover">
            คำนวณสูตร
          </Link>
        </footer>
      </div>
      {/* outside the spaced column: the closed dialog must not leave a gap */}
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Page>
  );
}

/** Per hour only means something for a market recipe (an imperial box has no per-hour value). */
const showsPerHour = (ev: RecipeEvaluation, by: HomeRank) => by === "profitPerHour" && ev.saleChannel === "market";

/**
 * One of the three "ทำอะไรดีตอนนี้" picks: the item, its line, the number it is ranked by in large,
 * and one button to the recipe. A column on phones and on lg (three across), a row in between.
 */
function PickTile({ ev, item, rank }: { ev: RecipeEvaluation; item: Item | undefined; rank: HomeRank }) {
  const name = item?.th ?? ev.recipe.name;
  const perHour = showsPerHour(ev, rank);
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-panel-2/60 p-3 sm:flex-row sm:items-center sm:gap-4 lg:flex-col lg:items-stretch lg:gap-3">
      <div className="flex min-w-0 items-center gap-3 sm:flex-1 lg:flex-none">
        <ItemIcon id={ev.productId} grade={item?.grade} size={40} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-medium text-foreground">{name}</p>
          {/* copper: a category, not a status */}
          <Badge tone="copper" icon={recipeTypeIcon(ev.recipe.type)} className="mt-1">
            {RECIPE_TYPE_TH[ev.recipe.type]}
          </Badge>
        </div>
      </div>
      <div className="flex items-end justify-between gap-3 lg:mt-auto">
        <div className="min-w-0 sm:text-right lg:text-left">
          <p className="text-xs text-muted">{perHour ? "กำไร/ชม." : "กำไร/ชิ้น"}</p>
          <Money value={perHour ? ev.profitPerHour : ev.profitPerUnit} tone="profit" compact className="block text-2xl font-semibold" />
          <p className="num text-xs text-muted">
            {perHour ? `${signed(ev.profitPerUnit, silverShort)}/ชิ้น · ` : ""}ROI {signedPct(ev.roi)}
          </p>
        </div>
        <Link href={`/recipes?open=${ev.recipe.id}`} aria-label={`ดูวิธีทำ ${name}`} className={btn("secondary", "sm")}>
          ดูวิธีทำ
          <Icon name="chevron-right" className="h-4 w-4" />
        </Link>
      </div>
    </li>
  );
}

function HighlightRow({ rank, by, ev, item, stock }: { rank: number; by: HomeRank; ev: RecipeEvaluation; item: Item | undefined; stock: number | undefined }) {
  const href = `/recipes?open=${ev.recipe.id}`;
  const perHour = showsPerHour(ev, by);
  const soldOut = ev.saleChannel === "market" && stock === 0;
  return (
    <li>
      <Link href={href} className="flex min-h-12 items-center gap-3 px-4 py-3 text-sm transition-colors duration-150 hover:bg-panel-2">
        <span className="num w-4 shrink-0 text-center text-xs text-faint">{rank}</span>
        <ItemIcon id={ev.productId} grade={item?.grade} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{item?.th ?? ev.recipe.name}</p>
          <p className="text-xs text-muted">
            {RECIPE_TYPE_TH[ev.recipe.type]} · ต้นทุน <span className="num">{silverShort(ev.unitCost)}</span> · {ev.saleChannel === "imperial" ? "ส่งราชวัง" : "ขาย"}{" "}
            <span className="num">{silverShort(ev.sellPrice)}</span>
          </p>
          {(ev.flags.materialSoldOut || soldOut) && (
            <div className="mt-1 flex flex-wrap gap-1">
              {ev.flags.materialSoldOut && (
                <Badge tone="warn" icon="alert-triangle">
                  วัตถุดิบบางตัวหมดตลาด
                </Badge>
              )}
              {soldOut && (
                <Badge tone="good" icon="trending-up">
                  ขาดตลาด
                </Badge>
              )}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-semibold">
            {perHour ? (
              <Money value={ev.profitPerHour} tone="profit" compact suffix="/ชม." />
            ) : (
              <Money value={ev.profitPerUnit} tone="profit" compact />
            )}
          </div>
          <div className="num text-xs text-muted">{perHour ? `${signed(ev.profitPerUnit, silverShort)}/ชิ้น` : `ROI ${signedPct(ev.roi)}`}</div>
        </div>
        <Icon name="chevron-right" className="hidden h-4 w-4 text-faint sm:block" />
      </Link>
    </li>
  );
}
