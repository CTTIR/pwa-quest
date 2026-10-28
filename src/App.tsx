import { useEffect } from 'react';
import { useApp } from './store';
import { Setup } from './pages/Setup';
import { Questionnaire } from './pages/Questionnaire';
import { Review } from './pages/Review';
import { Export } from './pages/Export';
import { ToastViewport } from './components/ui/Toast';

export default function App() {
  const route = useApp((s) => s.route);
  const hydrated = useApp((s) => s.hydrated);
  const hydrate = useApp((s) => s.hydrate);

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
        <span className="text-xs text-slate-400">Offline-ready</span>
      </header>

      {hydrated ? (
        <main className="flex-1">
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

      <ToastViewport />
    </div>
  );
}
