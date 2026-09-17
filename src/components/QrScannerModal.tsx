import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle, RefreshCw } from 'lucide-react';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const scannerId = 'qr-reader-container';

    const safeStopScanner = async (scanner: Html5Qrcode | null) => {
      if (!scanner) return;
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
      } catch {
        // Suppress any stop errors if scanner wasn't active
      }
      try {
        scanner.clear();
      } catch {
        // Suppress clear errors
      }
    };

    const startScanner = async () => {
      try {
        setIsStarting(true);
        setScannerError(null);

        // Allow DOM to settle
        await new Promise((r) => setTimeout(r, 150));
        if (!isMounted) return;

        const qrScanner = new Html5Qrcode(scannerId);
        html5QrCodeRef.current = qrScanner;

        const cameras = await Html5Qrcode.getCameras();
        if (!cameras || cameras.length === 0) {
          throw new Error('No camera found on this device.');
        }

        // Prefer back/environment camera
        const preferredCamera =
          cameras.find((c) => /back|rear|environment/i.test(c.label))?.id ||
          cameras[cameras.length - 1].id;

        if (!isMounted) return;

        await qrScanner.start(
          preferredCamera,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          async (decodedText) => {
            if (!isMounted) return;
            // Safely stop scanning before notifying parent
            await safeStopScanner(qrScanner);
            onScanSuccess(decodedText);
          },
          () => {
            // Ignore scan failure frames
          }
        );
      } catch (err: any) {
        console.warn('Camera scan initialization error:', err);
        setScannerError(
          err?.message?.includes('Permission')
            ? 'Camera permission denied. Please allow camera access or enter code below.'
            : 'Unable to start camera. You can manually enter the 6-digit session code.'
        );
      } finally {
        if (isMounted) setIsStarting(false);
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      const currentScanner = html5QrCodeRef.current;
      html5QrCodeRef.current = null;
      safeStopScanner(currentScanner);
    };
  }, [isOpen, onScanSuccess]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScanSuccess(manualCode.trim().toUpperCase());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-5 relative transition-colors">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1 pr-8">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">Scan QR Code</h3>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Point your camera at the QR code displayed on the screen.
          </p>
        </div>

        {/* Camera Container */}
        <div className="relative rounded-xl overflow-hidden bg-zinc-900 aspect-square flex items-center justify-center">
          <div id="qr-reader-container" className="w-full h-full" />

          {isStarting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-white gap-2 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
              <span>Starting camera...</span>
            </div>
          )}

          {scannerError && (
            <div className="absolute inset-0 p-6 flex flex-col items-center justify-center bg-zinc-900/95 text-center text-zinc-300 gap-3">
              <AlertCircle className="w-8 h-8 text-amber-400" />
              <p className="text-xs max-w-xs">{scannerError}</p>
            </div>
          )}
        </div>

        {/* Manual fallback */}
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Or type the 6-character code:</p>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. 9X2A1B"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              maxLength={8}
              className="flex-1 px-3 py-2 text-sm font-mono uppercase bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 rounded-lg focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors cursor-pointer"
            >
              Pair
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
