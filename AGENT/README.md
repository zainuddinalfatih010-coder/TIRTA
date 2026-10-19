TIRTA DEVELOPMENT MAP
=====================

ACTIVE WORKSPACES
- E:\TIRTA\LIVE    = canonical web/Cloudflare source.
- E:\TIRTA\NATIVE  = canonical Android/native source; APK-only changes live here.
- E:\TIRTA\RELEASE = final share-ready TIRTA.apk and TIRTA.exe only.

REFERENCE ONLY
- E:\TIRTA\REFERENCE = proposal/guidebook/golden/legacy design references. Never develop here.
- E:\TIRTA\MEDIA     = demo/opening/video material.

CURRENT DEVELOPMENT NOTES
- E:\TIRTA\AGENT\CURRENT = only the small set of notes worth carrying forward.

RULES
1. Do not create new TIRTA clones at drive root.
2. QA screenshots/reports/traces belong to ignored temporary output and may be deleted after verification.
3. Keep e2e test source plus playwright.config.ts, playwright.production.config.ts, and playwright.scientific.config.ts.
4. Web fixes go to LIVE. Android-only fixes go to NATIVE.
5. Final deliverables are copied only to RELEASE.
6. Read E:\TIRTA\README_FIRST.txt before structural changes.