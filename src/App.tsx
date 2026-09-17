import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { LandingView } from './components/LandingView';
import { HostScreen } from './components/HostScreen';
import { GuestScreen } from './components/GuestScreen';
import { QrScannerModal } from './components/QrScannerModal';
import { ActiveSession, LocalUploadTask, SharedFile } from './types';
import { detectClientDevice } from './utils/device';

export default function App() {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [localUploads, setLocalUploads] = useState<LocalUploadTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [successMessage, setSuccessMessage] = useState<string | undefined>();
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(undefined), 6000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(undefined), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Countdown timer
  useEffect(() => {
    if (!session || !session.expiresAt) return;

    const interval = setInterval(() => {
      const remaining = session.expiresAt - Date.now();
      if (remaining <= 0) {
        setTimeLeft(0);
        setSession((prev) => (prev ? { ...prev, status: 'expired' } : null));
        setErrorMessage('This transfer session has expired. All temporary files have been deleted.');
        clearInterval(interval);
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);

    setTimeLeft(Math.max(0, session.expiresAt - Date.now()));

    return () => clearInterval(interval);
  }, [session?.expiresAt]);

  // Real-time EventSource (SSE) setup
  useEffect(() => {
    if (!session || !session.sessionId || !session.token) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    const sseUrl = `/api/sessions/${session.sessionId}/events?token=${encodeURIComponent(session.token)}`;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.addEventListener('device:connected', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setSession((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            status: 'connected',
            guestDevice: data.device,
          };
        });
        setSuccessMessage('Device connected successfully! You can now transfer files.');
      } catch (err) {
        console.error('Error parsing device:connected event', err);
      }
    });

    es.addEventListener('device:disconnected', () => {
      setErrorMessage('Device temporarily disconnected.');
    });

    es.addEventListener('files:uploaded', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const incomingFiles: SharedFile[] = data.files || [];
        setSession((prev) => {
          if (!prev) return null;
          // Merge avoiding duplicates
          const existingIds = new Set(prev.files.map((f) => f.id));
          const toAdd = incomingFiles.filter((f) => !existingIds.has(f.id));
          return {
            ...prev,
            files: [...toAdd, ...prev.files],
          };
        });

        if (data.uploaderRole !== session.role) {
          setSuccessMessage(`New file${incomingFiles.length > 1 ? 's' : ''} received!`);
        }
      } catch (err) {
        console.error('Error parsing files:uploaded event', err);
      }
    });

    es.addEventListener('session:refreshed', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setSession((prev) => (prev ? { ...prev, expiresAt: data.expiresAt } : null));
        setSuccessMessage('Session extended by 15 minutes.');
      } catch (err) {
        console.error('Error parsing session:refreshed event', err);
      }
    });

    es.addEventListener('session:expired', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setSession((prev) => (prev ? { ...prev, status: 'expired' } : null));
        setErrorMessage(data.reason || 'Session ended. Files deleted.');
      } catch (err) {
        console.error('Error parsing session:expired event', err);
      }
    });

    es.onerror = () => {
      // EventSource automatically attempts reconnection
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [session?.sessionId, session?.token, session?.role]);

  // Join session handler (Guest)
  const handleJoinSession = useCallback(async (codeOrId: string, secretToken?: string) => {
    setIsLoading(true);
    setErrorMessage(undefined);
    try {
      const clientInfo = detectClientDevice();
      const res = await fetch('/api/sessions/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeOrId,
          token: secretToken,
          deviceInfo: {
            name: clientInfo.name,
            deviceType: clientInfo.deviceType,
            browser: clientInfo.browser,
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to connect to transfer session');
      }

      const data = await res.json();
      setSession({
        sessionId: data.sessionId,
        code: data.code,
        token: data.token,
        role: 'guest',
        expiresAt: data.expiresAt,
        status: data.status,
        hostDevice: data.hostDevice,
        guestDevice: data.guestDevice,
        files: data.files || [],
      });
      setSuccessMessage('Connected ✓');
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not join session. Check the code or try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Parse URL hash on mount for instant QR pairing from mobile camera
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash;
    const urlParams = new URLSearchParams(window.location.search);

    let pairCode = urlParams.get('pair') || '';
    let pairToken = urlParams.get('token') || '';

    if (!pairCode && hash.includes('pair=')) {
      const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
      pairCode = hashParams.get('pair') || '';
      pairToken = hashParams.get('token') || '';
    }

    if (pairCode) {
      handleJoinSession(pairCode, pairToken);
      // Clean up URL hash without reloading page
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [handleJoinSession]);

  // Create new session handler (Host)
  const handleStartHostSession = async () => {
    setIsLoading(true);
    setErrorMessage(undefined);
    try {
      const clientInfo = detectClientDevice();
      const res = await fetch('/api/sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceName: clientInfo.name,
          deviceType: clientInfo.deviceType,
          browser: clientInfo.browser,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create transfer session');
      }

      const data = await res.json();
      setSession({
        sessionId: data.sessionId,
        code: data.code,
        token: data.token,
        guestToken: data.guestToken,
        role: 'host',
        expiresAt: data.expiresAt,
        status: 'waiting',
        hostDevice: data.device,
        files: [],
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not start transfer session');
    } finally {
      setIsLoading(false);
    }
  };

async function convertImageToJpegViaCanvas(file: File): Promise<File | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          return resolve(null);
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) return resolve(null);
            const baseName = file.name.replace(/\.(heic|heif)$/i, '');
            const jpegFile = new File([blob], `${baseName}.jpg`, {
              type: 'image/jpeg',
              lastModified: file.lastModified,
            });
            resolve(jpegFile);
          },
          'image/jpeg',
          0.92
        );
      } catch {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

async function prepareFileForUpload(file: File): Promise<File> {
  let currentFile = file;

  // 1. Check if extension is missing and infer from MIME type
  const hasExt = /\.[a-zA-Z0-9]{2,8}$/.test(currentFile.name);
  if (!hasExt) {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/svg+xml': '.svg',
      'image/bmp': '.bmp',
      'image/heic': '.heic',
      'image/heif': '.heif',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/quicktime': '.mov',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
      'audio/ogg': '.ogg',
      'audio/mp4': '.m4a',
      'application/pdf': '.pdf',
      'application/zip': '.zip',
    };
    const ext = mimeToExt[currentFile.type.toLowerCase()];
    if (ext) {
      currentFile = new File([currentFile], `${currentFile.name}${ext}`, {
        type: currentFile.type,
        lastModified: currentFile.lastModified,
      });
    }
  }

  // 2. Convert HEIC/HEIF photos (e.g. from mobile devices) to standard JPEG when canvas decoding is available
  const isHeic =
    currentFile.type.toLowerCase().includes('heic') ||
    currentFile.type.toLowerCase().includes('heif') ||
    /\.heic$/i.test(currentFile.name) ||
    /\.heif$/i.test(currentFile.name);

  if (isHeic && typeof window !== 'undefined') {
    try {
      const converted = await convertImageToJpegViaCanvas(currentFile);
      if (converted) {
        return converted;
      }
    } catch {
      // Fallback to original file
    }
  }

  return currentFile;
}

  // Upload file(s) with real-time XHR progress tracking
  const handleUploadFiles = async (fileList: FileList | File[]) => {
    if (!session) return;
    const rawFiles = Array.from(fileList);

    // Limit check: 100MB per file
    const maxBytes = 100 * 1024 * 1024;
    const oversized = rawFiles.filter((f) => f.size > maxBytes);
    if (oversized.length > 0) {
      setErrorMessage(
        `File "${oversized[0].name}" exceeds the 100MB limit. Please choose a smaller file.`
      );
      return;
    }

    // Normalize files (ensure extensions, convert HEIC if supported)
    const files = await Promise.all(rawFiles.map((f) => prepareFileForUpload(f)));

    // Process files
    files.forEach((file) => {
      const taskId = Math.random().toString(36).substring(2, 9);
      const startTime = Date.now();

      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('files', file);

      const newTask: LocalUploadTask = {
        id: taskId,
        file,
        name: file.name,
        size: file.size,
        progress: 0,
        status: 'uploading',
        speed: '0 KB/s',
        xhr,
      };

      setLocalUploads((prev) => [newTask, ...prev]);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
          const elapsedSec = (Date.now() - startTime) / 1000;
          let speedStr = '';
          if (elapsedSec > 0.3) {
            const bytesPerSec = event.loaded / elapsedSec;
            if (bytesPerSec > 1024 * 1024) {
              speedStr = `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
            } else {
              speedStr = `${Math.round(bytesPerSec / 1024)} KB/s`;
            }
          }

          setLocalUploads((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, progress: percent, speed: speedStr } : t))
          );
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            const uploadedList: SharedFile[] = res.files || [];

            setLocalUploads((prev) =>
              prev.map((t) =>
                t.id === taskId ? { ...t, progress: 100, status: 'completed', speed: 'Done' } : t
              )
            );

            // Add to session files if not already there
            setSession((prev) => {
              if (!prev) return null;
              const existingIds = new Set(prev.files.map((f) => f.id));
              const toAdd = uploadedList.filter((f) => !existingIds.has(f.id));
              return {
                ...prev,
                files: [...toAdd, ...prev.files],
              };
            });

            setSuccessMessage(
              session.role === 'guest'
                ? 'File sent successfully ✓'
                : `Uploaded "${file.name}" to session.`
            );
          } catch {
            setLocalUploads((prev) =>
              prev.map((t) =>
                t.id === taskId
                  ? { ...t, status: 'error', errorMessage: 'Invalid server response' }
                  : t
              )
            );
          }
        } else {
          let errTxt = 'Upload failed';
          try {
            const errRes = JSON.parse(xhr.responseText);
            errTxt = errRes.error || errTxt;
          } catch {}
          setLocalUploads((prev) =>
            prev.map((t) =>
              t.id === taskId ? { ...t, status: 'error', errorMessage: errTxt } : t
            )
          );
        }
      };

      xhr.onerror = () => {
        setLocalUploads((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, status: 'error', errorMessage: 'Network error' } : t
          )
        );
      };

      xhr.open('POST', `/api/sessions/${session.sessionId}/upload`);
      xhr.setRequestHeader('x-session-token', session.token);
      xhr.send(formData);
    });
  };

  const handleCancelUpload = (taskId: string) => {
    setLocalUploads((prev) => {
      const target = prev.find((t) => t.id === taskId);
      if (target && target.xhr) {
        target.xhr.abort();
      }
      return prev.filter((t) => t.id !== taskId);
    });
  };

  const handleRefreshSession = async () => {
    if (!session) return;
    try {
      const res = await fetch(`/api/sessions/${session.sessionId}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': session.token,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setSession((prev) => (prev ? { ...prev, expiresAt: data.expiresAt } : null));
        setSuccessMessage('Session refreshed and extended.');
      }
    } catch (err) {
      console.error('Refresh error', err);
    }
  };

  const handleEndSession = async () => {
    if (!session) return;
    try {
      await fetch(`/api/sessions/${session.sessionId}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': session.token,
        },
      });
    } catch {}
    setSession(null);
    setLocalUploads([]);
    setSuccessMessage('Transfer session ended. All files safely shredded.');
  };

  // Handle camera QR code scan result
  const handleScanSuccess = (decodedText: string) => {
    setIsScannerOpen(false);
    let codeToUse = decodedText.trim();

    // Check if it's a full URL
    try {
      if (codeToUse.includes('pair=')) {
        const match = codeToUse.match(/pair=([A-Z0-9]+)/i);
        if (match && match[1]) {
          codeToUse = match[1];
        }
      }
    } catch {}

    handleJoinSession(codeToUse);
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 selection:bg-indigo-500 selection:text-white transition-colors duration-200">
      <Header
        session={session}
        timeLeft={timeLeft}
        onRefresh={handleRefreshSession}
        onEndSession={handleEndSession}
        onHomeClick={() => {
          if (session) {
            if (confirm('Leave this transfer session? Any uploaded files will remain until the session expires.')) {
              setSession(null);
            }
          }
        }}
      />

      <main className="flex-1 flex flex-col justify-center">
        {!session || session.status === 'expired' ? (
          <LandingView
            onStartHostSession={handleStartHostSession}
            onJoinSession={handleJoinSession}
            onOpenScanner={() => setIsScannerOpen(true)}
            isLoading={isLoading}
          />
        ) : session.role === 'host' ? (
          <HostScreen
            session={session}
            timeLeft={timeLeft}
            onRefreshSession={handleRefreshSession}
            onEndSession={handleEndSession}
            onUploadFiles={handleUploadFiles}
            localUploads={localUploads}
            onCancelUpload={handleCancelUpload}
            errorMessage={errorMessage}
            successMessage={successMessage}
          />
        ) : (
          <GuestScreen
            session={session}
            timeLeft={timeLeft}
            onUploadFiles={handleUploadFiles}
            localUploads={localUploads}
            onCancelUpload={handleCancelUpload}
            onEndSession={handleEndSession}
            errorMessage={errorMessage}
            successMessage={successMessage}
          />
        )}
      </main>

      {/* QR Scanner Modal for in-browser scanning */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />

      {/* Footer */}
      <footer className="w-full border-t border-zinc-200 dark:border-zinc-800 py-4 px-4 text-center text-xs text-zinc-500 dark:text-zinc-400 bg-white/50 dark:bg-zinc-900/50 transition-colors">
        <p>
          QR Share • End-to-end encrypted transfer sessions • Files are temporary and deleted automatically
        </p>
      </footer>
    </div>
  );
}
