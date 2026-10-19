TIRTA - CANONICAL WORKSPACE
===========================

LIVE URL
https://tirta-c35.pages.dev/production.html

FOLDER YANG DIPAKAI
1. LIVE\
   Source web production / Cloudflare Pages.
   Deploy web HANYA dari folder ini.

2. NATIVE\
   Source Android/native terbaru.
   Mengandung patch APK-only; JANGAN deploy folder ini ke Cloudflare.

3. RELEASE\
   File final yang dibagikan:
   - TIRTA.apk
   - TIRTA.exe

4. REFERENCE\
   Proposal, guidebook, Golden reference, dan spesifikasi legacy yang masih bernilai.
   Bukan workspace aktif.

5. MEDIA\
   Demo, opening, dan material video TIRTA.

6. AGENT\
   Catatan development ringkas untuk agent/developer berikutnya.
   Bukan tempat QA screenshot atau clone proyek.

CLOUDFLARE PROJECT
Project: tirta
Production branch: main
Deploy pattern: npm run build ; npx wrangler pages deploy dist --project-name tirta --branch main

PENTING
- LIVE dan NATIVE sengaja dipisah supaya patch APK-only tidak bocor ke web/EXE.
- Jangan membuat folder TIRTA baru di root E: atau D:.
- QA screenshots, traces, test-results, dist, dan build output bersifat generated/disposable.
- Test source e2e dan config Playwright utama tetap dipertahankan.