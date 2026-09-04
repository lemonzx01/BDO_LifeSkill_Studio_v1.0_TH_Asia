import { Loading } from "@/components/Loading";

/** Shown the moment a link is clicked, while the server renders the next page (market scan, recipe table…). */
export default function RouteLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-3 py-10 md:px-6">
      <Loading text="กำลังโหลดหน้า…" />
    </main>
  );
}
