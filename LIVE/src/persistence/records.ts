import { migrateProject } from "../domain/migration";
import { z } from "zod";
import { projectV2Schema, type ProjectV2 } from "../domain/projectV2";
import { type StoredProject, RepositoryError } from "./storage";
const historySchema = z
  .array(
    z.strictObject({
      revision: z.number().int().positive(),
      document: z.string(),
    }),
  )
  .min(1)
  .max(3);
const envelopeSchema = z.strictObject({
  id: z.string(),
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  history: historySchema,
  attachments: z.record(z.string(), z.string()),
  originalImports: z.array(z.string()).max(4),
});
export type ProjectRead = {
  project: ProjectV2 | null;
  storageRevision: number;
  recovered: boolean;
  invalidRevisions: number[];
  raw: string;
};
export function validateRecord(input: unknown): StoredProject {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success)
    throw new RepositoryError(
      "CORRUPT",
      "Struktur penyimpanan proyek rusak. Pulihkan revisi valid atau gunakan cadangan.",
    );
  return parsed.data;
}
/** Metadata salvage never writes. The caller must request explicit recovery before a new revision. */
export function salvageRecord(input: unknown): StoredProject | null {
  const parsed = z
    .object({
      id: z.string(),
      revision: z.number().int().positive(),
      history: historySchema,
    })
    .safeParse(input);
  if (!parsed.success) return null;
  const object = input as Record<string, unknown>;
  const attachments = z
      .record(z.string(), z.string())
      .safeParse(object.attachments),
    originals = z.array(z.string()).max(4).safeParse(object.originalImports);
  return {
    ...parsed.data,
    attachments: attachments.success ? attachments.data : {},
    originalImports: originals.success ? originals.data : [],
  };
}
export function inspectRecord(
  input: unknown,
  raw = JSON.stringify(input),
  expectedId?: string,
): ProjectRead {
  const exact = envelopeSchema.safeParse(input),
    record = exact.success ? exact.data : salvageRecord(input),
    invalidRevisions: number[] = [];
  const empty: ProjectRead = {
    project: null,
    storageRevision: record?.revision ?? 0,
    recovered: false,
    invalidRevisions,
    raw,
  };
  if (!record || (expectedId && record.id !== expectedId)) return empty;
  let newest: ProjectV2 | null = null;
  for (const saved of record.history) {
    try {
      const value: unknown = JSON.parse(saved.document);
      if (
        value &&
        typeof value === "object" &&
        "schemaVersion" in value &&
        typeof value.schemaVersion === "number" &&
        value.schemaVersion > 2
      )
        throw new RepositoryError(
          "UNSUPPORTED_VERSION",
          "Proyek ini memerlukan versi TIRTA yang lebih baru. Data tidak diturunkan versinya.",
        );
      if (value && typeof value === "object" && "science" in value && value.science && typeof value.science === "object" && "schemaVersion" in value.science && typeof value.science.schemaVersion === "number" && value.science.schemaVersion > 1)
        throw new RepositoryError("UNSUPPORTED_VERSION", "Data ilmiah memerlukan versi TIRTA lebih baru; data tidak diturunkan versinya.");
      const p = migrateProject(value, "1970-01-01T00:00:00.000Z");
      if (
        p.id !== record.id ||
        p.revision !== saved.revision ||
        saved.revision > record.revision
      )
        throw new Error("identity");
      if (!newest || p.revision > newest.revision) newest = p;
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      invalidRevisions.push(saved.revision);
    }
  }
  return newest
    ? {
        project: newest,
        storageRevision: record.revision,
        recovered:
          !exact.success ||
          invalidRevisions.length > 0 ||
          record.revision !== newest.revision,
        invalidRevisions,
        raw,
      }
    : empty;
}
export function retainedAttachmentBytes(
  history: StoredProject["history"],
  bytes: StoredProject["attachments"],
): StoredProject["attachments"] {
  const required = new Set<string>();
  for (const h of history) {
    const p = projectV2Schema.parse(JSON.parse(h.document));
    p.attachments.forEach((a) => required.add(a.sha256));
  }
  return Object.fromEntries(
    Object.entries(bytes).filter(([hash]) => required.has(hash)),
  );
}
