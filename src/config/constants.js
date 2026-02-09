export const PORT = Number(process.env.PORT || 3000);
export const AUDIO_DIR = "storage/audio";
export const AUDIT_DIR = "storage/audits";
export const AUDIO_RETENTION_MS = 24 * 60 * 60 * 1000;
export const FRONTEND_DIR = "frontend";
export const ADMIN_TOKEN = process.env.ADMIN_TOKEN; 

export const ALLOWED_EXT = new Set([".wav", ".mp3", ".m4a", ".ogg", ".webm", ".mpeg", ".mpga", ".mpg", ".aap"]);
export const ALLOWED_MIME_PREFIX = ["audio/"];
export const ALLOWED_MIME_EXACT = new Set(["application/octet-stream", "video/mpeg"]);
