import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import multer from 'multer';
import JSZip from 'jszip';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// Temporary upload root
const TEMP_UPLOAD_ROOT = path.join(os.tmpdir(), 'qr_file_share_uploads');
if (!fs.existsSync(TEMP_UPLOAD_ROOT)) {
  fs.mkdirSync(TEMP_UPLOAD_ROOT, { recursive: true });
}

// Session types
export interface SessionFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedAt: number;
  uploadedBy: 'host' | 'guest';
  diskPath: string;
  downloadToken: string;
}

export interface ConnectedDevice {
  id: string;
  role: 'host' | 'guest';
  name: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  connectedAt: number;
  lastPing: number;
}

export interface ShareSession {
  id: string;
  code: string;
  hostToken: string;
  guestToken: string;
  createdAt: number;
  expiresAt: number;
  status: 'waiting' | 'connected' | 'completed' | 'expired';
  hostDevice?: ConnectedDevice;
  guestDevice?: ConnectedDevice;
  files: SessionFile[];
  sseClients: Array<{
    id: string;
    role: 'host' | 'guest';
    res: express.Response;
  }>;
}

// In-memory session store
const sessions = new Map<string, ShareSession>();
const codeToSessionId = new Map<string, string>();

// Helpers
function generateSessionCode(): string {
  // 6-character easy-to-read uppercase alphanumeric (exclude ambiguous characters 0, O, 1, I, L)
  const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function broadcastToSession(session: ShareSession, event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  session.sseClients.forEach(client => {
    try {
      client.res.write(payload);
    } catch {
      // client connection might be dead
    }
  });
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._\- ()]/g, '_').substring(0, 150);
}

function detectFileTypeFromBuffer(buffer: Buffer): { ext: string; mime: string } | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: '.jpg', mime: 'image/jpeg' };
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ext: '.png', mime: 'image/png' };
  }
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return { ext: '.gif', mime: 'image/gif' };
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { ext: '.webp', mime: 'image/webp' };
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { ext: '.pdf', mime: 'application/pdf' };
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)
  ) {
    return { ext: '.zip', mime: 'application/zip' };
  }
  if (buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return { ext: '.bmp', mime: 'image/bmp' };
  }
  if (buffer.length >= 12 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    const brand = buffer.subarray(8, 12).toString('ascii').toLowerCase();
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) {
      return { ext: '.heic', mime: 'image/heic' };
    }
    if (['isom', 'mp41', 'mp42', 'qt  ', 'avc1'].includes(brand)) {
      return { ext: '.mp4', mime: 'video/mp4' };
    }
  }
  return null;
}

function resolveAccurateFileInfo(filePath: string, rawOriginalName: string, reportedMime: string): { name: string; mimeType: string } {
  let decodedName = rawOriginalName;
  try {
    const candidate = Buffer.from(rawOriginalName, 'latin1').toString('utf8');
    if (candidate && !candidate.includes('\ufffd') && candidate !== rawOriginalName) {
      decodedName = candidate;
    }
  } catch {}

  let magic: { ext: string; mime: string } | null = null;
  try {
    const fd = fs.openSync(filePath, 'r');
    const headerBuf = Buffer.alloc(64);
    const bytesRead = fs.readSync(fd, headerBuf, 0, 64, 0);
    fs.closeSync(fd);
    magic = detectFileTypeFromBuffer(headerBuf.subarray(0, bytesRead));
  } catch (err) {
    console.error('Error reading file magic bytes:', err);
  }

  let finalMime = reportedMime || 'application/octet-stream';
  if (magic?.mime) {
    if (finalMime === 'application/octet-stream' || finalMime === 'application/x-download' || !finalMime || magic.mime.startsWith('image/')) {
      finalMime = magic.mime;
    }
  }

  let cleanName = decodedName.trim();
  if (!cleanName) {
    cleanName = 'shared_file';
  }

  const existingExt = path.extname(cleanName);
  if (!existingExt || existingExt === '.') {
    const fallbackExt = magic?.ext || (finalMime === 'image/jpeg' ? '.jpg' : finalMime === 'image/png' ? '.png' : finalMime === 'image/webp' ? '.webp' : finalMime === 'image/gif' ? '.gif' : finalMime === 'application/pdf' ? '.pdf' : '');
    if (fallbackExt) {
      cleanName = `${cleanName}${fallbackExt}`;
    }
  } else if (magic?.ext && ['.bin', '.dat', '.tmp', '.octet-stream', '.part'].includes(existingExt.toLowerCase())) {
    cleanName = `${cleanName.slice(0, -existingExt.length)}${magic.ext}`;
  }

  return {
    name: cleanName,
    mimeType: finalMime,
  };
}

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now > session.expiresAt || session.status === 'expired') {
      destroySession(id, 'Session expired due to inactivity');
    }
  }
}, 30000);

async function destroySession(sessionId: string, reason?: string) {
  const session = sessions.get(sessionId);
  if (!session) return;

  broadcastToSession(session, 'session:expired', {
    reason: reason || 'Session ended',
    timestamp: Date.now(),
  });

  // Close all SSE streams
  session.sseClients.forEach(c => {
    try {
      c.res.end();
    } catch {}
  });
  session.sseClients = [];

  // Remove files on disk
  const sessionDir = path.join(TEMP_UPLOAD_ROOT, sessionId);
  if (fs.existsSync(sessionDir)) {
    try {
      await fs.promises.rm(sessionDir, { recursive: true, force: true });
    } catch (err) {
      console.error(`Failed to delete session directory: ${sessionDir}`, err);
    }
  }

  codeToSessionId.delete(session.code);
  sessions.delete(sessionId);
}

// Express middlewares
app.use(express.json());

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sessionId = req.params.sessionId;
    const sessionDir = path.join(TEMP_UPLOAD_ROOT, sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    cb(null, sessionDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(8).toString('hex');
    const safeName = sanitizeFilename(file.originalname);
    cb(null, `${uniqueSuffix}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max per file
    files: 10, // 10 files per request
  },
});

// ================= API ROUTES =================

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', activeSessions: sessions.size });
});

// 2. Create Session (initiated by Host)
app.post('/api/sessions/create', (req, res) => {
  const sessionId = crypto.randomBytes(8).toString('hex');
  let code = generateSessionCode();
  // Ensure uniqueness
  while (codeToSessionId.has(code)) {
    code = generateSessionCode();
  }

  const hostToken = crypto.randomBytes(16).toString('hex');
  const guestToken = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  const sessionDurationMs = 20 * 60 * 1000; // 20 minutes expiration

  const deviceInfo: ConnectedDevice = {
    id: crypto.randomBytes(6).toString('hex'),
    role: 'host',
    name: req.body.deviceName || 'Host Device',
    deviceType: req.body.deviceType || 'desktop',
    browser: req.body.browser || 'Browser',
    connectedAt: now,
    lastPing: now,
  };

  const session: ShareSession = {
    id: sessionId,
    code,
    hostToken,
    guestToken,
    createdAt: now,
    expiresAt: now + sessionDurationMs,
    status: 'waiting',
    hostDevice: deviceInfo,
    files: [],
    sseClients: [],
  };

  sessions.set(sessionId, session);
  codeToSessionId.set(code, sessionId);

  // Auto clean empty directory if created
  const sessionDir = path.join(TEMP_UPLOAD_ROOT, sessionId);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  res.json({
    sessionId,
    code,
    token: hostToken,
    guestToken,
    expiresAt: session.expiresAt,
    device: deviceInfo,
  });
});

// 3. Join Session (usually initiated by Mobile via QR code or manual code)
app.post('/api/sessions/join', (req, res) => {
  const { codeOrId, token, deviceInfo } = req.body;

  if (!codeOrId) {
    return res.status(400).json({ error: 'Session code or ID is required' });
  }

  let sessionId = codeOrId;
  if (codeToSessionId.has(codeOrId.toUpperCase())) {
    sessionId = codeToSessionId.get(codeOrId.toUpperCase())!;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or has expired' });
  }

  if (Date.now() > session.expiresAt || session.status === 'expired') {
    destroySession(sessionId, 'Session has expired');
    return res.status(410).json({ error: 'This transfer session has expired' });
  }

  const now = Date.now();
  const guestDevice: ConnectedDevice = {
    id: crypto.randomBytes(6).toString('hex'),
    role: 'guest',
    name: deviceInfo?.name || 'Guest Device',
    deviceType: deviceInfo?.deviceType || 'mobile',
    browser: deviceInfo?.browser || 'Browser',
    connectedAt: now,
    lastPing: now,
  };

  session.guestDevice = guestDevice;
  session.status = 'connected';

  // Broadcast device connected event to host and any listeners
  broadcastToSession(session, 'device:connected', {
    device: guestDevice,
    sessionStatus: session.status,
    timestamp: now,
  });

  res.json({
    sessionId: session.id,
    code: session.code,
    token: session.guestToken,
    expiresAt: session.expiresAt,
    hostDevice: session.hostDevice,
    guestDevice,
    status: session.status,
    files: session.files.map(f => ({
      id: f.id,
      name: f.name,
      size: f.size,
      mimeType: f.mimeType,
      uploadedAt: f.uploadedAt,
      uploadedBy: f.uploadedBy,
      downloadToken: f.downloadToken,
    })),
  });
});

// 4. Session Status & File list
app.get('/api/sessions/:sessionId/status', (req, res) => {
  const { sessionId } = req.params;
  const token = req.query.token as string;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  if (Date.now() > session.expiresAt) {
    destroySession(sessionId, 'Session expired');
    return res.status(410).json({ error: 'Session expired' });
  }

  if (token && token !== session.hostToken && token !== session.guestToken) {
    return res.status(403).json({ error: 'Unauthorized token for session' });
  }

  res.json({
    sessionId: session.id,
    code: session.code,
    status: session.status,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    hostDevice: session.hostDevice,
    guestDevice: session.guestDevice,
    files: session.files.map(f => ({
      id: f.id,
      name: f.name,
      size: f.size,
      mimeType: f.mimeType,
      uploadedAt: f.uploadedAt,
      uploadedBy: f.uploadedBy,
      downloadToken: f.downloadToken,
    })),
  });
});

// 5. Server-Sent Events (SSE) Real-time updates
app.get('/api/sessions/:sessionId/events', (req, res) => {
  const { sessionId } = req.params;
  const token = req.query.token as string;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (token !== session.hostToken && token !== session.guestToken) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const role: 'host' | 'guest' = token === session.hostToken ? 'host' : 'guest';
  const clientId = crypto.randomBytes(6).toString('hex');

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('\n');

  const client = { id: clientId, role, res };
  session.sseClients.push(client);

  // Send initial state
  const initialPayload = {
    type: 'init',
    sessionStatus: session.status,
    hostDevice: session.hostDevice,
    guestDevice: session.guestDevice,
    expiresAt: session.expiresAt,
    filesCount: session.files.length,
  };
  res.write(`event: session:init\ndata: ${JSON.stringify(initialPayload)}\n\n`);

  // Periodic heartbeat
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    session.sseClients = session.sseClients.filter(c => c.id !== clientId);

    // If a guest client disconnected, notify host after short grace
    setTimeout(() => {
      const activeGuest = session.sseClients.some(c => c.role === 'guest');
      if (!activeGuest && session.guestDevice && session.status === 'connected') {
        broadcastToSession(session, 'device:disconnected', {
          role: 'guest',
          timestamp: Date.now(),
        });
      }
    }, 3000);
  });
});

// 6. Upload Files (both Host and Guest can upload!)
app.post('/api/sessions/:sessionId/upload', upload.array('files', 10), (req, res) => {
  const { sessionId } = req.params;
  const token = req.headers['x-session-token'] as string || req.body.token;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (token !== session.hostToken && token !== session.guestToken) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (Date.now() > session.expiresAt) {
    destroySession(sessionId, 'Session expired');
    return res.status(410).json({ error: 'Session has expired' });
  }

  const uploadedFiles = req.files as Express.Multer.File[];
  if (!uploadedFiles || uploadedFiles.length === 0) {
    return res.status(400).json({ error: 'No files provided' });
  }

  const role: 'host' | 'guest' = token === session.hostToken ? 'host' : 'guest';
  const newFiles: SessionFile[] = [];

  for (const file of uploadedFiles) {
    const fileId = crypto.randomBytes(8).toString('hex');
    const downloadToken = crypto.randomBytes(12).toString('hex');

    const accurate = resolveAccurateFileInfo(file.path, file.originalname, file.mimetype);

    const fileRecord: SessionFile = {
      id: fileId,
      name: accurate.name,
      size: file.size,
      mimeType: accurate.mimeType,
      uploadedAt: Date.now(),
      uploadedBy: role,
      diskPath: file.path,
      downloadToken,
    };

    session.files.push(fileRecord);
    newFiles.push(fileRecord);
  }

  // Broadcast to all connected devices
  broadcastToSession(session, 'files:uploaded', {
    files: newFiles.map(f => ({
      id: f.id,
      name: f.name,
      size: f.size,
      mimeType: f.mimeType,
      uploadedAt: f.uploadedAt,
      uploadedBy: f.uploadedBy,
      downloadToken: f.downloadToken,
    })),
    uploaderRole: role,
    totalFilesCount: session.files.length,
  });

  res.json({
    success: true,
    files: newFiles.map(f => ({
      id: f.id,
      name: f.name,
      size: f.size,
      mimeType: f.mimeType,
      uploadedAt: f.uploadedAt,
      uploadedBy: f.uploadedBy,
      downloadToken: f.downloadToken,
    })),
  });
});

// 7. Download Single File
app.get('/api/sessions/:sessionId/files/:fileId/download', (req, res) => {
  const { sessionId, fileId } = req.params;
  const token = req.query.token as string;
  const downloadToken = req.query.dlToken as string;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  if (Date.now() > session.expiresAt) {
    destroySession(sessionId, 'Session expired');
    return res.status(410).json({ error: 'Session expired' });
  }

  const fileRecord = session.files.find(f => f.id === fileId);
  if (!fileRecord) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Token validation: must have valid session token OR file download token
  const hasValidSessionToken = token && (token === session.hostToken || token === session.guestToken);
  const hasValidDlToken = downloadToken && downloadToken === fileRecord.downloadToken;

  if (!hasValidSessionToken && !hasValidDlToken) {
    return res.status(403).json({ error: 'Invalid or missing authorization token' });
  }

  if (!fs.existsSync(fileRecord.diskPath)) {
    return res.status(404).json({ error: 'File data no longer available on server' });
  }

  const ext = path.extname(fileRecord.name);
  const base = path.basename(fileRecord.name, ext);
  const safeAsciiBase = base.replace(/[^a-zA-Z0-9_-]/g, '_') || 'file';
  const safeAsciiFilename = `${safeAsciiBase}${ext}`;
  const encodedFilename = encodeURIComponent(fileRecord.name);

  res.setHeader('Content-Type', fileRecord.mimeType || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${safeAsciiFilename}"; filename*=UTF-8''${encodedFilename}`
  );
  res.setHeader('Content-Length', fileRecord.size);
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const readStream = fs.createReadStream(fileRecord.diskPath);
  readStream.pipe(res);
});

// 7b. Inline View File (for image previews and browser inspection)
app.get('/api/sessions/:sessionId/files/:fileId/view', (req, res) => {
  const { sessionId, fileId } = req.params;
  const token = req.query.token as string;
  const downloadToken = req.query.dlToken as string;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).send('Session not found or expired');
  }

  const fileRecord = session.files.find(f => f.id === fileId);
  if (!fileRecord || !fs.existsSync(fileRecord.diskPath)) {
    return res.status(404).send('File not found');
  }

  const hasValidSessionToken = token && (token === session.hostToken || token === session.guestToken);
  const hasValidDlToken = downloadToken && downloadToken === fileRecord.downloadToken;

  if (!hasValidSessionToken && !hasValidDlToken) {
    return res.status(403).send('Invalid or missing authorization token');
  }

  const ext = path.extname(fileRecord.name);
  const base = path.basename(fileRecord.name, ext);
  const safeAsciiBase = base.replace(/[^a-zA-Z0-9_-]/g, '_') || 'file';
  const safeAsciiFilename = `${safeAsciiBase}${ext}`;
  const encodedFilename = encodeURIComponent(fileRecord.name);

  res.setHeader('Content-Type', fileRecord.mimeType || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${safeAsciiFilename}"; filename*=UTF-8''${encodedFilename}`
  );
  res.setHeader('Content-Length', fileRecord.size);
  res.setHeader('Cache-Control', 'public, max-age=600');

  const readStream = fs.createReadStream(fileRecord.diskPath);
  readStream.pipe(res);
});

// 8. Download All Files as ZIP
app.get('/api/sessions/:sessionId/download-all', async (req, res) => {
  const { sessionId } = req.params;
  const token = req.query.token as string;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (token !== session.hostToken && token !== session.guestToken) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (session.files.length === 0) {
    return res.status(400).json({ error: 'No files to download' });
  }

  try {
    const zip = new JSZip();
    for (const file of session.files) {
      if (fs.existsSync(file.diskPath)) {
        const content = await fs.promises.readFile(file.diskPath);
        zip.file(file.name, content);
      }
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="qr-share-${session.code}.zip"`);

    const zipStream = zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true });
    zipStream.pipe(res);
  } catch (err) {
    console.error('ZIP generation error:', err);
    res.status(500).json({ error: 'Failed to generate archive' });
  }
});

// 9. End / Cancel Session
app.post('/api/sessions/:sessionId/end', async (req, res) => {
  const { sessionId } = req.params;
  const token = req.headers['x-session-token'] as string || req.body.token;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.json({ success: true, message: 'Already ended' });
  }

  if (token !== session.hostToken && token !== session.guestToken) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  await destroySession(sessionId, 'Session terminated by user');
  res.json({ success: true });
});

// 10. Refresh / Extend Session
app.post('/api/sessions/:sessionId/refresh', (req, res) => {
  const { sessionId } = req.params;
  const token = req.headers['x-session-token'] as string || req.body.token;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (token !== session.hostToken && token !== session.guestToken) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Extend expiration by another 15 minutes
  session.expiresAt = Date.now() + 15 * 60 * 1000;
  broadcastToSession(session, 'session:refreshed', {
    expiresAt: session.expiresAt,
  });

  res.json({
    success: true,
    expiresAt: session.expiresAt,
  });
});

// ================= VITE INTEGRATION =================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QR File Share server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
