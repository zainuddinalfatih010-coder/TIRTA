import type { Outcome, Parameter, ParameterRef, Project, Unit } from "./model";
import { parameterSchema, projectSchema } from "./model";

export function parseProject(input: unknown): Outcome<Project> {
  const parsed = projectSchema.safeParse(input);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : {
        ok: false,
        issues: parsed.error.issues.map((issue) => ({
          code: "invalid_project",
          path: issue.path.join("."),
          message: issue.message,
        })),
      };
}
export function numericInput(text: string): Outcome<number | null> {
  if (!text.trim()) return { ok: true, value: null };
  const normalized = text.trim().replace(",", ".");
  const value = Number(normalized);
  if (!/^\d+(\.\d+)?$/.test(normalized) || !Number.isFinite(value) || value < 0)
    return {
      ok: false,
      issues: [
        {
          code: "invalid_number",
          path: "",
          message:
            "Masukkan angka nol atau positif. Gunakan koma atau titik untuk desimal.",
        },
      ],
    };
  return { ok: true, value };
}
export function resolveParameter(
  project: Project,
  reference: ParameterRef,
  unit: Unit,
  path: string,
): Outcome<Parameter & { value: number }> {
  const fail = (code: string, message: string): Outcome<never> => ({
    ok: false,
    issues: [{ code, path, message }],
  });
  const record = project.parameters.find((p) => p.id === reference.id);
  if (!record)
    return fail(
      "missing_source",
      "Catatan sumber belum ditemukan. Lengkapi sumber angka ini.",
    );
  if (!parameterSchema.safeParse(record).success)
    return fail(
      "invalid_parameter",
      "Nilai atau status parameter tidak valid.",
    );
  if (reference.unit !== unit || record.unit !== unit)
    return fail(
      "unit_mismatch",
      "Satuan angka dan sumber berbeda. Periksa kembali satuannya.",
    );
  if (reference.evidence !== record.evidence)
    return fail(
      "evidence_mismatch",
      "Status angka berbeda dengan catatan sumbernya. Periksa sumber angka.",
    );
  if (record.value === null)
    return fail(
      "unknown",
      "Data ini belum tersedia. Isi nilai yang diketahui atau buat asumsi eksplisit.",
    );
  if (record.evidence === "ASSIST_SUGGESTION")
    return fail(
      "unconfirmed",
      "Saran Asisten Permukaan bukan parameter perhitungan terkonfirmasi.",
    );
  if (!record.source.trim())
    return fail(
      "missing_source",
      "Tuliskan sumber atau alasan penggunaan angka ini.",
    );
  return { ok: true, value: { ...record, value: record.value } };
}
