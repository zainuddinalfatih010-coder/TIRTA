import { it, expect, vi } from "vitest";
import { createProjectV2, type ProjectV2 } from "../domain/projectV2";
import { SaveSession } from "./SaveSession";
import { testTime } from "../test/productionFixtures";
it("never labels in-flight or failed data saved and preserves edits made during a write", async () => {
  const p = createProjectV2("p", "Satu", testTime);
  let release: ((value: ProjectV2) => void) | undefined;
  const save = vi.fn(
    () =>
      new Promise<ProjectV2>((resolve) => {
        release = resolve;
      }),
  );
  const session = new SaveSession(p, save, 100000);
  session.update({ ...p, name: "Dua" });
  const flushing = session.flush();
  expect(session.snapshot().status).toBe("saving");
  session.update({ ...session.snapshot().project, name: "Tiga" });
  release!({ ...p, name: "Dua", revision: 2 });
  await flushing;
  expect(session.snapshot()).toMatchObject({
    status: "unsaved",
    project: { name: "Tiga", revision: 2 },
  });
  const second = session.flush();
  release!({ ...p, name: "Tiga", revision: 3 });
  await second;
  expect(session.snapshot().status).toBe("saved");
  session.dispose();
});
it("preserves recoverable work on quota failure and supports retry", async () => {
  const p = createProjectV2("p", "Satu", testTime);
  let fail = true;
  const session = new SaveSession(
    p,
    async (value) => {
      if (fail) throw new DOMException("Full", "QuotaExceededError");
      return { ...value, revision: 2 };
    },
    100000,
  );
  session.update({ ...p, name: "Belum hilang" });
  await session.flush();
  expect(session.snapshot()).toMatchObject({
    status: "error",
    project: { name: "Belum hilang" },
    error: { code: "STORAGE_FULL" },
  });
  fail = false;
  await session.flush();
  expect(session.snapshot().status).toBe("saved");
  session.dispose();
});
