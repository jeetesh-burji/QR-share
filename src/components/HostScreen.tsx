import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone,
  CheckCircle2,
  Clock,
  Download,
  UploadCloud,
  File,
  FileText,
  Film,
  Image,
  Archive,
  Music,
  Code,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  FolderDown,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { ActiveSession, SharedFile, LocalUploadTask } from '../types';
import { formatBytes, formatTimeRemaining, getFileTypeCategory } from '../utils/format';
import { triggerFileDownload } from '../utils/download';
import { ImagePreviewModal } from './ImagePreviewModal';

interface HostScreenProps {
  session: ActiveSession;
  timeLeft: number;
  onRefreshSession: () => void;
  onEndSession: () => void;
  onUploadFiles: (files: FileList | File[]) => void;
  localUploads: LocalUploadTask[];
  onCancelUpload: (taskId: string) => void;
  errorMessage?: string;
  successMessage?: string;
}

export const HostScreen: React.FC<HostScreenProps> = ({
  session,
  timeLeft,
  onRefreshSession,
  onEndSession,
  onUploadFiles,
  localUploads,
  onCancelUpload,
  errorMessage,
  successMessage,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewImage, setPreviewImage] = useState<SharedFile | null>(null);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownload = async (file: SharedFile) => {
    setDownloadingIds((prev) => new Set(prev).add(file.id));
    try {
      await triggerFileDownload(session.sessionId, file, session.token);
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(file.id);
        return next;
      });
    }
  };

  // Generate pairing URL that directly joins the session
  const pairingUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/#pair=${session.code}&token=${session.guestToken || session.token}`
    : '';

  useEffect(() => {
    if (pairingUrl) {
      QRCode.toDataURL(pairingUrl, {
        width: 380,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate QR code', err));
    }
  }, [pairingUrl]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(pairingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadFiles(e.dataTransfer.files);
    }
  };

  const getFileIcon = (file: SharedFile) => {
    const category = getFileTypeCategory(file.mimeType, file.name);
    switch (category) {
      case 'image':
        return <Image className="w-5 h-5 text-indigo-500" />;
      case 'video':
        return <Film className="w-5 h-5 text-rose-500" />;
      case 'audio':
        return <Music className="w-5 h-5 text-amber-500" />;
      case 'document':
        return <FileText className="w-5 h-5 text-blue-500" />;
      case 'archive':
        return <Archive className="w-5 h-5 text-emerald-500" />;
      case 'code':
        return <Code className="w-5 h-5 text-purple-500" />;
      default:
        return <File className="w-5 h-5 text-zinc-500" />;
    }
  };

  const isConnected = session.status === 'connected';

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Alert Messages */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Grid: Left is QR / Connection Card, Right is Files / Dropzone */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: QR & Status (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col items-center text-center space-y-6 transition-colors">
          {/* Main Title */}
          <div className="space-y-1.5 w-full">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Share files instantly
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Scan this QR code with another device to connect.
            </p>
          </div>

          {/* QR Code Container */}
          <div className="relative group p-4 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-2xl flex items-center justify-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Scan to pair device"
                className="w-64 h-64 sm:w-72 sm:h-72 object-contain rounded-xl bg-white p-2 shadow-xs"
              />
            ) : (
              <div className="w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse">
                <RefreshCw className="w-8 h-8 text-zinc-400 animate-spin" />
              </div>
            )}

            {/* Quick Refresh Floating Button */}
            <button
              onClick={onRefreshSession}
              title="Refresh QR Code"
              className="absolute top-6 right-6 p-2 bg-white/90 dark:bg-zinc-800/90 hover:bg-white dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Status under the QR code */}
          <div className="w-full">
            {isConnected ? (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-semibold text-base">Device connected ✓</span>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 flex items-center justify-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
                <span className="font-medium text-sm">Waiting for device...</span>
              </div>
            )}
          </div>

          {/* Device details if connected */}
          {isConnected && session.guestDevice && (
            <div className="w-full text-left p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-300 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
                  {session.guestDevice.name}
                </span>
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Active</span>
              </div>
              <p className="text-zinc-500 dark:text-zinc-400">Connected via {session.guestDevice.browser}</p>
            </div>
          )}

          {/* Pairing Code & Direct Link */}
          <div className="w-full pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>Session Code:</span>
              <span className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                {session.code}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopyLink}
                className="flex-1 py-2 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Link Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                    <span>Copy Pairing Link</span>
                  </>
                )}
              </button>

              <a
                href={pairingUrl}
                target="_blank"
                rel="noreferrer"
                title="Open in new window for testing"
                className="py-2 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 flex items-center justify-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                <span>Test Tab</span>
              </a>
            </div>

            <div className="text-[11px] text-zinc-400 dark:text-zinc-500 flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Session auto-expires in {formatTimeRemaining(timeLeft)}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Incoming Files & Drag-and-Drop (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Drag and Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer ${
              isDragOver
                ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 scale-[1.01]'
                : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 bg-white dark:bg-zinc-900 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              className="hidden"
              onChange={(e) => e.target.files && onUploadFiles(e.target.files)}
            />
            <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3 text-zinc-600 dark:text-zinc-400">
              <UploadCloud className="w-6 h-6 text-zinc-700 dark:text-zinc-300" />
            </div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">
              Send files to connected device
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
              Drag & drop files here, or click to browse. Supports photos, videos, archives, and docs up to 100MB.
            </p>
          </div>

          {/* Active Local Upload Progress */}
          {localUploads.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-3 transition-colors">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <span>Sending Files...</span>
                <span>{localUploads.filter((u) => u.status === 'completed').length}/{localUploads.length} Done</span>
              </div>
              <div className="space-y-2">
                {localUploads.map((task) => (
                  <div key={task.id} className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[200px]">
                        {task.name}
                      </span>
                      <span className="text-zinc-500 dark:text-zinc-400">{formatBytes(task.size)} • {task.progress}%</span>
                    </div>
                    <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-indigo-600 dark:bg-indigo-500 h-1.5 rounded-full transition-all duration-200"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                    {task.status === 'uploading' && (
                      <div className="flex justify-between items-center text-[11px] text-zinc-400">
                        <span>{task.speed || 'Transferring...'}</span>
                        <button
                          onClick={() => onCancelUpload(task.id)}
                          className="text-rose-600 dark:text-rose-400 hover:text-rose-700 font-medium cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transferred Files Section */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs space-y-4 transition-colors">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">Transferred Files</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {session.files.length === 0
                    ? 'No files received yet. Select files on your paired device or drop them above.'
                    : `${session.files.length} file${session.files.length > 1 ? 's' : ''} ready for download`}
                </p>
              </div>

              {session.files.length > 1 && (
                <a
                  href={`/api/sessions/${session.sessionId}/download-all?token=${session.token}`}
                  className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <FolderDown className="w-4 h-4" />
                  <span>Download All (.zip)</span>
                </a>
              )}
            </div>

            {session.files.length === 0 ? (
              <div className="py-12 text-center text-zinc-400 dark:text-zinc-500 space-y-2">
                <File className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-600 stroke-1" />
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Waiting for files</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 max-w-xs mx-auto">
                  When you pick photos, videos, or documents on your connected device, they will appear right here instantly.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {session.files.map((file) => {
                  const isImage = getFileTypeCategory(file.mimeType, file.name) === 'image';
                  const isDownloading = downloadingIds.has(file.id);
                  const viewUrl = `/api/sessions/${session.sessionId}/files/${file.id}/view?dlToken=${file.downloadToken}&token=${session.token}`;

                  return (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3.5 bg-zinc-50/80 hover:bg-zinc-50 dark:bg-zinc-800/50 dark:hover:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-3">
                        {isImage ? (
                          <div
                            onClick={() => setPreviewImage(file)}
                            className="relative w-11 h-11 rounded-lg bg-zinc-100 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 overflow-hidden shrink-0 shadow-xs cursor-pointer group"
                            title="Click to preview full image"
                          >
                            <img
                              src={viewUrl}
                              alt={file.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              onError={(e) => {
                                // Fallback to icon if thumbnail fails
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 flex items-center justify-center transition-colors">
                              <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-sm" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 flex items-center justify-center shrink-0 shadow-xs">
                            {getFileIcon(file)}
                          </div>
                        )}

                        <div className="min-w-0">
                          <h4
                            onClick={() => isImage && setPreviewImage(file)}
                            className={`text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate ${
                              isImage ? 'cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400' : ''
                            }`}
                            title={file.name}
                          >
                            {file.name}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            <span>{formatBytes(file.size)}</span>
                            <span>•</span>
                            <span className="capitalize">
                              {file.uploadedBy === 'guest' ? 'From Guest Device' : 'From Host Device'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isImage && (
                          <button
                            onClick={() => setPreviewImage(file)}
                            className="px-3 py-2 bg-white hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                            title="Preview image"
                          >
                            <Eye className="w-3.5 h-3.5 text-zinc-500" />
                            <span className="hidden sm:inline">Preview</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleDownload(file)}
                          disabled={isDownloading}
                          className="px-4 py-2 bg-white hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                          <span>{isDownloading ? 'Saving...' : 'Download'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      <ImagePreviewModal
        file={previewImage}
        sessionId={session.sessionId}
        token={session.token}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
};
