import { describe, expect, it } from "vitest";
import { describeError, driverName, publicErrorCode, sanitize } from "./health";

describe("health helpers", () => {
  it("masks credentials in connection strings", () => {
    expect(sanitize("connect failed postgres://user:pw@db.example.com:5432/x")).toBe("connect failed postgres://***@db.example.com:5432/x");
  });

  it("walks the cause chain and exposes only the innermost bare code", () => {
    const driver = Object.assign(new Error('password authentication failed for user "postgres"'), { code: "28P01" });
    const wrapped = new Error("Failed query: select 1", { cause: driver });
    const chain = describeError(wrapped);
    expect(chain).toEqual([
      { code: null, message: "Failed query (see cause)" },
      { code: "28P01", message: 'password authentication failed for user "postgres"' },
    ]);
    expect(publicErrorCode(chain)).toBe("28P01");
  });

  it("never passes a message-like code to the public", () => {
    expect(publicErrorCode([{ code: "connect ECONNREFUSED 10.0.0.1:5432", message: "x" }])).toBeNull();
    expect(publicErrorCode([{ code: "ECONNREFUSED", message: "connect ECONNREFUSED 10.0.0.1:5432" }])).toBe("ECONNREFUSED");
    expect(publicErrorCode([])).toBeNull();
  });

  it("names the driver from the environment without echoing it", () => {
    expect(driverName({})).toBe("pglite (embedded)");
    expect(driverName({ DATABASE_URL: "postgres://u:p@x.neon.tech/db" })).toBe("neon-http");
    expect(driverName({ POSTGRES_URL: "postgres://u:p@db.supabase.co:6543/postgres" })).toBe("postgres.js");
  });
});
