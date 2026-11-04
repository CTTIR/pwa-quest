import { describe, expect, test } from 'vitest';
import { QUESTIONS } from '../../src/config/questionnaire';
import { defaultAnswer, isAnswerValid, isDraftAnswerValid } from '../../src/lib/answers';
import type { Question } from '../../src/types';

describe('answer constraints at the data boundary', () => {
  test.each([
    [0, 1.5], [1, 2.5], [2, 'not an offered option'],
    [3, ['Felt confident', 'Felt confident']], [3, ['unknown']],
    [7, { unexpected: true }], [7, 'x'.repeat(101)], [8, Infinity],
  ])('refuses invalid answer to question index %i', (index, value) => {
    expect(isAnswerValid(QUESTIONS[index as number], value)).toBe(false);
  });
  test('unbounded numeric questions still require a finite number', () => {
    const q: Question = { id: 'n', type: 'numeric', question: 'Number' };
    for (const value of [Infinity, -Infinity, NaN, '3']) expect(isAnswerValid(q, value)).toBe(false);
    expect(isAnswerValid(q, 0)).toBe(true);
  });
  test('incomplete numeric typing survives as a draft but cannot be submitted', () => {
    const q = QUESTIONS[8];
    expect(isDraftAnswerValid(q, 1)).toBe(true);
    expect(isAnswerValid(q, 1)).toBe(false);
    expect(isDraftAnswerValid(q, null)).toBe(true);
    expect(isAnswerValid(q, null)).toBe(false);
    expect(isAnswerValid(q, 38)).toBe(true);
  });
  test('optional text permits an empty value, not invalid supplied data', () => {
    const q = QUESTIONS[7];
    expect(isAnswerValid(q, '')).toBe(true);
    expect(isAnswerValid(q, '  ')).toBe(true);
    expect(isAnswerValid(q, 'Field note')).toBe(true);
    expect(isAnswerValid(q, 'x'.repeat(100) + ' ')).toBe(false);
  });
  test('selection and ranking validate actual configured choices', () => {
    expect(isAnswerValid(QUESTIONS[3], [])).toBe(true);
    expect(isAnswerValid(QUESTIONS[3], ['Felt confident', 'Felt rushed'])).toBe(true);
    const ranking = QUESTIONS[9];
    if (ranking.type !== 'ranking') throw new Error('fixture');
    expect(isAnswerValid(ranking, [...ranking.items].reverse())).toBe(true);
    expect(isAnswerValid(ranking, [...ranking.items.slice(1), ranking.items[1]])).toBe(false);
  });
  test('sliders honor their configured lattice while allowing binary roundoff', () => {
    const q: Question = { id: 's', type: 'slider', question: 'Level', min: 0.1, max: 0.9, step: 0.1 };
    expect(isAnswerValid(q, 0.3)).toBe(true);
    expect(isAnswerValid(q, 0.31)).toBe(false);
  });
  test('all shipped defaults are safe drafts; required blank answers stay incomplete', () => {
    expect(QUESTIONS.every((q) => isDraftAnswerValid(q, defaultAnswer(q)))).toBe(true);
    expect(isAnswerValid(QUESTIONS[0], defaultAnswer(QUESTIONS[0]))).toBe(false);
  });
});
