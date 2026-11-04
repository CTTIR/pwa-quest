// Camera-based QR scanner. Uses html5-qrcode for broad mobile compatibility
// and a built-in camera-permission UI. Mounted only while active so the
// camera stream stops cleanly when we navigate away.

import { useEffect, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QrScannerProps {
  onResult: (text: string) => void;
  onError?: (message: string) => void;
}

const REGION_ID = 'qr-reader';

export function QrScanner({ onResult, onError }: QrScannerProps) {
  const [status, setStatus] = useState<'starting' | 'running' | 'denied' | 'error'>(
    'starting',
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let scanner: Html5Qrcode | null = null;
    let stopping: Promise<void> | null = null;
    let decodedOnce = false;
    const stop = async () => {
      if (!scanner || stopping) return stopping;
      if (!scanner.isScanning) return;
      stopping = scanner.stop().then(() => { scanner?.clear(); }).catch(() => undefined);
      return stopping;
    };

    const start = async () => {
      // Defer creation so React's development effect replay can cancel before
      // a second scanner starts on the same DOM region.
      await Promise.resolve();
      if (cancelled) return;
      scanner = new Html5Qrcode(REGION_ID, { verbose: false });

      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (vw, vh) => {
              const min = Math.min(vw, vh);
              const size = Math.floor(min * 0.7);
              return { width: size, height: size };
            },
          },
          (decoded) => {
            if (cancelled || decodedOnce) return;
            decodedOnce = true;
            void stop().then(() => { if (!cancelled) onResult(decoded); });
          },
          () => {
            /* ignore per-frame decode failures */
          },
        );
        if (cancelled) await stop();
        else setStatus('running');
      } catch (err) {
        const name = (err as DOMException | Error)?.name ?? '';
        const msg =
          name === 'NotAllowedError' || name === 'PermissionDeniedError'
            ? 'Camera access was denied. You can enable it in your browser settings, or enter the details manually.'
            : 'Camera unavailable on this device. Please enter the details manually.';
        if (!cancelled) {
          setStatus(name === 'NotAllowedError' ? 'denied' : 'error');
          setErrorMsg(msg);
          onError?.(msg);
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      // A pending permission request may finish after unmount; start() also
      // stops that late stream immediately once it becomes available.
      void stop();
    };
    // We deliberately want this to run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div id={REGION_ID} className="aspect-square w-full bg-slate-950" />
      {status === 'starting' && (
        <p className="mt-3 text-sm text-slate-400" role="status">
          Starting camera…
        </p>
      )}
      {(status === 'denied' || status === 'error') && errorMsg && (
        <p className="mt-3 rounded-lg bg-red-900/40 p-3 text-sm text-red-200" role="alert">
          {errorMsg}
        </p>
      )}
      {status === 'running' && (
        <p className="mt-3 text-sm text-slate-400">
          Point the camera at a setup QR code.
        </p>
      )}
    </div>
  );
}
