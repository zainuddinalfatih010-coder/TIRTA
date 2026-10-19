import { beforeEach, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  writeFile: vi.fn(async () => ({ uri: 'content://tirta/export.txt' })),
  share: vi.fn(async () => undefined),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
}));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: { writeFile: native.writeFile },
}));
vi.mock('@capacitor/share', () => ({
  Share: { share: native.share },
}));

import { downloadBlob } from './reportHtml';

beforeEach(() => {
  native.writeFile.mockClear();
  native.share.mockClear();
});

it('routes exported blobs through native Filesystem and Share on Android', async () => {
  await downloadBlob(new Blob(['hello'], { type: 'text/plain' }), 'export.txt');

  expect(native.writeFile).toHaveBeenCalledWith({
    path: 'export.txt',
    data: 'aGVsbG8=',
    directory: 'CACHE',
  });
  expect(native.share).toHaveBeenCalledWith({
    title: 'export.txt',
    dialogTitle: 'Simpan atau bagikan berkas TIRTA',
    url: 'content://tirta/export.txt',
  });
});
