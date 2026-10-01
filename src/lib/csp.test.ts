import { describe, expect, it } from "vitest";
import { buildCsp, newNonce } from "./csp";

const directives = (csp: string) => new Map(csp.split("; ").map((d) => [d.split(" ")[0], d] as const));

describe("content security policy", () => {
  it("allows only same-origin and nonce scripts in production", () => {
    const d = directives(buildCsp("abc123", { dev: false, upgradeInsecure: true }));
    expect(d.get("script-src")).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(d.get("default-src")).toBe("default-src 'self'");
    expect(d.get("style-src")).toBe("style-src 'self' 'unsafe-inline'");
    expect(d.get("img-src")).toBe("img-src 'self' data: blob:");
    expect(d.get("connect-src")).toBe("connect-src 'self'");
    expect(d.get("frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(d.get("object-src")).toBe("object-src 'none'");
    expect(d.get("base-uri")).toBe("base-uri 'self'");
    expect(d.get("form-action")).toBe("form-action 'self'");
    expect(d.has("upgrade-insecure-requests")).toBe(true);
  });

  it("adds unsafe-eval only in development and upgrade-insecure-requests only when asked", () => {
    const dev = buildCsp("n", { dev: true, upgradeInsecure: false });
    expect(directives(dev).get("script-src")).toContain("'unsafe-eval'");
    expect(dev).not.toContain("upgrade-insecure-requests");
    expect(buildCsp("n", { dev: false, upgradeInsecure: false })).not.toContain("unsafe-eval");
  });

  it("makes a new 128-bit base64 nonce every time", () => {
    const a = newNonce();
    const b = newNonce();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});
