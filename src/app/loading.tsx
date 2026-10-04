import { PageSkeleton } from "@/components/ui/Skeleton";

/**
 * Shown the moment a link is clicked, while the server renders the next page. The top bar and the
 * phone tab bar are the real ones (the user menu is a placeholder), so they stay put. Below them,
 * the moon emblem with "กำลังโหลดหน้า…" in place of the page's eyebrow line, then a slowly
 * shimmering outline of a typical page (title, chips, divider, toolbar, table rows): it reads as
 * "already on its way" better than a spinner does.
 */
export default function RouteLoading() {
  return <PageSkeleton emblem />;
}
