import type { ProjectV2 } from "./projectV2";
import { checked, type Edit } from "./authoring";
import type { SaveSession } from "../persistence/SaveSession";

export class AuthoringHistory {
  private past: ProjectV2[] = [];
  private future: ProjectV2[] = [];
  constructor(private session: SaveSession) {}
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  attachmentIds() {
    return new Set(
      [this.session.snapshot().project, ...this.past, ...this.future].flatMap(
        (p) => p.attachments.map((a) => a.id),
      ),
    );
  }
  apply(edit: Edit) {
    const current = this.session.snapshot().project;
    const next = checked(edit(structuredClone(current)));
    this.past.push(current);
    if (this.past.length > 100) this.past.shift();
    this.future = [];
    this.session.update(next);
  }
  undo() {
    const p = this.past.pop();
    if (!p) return;
    this.future.push(this.session.snapshot().project);
    this.session.update(p);
  }
  redo() {
    const p = this.future.pop();
    if (!p) return;
    this.past.push(this.session.snapshot().project);
    this.session.update(p);
  }
}
