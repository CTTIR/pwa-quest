import { useApp } from '../store';
import { QUESTIONS } from '../config/questionnaire';
import { Progress } from '../components/ui/Progress';
import { QuestionShell } from '../components/questions/QuestionShell';
import { QuestionRenderer } from '../components/questions/QuestionRenderer';
import { isAnswerValid } from '../lib/answers';

export function Questionnaire() {
  const storageBusy = useApp((s) => s.storageBusy);
  const session = useApp((s) => s.session);
  const setAnswer = useApp((s) => s.setAnswer);
  const setIndex = useApp((s) => s.setIndex);
  const goTo = useApp((s) => s.goTo);

  if (!session) return null;

  const idx = Math.min(session.currentIndex, QUESTIONS.length - 1);
  const q = QUESTIONS[idx];
  const value = session.answers[q.id];
  const valid = isAnswerValid(q, value);
  const isLast = idx === QUESTIONS.length - 1;

  const onNext = () => {
    if (!valid) return;
    if (isLast) {
      goTo('review');
    } else {
      setIndex(idx + 1);
    }
  };

  const onBack = () => {
    if (idx === 0) return;
    setIndex(idx - 1);
  };

  return (
    <fieldset disabled={storageBusy} className="space-y-5 min-w-0">
      <Progress current={idx + 1} total={QUESTIONS.length} />
      <QuestionShell
        questionNumber={idx + 1}
        question={q.question}
        description={q.description}
        optional={q.optional}
      >
        <QuestionRenderer
          question={q}
          value={value}
          onChange={(v) => setAnswer(q.id, v)}
        />
      </QuestionShell>

      <div className="flex justify-between gap-3">
        <button
          type="button"
          className="btn-ghost"
          onClick={onBack}
          disabled={idx === 0}
        >
          Back
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={onNext}
          disabled={!valid}
        >
          {isLast ? 'Review answers' : 'Next'}
        </button>
      </div>
    </fieldset>
  );
}
