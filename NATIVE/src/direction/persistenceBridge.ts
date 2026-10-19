import { ProjectRepository } from "../persistence/ProjectRepository";
import { IndexedDbStorage } from "../persistence/indexedDb";
let connection: Promise<{ storage: IndexedDbStorage; repository: ProjectRepository }> | null = null;
export function openGoldenPersistence() {
  connection ??= IndexedDbStorage.open("tirta-friday-rescue").then(storage => ({
    storage, repository: new ProjectRepository(storage),
  })).catch(error => { connection = null; throw error; });
  return connection;
}
