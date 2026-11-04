import { afterEach, expect, test, vi } from 'vitest';
import { QUESTIONS } from '../../src/config/questionnaire';
import { defaultAnswer } from '../../src/lib/answers';
import { decodeStoredSession, encodeStoredSession } from '../../src/lib/session';
import type { SessionState } from '../../src/types';

function draft(): SessionState { return { participantId: 'SYNTHETIC-OLD', scenario: 'pilot', startedAt: '2026-01-01T00:00:00.000Z', currentIndex: 0,
  answers: Object.fromEntries(QUESTIONS.map((q) => [q.id, defaultAnswer(q)])) }; }
function deferred() { let resolve!: () => void; const promise = new Promise<void>((r) => { resolve = r; }); return { promise, resolve }; }
async function fixture(initial: unknown = undefined) {
  let disk = initial;
  const storage = {
    loadSession: vi.fn(async () => structuredClone(disk)),
    safeSave: vi.fn(async (session: SessionState) => { disk = encodeStoredSession(structuredClone(session)); }),
    clearSession: vi.fn(async () => { disk = undefined; }),
  };
  vi.doMock('../../src/lib/storage', () => storage);
  const { useApp } = await import('../../src/store');
  return { useApp, storage, disk: () => disk };
}
afterEach(() => { vi.doUnmock('../../src/lib/storage'); vi.resetModules(); });

test('reset waits behind queued edits and cannot resurrect the previous participant', async () => {
  const f = await fixture(encodeStoredSession(draft())); await f.useApp.getState().hydrate();
  const gate = deferred(); const save = f.storage.safeSave.getMockImplementation()!;
  f.storage.safeSave.mockImplementationOnce(async (s) => { await gate.promise; await save(s); });
  f.useApp.getState().setAnswer('q1', 3);
  f.useApp.getState().setAnswer('q2', 7);
  const reset = f.useApp.getState().resetSession();
  await Promise.resolve();
  expect(f.storage.clearSession).not.toHaveBeenCalled();
  expect(f.useApp.getState().session?.participantId).toBe('SYNTHETIC-OLD');
  gate.resolve(); await reset;
  expect(f.disk()).toBeUndefined();
  expect(f.useApp.getState().session).toBeNull();
  await f.useApp.getState().startSession('SYNTHETIC-NEW', 'scenario-A');
  expect(decodeStoredSession(f.disk())?.participantId).toBe('SYNTHETIC-NEW');
});
test('failed durable deletion preserves the active session and displays an error', async () => {
  const original = encodeStoredSession(draft()); const f = await fixture(original);
  await f.useApp.getState().hydrate();
  f.storage.clearSession.mockRejectedValueOnce(new Error('Synthetic disk failure'));
  await expect(f.useApp.getState().resetSession()).resolves.toBeUndefined();
  expect(f.useApp.getState().session).toEqual(original.session);
  expect(f.disk()).toEqual(original);
  expect(f.useApp.getState().storageError).toMatch(/Could not clear.*Synthetic disk failure/);
  expect(f.useApp.getState().storageBusy).toBe(false);
});
test('invalid stored bytes block new sessions and survive until explicit clear', async () => {
  const corrupted = { ...draft(), currentIndex: -1 };
  const f = await fixture(corrupted); await f.useApp.getState().hydrate();
  expect(f.useApp.getState()).toMatchObject({ hydrated: true, recoveryRequired: true, session: null, storageBusy: false });
  await f.useApp.getState().startSession('NEW', 'pilot');
  expect(f.storage.safeSave).not.toHaveBeenCalled(); expect(f.disk()).toEqual(corrupted);
  await f.useApp.getState().resetSession();
  expect(f.disk()).toBeUndefined(); expect(f.useApp.getState().recoveryRequired).toBe(false);
});
test('read failures leave recovery available and a retry can safely resume', async () => {
  const f = await fixture(encodeStoredSession(draft()));
  f.storage.loadSession.mockRejectedValueOnce(new Error('Synthetic storage unavailable'));
  await f.useApp.getState().hydrate();
  expect(f.useApp.getState()).toMatchObject({ hydrated: true, recoveryRequired: true, storageBusy: false });
  expect(f.useApp.getState().storageError).toMatch(/Synthetic storage unavailable/);
  await f.useApp.getState().hydrate();
  expect(f.useApp.getState().session).toEqual(draft());
  expect(f.useApp.getState()).toMatchObject({ recoveryRequired: false, storageError: null });
});
test('duplicate hydration shares a read; an active session is not later overwritten by hydrate', async () => {
  const f = await fixture(encodeStoredSession(draft()));
  const gate = deferred(); const load = f.storage.loadSession.getMockImplementation()!;
  f.storage.loadSession.mockImplementationOnce(async () => { await gate.promise; return load(); });
  const first = f.useApp.getState().hydrate(); const second = f.useApp.getState().hydrate();
  await Promise.resolve(); expect(f.storage.loadSession).toHaveBeenCalledTimes(1);
  gate.resolve(); await Promise.all([first, second]);
  f.useApp.getState().setAnswer('q1', 4);
  await f.useApp.getState().hydrate();
  expect(f.useApp.getState().session?.answers.q1).toBe(4);
  expect(f.storage.loadSession).toHaveBeenCalledTimes(1);
  await f.useApp.getState().retrySave();
});
test('failed save retains in-memory answers and explicit retry persists exactly those answers', async () => {
  const f = await fixture(encodeStoredSession(draft())); await f.useApp.getState().hydrate();
  f.storage.safeSave.mockRejectedValueOnce(new DOMException('Synthetic quota', 'QuotaExceededError'));
  f.useApp.getState().setAnswer('q7', 'Important field observation');
  await vi.waitFor(() => expect(f.useApp.getState().storageError).toBe('Synthetic quota'));
  expect(f.useApp.getState().session?.answers.q7).toBe('Important field observation');
  await f.useApp.getState().retrySave();
  expect(decodeStoredSession(f.disk())?.answers.q7).toBe('Important field observation');
  expect(f.useApp.getState().storageError).toBeNull();
});
test('review waits for pending writes without dropping rapidly entered answers', async () => {
  const f = await fixture(encodeStoredSession(draft())); await f.useApp.getState().hydrate();
  const gate = deferred(); const save = f.storage.safeSave.getMockImplementation()!;
  f.storage.safeSave.mockImplementationOnce(async (s) => { await gate.promise; await save(s); });
  f.useApp.getState().setAnswer('q7', 'first'); f.useApp.getState().setAnswer('q7', 'final');
  expect(f.useApp.getState().pendingWrites).toBe(2);
  const navigation = f.useApp.getState().goTo('review');
  expect(f.useApp.getState().route).toBe('questionnaire');
  gate.resolve(); await navigation;
  expect(f.useApp.getState().route).toBe('review');
  expect(decodeStoredSession(f.disk())?.answers.q7).toBe('final');
  await vi.waitFor(() => expect(f.useApp.getState().pendingWrites).toBe(0));
});
test('incomplete answers cannot enter export and invalid programmatic edits are not stored', async () => {
  const f = await fixture(encodeStoredSession(draft())); await f.useApp.getState().hydrate();
  await f.useApp.getState().goTo('export');
  expect(f.useApp.getState().route).toBe('questionnaire');
  expect(() => f.useApp.getState().setAnswer('q3', 'invented option')).toThrow();
  expect(() => f.useApp.getState().setIndex(-1)).toThrow();
  expect(f.storage.safeSave).not.toHaveBeenCalled();
});
