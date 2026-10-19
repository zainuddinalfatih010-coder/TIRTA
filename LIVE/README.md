# TIRTA Ã¢â‚¬â€ approved demo, backed by production state

The canonical app is `/` or `/production.html`. Both run the approved seven-area experience. New projects start empty; Buka Contoh explicitly creates a separate synthetic project. Concept prototypes remain historical development artifacts and are not the canonical product.

```powershell
npm install
npm run dev
# http://127.0.0.1:5173/production.html
```

For offline support use the built app. Open it once online so its local service worker can install, then core work and reload are available offline. Data stays in this browser/origin; download a .tirta.json backup to move between origins.

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run preview -- --port 4273
# In a second terminal:
$env:TIRTA_RESCUE_URL='http://127.0.0.1:4273'
npx playwright test -c playwright.production.config.ts
```

The dedicated browser suite exercises the approved app, rather than obsolete prototype selectors in earlier suites. `scripts/review-approved-demo.js` captures the running read-only demo copy at 5274 and production preview at 4273. Visual review history remains under `.design/approved-demo-production/` and `evidence/decorative-production/`; those folder names are historical only and are not runtime authorities.

Science: declared dimensions establish local metric geometry, not surveyed coordinates. UNKNOWN remains unknown. Surface class never autofills engineering coefficients. Image processing is a deterministic color-region observation, not a trained semantic model; the user confirms/corrects it. Rainfall and intervention capacity must be supplied for each scenario. The optimizer returns trade-offs without a weighted BEST. Output is for pre-planning only.
