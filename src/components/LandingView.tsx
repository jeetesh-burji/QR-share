import React, { useState } from 'react';
import {
  QrCode,
  ArrowRight,
  Shield,
  Smartphone,
  Monitor,
  Zap,
  Camera,
  CheckCircle2,
  HardDrive,
  FileCheck,
} from 'lucide-react';

interface LandingViewProps {
  onStartHostSession: () => void;
  onJoinSession: (code: string) => void;
  onOpenScanner: () => void;
  isLoading: boolean;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onStartHostSession,
  onJoinSession,
  onOpenScanner,
  isLoading,
}) => {
  const [code, setCode] = useState('');

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      onJoinSession(code.trim().toUpperCase());
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 sm:py-16 space-y-16">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors">
          <Zap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>Zero Installation • Universal Device Pairing • Auto-Expiring</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight leading-tight">
          Instant QR-Based File Sharing
        </h1>

        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Transfer photos, 4K videos, documents, and ZIP files between devices in seconds.
          No cables, no accounts, no app downloads required.
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <button
            onClick={onStartHostSession}
            disabled={isLoading}
            className="w-full sm:w-auto px-7 py-3.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 active:scale-[0.98] text-white font-medium text-base rounded-xl shadow-md transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
          >
            <QrCode className="w-5 h-5 text-indigo-400 dark:text-indigo-200" />
            <span>{isLoading ? 'Creating Session...' : 'Start Transfer'}</span>
            <ArrowRight className="w-4 h-4 text-zinc-400 dark:text-indigo-200" />
          </button>

          <button
            onClick={onOpenScanner}
            className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium text-base rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <Camera className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            <span>Scan QR Code</span>
          </button>
        </div>

        {/* Manual Code Entry Form */}
        <div className="pt-2">
          <form
            onSubmit={handleJoinSubmit}
            className="inline-flex items-center gap-2 p-1.5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs max-w-md w-full transition-colors"
          >
            <input
              type="text"
              placeholder="Or enter 6-digit session code (e.g. 9X2A1B)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={8}
              className="flex-1 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none uppercase tracking-wider font-mono font-medium bg-transparent"
            />
            <button
              type="submit"
              disabled={!code.trim() || isLoading}
              className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
            >
              Connect
            </button>
          </form>
        </div>
      </div>

      {/* How it Works Step-by-Step */}
      <div className="bg-zinc-50/80 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 sm:p-10 space-y-8 transition-colors">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">How It Works</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Three frictionless steps to move files between any browser</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold text-base">
              1
            </div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">Generate QR Code</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Open the web page on the first device and click Start Transfer to display a unique, encrypted pairing QR code.
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold text-base">
              2
            </div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">Scan to Connect</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Point another device's camera at the QR code. You are connected instantly through high-speed server synchronization.
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold text-base">
              3
            </div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">Pick & Download</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Select files from your device storage. They appear live on the paired device with single-click and batch ZIP download options.
            </p>
          </div>
        </div>
      </div>

      {/* Security & Specification Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="flex items-start gap-3 p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 transition-colors shadow-2xs">
          <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Auto File Purge</h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Files are stored temporarily and automatically shredded after 20 minutes or when you close the session.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 transition-colors shadow-2xs">
          <HardDrive className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">100MB File Limit</h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Generous payload limit per file with multi-file batch upload support for photos, high-res videos, and archives.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 transition-colors shadow-2xs">
          <FileCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">All Formats Allowed</h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Transfer JPG, PNG, MP4, PDF, DOCX, ZIP, MP3, and raw binary formats with full metadata integrity.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 transition-colors shadow-2xs">
          <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Real-Time Progress</h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Live transfer progress indicators, speed calculation, and instant status updates over Server-Sent Events.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
