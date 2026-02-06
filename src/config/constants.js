export const PORT = Number(process.env.PORT || 3000);
export const AUDIO_DIR = "audios";
export const AUDIT_DIR = "audits";

export const ALLOWED_EXT = new Set([
  ".wav",
  ".mp3",
  ".m4a",
  ".ogg",
  ".webm",
  ".mpeg",
  ".mpga",
  ".mpg",
  ".aap"
]);

export const ALLOWED_MIME_PREFIX = ["audio/"];
export const ALLOWED_MIME_EXACT = new Set(["application/octet-stream", "video/mpeg"]);
