export type JsonBody = { ok: true; body: unknown } | { ok: false; status: 400 | 413; error: string };

/**
 * Reads a JSON request body of at most `maxChars` characters. The stream is read piece by
 * piece and abandoned as soon as it passes the limit, so an oversized body is never held
 * in memory whole (with or without a Content-Length header).
 */
export async function readJsonBody(req: Request, maxChars: number): Promise<JsonBody> {
  const tooLarge = { ok: false, status: 413, error: "body too large" } as const;
  // UTF-8 uses at most 4 bytes per UTF-16 unit, so more bytes than this is always too many characters
  const maxBytes = maxChars * 4;
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return tooLarge;

  let text = "";
  if (req.body) {
    const reader = req.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => {});
        return tooLarge;
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  }
  if (text.length > maxChars) return tooLarge;
  try {
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 400, error: "bad json" };
  }
}
