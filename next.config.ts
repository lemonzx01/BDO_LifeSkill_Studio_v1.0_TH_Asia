import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WASM + native bindings; keep it out of the server bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
