import { useEffect, useRef, useState } from 'react';

// Camera barcode scanner. Uses the ZXing library (loaded only when opened),
// because Safari on iPhone has no built-in barcode reader.

export default function BarcodeScanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (cancelled || !video.current) return;
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } }, audio: false },
          video.current,
          (result) => {
            if (result) {
              controls.stop();
              navigator.vibrate?.(30);
              onCode(result.getText());
            }
          }
        );
        stop = () => controls.stop();
        if (cancelled) stop();
        setStarting(false);
      } catch (err) {
        setStarting(false);
        setError(
          err instanceof Error && /permission|notallowed/i.test(`${err.name} ${err.message}`)
            ? 'Camera access was blocked. Allow it in your phone settings, or type the barcode below.'
            : "The camera couldn't start here. Type the barcode below instead."
        );
      }
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return (
    <div className="relative flex h-[190px] items-center justify-center overflow-hidden rounded-card bg-hero text-[13px] text-hero-muted">
      <video ref={video} className="absolute inset-0 h-full w-full object-cover" playsInline muted aria-label="Camera view for scanning a barcode" />
      {/* Aiming guide */}
      <span className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-coral shadow-[0_0_12px_rgb(var(--coral))]" aria-hidden />
      {(starting || error) && <span className="relative z-10 max-w-[240px] px-4 text-center">{error ?? 'Starting the camera…'}</span>}
    </div>
  );
}
