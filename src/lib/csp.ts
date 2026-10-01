/**
 * Content-Security-Policy for HTML pages, built per request by src/proxy.ts. Next.js reads the
 * nonce from the request's CSP header and puts it on every script it renders; 'strict-dynamic'
 * then lets those scripts load the rest of the app's chunks.
 */
export interface CspOptions {
  /** `next dev`: React needs eval to rebuild server error stacks in the browser */
  dev: boolean;
  /** add upgrade-insecure-requests (production over HTTPS only) */
  upgradeInsecure: boolean;
}

export function buildCsp(nonce: string, { dev, upgradeInsecure }: CspOptions): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // React SSR writes style="" attributes, which a nonce cannot cover
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];
  if (upgradeInsecure) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

/** 128 random bits, base64: unguessable and different on every request. */
export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
