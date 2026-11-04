// Renders a QR code from arbitrary text data. Uses the `qrcode` package's
// canvas renderer so the result is crisp at any size. Calls back with a data
// URL so the parent can offer a "save image" option if desired.

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

interface QrDisplayProps {
  data: string;
  size?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

export function QrDisplay({
  data,
  size = 320,
  errorCorrectionLevel = 'M',
}: QrDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    QRCode.toCanvas(canvas, data, {
      errorCorrectionLevel,
      width: size,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    }).then(
      () => setRenderError(null),
      (err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to render QR.';
        setRenderError(msg);
      },
    );
  }, [data, size, errorCorrectionLevel]);

  return (
    <div className="flex flex-col items-center">
      <div
        className="rounded-xl bg-white p-3 shadow-md"
        style={{ width: size + 24, maxWidth: '100%' }}
      >
        <canvas
          className="h-auto max-w-full"
          ref={canvasRef}
          width={size}
          height={size}
          aria-label="QR code containing the session data"
          role="img"
        />
      </div>
      {renderError && (
        <p className="mt-3 text-sm text-red-300" role="alert">
          {renderError}
        </p>
      )}
    </div>
  );
}
