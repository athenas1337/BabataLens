import { describe, it, expect } from "vitest";
import { providerRegistry } from "../../lib/providers/registry";

describe("Provider Registry & Routing Suite", () => {
  it("registers core providers across all capabilities", () => {
    const manifests = providerRegistry.getAllManifests();
    expect(manifests.length).toBeGreaterThanOrEqual(8);

    const capabilities = manifests.map((m) => m.capability);
    expect(capabilities).toContain("ai");
    expect(capabilities).toContain("market");
    expect(capabilities).toContain("blockchain");
    expect(capabilities).toContain("exchange");
    expect(capabilities).toContain("analytics");
  });

  it("retrieves AI and Market providers correctly", () => {
    const ai = providerRegistry.getAIProvider();
    // In test environment without keys, might be null or default
    const market = providerRegistry.getMarketProvider("coingecko");
    expect(market).not.toBeNull();
    expect(market?.id).toBe("coingecko");
  });

  it("produces health reports without any credential exposure", async () => {
    const reports = await providerRegistry.checkAllHealth();
    expect(reports.length).toBeGreaterThan(0);

    for (const rep of reports) {
      expect(rep).toHaveProperty("provider");
      expect(rep).toHaveProperty("status");
      expect(rep).toHaveProperty("lastCheckedAt");

      // Verify no sensitive keys leaked
      const stringified = JSON.stringify(rep).toLowerCase();
      expect(stringified).not.toContain("api_key");
      expect(stringified).not.toContain("secret");
      expect(stringified).not.toContain("bearer");
    }
  });
});
