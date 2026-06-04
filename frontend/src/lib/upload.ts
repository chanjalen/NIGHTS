// Client-side review-media upload: validation + presign + direct-to-S3 PUT.
import { getCsrfToken } from '@/contexts/AuthContext';

export const MAX_FILES = 6;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 150 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 60;

// Chat: one item per message, tighter video.
export const CHAT_MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const CHAT_MAX_VIDEO_SECONDS = 30;

export const IMAGE_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif',
];
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif'];
const VIDEO_EXTS = ['mp4', 'mov', 'webm'];

export type MediaKind = 'image' | 'video';

// Some browsers report an empty/odd file.type (notably HEIC) — fall back to the
// file extension so valid uploads aren't wrongly rejected.
export function kindOf(file: File): MediaKind | null {
  if (IMAGE_TYPES.includes(file.type)) return 'image';
  if (VIDEO_TYPES.includes(file.type)) return 'video';
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (IMAGE_EXTS.includes(ext)) return 'image';
  if (VIDEO_EXTS.includes(ext)) return 'video';
  return null;
}

// Reads a video's duration in seconds via a detached <video> element.
export function videoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(el.src);
      resolve(el.duration);
    };
    el.onerror = () => {
      URL.revokeObjectURL(el.src);
      reject(new Error('Could not read video'));
    };
    el.src = URL.createObjectURL(file);
  });
}

/** Validate a single file by type/size. Returns an error string or null. */
export function validateFile(
  file: File,
  opts: { maxVideoBytes?: number } = {},
): string | null {
  const maxVideoBytes = opts.maxVideoBytes ?? MAX_VIDEO_BYTES;
  const kind = kindOf(file);
  if (!kind) return `Unsupported file type${file.type ? `: ${file.type}` : ''}.`;
  if (kind === 'image' && file.size > MAX_IMAGE_BYTES) {
    return `Images must be under ${MAX_IMAGE_BYTES / 1024 / 1024}MB.`;
  }
  if (kind === 'video' && file.size > maxVideoBytes) {
    return `Videos must be under ${maxVideoBytes / 1024 / 1024}MB.`;
  }
  return null;
}

interface PresignUpload {
  key: string;
  url: string;
  fields: Record<string, string>;
  content_type: string;
}

/** Presign + upload all files directly to S3 (presigned POST with a size policy
 *  S3 enforces). Returns the object keys to attach. */
export async function uploadMedia(
  apiBase: string,
  files: File[],
  onProgress?: (percent: number) => void,
  purpose: 'review' | 'chat' = 'review',
): Promise<string[]> {
  if (!files.length) return [];

  const res = await fetch(`${apiBase}/api/v1/ratings/media/presign/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
    credentials: 'include',
    body: JSON.stringify({
      purpose,
      files: files.map((f) => ({ content_type: f.type, size: f.size })),
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      (data.detail as string) || (data.files as string) || 'Could not prepare upload.',
    );
  }
  const { uploads } = (await res.json()) as { uploads: PresignUpload[] };

  const total = files.reduce((s, f) => s + f.size, 0);
  const loaded = new Array(files.length).fill(0);

  await Promise.all(
    files.map(
      (file, i) =>
        new Promise<void>((resolve, reject) => {
          // S3 presigned POST: append all policy fields first, then the file last.
          const form = new FormData();
          Object.entries(uploads[i].fields).forEach(([k, v]) => form.append(k, v));
          form.append('file', file);

          const xhr = new XMLHttpRequest();
          xhr.open('POST', uploads[i].url);
          // Do NOT set Content-Type — the browser sets the multipart boundary.
          xhr.upload.onprogress = (e) => {
            if (!e.lengthComputable) return;
            loaded[i] = e.loaded;
            onProgress?.(Math.round((100 * loaded.reduce((a, b) => a + b, 0)) / total));
          };
          xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error('Upload failed.'));
          xhr.onerror = () => reject(new Error('Upload failed.'));
          xhr.send(form);
        }),
    ),
  );

  return uploads.map((u) => u.key);
}
