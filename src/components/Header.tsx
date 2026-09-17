import React from 'react';
import { QrCode, Clock, ShieldCheck, RefreshCw, XCircle } from 'lucide-react';
import { ActiveSession } from '../types';
import { formatTimeRemaining } from '../utils/format';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  session: ActiveSession | null;
  timeLeft: number;
  onRefresh: () => void;
  onEndSession: () => void;
  onHomeClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  session,
  timeLeft,
  onRefresh,
  onEndSession,
  onHomeClick,
}) => {
  return (
    <header className="w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md sticky top-0 z-40 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <button
          onClick={onHomeClick}
          className="flex items-center gap-2.5 text-left group focus:outline-none shrink-0"
        >
          <div className="w-9 h-9 rounded-xl bg-zinc-900 dark:bg-zinc-800 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
            <QrCode className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <span className="font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 text-base flex items-center gap-1.5">
              QR Share
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Secure
              </span>
            </span>
          </div>
        </button>

        {/* Right side info & theme controls */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {session ? (
            <>
              {/* Expiration timer */}
              <div
                className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                  timeLeft < 180000
                    ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 animate-pulse'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                }`}
                title="Time until this temporary session auto-expires and deletes all files"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Expires: {formatTimeRemaining(timeLeft)}</span>
              </div>

              {/* Device connection status pill */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200">
                {session.status === 'connected' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="hidden md:inline">Device connected</span>
                    <span className="md:hidden">Connected</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>Waiting</span>
                  </>
                )}
              </div>

              {/* Refresh button */}
              {session.role === 'host' && (
                <button
                  onClick={onRefresh}
                  title="Refresh and extend session"
                  className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}

              {/* End session */}
              <button
                onClick={onEndSession}
                title="End session and delete files immediately"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900 transition-colors cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span className="hidden sm:inline">End</span>
              </button>
            </>
          ) : (
            <div className="hidden md:flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Temporary Storage • Auto-Deleted</span>
            </div>
          )}

          {/* Theme Mode Toggle (Light / Dark / System) */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};
