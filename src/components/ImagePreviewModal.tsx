import React, { useEffect, useState } from 'react';
import { X, Download, ExternalLink, Copy, Check, Image as ImageIcon } from 'lucide-react';
import { SharedFile } from '../types';
import { formatBytes } from '../utils/format';
import { triggerFileDownload } from '../utils/download';

interface ImagePreviewModalProps {
  file: SharedFile | null;
  sessionId: string;
  token: string;
  onClose: () => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  file,
  sessionId,
  token,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isImgLoaded, setIsImgLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!file) return null;

  const viewUrl = `/api/sessions/${sessionId}/files/${file.id}/view?dlToken=${file.downloadToken}&token=${token}`;

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await triggerFileDownload(sessionId, file, token);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyImage = async () => {
    try {
      const res = await fetch(viewUrl);
      const blob = await res.blob();
      // PNG conversion for clipboard if needed
      let clipBlob = blob;
      if (blob.type !== 'image/png') {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = url;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          clipBlob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b || blob), 'image/png'));
        }
        URL.revokeObjectURL(url);
      }

      await navigator.clipboard.write([
        new ClipboardItem({ [clipBlob.type]: clipBlob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Could not copy image directly to clipboard:', err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="min-w-0 pr-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
              {file.name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              <span>{formatBytes(file.size)}</span>
              <span>•</span>
              <span className="uppercase text-[11px] font-semibold tracking-wider text-indigo-600 dark:text-indigo-400">
                {file.mimeType.replace('image/', '') || 'IMAGE'}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Close image preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Image Display Area */}
        <div className="relative flex-1 min-h-[300px] max-h-[65vh] bg-zinc-950 flex items-center justify-center overflow-auto p-4">
          {!isImgLoaded && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-400 text-xs">
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span>Loading image...</span>
              </div>
            </div>
          )}

          {hasError ? (
            <div className="flex flex-col items-center justify-center text-center p-6 text-zinc-400 space-y-2">
              <ImageIcon className="w-12 h-12 text-zinc-600" />
              <p className="text-sm font-medium text-zinc-200">Unable to preview format directly</p>
              <p className="text-xs text-zinc-400 max-w-sm">
                You can download the original file to view it in your device's photo viewer.
              </p>
            </div>
          ) : (
            <img
              src={viewUrl}
              alt={file.name}
              onLoad={() => setIsImgLoaded(true)}
              onError={() => setHasError(true)}
              className={`max-w-full max-h-[62vh] object-contain rounded-lg transition-opacity duration-200 ${
                isImgLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-zinc-50 dark:bg-zinc-900/90 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <a
              href={viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in New Tab</span>
            </a>

            {'ClipboardItem' in window && (
              <button
                onClick={handleCopyImage}
                className="px-3 py-1.5 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Copy Image</span>
                  </>
                )}
              </button>
            )}
          </div>

          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isDownloading ? 'Saving...' : 'Download Image'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
