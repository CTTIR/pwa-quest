import { lazy, Suspense, useMemo, useState } from 'react';
import { useApp } from '../store';
import { buildSession } from '../lib/buildSession';
import { buildCsv } from '../lib/export/csv';
import { buildTxt } from '../lib/export/txt';
import { buildXml } from '../lib/export/xml';
import { buildXlsx } from '../lib/export/xlsx';
import { downloadBlob, downloadText } from '../lib/download';
import { buildFilename } from '../lib/sanitize';
import { Modal } from '../components/ui/Modal';

// QrDisplay pulls in the `qrcode` package — split into its own chunk.
const QrDisplay = lazy(() =>
  import('../components/qr/QrDisplay').then((m) => ({ default: m.QrDisplay })),
);

// Practical capacity for QR with error correction level M is around 2300
// alphanumeric / 1800 byte chars. We warn at 2000 to stay safely scannable.
const QR_WARN_THRESHOLD = 2000;

export function Export() {
  const session = useApp((s) => s.session);
  const resetSession = useApp((s) => s.resetSession);

  // Freeze completedAt at the moment the export screen opens so repeated
  // downloads share a consistent timestamp and filename.
  const [completedAt] = useState(() => new Date());
  const [confirmReset, setConfirmReset] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const storageBusy = useApp((s) => s.storageBusy);

  const exportSession = useMemo(
    () => (session ? buildSession(session, completedAt) : null),
    [session, completedAt],
  );

  if (!session || !exportSession) return null;

  const json = JSON.stringify(exportSession);
  const qrBytes = new TextEncoder().encode(json).length;
  const tooLargeForQr = qrBytes > QR_WARN_THRESHOLD;

  const fname = (ext: string) =>
    buildFilename(session.participantId, session.scenario, ext, completedAt);

  const runExport = async (action: () => void | Promise<void>) => {
    setExportError(null);
    setExportBusy(true);
    try { await action(); }
    catch (error) {
      setExportError(`Export failed. Your answers are still available. ${error instanceof Error ? error.message : 'Please try again.'}`);
    } finally { setExportBusy(false); }
  };

  const onJson = () => downloadText(JSON.stringify(exportSession, null, 2), fname('json'), 'application/json');
  const onCsv = () => downloadText(buildCsv(exportSession), fname('csv'), 'text/csv');
  const onTxt = () => downloadText(buildTxt(exportSession), fname('txt'), 'text/plain');
  const onXml = () => downloadText(buildXml(exportSession), fname('xml'), 'application/xml');
  const onXlsx = async () => {
    const blob = await buildXlsx(exportSession);
    downloadBlob(blob, fname('xlsx'));
  };
  const onEmailXml = async () => {
    const xml = buildXml(exportSession);
    const filename = fname('xml');
    const subject = `Questionnaire results — ${session.participantId} / ${session.scenario}`;
    const summary = `Participant: ${session.participantId}\nScenario: ${session.scenario}\nCompleted: ${completedAt.toISOString()}`;
    const file = new File([xml], filename, { type: 'application/xml' });

    // Web Share Level 2 (navigator.canShare with files) is the only browser API
    // that can hand a file to the user's mail app as a real attachment.
    // Available on iOS Safari, Android Chrome, and recent desktop Chrome/Edge.
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] }) && typeof nav.share === 'function') {
      try {
        await nav.share({ files: [file], title: subject, text: summary });
        return;
      } catch (err) {
        // User cancelled or share failed — fall through to mailto fallback.
        if ((err as DOMException)?.name === 'AbortError') return;
      }
    }

    // Fallback: inline the XML in the mail body if it fits in a mailto URL,
    // otherwise download the file and open an empty draft so the user can
    // attach it manually. Browsers cannot attach files via mailto.
    const inlineHref = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
      `${summary}\n\nXML payload:\n\n${xml}`,
    )}`;
    if (inlineHref.length <= 2000) {
      window.location.href = inlineHref;
      return;
    }
    downloadText(xml, filename, 'application/xml');
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
      `${summary}\n\nThe XML was too large to inline. Please attach ${filename} (just downloaded) before sending.`,
    )}`;
  };

  return (
    <div className="space-y-6">
      {exportError && <p role="alert" className="rounded-lg bg-red-900/40 p-3 text-red-200">{exportError}</p>}
      <div className="card">
        <h2 className="mb-1 text-base font-semibold text-slate-100">Session complete</h2>
        <p className="text-sm text-slate-300">
          Participant <strong>{session.participantId}</strong> · Scenario{' '}
          <strong>{session.scenario}</strong>
        </p>
      </div>

      <section aria-labelledby="qr-heading" className="card">
        <h3 id="qr-heading" className="mb-3 text-base font-semibold text-slate-100">
          Scan to collect
        </h3>
        {tooLargeForQr ? (
          <p
            className="rounded-lg bg-amber-900/40 p-3 text-sm text-amber-200"
            role="alert"
          >
            Data too large for a single QR ({qrBytes.toLocaleString()} UTF-8 bytes).
            Consider shortening text answers, or use the file download instead.
          </p>
        ) : (
          <>
            <Suspense
              fallback={
                <p className="text-sm text-slate-400" role="status">
                  Rendering QR…
                </p>
              }
            >
              <QrDisplay data={json} size={320} errorCorrectionLevel="M" />
            </Suspense>
            <p className="mt-3 text-center text-xs text-slate-400">
              {qrBytes.toLocaleString()} UTF-8 bytes · error correction level M
            </p>
          </>
        )}
      </section>

      <section aria-labelledby="dl-heading" className="card">
        <h3 id="dl-heading" className="mb-3 text-base font-semibold text-slate-100">
          Download
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <button type="button" className="btn-secondary" disabled={exportBusy} onClick={() => void runExport(onJson)}>
            JSON
          </button>
          <button type="button" className="btn-secondary" disabled={exportBusy} onClick={() => void runExport(onCsv)}>
            CSV
          </button>
          <button type="button" className="btn-secondary" disabled={exportBusy} onClick={() => void runExport(onXlsx)}>
            XLSX
          </button>
          <button type="button" className="btn-secondary" disabled={exportBusy} onClick={() => void runExport(onTxt)}>
            TXT
          </button>
          <button type="button" className="btn-secondary" disabled={exportBusy} onClick={() => void runExport(onXml)}>
            XML
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Files are saved with the name{' '}
          <code className="rounded bg-slate-900 px-1 py-0.5">{fname('<ext>')}</code>.
        </p>
      </section>

      <section aria-labelledby="email-heading" className="card">
        <h3 id="email-heading" className="mb-3 text-base font-semibold text-slate-100">
          Send by email
        </h3>
        <button type="button" className="btn-primary w-full" disabled={exportBusy} onClick={() => void runExport(onEmailXml)}>
          Email XML
        </button>
        <p className="mt-3 text-xs text-slate-400">
          Opens your default mail program with the XML in the message body. If the
          payload is too large for a mailto URL, the XML file is downloaded instead so
          you can attach it manually.
        </p>
      </section>

      <div className="flex justify-center pt-2">
        <button
          type="button"
          className="btn-danger"
          disabled={storageBusy || exportBusy}
          onClick={() => setConfirmReset(true)}
        >
          New session
        </button>
      </div>

      <Modal
        open={confirmReset}
        title="Start a new session?"
        description="This will clear the current participant's answers from this device. Make sure you've saved or scanned the data first."
        confirmLabel="Clear and start over"
        destructive
        onConfirm={() => {
          setConfirmReset(false);
          void resetSession();
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
