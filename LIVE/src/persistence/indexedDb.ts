import {
  type ProjectStorage,
  type StoredProject,
  type StorageMutation,
  storageError,
} from "./storage";
export class IndexedDbStorage implements ProjectStorage {
  constructor(private db: IDBDatabase) {
    db.onversionchange = () => db.close();
  }
  static open(
    name = "tirta-production",
    factory: IDBFactory = indexedDB,
  ): Promise<IndexedDbStorage> {
    return new Promise((resolve, reject) => {
      const request = factory.open(name, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("projects", { keyPath: "id" });
        db.createObjectStore("settings");
      };
      request.onerror = () => reject(storageError(request.error));
      request.onblocked = () =>
        reject(
          new Error(
            "Tutup tab TIRTA lain, lalu buka ulang untuk memperbarui penyimpanan.",
          ),
        );
      request.onsuccess = () => resolve(new IndexedDbStorage(request.result));
    });
  }
  private readRequest<T>(store: string, key?: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, "readonly"),
        object = tx.objectStore(store),
        req = key === undefined ? object.getAll() : object.get(key);
      req.onerror = () => reject(storageError(req.error));
      tx.onabort = () => reject(storageError(tx.error));
      tx.oncomplete = () => resolve(req.result as T);
    });
  }
  async read(id: string) {
    return (
      (await this.readRequest<StoredProject | undefined>("projects", id)) ??
      null
    );
  }
  async listIds() {
    return (await this.readRequest<StoredProject[]>("projects")).map(
      (p) => p.id,
    );
  }
  async readRaw(id: string) {
    const value = await this.readRequest<unknown>("projects", id);
    return value === undefined ? null : JSON.stringify(value);
  }
  change<T>(
    id: string,
    edit: (current: StoredProject | null) => StorageMutation<T>,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("projects", "readwrite"),
        store = tx.objectStore("projects"),
        req = store.get(id);
      let value: T, cause: unknown;
      req.onsuccess = () => {
        try {
          const mutation = edit(req.result ?? null);
          value = mutation.value;
          if (mutation.record) store.put(mutation.record);
          else store.delete(id);
        } catch (error) {
          cause = error;
          try {
            tx.abort();
          } catch {
            reject(storageError(cause));
          }
        }
      };
      tx.oncomplete = () => resolve(value);
      tx.onabort = () => reject(storageError(cause ?? tx.error));
      tx.onerror = () => {
        cause ??= tx.error;
      };
    });
  }
  readSetting(key: string) {
    return this.readRequest<unknown>("settings", key);
  }
  writeSetting(key: string, value: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("settings", "readwrite");
      tx.objectStore("settings").put(value, key);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(storageError(tx.error));
    });
  }
  close() {
    this.db.close();
  }
}
