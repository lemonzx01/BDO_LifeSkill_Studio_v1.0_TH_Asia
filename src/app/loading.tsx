import { PageSkeleton } from "@/components/ui/Skeleton";

/**
 * Shown the moment a link is clicked, while the server renders the next page. The header and the
 * phone tab bar are the real ones (the user menu is a placeholder), so they stay put, and below
 * them a grey outline of a typical page (title, chips, toolbar, table rows) reads as "already
 * loading" better than a spinner does.
 */
export default function RouteLoading() {
  return <PageSkeleton />;
}
