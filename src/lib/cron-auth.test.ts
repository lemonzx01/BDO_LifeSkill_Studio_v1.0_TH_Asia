import { describe, expect, it } from "vitest";
import { bearerMatches, checkCronAuth } from "./cron-auth";

describe("cron authorization", () => {
  it("accepts only the exact bearer token", () => {
    expect(bearerMatches("Bearer s3cret", "s3cret")).toBe(true);
    expect(bearerMatches("Bearer s3cret ", "s3cret")).toBe(false);
    expect(bearerMatches("bearer s3cret", "s3cret")).toBe(false);
    expect(bearerMatches("Bearer s3cre", "s3cret")).toBe(false);
    expect(bearerMatches("Bearer s3cret-and-more", "s3cret")).toBe(false);
    expect(bearerMatches(null, "s3cret")).toBe(false);
    expect(bearerMatches("", "s3cret")).toBe(false);
  });

  it("fails closed on Vercel when CRON_SECRET is missing", () => {
    expect(checkCronAuth(null, { VERCEL: "1" })).toBe("unconfigured");
    expect(checkCronAuth("Bearer anything", { VERCEL: "1", CRON_SECRET: "" })).toBe("unconfigured");
  });

  it("fails closed on any production server when CRON_SECRET is missing", () => {
    expect(checkCronAuth(null, { NODE_ENV: "production" })).toBe("unconfigured");
    expect(checkCronAuth("Bearer anything", { NODE_ENV: "production", CRON_SECRET: "" })).toBe("unconfigured");
  });

  it("allows a development run without a secret", () => {
    expect(checkCronAuth(null, {})).toBe("ok");
    expect(checkCronAuth(null, { NODE_ENV: "development" })).toBe("ok");
    expect(checkCronAuth(null, { NODE_ENV: "test" })).toBe("ok");
  });

  it("requires the secret whenever it is set", () => {
    const env = { VERCEL: "1", CRON_SECRET: "s3cret" };
    expect(checkCronAuth("Bearer s3cret", env)).toBe("ok");
    expect(checkCronAuth("Bearer wrong", env)).toBe("unauthorized");
    expect(checkCronAuth(null, env)).toBe("unauthorized");
    expect(checkCronAuth(null, { CRON_SECRET: "s3cret" })).toBe("unauthorized"); // locally too
  });
});
