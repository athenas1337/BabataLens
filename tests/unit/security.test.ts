import { describe, it, expect } from "vitest";
import { redactSecret } from "../../lib/config/env";

describe("Security & Secret Redaction Suite", () => {
  it("masks long tokens and api keys in strings", () => {
    const sensitive = "sk-proj-1234567890abcdef1234567890";
    const redacted = redactSecret(sensitive);
    expect(redacted).not.toBe(sensitive);
    expect(String(redacted)).toContain("***");
  });

  it("redacts keys in sensitive dictionary keys", () => {
    const payload = {
      apiKey: "secret_1234567890abcdef",
      authToken: "bearer_xyz987654321",
      regularField: "public_information",
    };

    const cleaned = redactSecret(payload) as Record<string, unknown>;
    expect(cleaned.apiKey).toBe("[REDACTED]");
    expect(cleaned.authToken).toBe("[REDACTED]");
    expect(cleaned.regularField).toBe("public_information");
  });

  it("handles nested structures and arrays", () => {
    const nested = {
      user: "Atha",
      credentials: [
        { apiSecret: "shhhh_dont_look_here" },
        { provider: "coingecko" },
      ],
    };

    const cleaned = redactSecret(nested) as any;
    expect(cleaned.user).toBe("Atha");
    expect(cleaned.credentials[0].apiSecret).toBe("[REDACTED]");
    expect(cleaned.credentials[1].provider).toBe("coingecko");
  });
});
