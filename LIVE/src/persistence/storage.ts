export type StoredProject = {
  id: string;
  revision: number;
  history: { revision: number; document: string }[];
  attachments: Record<string, string>;
  originalImports: string[];
};
export type StorageMutation<T> = { record: StoredProject | null; value: T };
/** Synchronous callback is required so IndexedDB cannot auto-commit between read and write. */
export interface ProjectStorage {
  listIds(): Promise<string[]>;
  read(id: string): Promise<StoredProject | null>;
  readRaw(id: string): Promise<string | null>;
  change<T>(
    id: string,
    edit: (current: StoredProject | null) => StorageMutation<T>,
  ): Promise<T>;
  readSetting(key: string): Promise<unknown>;
  writeSetting(key: string, value: unknown): Promise<void>;
  close(): void | Promise<void>;
}
export class RepositoryError extends Error {
  constructor(
    public code:
      | "CONFLICT"
      | "NOT_FOUND"
      | "INVALID_IMPORT"
      | "UNSUPPORTED_VERSION"
      | "CORRUPT"
      | "STORAGE_FULL"
      | "STORAGE_FAILED"
      | "ATTACHMENT_INVALID",
    message: string,
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}
export function storageError(error: unknown): RepositoryError {
  if (error instanceof RepositoryError) return error;
  if (
    error instanceof Error &&
    (error.name === "QuotaExceededError" ||
      /SQLITE_FULL|database or disk is full/i.test(error.message))
  )
    return new RepositoryError(
      "STORAGE_FULL",
      "Penyimpanan penuh. Data terakhir tetap tersedia; ekspor pekerjaan lalu kosongkan ruang.",
    );
  return new RepositoryError(
    "STORAGE_FAILED",
    "Penyimpanan gagal. Coba lagi atau simpan salinan berkas pekerjaan Anda.",
  );
}
