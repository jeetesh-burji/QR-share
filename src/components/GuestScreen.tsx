import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Plus,
  Monitor,
  Download,
  File,
  FileText,
  Film,
  Image,
  Archive,
  Music,
  Code,
  AlertCircle,
  XCircle,
  Clock,
  Sparkles,
  ArrowUpCircle,
  Eye,
} from 'lucide-react';
import { ActiveSession, SharedFile, LocalUploadTask } from '../types';
import { formatBytes, formatTimeRemaining, getFileTypeCategory } from '../utils/format';
import { triggerFileDownload } from '../utils/download';
import { ImagePreviewModal } from './ImagePreviewModal';

interface GuestScreenProps {
  session: ActiveSession;
  timeLeft: number;
  onUploadFiles: (files: FileList | File[]) => void;
  localUploads: LocalUploadTask[];
  onCancelUpload: (taskId: string) => void;
  onEndSession: () => void;
  errorMessage?: string;
  successMessage?: string;
}

export const GuestScreen: React.FC<GuestScreenProps> = ({
  session,
  timeLeft,
  onUploadFiles,
  localUploads,
  onCancelUpload,
  onEndSession,
  errorMessage,
  successMessage,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileCount, setSelectedFileCount] = useState(0);
  const [previewImage, setPreviewImage] = useState<SharedFile | null>(null);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFileCount(e.target.files.length);
      onUploadFiles(e.target.files);
      // Reset input value so re-selecting same file triggers onChange
      e.target.value = '';
    }
  };

  const getFileIcon = (mimeType: string, name: string) => {
    const category = getFileTypeCategory(mimeType, name);
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

  // Recent completed uploads
  const completedUploads = localUploads.filter((u) => u.status === 'completed');
  const activeUploads = localUploads.filter((u) => u.status === 'uploading' || u.status === 'pending');

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Alert Messages */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Prominent Connection Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs text-center space-y-4 transition-colors">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Connected ✓</span>
        </div>

        {/* Host Device Info */}
        <div className="flex items-center justify-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <Monitor className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
          <span>Paired with: <strong className="text-zinc-800 dark:text-zinc-200">{session.hostDevice?.name || 'Device'}</strong></span>
          <span>•</span>
          <span className="font-mono">Code: {session.code}</span>
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Select files to transfer directly to the paired device.
        </p>

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Prominent "+ Choose Files" Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-4 px-6 bg-zinc-900 hover:bg-zinc-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 active:scale-[0.98] text-white font-semibold text-lg rounded-xl shadow-md transition-all flex items-center justify-center gap-3 cursor-pointer min-h-[56px]"
        >
          <Plus className="w-6 h-6 text-indigo-400 dark:text-indigo-200 stroke-[2.5]" />
          <span>+ Choose Files</span>
        </button>

        <div className="flex items-center justify-center gap-4 text-xs text-zinc-400 dark:text-zinc-500 pt-1">
          <span>Photos & Videos</span>
          <span>•</span>
          <span>PDFs & Docs</span>
          <span>•</span>
          <span>Up to 100MB</span>
        </div>
      </div>

      {/* Upload Tasks / Real-Time Progress */}
      {localUploads.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4 transition-colors">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
              Upload Progress ({localUploads.length})
            </h3>
            {activeUploads.length > 0 && (
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium animate-pulse">
                Transferring...
              </span>
            )}
          </div>

          <div className="space-y-3">
            {localUploads.map((task) => (
              <div
                key={task.id}
                className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-2.5 transition-all"
              >
                {/* File Name & Size */}
                <div className="flex items-start justify-between gap-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate" title={task.name}>
                      {task.name}
                    </p>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-0.5">{formatBytes(task.size)}</p>
                  </div>

                  {/* Upload Status */}
                  <div className="text-right shrink-0">
                    {task.status === 'completed' && (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/70 px-2 py-0.5 rounded text-[11px] border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        File sent successfully ✓
                      </span>
                    )}
                    {task.status === 'uploading' && (
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400 text-xs">
                        {task.progress}%
                      </span>
                    )}
                    {task.status === 'error' && (
                      <span className="text-rose-600 dark:text-rose-400 font-medium text-xs">
                        {task.errorMessage || 'Failed'}
                      </span>
                    )}
                    {task.status === 'pending' && (
                      <span className="text-zinc-400 dark:text-zinc-500 text-xs">Queued...</span>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-200 ${
                      task.status === 'completed'
                        ? 'bg-emerald-500'
                        : task.status === 'error'
                        ? 'bg-rose-500'
                        : 'bg-indigo-600 dark:bg-indigo-500'
                    }`}
                    style={{ width: `${task.progress}%` }}
                  />
                </div>

                {/* Speed & Cancel */}
                {task.status === 'uploading' && (
                  <div className="flex justify-between items-center text-[11px] text-zinc-500 dark:text-zinc-400 pt-0.5">
                    <span>{task.speed || 'Uploading to server...'}</span>
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

          {/* Prompt to send more */}
          {completedUploads.length > 0 && activeUploads.length === 0 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 px-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Send More Files</span>
            </button>
          )}
        </div>
      )}

      {/* Files Available in Session (Received or already sent) */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4 transition-colors">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">Session Files</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {session.files.length} file{session.files.length === 1 ? '' : 's'} in this transfer
            </p>
          </div>
        </div>

        {session.files.length === 0 ? (
          <div className="py-6 text-center text-zinc-400 dark:text-zinc-500 space-y-1">
            <p className="text-xs">No files transferred in this session yet.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {session.files.map((file) => {
              const isImage = getFileTypeCategory(file.mimeType, file.name) === 'image';
              const isDownloading = downloadingIds.has(file.id);
              const viewUrl = `/api/sessions/${session.sessionId}/files/${file.id}/view?dlToken=${file.downloadToken}&token=${session.token}`;

              return (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    {isImage ? (
                      <div
                        onClick={() => setPreviewImage(file)}
                        className="relative w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 overflow-hidden shrink-0 shadow-xs cursor-pointer group"
                        title="Click to preview full image"
                      >
                        <img
                          src={viewUrl}
                          alt={file.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 flex items-center justify-center transition-colors">
                          <Eye className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 flex items-center justify-center shrink-0">
                        {getFileIcon(file.mimeType, file.name)}
                      </div>
                    )}

                    <div className="min-w-0">
                      <p
                        onClick={() => isImage && setPreviewImage(file)}
                        className={`text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[170px] ${
                          isImage ? 'cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400' : ''
                        }`}
                      >
                        {file.name}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {formatBytes(file.size)} • {file.uploadedBy === 'host' ? 'From Host Device' : 'From Guest Device'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isImage && (
                      <button
                        onClick={() => setPreviewImage(file)}
                        className="p-2 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 rounded-lg text-xs font-medium flex items-center gap-1 shadow-2xs cursor-pointer"
                        title="Preview image"
                      >
                        <Eye className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="hidden sm:inline">Preview</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleDownload(file)}
                      disabled={isDownloading}
                      className="p-2 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 rounded-lg text-xs font-medium flex items-center gap-1 shadow-2xs cursor-pointer disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{isDownloading ? '...' : 'Save'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Session Expiry & Finish Button */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <Clock className="w-3.5 h-3.5" />
          <span>Auto-expires in {formatTimeRemaining(timeLeft)}</span>
        </div>

        <button
          onClick={onEndSession}
          className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 py-2 px-3 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
        >
          Disconnect / Finish
        </button>
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
