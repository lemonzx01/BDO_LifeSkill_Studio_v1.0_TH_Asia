import Link from "next/link";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/brand";

/**
 * A single centred card with no app navigation, for /login, /setup and the forced password change
 * on /account (every other page sends a member there until it is done). Signed-in pages use
 * <Page> from components/ui instead.
 */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-4 py-10">
      <Link href="/" className="mb-6 text-xl font-bold text-accent">
        {APP_NAME}
      </Link>
      <div className="w-full max-w-md rounded-lg border border-border bg-panel p-4 sm:p-6">
        <h1 className="text-lg font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        <div className="mt-4">{children}</div>
      </div>
    </main>
  );
}
