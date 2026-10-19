import { describe, expect, it } from "vitest";
import { loadBundledSurfaceModel } from "./surfaceModelAdapter";

describe("bundled Surface Assist model gate", () => {
  it("reports no validated local model instead of fabricating a model result", async () => {
    await expect(loadBundledSurfaceModel()).resolves.toEqual({
      status: "unavailable",
      reason: "NO_VALIDATED_BUNDLED_MODEL",
    });
  });
});
