"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { btn } from "./button";

export interface ConfirmOptions {
  title: string;
  /** one line on what will happen */
  body: ReactNode;
  /** optional list shown under it, scrolling when long (e.g. the inventory changes) */
  details?: ReactNode[];
  /** named after the action, e.g. "ลบ 42 รายการ" or "ปิดใช้งาน @somchai" */
  confirmLabel: string;
  cancelLabel?: string;
  /** "danger" for a destructive action: a red confirm button */
  tone?: "danger" | "default";
}

interface Request {
  opts: ConfirmOptions;
  resolve: (ok: boolean) => void;
}

/**
 * The replacement for window.confirm(): `const [confirm, confirmDialog] = useConfirm()`, render
 * {confirmDialog} once, then `if (await confirm({...})) doIt()`.
 *
 * Built on a native <dialog> opened with showModal(), which keeps keyboard focus inside it, makes
 * the page behind it inert and closes on Escape (= cancel). Focus starts on the cancel button and
 * goes back to whatever had it (usually the button that asked) when the dialog closes.
 */
export function useConfirm(): [(opts: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [request, setRequest] = useState<Request | null>(null);
  const pending = useRef<Request | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        // a second question replaces an unanswered one, which counts as cancelled
        pending.current?.resolve(false);
        const req = { opts, resolve };
        pending.current = req;
        setRequest(req);
      }),
    [],
  );

  const answer = useCallback((req: Request, ok: boolean) => {
    if (pending.current === req) pending.current = null;
    req.resolve(ok);
    setRequest((cur) => (cur === req ? null : cur));
  }, []);

  return [confirm, <ConfirmDialog key="confirm" request={request} onAnswer={answer} />];
}

function ConfirmDialog({ request, onAnswer }: { request: Request | null; onAnswer: (req: Request, ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  // the request on screen: kept while the dialog closes so its text does not blank out first
  const shown = useRef<Request | null>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d || !request) return;
    shown.current = request;
    if (d.open) return;
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    d.returnValue = "";
    d.showModal();
    cancelRef.current?.focus();
  }, [request]);

  const onClose = () => {
    const req = shown.current;
    shown.current = null;
    const back = returnTo.current;
    returnTo.current = null;
    if (back?.isConnected) back.focus();
    if (req) onAnswer(req, ref.current?.returnValue === "confirm");
  };

  const opts = request?.opts;
  const danger = opts?.tone === "danger";
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onClose={onClose}
      // a press on the dimmed backdrop (outside the panel) is a cancel
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-border bg-panel p-0 text-foreground shadow-2xl backdrop:bg-black/60"
    >
      {opts && (
        <form method="dialog" className="p-4">
          <h2 id={titleId} className="text-base font-semibold">
            {opts.title}
          </h2>
          <div id={bodyId} className="mt-1 text-sm text-muted">
            {opts.body}
          </div>
          {opts.details && opts.details.length > 0 && (
            <ul className="mt-3 max-h-48 space-y-0.5 overflow-y-auto rounded border border-border bg-background/40 px-3 py-2 text-xs text-muted">
              {opts.details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button ref={cancelRef} type="submit" value="cancel" className={btn("secondary")}>
              {opts.cancelLabel ?? "ยกเลิก"}
            </button>
            <button type="submit" value="confirm" className={btn(danger ? "danger" : "primary")}>
              {opts.confirmLabel}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
