import path from "path";
import { ALLOWED_EXT, ALLOWED_MIME_EXACT, ALLOWED_MIME_PREFIX } from "../config/constants.js";

export function sanitizeFileName(name) {
  return String(name || "")
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();
}

export function getDateTimeSuffix() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}_${hh}-${min}`;
}

export function validateAudioFile(file) {
  const ext = path.extname(file?.originalname || "").toLowerCase();
  const mime = (file?.mimetype || "").toLowerCase();

  const extOk = ALLOWED_EXT.has(ext);
  const mimeOk =
    ALLOWED_MIME_PREFIX.some((prefix) => mime.startsWith(prefix)) ||
    ALLOWED_MIME_EXACT.has(mime);

  return {
    accepted: extOk || mimeOk,
    ext,
    mime
  };
}
