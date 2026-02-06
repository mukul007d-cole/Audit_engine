import "dotenv/config";
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { transcribeAudio, extractChecklist } from "./extract.js";
import { generatePdfReport } from "./pdf.js";

const app = express();

fs.mkdirSync("audios", { recursive: true });
fs.mkdirSync("audits", { recursive: true });

const upload = multer({ dest: "audios/" });

const ALLOWED_EXT = new Set([
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

function sanitizeFileName(name) {
    return name
      .replace(/\.[^/.]+$/, "")   
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/_+/g, "_")            
      .toLowerCase();
  }
  
  function getDateTimeSuffix() {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    return `${dd}-${mm}_${hh}:${min}`;
  }
  
const ALLOWED_MIME_PREFIX = ["audio/"];
const ALLOWED_MIME_EXACT = new Set([
  "application/octet-stream",
  "video/mpeg",
]);

app.post("/process-call", upload.single("audio"), async (req, res) => {
  console.log("HIT /process-call", new Date().toISOString());

  const file = req.file;
  if (!file) {
    return res.status(400).json({
      error: "audio file required (field name: audio)",
    });
  }

  const ext = path.extname(file.originalname || "").toLowerCase();
  const mime = (file.mimetype || "").toLowerCase();

  console.log("FILE:", {
    originalname: file.originalname,
    ext,
    mimetype: mime,
    destination: file.destination,
    filename: file.filename,
    path: file.path,
    size: file.size,
  });

  const extOk = ALLOWED_EXT.has(ext);
  const mimeOk =
    ALLOWED_MIME_PREFIX.some((p) => mime.startsWith(p)) ||
    ALLOWED_MIME_EXACT.has(mime);

  if (!extOk && !mimeOk) {
    try { fs.unlinkSync(file.path); } catch {}
    return res.status(400).json({
      error: "Unsupported file format",
      received: { originalname: file.originalname, ext, mimetype: mime },
      allowedExtensions: Array.from(ALLOWED_EXT),
    });
  }

  try {
    const transcript = await transcribeAudio(file.path, file.originalname);
    console.log("TRANSCRIPT PREVIEW:", transcript?.slice?.(0, 200));
    const reportJson = await extractChecklist(transcript);
    
    const baseName = sanitizeFileName(file.originalname);
    const timeSuffix = getDateTimeSuffix();
    const pdfName = `${baseName}_${timeSuffix}.pdf`;
    const outPath = path.join("audits", pdfName);

    await generatePdfReport(reportJson, outPath);


    try { fs.unlinkSync(file.path); } catch {}
    console.log(`/audits/${pdfName}` ," Has been generated.")
    return res.json({
      ok: true,
      pdf: `/audits/${pdfName}`,
      report: reportJson,
      transcript,
    });
  } catch (e) {
    console.error("PROCESS ERROR:", e);
    try { fs.unlinkSync(file.path); } catch {}
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
});

app.use("/audits", express.static("audits"));

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
