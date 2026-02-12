export const PORT = Number(process.env.PORT || 3000);
export const AUDIO_DIR = "storage/audio";
export const AUDIT_DIR = "storage/audits";
export const AUDIO_RETENTION_MS = 24 * 60 * 60 * 1000;
export const FRONTEND_DIR = "frontend";
export const ADMIN_TOKEN = "wellsureaudit1";

export const ALLOWED_EXT = new Set([
  ".mp3",
  ".wav",
  ".m4a"
]);
export const ALLOWED_MIME_PREFIX = [];
export const ALLOWED_MIME_EXACT = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a"]);
