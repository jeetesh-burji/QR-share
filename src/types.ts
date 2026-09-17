export interface ConnectedDevice {
  id: string;
  role: 'host' | 'guest';
  name: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  connectedAt: number;
  lastPing: number;
}

export interface SharedFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedAt: number;
  uploadedBy: 'host' | 'guest';
  downloadToken: string;
}

export interface LocalUploadTask {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number; // 0 to 100
  status: 'pending' | 'uploading' | 'completed' | 'error' | 'cancelled';
  speed?: string; // e.g. "3.2 MB/s"
  errorMessage?: string;
  xhr?: XMLHttpRequest;
}

export interface ActiveSession {
  sessionId: string;
  code: string;
  token: string;
  guestToken?: string;
  role: 'host' | 'guest';
  expiresAt: number;
  status: 'waiting' | 'connected' | 'completed' | 'expired';
  hostDevice?: ConnectedDevice;
  guestDevice?: ConnectedDevice;
  files: SharedFile[];
}
