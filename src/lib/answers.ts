// Default answer values + validation for each question type.

import type { AnswerValue, Question } from '../types';

export function defaultAnswer(q: Question): AnswerValue {
  switch (q.type) {
    case 'likert5':
    case 'stars10':
    case 'numeric':
      return null; // numeric answers start blank so we can detect "unanswered"
    case 'singleSelect':
    case 'shortText':
    case 'longText':
    case 'yesNoUnsure':
      return '';
    case 'multiSelect':
      return [];
    case 'slider':
      // Start at the midpoint so the slider has a meaningful position.
      return Math.round((q.min + q.max) / 2);
    case 'ranking':
      return [...q.items];
  }
}

function isBlankAnswer(value: unknown): boolean {
  return value === null || value === '' ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0);
}

// Drafts may be incomplete or outside a numeric range while someone types.
// They must still have the shape that the question renderer understands.
export function isDraftAnswerValid(q: Question, value: unknown): value is AnswerValue {
  switch (q.type) {
    case 'likert5':
    case 'stars10':
      return value === null || (typeof value === 'number' && Number.isInteger(value) &&
        value >= 1 && value <= (q.type === 'likert5' ? 5 : 10));
    case 'numeric':
      return value === null || (typeof value === 'number' && Number.isFinite(value));
    case 'singleSelect':
      return typeof value === 'string' && (value === '' || q.options.includes(value));
    case 'multiSelect':
      return Array.isArray(value) && value.every((item) =>
        typeof item === 'string' && q.options.includes(item)) &&
        new Set(value).size === value.length;
    case 'slider': {
      if (typeof value !== 'number' || !Number.isFinite(value) ||
          value < q.min || value > q.max) return false;
      const steps = (value - q.min) / (q.step ?? 1);
      return Number.isFinite(steps) &&
        Math.abs(steps - Math.round(steps)) <= 8 * Number.EPSILON * Math.max(1, Math.abs(steps));
    }
    case 'yesNoUnsure':
      return value === '' || value === 'yes' || value === 'no' || value === 'unsure';
    case 'shortText':
    case 'longText':
      return typeof value === 'string' &&
        (q.maxLength === undefined || value.length <= q.maxLength);
    case 'ranking':
      return Array.isArray(value) && value.length === q.items.length &&
        new Set(value).size === value.length &&
        value.every((item) => typeof item === 'string' && q.items.includes(item));
  }
}

// Optional means an answer may be blank, not that a supplied value is exempt
// from its question's constraints.
export function isAnswerValid(q: Question, value: unknown): boolean {
  if (!isDraftAnswerValid(q, value)) return false;
  if (q.optional && isBlankAnswer(value)) return true;
  switch (q.type) {
    case 'likert5':
      return typeof value === 'number' && value >= 1 && value <= 5;
    case 'stars10':
      return typeof value === 'number' && value >= 1 && value <= 10;
    case 'singleSelect':
      return typeof value === 'string' && q.options.includes(value);
    case 'multiSelect': {
      if (!Array.isArray(value)) return false;
      const min = q.min ?? 1; // require at least one if not specified
      const max = q.max ?? q.options.length;
      return value.length >= min && value.length <= max;
    }
    case 'slider':
      return typeof value === 'number' && value >= q.min && value <= q.max;
    case 'yesNoUnsure':
      return value === 'yes' || value === 'no' || value === 'unsure';
    case 'shortText':
    case 'longText': {
      if (typeof value !== 'string') return false;
      const trimmed = value.trim();
      if (trimmed.length === 0) return false;
      if (q.maxLength && trimmed.length > q.maxLength) return false;
      return true;
    }
    case 'numeric': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return false;
      if (q.min !== undefined && value < q.min) return false;
      if (q.max !== undefined && value > q.max) return false;
      return true;
    }
    case 'ranking':
      return (
        Array.isArray(value) &&
        value.length === q.items.length &&
        q.items.every((it) => value.includes(it))
      );
  }
}

// Human-readable rendering of an answer for review and TXT export.
export function formatAnswer(q: Question, value: AnswerValue): string {
  if (value === null || value === undefined || value === '') return '—';
  switch (q.type) {
    case 'likert5':
      return `${value} / 5`;
    case 'stars10':
      return `${value} / 10`;
    case 'slider':
      return q.unit ? `${value} ${q.unit}` : String(value);
    case 'numeric':
      return q.unit ? `${value} ${q.unit}` : String(value);
    case 'multiSelect':
      return Array.isArray(value) && value.length > 0 ? value.join(', ') : '—';
    case 'ranking':
      return Array.isArray(value)
        ? value.map((item, i) => `${i + 1}. ${item}`).join('\n')
        : '—';
    case 'yesNoUnsure':
      return value === 'yes' ? 'Yes' : value === 'no' ? 'No' : 'Not sure';
    default:
      return String(value);
  }
}
