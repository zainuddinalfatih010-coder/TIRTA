# Migration and rollback

Protected live roots remain untouched. Initial isolated Git checkpoint361004f captures copied live source. Protected file hashes are in protected-source-hashes.json.

Migration is deterministic and read-only until the existing save transaction. Version2 without science gets an explicit unknown extension and legacy component review markers. Area, C, depth, geometry, components and old parameter evidence remain exactly unchanged. No capacity/site data is synthesized. Frozen baseline-fixture.json verifies exact output parity.

On first migrated write the original pre-extension document is retained in originalImports before history can rotate. Existing optimistic revision checks remain; if the original-import archive is full, the save is blocked with an explicit backup action rather than overwriting an archive. Existing backup/import wrapper, source data, attachments and recovery stay in use. Science/photos are serialized in the same project; the existing10MiB portable cap remains. Photo UI accepts raster files≤2MiB; full backups preserve them, text reports reference them without embedding binaries.

Future scientific extension versions are not downgraded. Invalid units, graph endpoints, contradictory routes and cycles are rejected. Explicit zone deletion removes its context/routes and marks deleted overflow/route destinations unknown; this is a consequence of the user's delete command, never silent repair on import.

Rollback: stop candidate preview, checkout the baseline checkpoint in this isolated repository only. Do not replace the live build or write migrated projects into an older application. Keep original backups for owner review. Releasing the migration requires human scientific review and a separate release decision; this task never modifies the published origin.
