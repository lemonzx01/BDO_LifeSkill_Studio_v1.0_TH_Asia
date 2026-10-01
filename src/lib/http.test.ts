import { describe, expect, it } from "vitest";
import { readJsonBody } from "./http";

const put = (body: BodyInit, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/x", { method: "PUT", body, headers, duplex: "half" } as RequestInit);

describe("readJsonBody", () => {
  it("parses a small JSON body", async () => {
    expect(await readJsonBody(put(JSON.stringify({ id: 1, on: true })), 100)).toEqual({ ok: true, body: { id: 1, on: true } });
  });

  it("returns 400 for broken JSON and for an empty body", async () => {
    expect(await readJsonBody(put("{nope"), 100)).toMatchObject({ ok: false, status: 400 });
    expect(await readJsonBody(new Request("http://localhost/api/x", { method: "PUT" }), 100)).toMatchObject({ ok: false, status: 400 });
  });

  it("returns 413 when the text is longer than the limit", async () => {
    const big = JSON.stringify({ junk: "x".repeat(200) });
    expect(await readJsonBody(put(big), 100)).toMatchObject({ ok: false, status: 413 });
  });

  it("counts characters, not bytes, for text under the byte cap", async () => {
    // 60 Thai characters = 180 UTF-8 bytes, still within 100 characters
    const thai = JSON.stringify("ก".repeat(60));
    expect(await readJsonBody(put(thai), 100)).toEqual({ ok: true, body: "ก".repeat(60) });
  });

  it("refuses a declared Content-Length over the cap without reading", async () => {
    expect(await readJsonBody(put("{}", { "content-length": "999999" }), 100)).toMatchObject({ ok: false, status: 413 });
  });

  it("stops reading a streamed body once it passes the cap", async () => {
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        if (pulled > 1000) controller.close();
        else controller.enqueue(new TextEncoder().encode("x".repeat(100)));
      },
    });
    const res = await readJsonBody(put(stream), 100);
    expect(res).toMatchObject({ ok: false, status: 413 });
    expect(pulled).toBeLessThan(20);
  });
});
