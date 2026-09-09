import { describe, expect, it } from "vitest";
import { DREAM_SKILL, buildDreamFromPrompt } from "./skill.js";

describe("DREAM_SKILL", () => {
  it("is a non-empty, platform-owned markdown constant", () => {
    expect(DREAM_SKILL.length).toBeGreaterThan(0);
    expect(DREAM_SKILL).toContain("Monitor");
    expect(DREAM_SKILL.toLowerCase()).toContain("responsibility");
    expect(DREAM_SKILL).toContain("JAMOT");
  });
});

describe("buildDreamFromPrompt", () => {
  it("derives an objective from the first sentence of the prompt", async () => {
    const config = await buildDreamFromPrompt(
      "Build a €1M ARR AI consulting company. We focus on fintech.",
    );
    expect(config.objective).toBe("Build a €1M ARR AI consulting company");
    expect(config.outcomes).toEqual([]);
    expect(config.requiredResponsibilities).toEqual([]);
  });
});