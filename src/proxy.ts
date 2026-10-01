import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, newNonce } from "@/lib/csp";

/**
 * Adds a Content-Security-Policy with a fresh nonce to every page response. The policy is also
 * set on the forwarded request, which is where Next.js picks the nonce up while rendering.
 * Every page is dynamic (force-dynamic), so each render gets this request's nonce.
 */
export function proxy(request: NextRequest) {
  const nonce = newNonce();
  const https = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  const csp = buildCsp(nonce, {
    dev: process.env.NODE_ENV === "development",
    // on plain-http hosts (`next start` on localhost) upgrading would only break loading the page
    upgradeInsecure: process.env.NODE_ENV === "production" && https,
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // pages only: not API routes, build output, image optimisation or files from public/
      source:
        "/((?!api/|api$|_next/static|_next/image|favicon\\.ico|icons/|manifest\\.webmanifest|robots\\.txt|.*\\.(?:png|jpe?g|gif|webp|svg|ico|txt|xml|json|webmanifest|woff2?|map|js|css)$).*)",
      // Next's own <Link> prefetches render no HTML, so they need no nonce. A browser cannot add this
      // header to a page load. "Purpose: prefetch" is not skipped: browsers send it themselves for
      // <link rel=prefetch>, and the HTML they keep would then have no CSP.
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
