import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

const workerPolicyVersion = createHash("sha256").update(await readFile(new URL("./public/_headers", import.meta.url))).digest("hex").slice(0, 8);

export default defineConfig({
  // Immutable worker responses retain their CSP. A policy update must also
  // change the worker URL, even when its JavaScript is otherwise identical.
  worker: { rollupOptions: { output: { entryFileNames: `assets/[name]-[hash]-${workerPolicyVersion}.js` } } },
  plugins: [react(), {
    name: "tirta-offline",
    apply: "build",
    async writeBundle(options) {
      const directory = options.dir ?? "dist";
      const assets = (await readdir(directory, { recursive: true })).filter(p => /\.(js|css|woff2?|wasm|webp)$/.test(p) && p !== "tirta-sw.js").map(p => `/${p.replaceAll("\\", "/")}`).sort();
      await writeFile(join(directory, "tirta.html"), await readFile(join(directory, "production.html")));
      const files = ["/", "/production.html", "/tirta.html", "/production", "/tirta", "/tirta-logo.png", "/fonts/instrument-sans.ttf", "/fonts/manrope.ttf", "/fonts/roboto.ttf", ...["rainlight", "shorelight", "open-water", "paper-arc", "earth-grain", "overlap", "fold", "closing-water"].map(n => `/atmosphere/${n}.svg`), ...assets];
      const cache = `tirta-approved-${createHash("sha256").update(files.join("\n")).update(await readFile(join(directory, "_headers"))).digest("hex").slice(0, 16)}`;
      await writeFile(join(directory, "tirta-sw.js"), `
const CACHE = ${JSON.stringify(cache)};
const FILES = ${JSON.stringify(files)};
const navigationResponse = response => response?.redirected ? new Response(response.body, { status: response.status, statusText: response.statusText, headers: response.headers }) : response;
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("tirta-approved-") && k !== CACHE).map(k => caches.delete(k)))), self.clients.claim()])));
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || !FILES.includes(url.pathname)) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(response => {
      if (!response.ok) throw new Error("Application unavailable");
      // Pages redirects .html navigations to extensionless URLs. Navigation
      // requests use manual redirects, so a redirected fetch Response cannot
      // be returned directly by respondWith; retain its content and headers.
      return navigationResponse(response);
    }).catch(() => caches.open(CACHE).then(async cache => navigationResponse(await cache.match(url.pathname) || await cache.match(new URL("/", self.location.origin).href)))));
    return;
  }
  event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname)).then(cached => cached || fetch(event.request)));
});`);
    },
  }],
  build: {
    rollupOptions: {
      input: {
        app: "index.html",
        concepts: "concepts.html",
        production: "production.html",
      },
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});


