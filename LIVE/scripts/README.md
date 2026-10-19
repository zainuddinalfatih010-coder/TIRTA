# TIRTA development scripts

Only reusable development utilities live here. Generated screenshots/review artifacts do not belong in source control.

- `build-evidence-catalog.py` — rebuilds `src/domain/evidenceCatalog.ts` and the scientific evidence matrix from verified Crossref data.
- `verify-scientific-sources.py` — refreshes Crossref metadata used by the scientific evidence workflow.
- `production-preview.mjs` — runs a fresh production build and opens Vite preview on port 4173.
- `tirta-preview-runtime.mjs` — preview runtime used by the public-preview launcher.
- `start-tirta-public-preview.ps1` — optional local/public preview launcher; not required for normal build or deploy.

Do not add one-off QA screenshot scripts here. Put temporary QA code under ignored `tmp/` and delete it after verification.