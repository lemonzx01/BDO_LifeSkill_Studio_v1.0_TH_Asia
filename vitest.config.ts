import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    // the first test or hook of a file starts its in-memory database, which can take over 30 s
    // while every other test file starts its own in parallel on a busy machine
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
