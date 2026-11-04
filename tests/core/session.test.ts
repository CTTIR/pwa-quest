import { afterEach, expect, test, vi } from 'vitest';
import { QUESTIONS, SCHEMA_VERSION } from '../../src/config/questionnaire';
import { SCENARIOS } from '../../src/config/scenarios';
import { defaultAnswer } from '../../src/lib/answers';
import { decodeStoredSession, encodeStoredSession, isSessionState } from '../../src/lib/session';
import type { SessionState } from '../../src/types';

function draft(): SessionState {
  return { participantId: '001', scenario: 'pilot', startedAt: '2026-01-01T00:00:00.000Z',
    currentIndex: 3, answers: Object.fromEntries(QUESTIONS.map((q) => [q.id, defaultAnswer(q)])) };
}
afterEach(() => { vi.doUnmock('../../src/config/questionnaire'); vi.resetModules(); });
test('a valid original unversioned draft resumes without losing ID, index or answers', () => {
  const old = draft(); old.answers.q9 = 1;
  const before = structuredClone(old);
  expect(decodeStoredSession(old)).toEqual(before);
  expect(old).toEqual(before);
  expect(decodeStoredSession(encodeStoredSession(old))).toEqual(before);
});
test.each([
  ['currentIndex', -1], ['currentIndex', 0.5], ['currentIndex', 10],
  ['scenario', 'unknown'], ['startedAt', 'not a timestamp'], ['participantId', ''],
])('malformed stored %s is refused without rewriting its input', (key, value) => {
  const old = { ...draft(), [key]: value }; const before = structuredClone(old);
  expect(() => decodeStoredSession(old)).toThrow(/has not been changed/);
  expect(old).toEqual(before);
});
test('missing/unknown question keys and invalid shapes never become a live session', () => {
  const old = draft(); delete old.answers.q1;
  expect(isSessionState(old)).toBe(false);
  old.answers.q1 = 4; old.answers.unknown = 'extra';
  expect(() => decodeStoredSession(old)).toThrow();
  delete old.answers.unknown; old.answers.q3 = 'unknown';
  expect(() => decodeStoredSession(old)).toThrow();
});
test('an unsupported envelope and changed questionnaire are refused without deleting data', async () => {
  const old = draft(); const stored = encodeStoredSession(old);
  expect(() => decodeStoredSession({ ...stored, storageVersion: 99 })).toThrow();
  expect(() => decodeStoredSession({ ...stored, questionnaireSignature: 'other' })).toThrow();
  const changed = structuredClone(QUESTIONS); changed[0].question = 'Different scientific meaning';
  vi.doMock('../../src/config/questionnaire', () => ({ QUESTIONS: changed, SCHEMA_VERSION }));
  vi.resetModules();
  const changedModule = await import('../../src/lib/session');
  expect(() => changedModule.decodeStoredSession(stored)).toThrow();
  expect(() => changedModule.decodeStoredSession(old)).toThrow();
  expect(stored.session).toEqual(old);
});
test('signature includes the original wording, scenarios and option order', () => {
  const stored = encodeStoredSession(draft());
  expect(JSON.parse(stored.questionnaireSignature)).toEqual({ schemaVersion: SCHEMA_VERSION, questions: QUESTIONS, scenarios: SCENARIOS });
});
