import { describe, expect, it } from "vitest";

// vitest.config.ts clears DATABASE_URL so no test can reach a real Neon
// database. If this fails, that guard has gone and every write-heavy test
// would run against whatever database the shell points at.
describe("test database", () => {
  it("never sees DATABASE_URL", () => {
    expect(process.env.DATABASE_URL ?? "").toBe("");
  });
});
