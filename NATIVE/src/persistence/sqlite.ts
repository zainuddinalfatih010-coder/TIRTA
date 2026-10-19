import {
  type ProjectStorage,
  type StoredProject,
  type StorageMutation,
  storageError,
} from "./storage";
export interface SqliteConnection {
  execute(sql: string): Promise<void>;
  query(sql: string, values?: string[]): Promise<unknown[]>;
  run(sql: string, values?: string[]): Promise<void>;
  close(): void | Promise<void>;
}
/** Native bridge supplies an opened connection; SQL is also exercised against real SQLite in tests. */
export class SqliteStorage implements ProjectStorage {
  private pending: Promise<unknown> = Promise.resolve();
  constructor(private connection: SqliteConnection) {}
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const task = this.pending.then(work, work);
    this.pending = task.catch(() => undefined);
    return task;
  }
  async initialize() {
    const rows = await this.connection.query("PRAGMA user_version");
    const row = rows[0];
    if (
      row &&
      typeof row === "object" &&
      "user_version" in row &&
      Number(row.user_version) > 1
    )
      throw new Error("UNSUPPORTED_VERSION: database lebih baru.");
    await this.connection.execute(
      "BEGIN IMMEDIATE; CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY, payload TEXT NOT NULL); PRAGMA user_version = 1; COMMIT;",
    );
  }
  private async get(id: string): Promise<StoredProject | null> {
    const rows = await this.connection.query(
      "SELECT payload FROM projects WHERE id = ?",
      [id],
    );
    const row = rows[0];
    return row &&
      typeof row === "object" &&
      "payload" in row &&
      typeof row.payload === "string"
      ? JSON.parse(row.payload)
      : null;
  }
  read(id: string) {
    return this.serial(() => this.get(id));
  }
  listIds() {
    return this.serial(async () => {
      const rows = await this.connection.query(
        "SELECT id FROM projects ORDER BY id",
      );
      return rows.map((row) => {
        if (
          !row ||
          typeof row !== "object" ||
          !("id" in row) ||
          typeof row.id !== "string"
        )
          throw new Error("CORRUPT");
        return row.id;
      });
    });
  }
  readRaw(id: string) {
    return this.serial(async () => {
      const rows = await this.connection.query(
        "SELECT payload FROM projects WHERE id = ?",
        [id],
      );
      const row = rows[0];
      return row &&
        typeof row === "object" &&
        "payload" in row &&
        typeof row.payload === "string"
        ? row.payload
        : null;
    });
  }
  change<T>(
    id: string,
    edit: (current: StoredProject | null) => StorageMutation<T>,
  ): Promise<T> {
    return this.serial(async () => {
      await this.connection.execute("BEGIN IMMEDIATE");
      try {
        const mutation = edit(await this.get(id));
        if (mutation.record)
          await this.connection.run(
            "INSERT INTO projects (id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
            [id, JSON.stringify(mutation.record)],
          );
        else
          await this.connection.run("DELETE FROM projects WHERE id = ?", [id]);
        await this.connection.execute("COMMIT");
        return mutation.value;
      } catch (error) {
        await this.connection.execute("ROLLBACK");
        throw storageError(error);
      }
    });
  }
  readSetting(key: string) {
    return this.serial(async () => {
      const rows = await this.connection.query(
        "SELECT payload FROM settings WHERE id = ?",
        [key],
      );
      const row = rows[0];
      return row &&
        typeof row === "object" &&
        "payload" in row &&
        typeof row.payload === "string"
        ? JSON.parse(row.payload)
        : null;
    });
  }
  writeSetting(key: string, value: unknown) {
    return this.serial(() =>
      this.connection.run(
        "INSERT INTO settings (id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
        [key, JSON.stringify(value)],
      ),
    );
  }
  async close() {
    await this.pending;
    await this.connection.close();
  }
}
