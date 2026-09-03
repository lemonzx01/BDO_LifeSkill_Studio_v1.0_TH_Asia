import Link from "next/link";
import type { ReactNode } from "react";

export function AuthCard({ title, subtitle, children, wide = false }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 py-10">
      <Link href="/" className="mb-6 text-xl font-bold text-accent">
        BDO LifeSkill Studio
      </Link>
      <div className={`w-full rounded-lg border border-border bg-panel p-6 ${wide ? "max-w-4xl" : "max-w-md"}`}>
        <h1 className="text-lg font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        <div className="mt-4">{children}</div>
      </div>
    </main>
  );
}
