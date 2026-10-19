import {importNavigatorJourney} from '../domain/navigatorJourney';
import {NavigatorJourneyRepository} from './NavigatorJourneyRepository';
import { z } from "zod";
import {
  createProjectV2,
  projectV2Schema,
  preferencesSchema,
  type Preferences,
  type ProjectV2,
} from "../domain/projectV2";
import { migrateProject } from "../domain/migration";
import { planningFingerprint } from '../domain/planningEngine';
import { type ProjectStorage, RepositoryError, storageError } from "./storage";

import {
  inspectRecord,
  validateRecord,
  salvageRecord,
  retainedAttachmentBytes,
  type ProjectRead,
} from "./records";
import { projectBackup, PROJECT_JSON_LIMIT } from "./portable";
export type { ProjectRead } from "./records";
export type ProjectSummary = {
  id: string;
  name: string;
  mode: "real" | "demo" | null;
  revision: number;
  updatedAt: string | null;
  zoneCount: number;
  recovery: boolean;
};

export type AttachmentData = { id: string; bytes: Uint8Array };
function base64(bytes: Uint8Array): string {
  let text = "";
  for (const b of bytes) text += String.fromCharCode(b);
  return btoa(text);
}
export async function sha256(bytes: Uint8Array): Promise<string> {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export class ProjectRepository {
  constructor(
    private storage: ProjectStorage,
    private now: () => string = () => new Date().toISOString(),
  ) {}
  async list(): Promise<ProjectSummary[]> {
    const result: ProjectSummary[] = [];
    for (const id of await this.storage.listIds()) {
      try {
        const r = await this.read(id);
        result.push({
          id,
          name: r.project?.name ?? "Proyek perlu pemulihan",
          mode: r.project?.mode ?? null,
          revision: r.storageRevision,
          updatedAt: r.project?.updatedAt ?? null,
          zoneCount: r.project?.zones.length ?? 0,
          recovery: r.recovered || r.project === null,
        });
      } catch (error) {
        if (
          error instanceof RepositoryError &&
          error.code === "UNSUPPORTED_VERSION"
        )
          result.push({
            id,
            name: "Proyek dari versi TIRTA lebih baru",
            mode: null,
            revision: 0,
            updatedAt: null,
            zoneCount: 0,
            recovery: true,
          });
        else throw error;
      }
    }
    return result.sort(
      (a, b) =>
        (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") ||
        a.id.localeCompare(b.id),
    );
  }
  async read(id: string): Promise<ProjectRead> {
    const raw = await this.storage.readRaw(id);
    if (raw === null)
      throw new RepositoryError(
        "NOT_FOUND",
        "Proyek tidak ditemukan. Muat ulang daftar proyek.",
      );
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      return {
        project: null,
        storageRevision: 0,
        recovered: false,
        invalidRevisions: [],
        raw,
      };
    }
    return inspectRecord(value, raw, id);
  }
  async attachment(
    projectId: string,
    attachmentId: string,
  ): Promise<Uint8Array | null> {
    const project = (await this.read(projectId)).project;
    const metadata = project?.attachments.find((a) => a.id === attachmentId);
    if (!metadata) return null;
    const record = validateRecord(await this.storage.read(projectId));
    const encoded = record.attachments[metadata.sha256];
    if (!encoded) return null;
    const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    if (
      bytes.length !== metadata.byteLength ||
      (await sha256(bytes)) !== metadata.sha256
    )
      throw new RepositoryError(
        "CORRUPT",
        "Gambar referensi rusak; data perhitungan tetap dapat digunakan.",
      );
    return bytes;
  }
  async create(id: string, name: string) {
    const p = createProjectV2(id, name, this.now());
    return this.save(p, null);
  }
  async save(
    input: ProjectV2,
    expectedRevision: number | null,
    attachments: AttachmentData[] = [],
  ): Promise<ProjectV2> {
    const parsed = projectV2Schema.safeParse(input);
    if (!parsed.success)
      throw new RepositoryError(
        "INVALID_IMPORT",
        "Perubahan belum dapat disimpan. Periksa nama, data, geometri, dan catatan sumber; pekerjaan tetap ada di halaman ini.",
      );
    const p = parsed.data,
      staged: Record<string, string> = {};
    for (const attachment of attachments) {
      const metadata = p.attachments.find((a) => a.id === attachment.id);
      if (
        !metadata ||
        metadata.byteLength !== attachment.bytes.length ||
        metadata.sha256 !== (await sha256(attachment.bytes))
      )
        throw new RepositoryError(
          "ATTACHMENT_INVALID",
          "Gambar referensi tidak cocok dengan ukuran atau checksum.",
        );
      staged[metadata.sha256] = base64(attachment.bytes);
    }
    try {
      return await this.storage.change(p.id, (current) => {
        if (current) validateRecord(current);
        if ((current?.revision ?? null) !== expectedRevision)
          throw new RepositoryError(
            "CONFLICT",
            "Proyek berubah di tab lain. Muat versi tersimpan atau simpan pekerjaan sebagai salinan.",
          );
        const previous = current ? inspectRecord(current) : null;
        if (previous && (previous.recovered || previous.project === null))
          throw new RepositoryError(
            "CORRUPT",
            "Pulihkan revisi terakhir yang valid sebelum menyimpan.",
          );
        const revision = (current?.revision ?? 0) + 1;
        const project = projectV2Schema.parse({
          ...p,
          revision,
          updatedAt: this.now(),
        });
        const document = JSON.stringify(project);
        projectBackup(project);
        const bytes = { ...current?.attachments, ...staged };
        for (const m of project.attachments)
          if (!Object.hasOwn(bytes, m.sha256))
            throw new RepositoryError(
              "ATTACHMENT_INVALID",
              "Gambar referensi belum tersedia. Tambahkan gambar atau hapus referensinya secara eksplisit.",
            );
        const history = [
          { revision, document },
          ...(current?.history ?? []),
        ].slice(0, 3);
        return {
          record: {
            id: p.id,
            revision,
            history,
            attachments: retainedAttachmentBytes(history, bytes),
            originalImports: (() => {
              const originals = [...(current?.originalImports ?? [])];
              const beforeMigration = current?.history.find(h => !JSON.parse(h.document).science)?.document;
              if (beforeMigration && !originals.includes(beforeMigration)) {
                if (originals.length >= 4) throw new RepositoryError("INVALID_IMPORT", "Simpan cadangan dan kurangi arsip impor sebelum migrasi; arsip lama tidak ditimpa.");
                originals.push(beforeMigration);
              }
              return originals;
            })(),
          },
          value: project,
        };
      });
    } catch (error) {
      throw storageError(error);
    }
  }
  async duplicate(id: string, newId: string, name: string) {
    const r = await this.read(id);
    if (!r.project)
      throw new RepositoryError(
        "CORRUPT",
        "Tidak ada revisi valid untuk disalin.",
      );
    const source = await this.storage.read(id);
    const p = projectV2Schema.parse({
      ...r.project,
      id: newId,
      name,
      revision: 1,
      createdAt: this.now(),
      updatedAt: this.now(),
      importedFrom: { id: r.project.id, revision: r.project.revision },
    });
    const attachments = p.attachments.map((a) => ({
      id: a.id,
      bytes: Uint8Array.from(atob(source!.attachments[a.sha256]!), (c) =>
        c.charCodeAt(0),
      ),
    }));
    return this.save(p, null, attachments);
  }
  async delete(id: string, expectedRevision: number) {
    await this.storage.change(id, (current) => {
      if (!current)
        throw new RepositoryError("NOT_FOUND", "Proyek tidak ditemukan.");
      if (current.revision !== expectedRevision)
        throw new RepositoryError(
          "CONFLICT",
          "Proyek berubah; muat ulang sebelum menghapus.",
        );
      return { record: null, value: undefined };
    });
  }
  async recover(id: string, expectedRevision: number) {
    return this.storage.change(id, (current) => {
      if (!current)
        throw new RepositoryError("NOT_FOUND", "Proyek tidak ditemukan.");
      if (current.revision !== expectedRevision)
        throw new RepositoryError(
          "CONFLICT",
          "Proyek berubah; muat ulang sebelum memulihkan.",
        );
      const r = inspectRecord(current);
      const salvaged = salvageRecord(current);
      if (!r.project || !salvaged)
        throw new RepositoryError(
          "CORRUPT",
          "Tidak ada revisi valid. Gunakan berkas cadangan.",
        );
      const revision = current.revision + 1,
        project = { ...r.project, revision, updatedAt: this.now() };
      const valid = salvaged.history.filter((h) => {
        try {
          const parsed = projectV2Schema.safeParse(JSON.parse(h.document));
          return (
            parsed.success &&
            parsed.data.id === id &&
            parsed.data.revision === h.revision &&
            h.revision <= current.revision
          );
        } catch {
          return false;
        }
      });
      const history = [
        { revision, document: JSON.stringify(project) },
        ...valid.sort((a, b) => b.revision - a.revision),
      ].slice(0, 3);
      projectBackup(project);
      return {
        record: {
          ...salvaged,
          revision,
          history,
          attachments: retainedAttachmentBytes(history, salvaged.attachments),
          originalImports: [
            JSON.stringify({ ...current, originalImports: [] }),
            ...salvaged.originalImports,
          ].slice(0, 4),
        },
        value: project,
      };
    });
  }
  async importJson(
    text: string,
    newId: string,
  ): Promise<{ project: ProjectV2; warnings: string[] }> {
    if (new TextEncoder().encode(text).byteLength > PROJECT_JSON_LIMIT)
      throw new RepositoryError("INVALID_IMPORT", "Berkas melebihi 10 MiB.");
    let project: ProjectV2;
    let portableJourney:unknown;
    let attachmentData: Record<string, string> = {};
    let hasPortableAttachments = false;
    try {
      const raw: unknown = JSON.parse(text);
      const wrapper = z.union([
        z.strictObject({
          format: z.literal("tirta-project"),
          formatVersion: z.literal(1),
          project: z.unknown(),
          navigatorJourney:z.unknown().optional(),
        }),
        z.strictObject({
          format: z.literal("tirta-project"),
          formatVersion: z.literal(2),
          project: z.unknown(),
          navigatorJourney:z.unknown().optional(),
          attachmentData: z.record(z.string().regex(/^[a-f0-9]{64}$/), z.string().regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)),
        }),
      ]).safeParse(raw);
      if (!wrapper.success)
        throw new Error("Gunakan berkas cadangan .tirta.json yang didukung.");
      project = migrateProject(wrapper.data.project, this.now());
      portableJourney=wrapper.data.navigatorJourney;
      if (wrapper.data.formatVersion === 2) {
        const required = new Set(project.attachments.map(a => a.sha256));
        if (Object.keys(wrapper.data.attachmentData).length !== required.size || Object.keys(wrapper.data.attachmentData).some(hash => !required.has(hash))) throw new Error('Lampiran tidak cocok.');
        for (const a of project.attachments) {
          const encoded = wrapper.data.attachmentData[a.sha256];
          if (!encoded) throw new Error('Lampiran tidak tersedia.');
          const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
          if (bytes.length !== a.byteLength || await sha256(bytes) !== a.sha256) throw new Error('Lampiran rusak.');
        }
        attachmentData = wrapper.data.attachmentData;
        hasPortableAttachments = true;
      }
    } catch (error) {
      throw new RepositoryError(
        "INVALID_IMPORT",
        `Berkas ditolak; data tersimpan tidak berubah. ${error instanceof Error && error.message.startsWith("UNSUPPORTED_VERSION") ? "Versi proyek lebih baru dari aplikasi ini." : "Periksa format, referensi, geometri dan status sumber."}`,
      );
    }
    const warnings = hasPortableAttachments ? [] : project.attachments.map(
      (a) =>
        `Referensi gambar ${a.id} tidak disertakan dalam JSON. Data ilmiah dipertahankan.`,
    );
    const p = projectV2Schema.parse({
      ...project,
      id: newId,
      revision: 1,
      createdAt: this.now(),
      updatedAt: this.now(),
      importedFrom: { id: project.id, revision: project.revision },
      attachments: hasPortableAttachments ? project.attachments : [],
      underlay: hasPortableAttachments ? project.underlay : null,
    });
    // Renaming project identity changes baseline keys, not its reviewed science.
    // Rebase only a review that matches the validated/migrated source inputs.
    if (project.selectedPlan?.reviewedInputFingerprint === planningFingerprint(project) && p.selectedPlan) {
      p.selectedPlan.reviewedInputFingerprint = planningFingerprint(p);
    }
    projectBackup(p);
    // Validation and migration finish before the one transaction that creates the imported project.
    const saved = await this.storage.change(newId, (current) => {
      if (current)
        throw new RepositoryError(
          "CONFLICT",
          "Identitas impor sudah digunakan.",
        );
      return {
        record: {
          id: newId,
          revision: 1,
          history: [{ revision: 1, document: JSON.stringify(p) }],
          attachments: attachmentData,
          originalImports: [text],
        },
        value: p,
      };
    });
    if(portableJourney!==undefined){const journey=importNavigatorJourney(portableJourney,project.id,newId);if(journey){try{await new NavigatorJourneyRepository(this.storage).write(newId,journey);if(journey.activeScenarioId&&saved.scenarios.some(s=>s.id===journey.activeScenarioId))await this.storage.writeSetting(`active-scenario:${newId}`,journey.activeScenarioId);}catch{warnings.push('Proyek diimpor; progres Navigator belum dapat dipulihkan.');}}else warnings.push('Proyek diimpor; progres Navigator tidak kompatibel dan perlu dimulai kembali.');}
    return { project: saved, warnings };
  }
  async exportJson(id: string) {
    const r = await this.read(id);
    if (!r.project || r.recovered)
      throw new RepositoryError(
        "CORRUPT",
        "Pulihkan revisi valid sebelum mengekspor proyek.",
      );
    const savedJourney=await new NavigatorJourneyRepository(this.storage).read(id),activeScenario=await this.storage.readSetting(`active-scenario:${id}`);
    const journey=savedJourney?{...savedJourney,...(typeof activeScenario==='string'&&r.project.scenarios.some(s=>s.id===activeScenario)?{activeScenarioId:activeScenario}:{})}:null;
    if (!r.project.attachments.length){const envelope=JSON.parse(projectBackup(r.project));if(journey)envelope.navigatorJourney=journey;const text=JSON.stringify(envelope);if(new TextEncoder().encode(text).byteLength>PROJECT_JSON_LIMIT)throw new RepositoryError('INVALID_IMPORT','Cadangan melebihi 10 MiB.');return text;}
    const snapshot = validateRecord(JSON.parse(r.raw));
    const data: Record<string, string> = {};
    for (const a of r.project.attachments) {
      const encoded = snapshot.attachments[a.sha256];
      if (!encoded) throw new RepositoryError('ATTACHMENT_INVALID', 'Gambar cadangan tidak tersedia; referensi tidak dihapus diam-diam.');
      const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
      if (bytes.length !== a.byteLength || await sha256(bytes) !== a.sha256) throw new RepositoryError('CORRUPT', 'Gambar cadangan rusak; ekspor dihentikan.');
      data[a.sha256] = encoded;
    }
    const text = JSON.stringify({ format:'tirta-project', formatVersion:2, project:r.project, attachmentData:data,...(journey?{navigatorJourney:journey}:{}) });
    if (new TextEncoder().encode(text).byteLength > PROJECT_JSON_LIMIT) throw new RepositoryError('INVALID_IMPORT', 'Proyek dan gambar melebihi batas cadangan 10 MiB.');
    return text;
  }
  async exportRaw(id: string) {
    const raw = await this.storage.readRaw(id);
    if (raw === null)
      throw new RepositoryError("NOT_FOUND", "Proyek tidak ditemukan.");
    return raw;
  }
  async select(id: string) {
    await this.read(id);
    await this.storage.writeSetting("selectedProjectId", id);
  }
  async selectedId(): Promise<string | null> {
    const id = await this.storage.readSetting("selectedProjectId");
    return typeof id === "string" && (await this.storage.readRaw(id))
      ? id
      : null;
  }
  async preferences(): Promise<Preferences> {
    const raw = await this.storage.readSetting("preferences");
    if (raw === undefined || raw === null)
      return {
        schemaVersion: 1,
        contextualGuidance: true,
        lastGuideTopic: null,
      };
    const parsed = preferencesSchema.safeParse(raw);
    if (!parsed.success)
      throw new RepositoryError(
        "CORRUPT",
        "Preferensi tersimpan tidak valid. Atur ulang preferensi.",
      );
    return parsed.data;
  }
  async setPreferences(value: Preferences) {
    await this.storage.writeSetting(
      "preferences",
      preferencesSchema.parse(value),
    );
  }
}
