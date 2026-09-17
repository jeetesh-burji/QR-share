import { SharedFile } from '../types';

/**
 * Downloads a file using a fetched Blob to guarantee that:
 * 1. The browser saves the exact MIME bytes and original extension
 * 2. Any server error response (e.g. 404/403) is caught rather than saved as a corrupted image file
 * 3. Works reliably in iframes, desktop browsers, and mobile devices
 */
export async function triggerFileDownload(
  sessionId: string,
  file: SharedFile,
  token: string
): Promise<void> {
  const downloadUrl = `/api/sessions/${sessionId}/files/${file.id}/download?dlToken=${file.downloadToken}&token=${token}`;

  try {
    const res = await fetch(downloadUrl);
    if (!res.ok) {
      let errMsg = 'Download failed';
      try {
        const errJson = await res.json();
        errMsg = errJson.error || errMsg;
      } catch {
        errMsg = `Server error (${res.status})`;
      }
      throw new Error(errMsg);
    }

    const blob = await res.blob();
    // Ensure blob type matches file mimeType
    const finalBlob = blob.type ? blob : new Blob([blob], { type: file.mimeType || 'application/octet-stream' });
    const blobUrl = URL.createObjectURL(finalBlob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 15000);
  } catch (err) {
    console.warn('Blob download encountered an issue, falling back to direct link:', err);
    const fallbackLink = document.createElement('a');
    fallbackLink.href = downloadUrl;
    fallbackLink.download = file.name;
    fallbackLink.target = '_blank';
    fallbackLink.rel = 'noopener noreferrer';
    document.body.appendChild(fallbackLink);
    fallbackLink.click();
    document.body.removeChild(fallbackLink);
  }
}
