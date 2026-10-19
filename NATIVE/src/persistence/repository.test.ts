import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { ProjectRepository, sha256 } from "./ProjectRepository";
import { SqliteStorage, type SqliteConnection } from "./sqlite";
import { productionFixture, testTime } from "../test/productionFixtures";
import { createProjectV2 } from "../domain/projectV2";
import { snapshotPlan, planningFingerprint } from "../domain/planningEngine";

describe("repository contract on real SQLite", () => {
  let db: DatabaseSync, store: SqliteStorage, repo: ProjectRepository;
  beforeEach(async () => {
    db = new DatabaseSync(":memory:");
    const port: SqliteConnection = {
      execute: async (sql) => {
        db.exec(sql);
      },
      query: async (sql, values = []) => db.prepare(sql).all(...values),
      run: async (sql, values = []) => {
        db.prepare(sql).run(...values);
      },
      close: () => db.close(),
    };
    store = new SqliteStorage(port);
    await store.initialize();
    repo = new ProjectRepository(store, () => testTime);
  });
  afterEach(() => store.close());
  it('backs up the original scientific payload before the first migrated write', async () => {
    const p = await repo.create('legacy-science', 'Before revision');
    delete p.science;
    const original = JSON.stringify(p);
    await store.change(p.id, record => ({ record: { ...record!, history: [{ revision: p.revision, document: original }] }, value: undefined }));
    const migrated = await repo.read(p.id);
    expect(migrated.project?.science?.schemaVersion).toBe(1);
    expect((await store.read(p.id))!.history[0]!.document).toBe(original);
    await repo.save(migrated.project!, p.revision);
    expect((await store.read(p.id))!.originalImports).toContain(original);
    for (let i = 0; i < 4; i++) { const current = await repo.read(p.id); await repo.save(current.project!, current.storageRevision); }
    expect((await store.read(p.id))!.originalImports).toContain(original);
  });
  it('round-trips scientific UNKNOWN, field records and sources through backup/import', async () => {
    const p = productionFixture();
    const result = await repo.importJson(JSON.stringify({ format: 'tirta-project', formatVersion: 1, project: p }), 'science-import');
    const portable = JSON.parse(await repo.exportJson(result.project.id));
    expect(portable.project.science).toEqual(p.science);
    const restored = await repo.importJson(JSON.stringify(portable), 'science-restored');
    expect(restored.project.science).toEqual(p.science);
  });
  it('preserves a current review across import identity changes without laundering a stale review', async () => {
    const p=productionFixture();
    p.selectedPlan={definition:snapshotPlan(p,[], 'chosen','Pembanding'),decisionNote:'Keputusan pengguna',reviewedInputFingerprint:planningFingerprint(p)};
    const current=await repo.importJson(JSON.stringify({format:'tirta-project',formatVersion:1,project:p}),'new-identity');
    expect(current.project.selectedPlan?.reviewedInputFingerprint).toBe(planningFingerprint(current.project));
    expect(current.project.selectedPlan?.definition).toEqual(p.selectedPlan.definition);
    p.parameters[0]!.source+=' revised input';
    const stale=await repo.importJson(JSON.stringify({format:'tirta-project',formatVersion:1,project:p}),'stale-identity');
    expect(stale.project.selectedPlan?.reviewedInputFingerprint).toBe(p.selectedPlan.reviewedInputFingerprint);
    expect(stale.project.selectedPlan?.reviewedInputFingerprint).not.toBe(planningFingerprint(stale.project));
  });
  it("creates and atomically saves, rejects stale writers, retains unknown", async () => {
    const p = await repo.create("p", "Sekolah");
    expect(p.mode).toBe("real");
    const saved = await repo.save({ ...p, name: "Sekolah baru" }, 1);
    expect(saved.revision).toBe(2);
    await expect(
      repo.save({ ...p, name: "Tab lama" }, 1),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await repo.read("p")).project?.name).toBe("Sekolah baru");
    expect((await repo.read("p")).project?.parameters[0]?.value).toBeNull();
  });
  it("imports full variants and sources as a new identity, exports portable data", async () => {
    const p = productionFixture();
    const imported = await repo.importJson(
      JSON.stringify({ format: "tirta-project", formatVersion: 1, project: p }),
      "imported",
    );
    expect(imported.project.components).toHaveLength(8);
    expect(imported.project.importedFrom).toEqual({
      id: "fixture",
      revision: 1,
    });
    const text = await repo.exportJson("imported");
    expect(JSON.parse(text).project.parameters).toEqual(p.parameters);
    await repo.duplicate("imported", "copy", "Salinan");
    await repo.delete("imported", 1);
    expect((await repo.list()).map((p) => p.id)).toEqual(["copy"]);
  });
  it("rejects malformed, nonfinite, newer and demo-laundered imports without writes", async () => {
    for (const text of [
      "{",
      '{"schemaVersion":99}',
      JSON.stringify({
        format: "tirta-project",
        formatVersion: 2,
        project: productionFixture(),
      }),
    ])
      await expect(repo.importJson(text, "bad")).rejects.toBeInstanceOf(Error);
    expect(await repo.list()).toEqual([]);
    const p = productionFixture();
    p.parameters[0]!.evidence = "DEMO";
    await expect(
      repo.importJson(
        JSON.stringify({
          format: "tirta-project",
          formatVersion: 1,
          project: p,
        }),
        "bad",
      ),
    ).rejects.toBeInstanceOf(Error);
    expect(await repo.list()).toEqual([]);
  });
  it("keeps latest plus two previous valid revisions and explicitly recovers last good", async () => {
    let p = await repo.create("p", "Satu");
    for (const name of ["Dua", "Tiga", "Empat"])
      p = await repo.save({ ...p, name }, p.revision);
    const stored = await store.read("p");
    expect(stored?.history).toHaveLength(3);
    await store.change("p", (current) => ({
      record: {
        ...current!,
        history: [
          { revision: 4, document: "{broken" },
          ...current!.history.slice(1),
        ],
      },
      value: null,
    }));
    const read = await repo.read("p");
    expect(read.recovered).toBe(true);
    expect(read.project?.name).toBe("Tiga");
    expect((await store.read("p"))?.history[0]?.document).toBe("{broken");
    const recovered = await repo.recover("p", 4);
    expect(recovered.revision).toBe(5);
    expect(recovered.name).toBe("Tiga");
  });
  it("rolls back a database failure and prevents partial replacement", async () => {
    await repo.create("p", "Satu");
    db.exec(
      "CREATE TRIGGER reject_save BEFORE UPDATE ON projects BEGIN SELECT RAISE(ABORT,'test interruption'); END;",
    );
    await expect(
      repo.save({ ...createProjectV2("p", "Dua", testTime) }, 1),
    ).rejects.toMatchObject({ code: "STORAGE_FAILED" });
    expect((await repo.read("p")).project?.name).toBe("Satu");
  });
  it("rejects stale deletion without removing the project or another project", async () => {
    const first = await repo.create("delete-cas", "Lahan yang sama");
    await repo.create("keep", "Lahan yang sama");
    await repo.save({ ...first, name: "Diperbarui di tab lain" }, first.revision);
    await expect(repo.delete(first.id, first.revision)).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await repo.read(first.id)).project?.name).toBe("Diperbarui di tab lain");
    expect((await repo.read("keep")).project?.name).toBe("Lahan yang sama");
  });
  it("validates durable settings and selected project resume", async () => {
    await repo.create("p", "Sekolah");
    await repo.select("p");
    await repo.setPreferences({
      schemaVersion: 1,
      contextualGuidance: false,
      lastGuideTopic: "unknown",
    });
    expect(await repo.selectedId()).toBe("p");
    expect((await repo.preferences()).contextualGuidance).toBe(false);
    await repo.delete("p", 1);
    expect(await repo.selectedId()).toBeNull();
  });
  it("reopens a durable SQLite file with project and selection intact", async () => {
    const directory = resolve("tmp");
    mkdirSync(directory, { recursive: true });
    const file = resolve(directory, `tirta-storage-${crypto.randomUUID()}.db`);
    const connect = () => {
      const database = new DatabaseSync(file);
      return new SqliteStorage({
        execute: async (sql) => {
          database.exec(sql);
        },
        query: async (sql, values = []) => database.prepare(sql).all(...values),
        run: async (sql, values = []) => {
          database.prepare(sql).run(...values);
        },
        close: () => database.close(),
      });
    };
    const first = connect();
    await first.initialize();
    const repository = new ProjectRepository(first, () => testTime);
    await repository.create("disk", "Tersimpan di disk");
    await repository.select("disk");
    await first.close();
    const reopened = connect();
    await reopened.initialize();
    const next = new ProjectRepository(reopened, () => testTime);
    expect((await next.read("disk")).project?.name).toBe("Tersimpan di disk");
    expect(await next.selectedId()).toBe("disk");
    await reopened.close();
    unlinkSync(file);
  });
  it("does not roll a newer project back into an older schema", async () => {
    const p = await repo.create("future", "Ancien");
    await repo.save({ ...p, name: "Version future" }, 1);
    await store.change("future", (r) => ({
      record: {
        ...r!,
        history: [
          {
            revision: 2,
            document: JSON.stringify({ ...p, revision: 2, schemaVersion: 99 }),
          },
          ...r!.history.slice(1),
        ],
      },
      value: null,
    }));
    await expect(repo.read("future")).rejects.toMatchObject({
      code: "UNSUPPORTED_VERSION",
    });
    await expect(repo.recover("future", 2)).rejects.toMatchObject({
      code: "UNSUPPORTED_VERSION",
    });
    expect((await store.read("future"))!.revision).toBe(2);
  });
  it("commits attachments only with verified bytes and preserves historical versions", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const p = createProjectV2("image", "Sketsa referensi", testTime);
    p.attachments = [
      {
        id: "underlay",
        purpose: "underlay",
        mediaType: "image/png",
        byteLength: bytes.length,
        sha256: await sha256(bytes),
        width: 1,
        height: 1,
        source: "Fixture bytes; staging test only",
      },
    ];
    p.underlay = {
      attachmentId: "underlay",
      x: 0,
      y: 0,
      scale: 1,
      opacity: 0.5,
      locked: true,
      context: "schematic",
    };
    await expect(
      repo.save(p, null, [{ id: "underlay", bytes: new Uint8Array([1]) }]),
    ).rejects.toMatchObject({ code: "ATTACHMENT_INVALID" });
    expect(await repo.list()).toEqual([]);
    const saved = await repo.save(p, null, [{ id: "underlay", bytes }]);
    const wrong = structuredClone(saved);
    wrong.attachments[0]!.sha256 = "f".repeat(64);
    await expect(repo.save(wrong, 1)).rejects.toMatchObject({
      code: "ATTACHMENT_INVALID",
    });
    expect(
      (await repo.duplicate("image", "copy", "Referensi salinan")).attachments,
    ).toEqual(p.attachments);
    const imported = await repo.importJson(
      await repo.exportJson("image"),
      "with-image",
    );
    expect(imported.warnings).toHaveLength(0);
    expect(imported.project.underlay).toEqual(p.underlay);
    expect(await repo.attachment('with-image', 'underlay')).toEqual(bytes);
    const old = await repo.importJson(JSON.stringify({format:'tirta-project',formatVersion:1,project:p}),'legacy-without-image');
    expect(old.warnings).toHaveLength(1);
    expect(old.project.underlay).toBeNull();
    const damaged = JSON.parse(await repo.exportJson('image'));
    damaged.attachmentData[p.attachments[0]!.sha256] = btoa('corrupt');
    const before = await repo.list();
    await expect(repo.importJson(JSON.stringify(damaged),'broken-image')).rejects.toMatchObject({code:'INVALID_IMPORT'});
    for (const payload of [
      {...damaged,attachmentData:{}},
      {...damaged,attachmentData:{...damaged.attachmentData,['0'.repeat(64)]:btoa('extra')}},
      {...damaged,formatVersion:99},
      {...damaged,unexpectedField:true},
    ]) await expect(repo.importJson(JSON.stringify(payload),'invalid-envelope')).rejects.toMatchObject({code:'INVALID_IMPORT'});
    expect(await repo.list()).toEqual(before);
  });
  it("one corrupt project does not hide healthy projects", async () => {
    await repo.create("good", "Proyek valid");
    await repo.create("bad", "Rusak");
    await store.change("bad", (r) => ({
      record: { ...r!, history: [{ revision: 1, document: "bad" }] },
      value: null,
    }));
    expect((await repo.list()).find((x) => x.id === "good")?.name).toBe(
      "Proyek valid",
    );
    expect((await repo.read("bad")).project).toBeNull();
  });
  it("isolates malformed SQL payloads and exports their original bytes", async () => {
    await repo.create("good", "Proyek sehat");
    await repo.create("broken", "Rusak");
    db.prepare("UPDATE projects SET payload=? WHERE id=?").run(
      "{broken",
      "broken",
    );
    expect((await repo.list()).some((x) => x.name === "Proyek sehat")).toBe(
      true,
    );
    expect((await repo.read("broken")).project).toBeNull();
    expect(await repo.exportRaw("broken")).toBe("{broken");
  });
  it("salvages valid documents from broken metadata only through explicit recovery", async () => {
    await repo.create("metadata", "Sumber tetap ada");
    const raw = JSON.parse((await store.readRaw("metadata"))!);
    delete raw.originalImports;
    db.prepare("UPDATE projects SET payload=? WHERE id=?").run(
      JSON.stringify(raw),
      "metadata",
    );
    const read = await repo.read("metadata");
    expect(read.recovered).toBe(true);
    expect(read.project?.name).toBe("Sumber tetap ada");
    expect(await repo.exportRaw("metadata")).toBe(JSON.stringify(raw));
    await repo.recover("metadata", 1);
    expect((await repo.read("metadata")).recovered).toBe(false);
  });
  it("exports a supported near-limit project that its importer accepts", async () => {
    const p = createProjectV2("large", "Berkas besar", testTime);
    for (let i = 0; i < 4800; i++)
      p.parameters.push({
        id: `p-${i}`,
        revision: 1,
        value: null,
        unit: "m2",
        evidence: "UNKNOWN",
        source: "",
        note: "x".repeat(1920),
        applicability: "",
      });
    await repo.save(p, null);
    const text = await repo.exportJson("large");
    const imported = await repo.importJson(text, "large-copy");
    expect(imported.project.parameters).toHaveLength(4804);
  });
  it("collects superseded attachment bytes while preserving three recoverable revisions", async () => {
    let p = createProjectV2("images", "Referensi berganti", testTime);
    for (let i = 0; i < 6; i++) {
      const bytes = new Uint8Array([i + 1]);
      p.attachments = [
        {
          id: "underlay",
          purpose: "underlay",
          mediaType: "image/png",
          byteLength: 1,
          sha256: await sha256(bytes),
          width: 1,
          height: 1,
          source: "Test only, not a decoded image",
        },
      ];
      p = await repo.save(p, i === 0 ? null : p.revision, [
        { id: "underlay", bytes },
      ]);
    }
    expect(Object.keys((await store.read("images"))!.attachments)).toHaveLength(
      3,
    );
  });
  it("detects broken older history and recovers while retaining the valid latest data", async () => {
    const p = await repo.create("history", "Pertama");
    await repo.save({ ...p, name: "Terbaru" }, 1);
    await store.change("history", (r) => ({
      record: {
        ...r!,
        history: [r!.history[0]!, { revision: 1, document: "{broken" }],
      },
      value: null,
    }));
    const read = await repo.read("history");
    expect(read.recovered).toBe(true);
    expect(read.project?.name).toBe("Terbaru");
    await expect(
      repo.save({ ...read.project!, name: "Tidak boleh diam-diam" }, 2),
    ).rejects.toMatchObject({ code: "CORRUPT" });
    const recovered = await repo.recover("history", 2);
    expect(recovered.name).toBe("Terbaru");
    expect(
      (await repo.save({ ...recovered, name: "Lanjut" }, 3)).revision,
    ).toBe(4);
  });
});
