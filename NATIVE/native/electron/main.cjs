const { app, BrowserWindow, Menu, shell, session } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const HOST = '127.0.0.1';
const PORT = 17341;
const ORIGIN = `http://${HOST}:${PORT}`;
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' blob:; worker-src 'self' blob:; media-src 'self' data: blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.pdf': 'application/pdf'
};

let server;
let mainWindow;

function resolveAsset(root, requestPath) {
  let pathname = decodeURIComponent(requestPath.split('?')[0] || '/');
  if (pathname === '/' || pathname === '/production' || pathname === '/production/') pathname = '/production.html';
  if (pathname === '/tirta' || pathname === '/tirta/') pathname = '/tirta.html';
  if (pathname === '/concepts' || pathname === '/concepts/') pathname = '/concepts.html';
  const normalized = path.posix.normalize(pathname).replace(/^\/+/, '');
  const candidate = path.join(root, normalized);
  const relative = path.relative(root, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return candidate;
}

function sendFile(req, res, filePath) {
  fs.stat(filePath, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const immutable = filePath.includes(`${path.sep}assets${path.sep}`);
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': CSP,
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache'
    };
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
}

function startLocalServer() {
  const root = path.join(app.getAppPath(), 'dist');
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      if (!req.url || !['GET', 'HEAD'].includes(req.method || 'GET')) {
        res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Method not allowed');
      }
      const filePath = resolveAsset(root, req.url);
      if (!filePath) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Bad request');
      }
      sendFile(req, res, filePath);
    });
    server.once('error', reject);
    server.listen(PORT, HOST, () => resolve());
  });
}

function createWindow() {
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  mainWindow = new BrowserWindow({
    title: 'TIRTA',
    width: 1440,
    height: 900,
    minWidth: 360,
    minHeight: 640,
    backgroundColor: '#dff5fc',
    autoHideMenuBar: true,
    icon: path.join(app.getAppPath(), 'dist', 'tirta-logo.png'),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: false
    }
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(ORIGIN)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(ORIGIN)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });
  void mainWindow.loadURL(`${ORIGIN}/production.html`);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.whenReady().then(async () => {
    try {
      // Always prefer the web bundle shipped in this executable over stale renderer caches.
      // Clear only disposable caches; IndexedDB/local project data stays untouched.
      await session.defaultSession.clearCache();
      await session.defaultSession.clearStorageData({ storages: ['serviceworkers', 'cachestorage'] });
      await startLocalServer();
      createWindow();
    } catch (error) {
      console.error(error);
      app.quit();
    }
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && server) createWindow();
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('will-quit', () => {
    try { server?.close(); } catch { /* no-op */ }
  });
}
