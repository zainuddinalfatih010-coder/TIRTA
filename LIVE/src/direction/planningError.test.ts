import { expect, it } from "vitest";
import { z } from "zod";
import { planningError } from "./planningError";

it("does not expose schema JSON or internal paths to the planning form", () => {
  const result = z.object({ secretInternalPath: z.number() }).safeParse({ secretInternalPath: "bad" });
  if (result.success) throw new Error("Expected invalid input");
  const message = planningError(result.error);
  expect(message).toContain("Isian Anda tetap ada");
  expect(message).not.toMatch(/secretInternalPath|invalid_type|"code"|"path"/);
  expect(planningError(new Error("Biaya: pilih dasar angka."))).toBe("Biaya: pilih dasar angka.");
});
