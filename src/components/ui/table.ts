/**
 * Class strings for the dense lists of the app (MASTER.md §7 "Tables / dense lists"), so the
 * recipes, market, inventory and admin tables look like one family. Plain strings, like button.ts:
 * use them on the real elements and add layout classes (widths, `hidden md:table-cell`) after.
 *
 * Desktop (md and up): a <table> inside a Card. The header row is panel-2 and can stick below the
 * top bar (headStickyCls, only when nothing between it and the page scrolls sideways). Numbers
 * are tabular and right-aligned; the first column is ItemIcon + name. No zebra stripes.
 *
 * Phones: the same rows as stacked cards in a list (stackedListCls / stackedRowCls): the name and
 * the main number on the first line, the secondary facts on a grey line under it. No sideways
 * page scroll. A table that needs more room than md gives (editable cells, many columns) switches
 * at lg instead: stackedListLgCls for the list, `hidden lg:table` (or lg:block) on the table.
 */

/** <table> */
export const tableCls = "w-full border-collapse text-sm";

/** <thead>: grey 12px medium labels on panel-2 (opaque, so rows do not show through when it sticks) */
export const headCls = "bg-panel-2 text-xs font-medium text-muted";
/** add to <thead> to keep it in view under the sticky top bar while the page scrolls */
export const headStickyCls = "sticky top-(--header-h) z-10";

/** <th> for a text column */
export const thCls = "px-3 py-2 text-left font-medium whitespace-nowrap first:pl-4 last:pr-4";
/** <th> for a number column */
export const thNumCls = "px-3 py-2 text-right font-medium whitespace-nowrap first:pl-4 last:pr-4";
/** <th> for a column aligned right that holds no numbers (e.g. row actions) */
export const thEndCls = "px-3 py-2 text-right font-medium whitespace-nowrap first:pl-4 last:pr-4";

/** <tr> in <tbody>: a hairline under each row, a soft fill on hover */
export const rowCls = "border-b border-border/70 transition-colors duration-150 last:border-b-0 hover:bg-panel-2/60";
/** <tr> that opens something when pressed (also give it the keyboard path the page already has) */
export const rowButtonCls = "cursor-pointer border-b border-border/70 transition-colors duration-150 last:border-b-0 hover:bg-panel-2/60";
/** the row that is open / selected right now */
export const rowSelectedCls = "bg-accent/6";

/** <td> for text */
export const tdCls = "px-3 py-2.5 align-middle first:pl-4 last:pr-4";
/** <td> for a number: tabular figures, right-aligned, never wrapped */
export const tdNumCls = "num px-3 py-2.5 text-right align-middle whitespace-nowrap first:pl-4 last:pr-4";
/** <td> under thEndCls: right-aligned, not a number (row actions) */
export const tdEndCls = "px-3 py-2.5 text-right align-middle first:pl-4 last:pr-4";
/**
 * Add to the first (name) cell next to tdCls: it takes the width the other columns leave, and a
 * long name is cut short (itemNameCls) instead of widening the table past its card, where an
 * overflow-clip card would hide the rest.
 */
export const fillCellCls = "w-full max-w-0";
/** the first cell's content: ItemIcon then the name */
export const itemCellCls = "flex min-w-0 items-center gap-2.5";
/** the item name inside itemCellCls */
export const itemNameCls = "min-w-0 truncate font-medium text-foreground";

/** the phone list (<ul> or <div role="list">) that replaces the table below md */
export const stackedListCls = "divide-y divide-border md:hidden";
/** the same list for a table that needs lg room: it replaces the table below lg */
export const stackedListLgCls = "divide-y divide-border lg:hidden";
/** one phone row: a column of lines */
export const stackedRowCls = "flex flex-col gap-1.5 px-4 py-3";
/** its first line: ItemIcon, the name (flex-1, truncated) and the main number on the right */
export const stackedMainCls = "flex min-w-0 items-center gap-3";
/** the main number on that line */
export const stackedNumCls = "num ml-auto shrink-0 text-right font-semibold";
/** the grey line of secondary facts under it; pl-11 lines it up with the name after a 32px icon */
export const stackedMetaCls = "flex flex-wrap gap-x-3 gap-y-1 pl-11 text-xs text-muted";

/** a row of controls over a list (search, filters, actions), framed as a card */
export const toolbarCls = "flex flex-wrap items-center gap-2 rounded-xl border border-border bg-panel p-3 shadow-card";
