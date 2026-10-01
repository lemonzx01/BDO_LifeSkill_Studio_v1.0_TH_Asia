import { PageSkeleton } from "@/components/ui/Skeleton";

/**
 * Shown the moment a link is clicked, while the server renders the next page.
 * A grey outline of a typical page (header, toolbar, table rows) reads as
 * "already loading" better than a spinner does.
 */
export default function RouteLoading() {
  return <PageSkeleton />;
}
