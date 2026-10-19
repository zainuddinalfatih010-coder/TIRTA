import { type ProjectV2 } from "../domain/projectV2";
import { storageError, type RepositoryError } from "./storage";
export type SaveState = {
  project: ProjectV2;
  status: "saved" | "unsaved" | "saving" | "error";
  error: RepositoryError | null;
};
export class SaveSession {
  private state: SaveState;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private committedGeneration = 0;
  private running: Promise<void> | null = null;
  constructor(
    project: ProjectV2,
    private save: (
      p: ProjectV2,
      expectedRevision: number,
    ) => Promise<ProjectV2>,
    private delay = 500,
  ) {
    this.state = { project, status: "saved", error: null };
  }
  snapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(next: SaveState) {
    this.state = next;
    this.listeners.forEach((fn) => fn());
  }
  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.delay);
  }
  update(project: ProjectV2) {
    if (project.id !== this.state.project.id)
      throw new Error("Session project mismatch");
    this.generation++;
    this.publish({
      project: { ...project, revision: this.state.project.revision },
      status: this.running ? "saving" : "unsaved",
      error: null,
    });
    this.schedule();
  }
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.running) return this.running;
    if (this.generation === this.committedGeneration) return;
    const generation = this.generation,
      project = this.state.project;
    this.publish({ ...this.state, status: "saving", error: null });
    this.running = (async () => {
      try {
        const saved = await this.save(project, project.revision);
        this.committedGeneration = generation;
        this.publish({
          project:
            this.generation === generation
              ? saved
              : {
                  ...this.state.project,
                  revision: saved.revision,
                  updatedAt: saved.updatedAt,
                },
          status: this.generation === generation ? "saved" : "unsaved",
          error: null,
        });
        if (this.generation !== generation) this.schedule();
      } catch (error) {
        this.publish({
          ...this.state,
          status: "error",
          error: storageError(error),
        });
      }
    })();
    await this.running;
    this.running = null;
  }
  async settle() {
    while (this.generation !== this.committedGeneration) {
      await this.flush();
      if (this.state.status === "error") return false;
    }
    return true;
  }
  dispose() {
    if (this.timer) clearTimeout(this.timer);
    this.listeners.clear();
  }
}
