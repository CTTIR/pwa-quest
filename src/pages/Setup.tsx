import { lazy, Suspense, useState } from 'react';
import { useApp } from '../store';
import { SCENARIOS, isValidScenario } from '../config/scenarios';
import { showToast } from '../components/ui/Toast';

// html5-qrcode is large; only fetch it once the participant taps "Scan QR".
const QrScanner = lazy(() =>
  import('../components/qr/QrScanner').then((m) => ({ default: m.QrScanner })),
);

type Step = 'choose' | 'manual' | 'scan' | 'confirm';

interface ParsedQr {
  participantId: string;
  scenario: string;
}

function parseSetupQr(text: string): ParsedQr | string {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null) {
      return 'QR did not contain a JSON object.';
    }
    const participantId =
      typeof parsed.participantId === 'string' ? parsed.participantId.trim() : '';
    const scenario = typeof parsed.scenario === 'string' ? parsed.scenario : '';
    if (!participantId) return 'QR is missing "participantId".';
    if (!scenario) return 'QR is missing "scenario".';
    if (!isValidScenario(scenario)) return `Unknown scenario "${scenario}".`;
    return { participantId, scenario };
  } catch {
    return 'QR did not contain valid JSON.';
  }
}

export function Setup() {
  const storageBusy = useApp((s) => s.storageBusy);
  const recoveryRequired = useApp((s) => s.recoveryRequired);
  const startSession = useApp((s) => s.startSession);

  const [step, setStep] = useState<Step>('choose');
  const [participantId, setParticipantId] = useState('');
  const [scenario, setScenario] = useState(SCENARIOS[0]?.id ?? '');
  const [pid, setPid] = useState('');
  const [sce, setSce] = useState('');
  const [pidError, setPidError] = useState<string | null>(null);

  const onScan = (text: string) => {
    const result = parseSetupQr(text);
    if (typeof result === 'string') {
      showToast(result, 'error');
      // Stay on the scan step so they can retry; the scanner unmounts on
      // step change, so re-mount it by toggling.
      setStep('choose');
      setTimeout(() => setStep('scan'), 50);
      return;
    }
    setPid(result.participantId);
    setSce(result.scenario);
    setStep('confirm');
  };

  const onSubmitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = participantId.trim();
    if (!trimmed) {
      setPidError('Participant ID is required.');
      return;
    }
    if (!isValidScenario(scenario)) {
      setPidError('Please choose a valid scenario.');
      return;
    }
    setPidError(null);
    setPid(trimmed);
    setSce(scenario);
    setStep('confirm');
  };

  const onConfirm = async () => {
    await startSession(pid, sce);
  };

  if (step === 'choose') {
    return (
      <div className="space-y-4">
        <p className="text-slate-300">
          Set up the session by scanning a QR code or entering the details manually.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className="btn-primary"
            onClick={() => setStep('scan')}
          >
            Scan QR
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setStep('manual')}
          >
            Enter manually
          </button>
        </div>
      </div>
    );
  }

  if (step === 'scan') {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-slate-100">Scan setup QR</h2>
        <Suspense
          fallback={
            <p className="text-sm text-slate-400" role="status">
              Loading scanner…
            </p>
          }
        >
          <QrScanner
            onResult={onScan}
            onError={() => {
              /* error displayed inside the scanner */
            }}
          />
        </Suspense>
        <div className="flex justify-between gap-3">
          <button type="button" className="btn-ghost" onClick={() => setStep('choose')}>
            Back
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setStep('manual')}
          >
            Enter manually instead
          </button>
        </div>
      </div>
    );
  }

  if (step === 'manual') {
    return (
      <form onSubmit={onSubmitManual} className="space-y-4" noValidate>
        <h2 className="text-base font-semibold text-slate-100">Enter details</h2>

        <div>
          <label htmlFor="pid" className="field-label">
            Participant ID
          </label>
          <input
            id="pid"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            className="field-input"
            value={participantId}
            onChange={(e) => setParticipantId(e.target.value)}
            aria-invalid={pidError ? true : undefined}
            aria-describedby={pidError ? 'pid-error' : undefined}
            required
          />
          {pidError && (
            <p id="pid-error" className="mt-1 text-sm text-red-300" role="alert">
              {pidError}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="scenario" className="field-label">
            Scenario
          </label>
          <select
            id="scenario"
            className="field-input"
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            required
          >
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-between gap-3">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setStep('choose')}
          >
            Back
          </button>
          <button type="submit" className="btn-primary">
            Continue
          </button>
        </div>
      </form>
    );
  }

  // confirm
  const scenarioLabel = SCENARIOS.find((s) => s.id === sce)?.label ?? sce;
  return (
    <div className="card space-y-4">
      <h2 className="text-base font-semibold text-slate-100">Confirm session</h2>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-400">Participant</dt>
          <dd className="font-medium text-slate-100">{pid}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-400">Scenario</dt>
          <dd className="text-right font-medium text-slate-100">{scenarioLabel}</dd>
        </div>
      </dl>
      <div className="flex justify-between gap-3 pt-2">
        <button type="button" className="btn-ghost" onClick={() => setStep('choose')}>
          Edit
        </button>
        <button type="button" className="btn-primary" disabled={storageBusy || recoveryRequired} onClick={onConfirm}>
          Start questionnaire
        </button>
      </div>
    </div>
  );
}
