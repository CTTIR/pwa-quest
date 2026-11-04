import { QUESTIONS, SCHEMA_VERSION } from '../config/questionnaire';
import { SCENARIOS, isValidScenario } from '../config/scenarios';
import legacyQuestionnaire from '../config/legacy-questionnaire.json';
import type { SessionState } from '../types';
import { isDraftAnswerValid } from './answers';

// Compare the exact configuration, including wording and option order. This is
// a compatibility signature, not a cryptographic authenticity claim.
export const QUESTIONNAIRE_SIGNATURE = JSON.stringify({
  schemaVersion: SCHEMA_VERSION, questions: QUESTIONS, scenarios: SCENARIOS,
});
const LEGACY_SIGNATURE = JSON.stringify(legacyQuestionnaire);

export interface StoredSession {
  storageVersion: 1;
  questionnaireSignature: string;
  session: SessionState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

export function isSessionState(value: unknown): value is SessionState {
  if (!isRecord(value) || !hasExactKeys(value, [
    'participantId', 'scenario', 'startedAt', 'answers', 'currentIndex',
  ])) return false;
  if (typeof value.participantId !== 'string' || value.participantId.trim() === '' ||
      value.participantId !== value.participantId.trim() ||
      typeof value.scenario !== 'string' || !isValidScenario(value.scenario) ||
      typeof value.startedAt !== 'string' || !Number.isFinite(Date.parse(value.startedAt)) ||
      new Date(value.startedAt).toISOString() !== value.startedAt ||
      !Number.isInteger(value.currentIndex) || (value.currentIndex as number) < 0 ||
      (value.currentIndex as number) >= QUESTIONS.length || !isRecord(value.answers)) return false;
  const answers = value.answers;
  return hasExactKeys(answers, QUESTIONS.map((q) => q.id)) &&
    QUESTIONS.every((q) => isDraftAnswerValid(q, answers[q.id]));
}

export class StoredSessionError extends Error {
  constructor() {
    super('The saved session is incompatible with this questionnaire or contains invalid data. It has not been changed. Restore the matching app version, or explicitly clear it to start over.');
    this.name = 'StoredSessionError';
  }
}

export function decodeStoredSession(value: unknown): SessionState | null {
  if (value === undefined || value === null) return null;
  if (isRecord(value) && Object.hasOwn(value, 'storageVersion')) {
    if (!hasExactKeys(value, ['storageVersion', 'questionnaireSignature', 'session']) ||
        value.storageVersion !== 1 || value.questionnaireSignature !== QUESTIONNAIRE_SIGNATURE ||
        !isSessionState(value.session)) throw new StoredSessionError();
    return value.session;
  }
  // The first released app stored no version or configuration. Permit its
  // well-formed drafts only while the original shipped configuration is intact.
  // A later questionnaire cannot reinterpret those unversioned answers.
  if (QUESTIONNAIRE_SIGNATURE !== LEGACY_SIGNATURE || !isSessionState(value)) {
    throw new StoredSessionError();
  }
  return value;
}

export function encodeStoredSession(session: SessionState): StoredSession {
  if (!isSessionState(session)) throw new StoredSessionError();
  return { storageVersion: 1, questionnaireSignature: QUESTIONNAIRE_SIGNATURE, session };
}
