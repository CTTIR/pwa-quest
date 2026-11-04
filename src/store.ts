// Global app state. A single Zustand store covers route, session metadata,
// and answers. Route is a tiny enum rather than a router to keep the bundle
// minimal — there are only four screens.

import { create } from 'zustand';
import type { AnswerValue, SessionState } from './types';
import { QUESTIONS } from './config/questionnaire';
import { isValidScenario } from './config/scenarios';
import { defaultAnswer, isAnswerValid, isDraftAnswerValid } from './lib/answers';
import { clearSession, loadSession, safeSave } from './lib/storage';
import { decodeStoredSession } from './lib/session';

export type Route = 'setup' | 'questionnaire' | 'review' | 'export';

interface AppState {
  route: Route;
  session: SessionState | null;
  hydrated: boolean;
  storageError: string | null;
  recoveryRequired: boolean;
  storageBusy: boolean;
  pendingWrites: number;

  hydrate: () => Promise<void>;
  startSession: (participantId: string, scenario: string) => Promise<void>;
  setAnswer: (questionId: string, value: AnswerValue) => void;
  setIndex: (idx: number) => void;
  goTo: (route: Route) => Promise<void>;
  resetSession: () => Promise<void>;
  retrySave: () => Promise<void>;
}

function buildBlankSession(participantId: string, scenario: string): SessionState {
  const answers: Record<string, AnswerValue> = {};
  for (const q of QUESTIONS) answers[q.id] = defaultAnswer(q);
  return {
    participantId,
    scenario,
    startedAt: new Date().toISOString(),
    answers,
    currentIndex: 0,
  };
}

// Reads, writes and deletion share one ordering boundary. In particular, clear
// cannot overtake an older queued write and resurrect the previous participant.
let operations: Promise<void> = Promise.resolve();
let generation = 0;
let hydration: Promise<void> | null = null;
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = operations.then(operation);
  operations = result.then(() => undefined, () => undefined);
  return result;
}
function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Session storage failed. Please retry.';
}

export const useApp = create<AppState>((set, get) => ({
  route: 'setup',
  session: null,
  hydrated: false,
  storageError: null,
  recoveryRequired: false,
  storageBusy: false,
  pendingWrites: 0,

  async hydrate() {
    if (hydration) return hydration;
    if (get().hydrated && !get().recoveryRequired) return;
    set({ storageBusy: true });
    hydration = (async () => {
      try {
        const stored = decodeStoredSession(await enqueue(loadSession));
        set({ session: stored, route: stored ? 'questionnaire' : 'setup',
          hydrated: true, recoveryRequired: false, storageError: null });
      } catch (error) {
        // Never treat an unreadable or incompatible saved value as an empty
        // slot: doing so would allow a new participant to overwrite it.
        set({ hydrated: true, recoveryRequired: true, storageError: message(error) });
      } finally {
        set({ storageBusy: false });
        hydration = null;
      }
    })();
    return hydration;
  },

  async startSession(participantId, scenario) {
    if (get().storageBusy || get().recoveryRequired || !get().hydrated) return;
    if (get().session) {
      set({ storageError: 'Clear the current session explicitly before starting another participant.' });
      return;
    }
    if (typeof participantId !== 'string' || !participantId.trim() || !isValidScenario(scenario)) {
      set({ storageError: 'Enter a participant ID and choose a configured scenario.' });
      return;
    }
    const session = buildBlankSession(participantId.trim(), scenario);
    generation += 1;
    set({ session, route: 'questionnaire', storageError: null, storageBusy: true });
    try {
      await enqueue(() => safeSave(session));
    } catch (error) {
      set({ storageError: message(error) });
    } finally {
      set({ storageBusy: false });
    }
  },

  setAnswer(questionId, value) {
    const cur = get().session;
    if (!cur || get().storageBusy || get().recoveryRequired) return;
    const question = QUESTIONS.find((q) => q.id === questionId);
    if (!question || !isDraftAnswerValid(question, value)) {
      throw new Error('The answer does not match a configured question.');
    }
    const next: SessionState = {
      ...cur,
      answers: { ...cur.answers, [questionId]: Array.isArray(value) ? [...value] : value },
    };
    const currentGeneration = generation;
    set({ session: next, pendingWrites: get().pendingWrites + 1 });
    void enqueue(() => safeSave(next)).then(() => {
      if (generation === currentGeneration && get().session === next) set({ storageError: null });
    }, (error) => {
      if (generation === currentGeneration) set({ storageError: message(error) });
    }).finally(() => set((state) => ({ pendingWrites: state.pendingWrites - 1 })));
  },

  setIndex(idx) {
    const cur = get().session;
    if (!cur || get().storageBusy || get().recoveryRequired) return;
    if (!Number.isInteger(idx) || idx < 0 || idx >= QUESTIONS.length) {
      throw new Error('Question position is outside this questionnaire.');
    }
    const next = { ...cur, currentIndex: idx };
    const currentGeneration = generation;
    set({ session: next, pendingWrites: get().pendingWrites + 1 });
    void enqueue(() => safeSave(next)).then(() => {
      if (generation === currentGeneration && get().session === next) set({ storageError: null });
    }, (error) => {
      if (generation === currentGeneration) set({ storageError: message(error) });
    }).finally(() => set((state) => ({ pendingWrites: state.pendingWrites - 1 })));
  },

  async goTo(route) {
    if (get().recoveryRequired || get().storageBusy) return;
    if (!get().session && route !== 'setup') return;
    if (route === 'export' && !QUESTIONS.every((q) => isAnswerValid(q, get().session?.answers[q.id]))) {
      set({ storageError: 'Complete all required answers before exporting this session.' });
      return;
    }
    if (route === 'review' || route === 'export') {
      // Wait for already-entered edits before a completion transition. Failed
      // writes remain visible; exporting the in-memory answers is still a
      // recovery path and does not assert that persistence succeeded.
      set({ storageBusy: true });
      await operations;
      set({ storageBusy: false });
    }
    set({ route });
  },

  async resetSession() {
    if (get().storageBusy) return;
    set({ storageBusy: true });
    try {
      await enqueue(clearSession);
      generation += 1;
      set({ session: null, route: 'setup', storageError: null, recoveryRequired: false });
    } catch (error) {
      set({ storageError: `Could not clear the saved session. ${message(error)}` });
    } finally {
      set({ storageBusy: false });
    }
  },

  async retrySave() {
    const session = get().session;
    if (!session || get().storageBusy || get().recoveryRequired) return;
    set({ storageBusy: true });
    try {
      await enqueue(() => safeSave(session));
      set({ storageError: null });
    } catch (error) {
      set({ storageError: message(error) });
    } finally {
      set({ storageBusy: false });
    }
  },
}));
