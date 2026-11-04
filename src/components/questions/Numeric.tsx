import type { NumericQuestion } from '../../types';

interface Props {
  question: NumericQuestion;
  value: number | null;
  onChange: (value: number | null) => void;
}

export function Numeric({ question, value, onChange }: Props) {
  const text = value === null ? '' : String(value);
  const outOfRange =
    value !== null &&
    ((question.min !== undefined && value < question.min) ||
      (question.max !== undefined && value > question.max));

  return (
    <div>
      <div className="flex items-center gap-3">
        <input
          type="number"
          inputMode="numeric"
          className="field-input"
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') return onChange(null);
            const n = Number(v);
            onChange(Number.isFinite(n) ? n : null);
          }}
          min={question.min}
          max={question.max}
          aria-label={question.question}
          aria-invalid={outOfRange ? true : undefined}
        />
        {question.unit && (
          <span className="text-base text-slate-300">{question.unit}</span>
        )}
      </div>
      {(question.min !== undefined || question.max !== undefined) && (
        <p
          className={`mt-1 text-xs ${outOfRange ? 'text-red-300' : 'text-slate-500'}`}
          role={outOfRange ? 'alert' : undefined}
        >
          Allowed range: {question.min ?? '−∞'} to {question.max ?? '∞'}
          {question.unit ? ` ${question.unit}` : ''}
        </p>
      )}
    </div>
  );
}
