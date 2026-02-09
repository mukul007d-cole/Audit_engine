import fs from "fs";
import path from "path";
import { AUDIO_DIR, AUDIO_RETENTION_MS } from "../config/constants.js";

export function startAudioCleanup() {
  if (AUDIO_RETENTION_MS <= 0) return;

  const intervalMs = Math.max(60 * 60 * 1000, Math.floor(AUDIO_RETENTION_MS / 2));

  setInterval(() => {
    const now = Date.now();
    try {
      const entries = fs.readdirSync(AUDIO_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const filePath = path.join(AUDIO_DIR, entry.name);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs >= AUDIO_RETENTION_MS) {
          try {
            fs.unlinkSync(filePath);
          } catch {}
        }
      }
    } catch {}
  }, intervalMs).unref?.();
}
