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

// Extension → canonical MIME, mirroring the backend's allowed-type maps. Used to
// recover a content-type when the browser reports an empty file.type (notably
// HEIC on some browsers), so the presign request isn't rejected.
const EXT_TO_TYPE: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  heic: 'image/heic', heif: 'image/heif', gif: 'image/gif',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
};

export type MediaKind = 'image' | 'video';

// The content-type to send for presign: the browser's value when it's one we
// allow, otherwise inferred from the file extension. Empty string if unknown.
export function contentTypeOf(file: File): string {
  if (IMAGE_TYPES.includes(file.type) || VIDEO_TYPES.includes(file.type)) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_TO_TYPE[ext] ?? '';
}

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

// Render a still JPEG from a video file. iOS hands the photo picker a Live
// Photo's .mov even when the input is image-only, so we grab a frame and treat
// it as the photo. Returns a new image/jpeg File.
export function videoFrameToImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.muted = true;
    el.playsInline = true;
    const cleanup = () => URL.revokeObjectURL(el.src);
    const capture = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = el.videoWidth;
        canvas.height = el.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx || !canvas.width || !canvas.height) throw new Error('no frame');
        ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            cleanup();
            if (!blob) { reject(new Error('Could not read photo')); return; }
            const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
            resolve(new File([blob], name, { type: 'image/jpeg' }));
          },
          'image/jpeg',
          0.9,
        );
      } catch {
        cleanup();
        reject(new Error('Could not read photo'));
      }
    };
    el.onloadeddata = () => {
      // Seek slightly in to avoid a black/blank first frame. Seeking to 0 won't
      // fire 'seeked', so capture immediately in that case.
      const target = el.duration ? Math.min(0.1, el.duration / 2) : 0;
      if (target > 0) { el.onseeked = capture; el.currentTime = target; }
      else capture();
    };
    el.onerror = () => { cleanup(); reject(new Error('Could not read photo')); };
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
      files: files.map((f) => ({ content_type: contentTypeOf(f), size: f.size })),
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
