import { it, expect, vi } from 'vitest';
import { discardRetiredModelCache, retiredModelKey } from './retiredModelCache';

it('removes only the pinned retired model and metadata, preserving unrelated storage', async () => {
  const files = new Set([retiredModelKey, `__metadata__${retiredModelKey}`, 'project-export.json', 'other-model.gguf']);
  const removeEntry = vi.fn(async (key: string) => { files.delete(key); });
  const getDirectoryHandle = vi.fn(async () => ({ removeEntry }));
  const storage = { getDirectory: async () => ({ getDirectoryHandle }) } as unknown as StorageManager;
  await discardRetiredModelCache(storage);
  expect(getDirectoryHandle).toHaveBeenCalledWith('cache', { create: false });
  expect(files).toEqual(new Set(['project-export.json', 'other-model.gguf']));
  expect(removeEntry).toHaveBeenCalledTimes(2);
  expect(removeEntry.mock.calls.every(call => call.length === 1)).toBe(true);
  await discardRetiredModelCache(storage);
  expect(files).toEqual(new Set(['project-export.json', 'other-model.gguf']));
});
it('does not block startup when OPFS is unavailable or a model file is locked', async () => {
  const denied = { getDirectory: async () => { throw new Error('unsupported'); } } as unknown as StorageManager;
  await expect(discardRetiredModelCache(denied)).resolves.toBeUndefined();
  const removeEntry = vi.fn(async () => { throw new Error('locked'); });
  const locked = { getDirectory: async () => ({ getDirectoryHandle: async () => ({ removeEntry }) }) } as unknown as StorageManager;
  await expect(discardRetiredModelCache(locked)).resolves.toBeUndefined();
  expect(removeEntry).toHaveBeenCalledTimes(2);
});
