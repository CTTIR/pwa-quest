import { useEffect, useState } from 'react';
import { useApp } from './store';
import { Setup } from './pages/Setup';
import { Questionnaire } from './pages/Questionnaire';
import { Review } from './pages/Review';
import { Export } from './pages/Export';
import { Modal } from './components/ui/Modal';
import { ToastViewport } from './components/ui/Toast';

export default function App() {
  const route = useApp((s) => s.route);
  const hydrated = useApp((s) => s.hydrated);
  const hydrate = useApp((s) => s.hydrate);

  const storageError = useApp((s) => s.storageError);
  const pendingWrites = useApp((s) => s.pendingWrites);
  const storageBusy = useApp((s) => s.storageBusy);
  const recoveryRequired = useApp((s) => s.recoveryRequired);
  const retrySave = useApp((s) => s.retrySave);
  const session = useApp((s) => s.session);
  const resetSession = useApp((s) => s.resetSession);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col px-4 pb-8 pt-6 sm:px-6">
      <header className="mb-4 flex items-center justify-between">
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="pwa-quest logo" width="96" height="111" />
        <h1 className="text-lg font-semibold tracking-tight text-slate-100">
          Questionnaire
        </h1>
        <span className="text-xs text-slate-400">Offline questionnaire</span>
      </header>

      {hydrated ? (
        <main className="flex-1">
          {storageError && <section className="mb-4 rounded-lg bg-red-900/40 p-3 text-red-200" aria-label="Storage problem">
            <p role="alert">{storageError}</p>
            {!recoveryRequired && session && <button className="btn-secondary mt-3" disabled={storageBusy} onClick={() => void retrySave()}>Retry saving</button>}
            {recoveryRequired && <div className="mt-3 flex gap-3">
              <button className="btn-secondary" disabled={storageBusy} onClick={() => void hydrate()}>Retry saved session</button>
              <button className="btn-danger" disabled={storageBusy} onClick={() => setConfirmClear(true)}>Clear saved session</button>
            </div>}
          </section>}
          {(storageBusy || pendingWrites > 0) && <p role="status" className="mb-3 text-slate-300">Saving changes…</p>}
          {route === 'setup' && <Setup />}
          {route === 'questionnaire' && <Questionnaire />}
          {route === 'review' && <Review />}
          {route === 'export' && <Export />}
        </main>
      ) : (
        <p className="text-slate-400" role="status">
          Loading…
        </p>
      )}

      <Modal open={confirmClear} title="Clear saved session?" description="This permanently removes the saved participant responses from this browser. Cancel to preserve them for recovery." confirmLabel="Clear saved session" destructive onCancel={() => setConfirmClear(false)} onConfirm={() => { setConfirmClear(false); void resetSession(); }} />
      <ToastViewport />
    </div>
  );
}
