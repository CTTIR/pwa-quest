import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { IDBFactory, IDBObjectStore, IDBDatabase } from 'fake-indexeddb';
import { QUESTIONS } from '../../src/config/questionnaire';
import { defaultAnswer } from '../../src/lib/answers';
import { clearSession, loadSession, saveSession } from '../../src/lib/storage';
import { decodeStoredSession } from '../../src/lib/session';
import type { SessionState } from '../../src/types';

const draft = (): SessionState => ({ participantId: 'SYNTHETIC', scenario: 'pilot', startedAt: '2026-01-01T00:00:00.000Z',
  currentIndex: 0, answers: Object.fromEntries(QUESTIONS.map((q) => [q.id, defaultAnswer(q)])) });
beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
test('committed drafts round-trip and a committed deletion removes them', async () => {
  const original = draft(); await saveSession(original);
  expect(decodeStoredSession(await loadSession())).toEqual(original);
  await clearSession(); expect(await loadSession()).toBeUndefined();
});
test('request success followed by transaction abort is a failed save, not a commit', async () => {
  const put = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (...args) {
    const request = put.apply(this, args);
    request.addEventListener('success', () => this.transaction.abort(), { once: true });
    return request;
  });
  await expect(saveSession(draft())).rejects.toMatchObject({ name: 'AbortError' });
  expect(await loadSession()).toBeUndefined();
});
test('failed clear rejects and preserves the last committed session', async () => {
  const original = draft(); await saveSession(original);
  vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementationOnce(() => {
    throw new DOMException('Synthetic blocked write', 'InvalidStateError');
  });
  await expect(clearSession()).rejects.toThrow('Synthetic blocked write');
  expect(decodeStoredSession(await loadSession())).toEqual(original);
});
test('a missing storage API is a visible read failure, not an empty session', async () => {
  vi.stubGlobal('indexedDB', undefined);
  await expect(loadSession()).rejects.toThrow();
});
test('completed helpers release connections so a schema upgrade is not blocked', async () => {
  await saveSession(draft()); await loadSession(); await clearSession();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('pwa-quest', 2);
    request.onblocked = () => reject(new Error('A helper leaked an open database connection'));
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { request.result.close(); resolve(); };
  });
});
