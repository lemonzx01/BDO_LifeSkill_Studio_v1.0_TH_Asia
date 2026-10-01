/** Scrolling helpers for the browser (call them from event handlers or effects, never in render). */

/** "smooth", unless the member's system asks for reduced motion */
export const scrollBehavior = (): ScrollBehavior => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

/**
 * True when the top of `el` is hidden under (or above) the sticky `bar`, e.g. a phone filter panel
 * that sits right after the bar and was scrolled away with the list.
 */
export function hiddenUnder(el: HTMLElement | null, bar: HTMLElement | null): boolean {
  if (!el || !bar || el.getClientRects().length === 0) return false;
  return el.getBoundingClientRect().top < bar.getBoundingClientRect().bottom - 1;
}

/** Scroll up just enough that the top of `el` shows right under the sticky `bar`. */
export function revealUnder(el: HTMLElement | null, bar: HTMLElement | null): void {
  if (!el || !bar || el.getClientRects().length === 0) return;
  const gap = el.getBoundingClientRect().top - bar.getBoundingClientRect().bottom;
  if (gap < 0) window.scrollBy({ top: gap, behavior: scrollBehavior() });
}
