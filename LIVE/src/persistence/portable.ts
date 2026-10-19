import { projectV2Schema, type ProjectV2 } from "../domain/projectV2";
import { RepositoryError } from "./storage";
export const PROJECT_JSON_LIMIT = 10 * 1024 * 1024;
/** Save and export share the exact portable representation and byte guard. */
export function projectBackup(project: ProjectV2): string {
  const text = JSON.stringify({
    format: "tirta-project",
    formatVersion: 1,
    project: projectV2Schema.parse(project),
  });
  if (new TextEncoder().encode(text).byteLength > PROJECT_JSON_LIMIT)
    throw new RepositoryError(
      "INVALID_IMPORT",
      "Proyek melebihi batas cadangan JSON 10 MiB.",
    );
  return text;
}
