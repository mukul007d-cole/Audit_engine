import express from "express";
import fs from "fs";
import multer from "multer";
import { randomUUID } from "crypto";
import { ALLOWED_EXT, AUDIO_DIR, AUDIO_RETENTION_MS } from "../config/constants.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { validateAudioFile } from "../utils/file.js";
import { getAllJobs, getJob, getJobsBySellerId, saveJob, serializeJob } from "../store/jobStore.js";
import { queueJob } from "../services/jobProcessor.js";

const router = express.Router();
const upload = multer({ dest: `${AUDIO_DIR}/` });
const uploadRateLimit = new Map();
const UPLOAD_RATE_LIMIT_MS = 2 * 60 * 1000;

function cleanupUpload(file) {
  if (file?.path) {
    try {
      fs.unlinkSync(file.path);
    } catch {}
  }
}

router.post("/jobs", upload.single("audio"), (req, res) => {
  const sellerId = String(req.body?.sellerId || "").trim();
  const uploaderName = String(req.body?.uploaderName || "").trim();
  const file = req.file;

  if (!sellerId) {
    cleanupUpload(file);
    return res.status(400).json({ error: "sellerId is required" });
  }

  if (!uploaderName) {
    cleanupUpload(file);
    return res.status(400).json({ error: "uploaderName is required" });
  }

  if (!file) return res.status(400).json({ error: "audio file required (field name: audio)" });

  const rateLimitKey = `${req.ip}:${sellerId}:${uploaderName}`;
  const now = Date.now();
  const lastUpload = uploadRateLimit.get(rateLimitKey);
  if (lastUpload && now - lastUpload < UPLOAD_RATE_LIMIT_MS) {
    cleanupUpload(file);
    const retryAfterSeconds = Math.ceil((UPLOAD_RATE_LIMIT_MS - (now - lastUpload)) / 1000);
    res.setHeader("Retry-After", retryAfterSeconds);
    return res.status(429).json({
      error: "Rate limit exceeded",
      message: "Only one upload is allowed every 2 minutes per uploader.",
      retryAfterSeconds
    });
  }

  const validation = validateAudioFile(file);
  if (!validation.accepted) {
    cleanupUpload(file);

    return res.status(400).json({
      error: "Unsupported file format",
      received: { originalname: file.originalname, ext: validation.ext, mimetype: validation.mime },
      allowedExtensions: Array.from(ALLOWED_EXT)
    });
  }

  uploadRateLimit.set(rateLimitKey, now);

  const id = randomUUID();
  saveJob({
    id,
    sellerId,
    uploaderName,
    status: "queued",
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    error: null,
    fileName: file.originalname,
    filePath: file.path,
    pdf: null,
    report: null,
    transcript: null,
    deleteAfter: new Date(Date.now() + AUDIO_RETENTION_MS).toISOString()
  });

  queueJob(id);

  return res.status(202).json({
    ok: true,
    message: "Job accepted for async processing",
    job: serializeJob(getJob(id)),
    links: { job: `/jobs/${id}`, sellerJobs: `/sellers/${encodeURIComponent(sellerId)}/jobs` }
  });
});

router.get("/jobs/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  return res.json({ ok: true, job: serializeJob(job) });
});

router.get("/sellers/:sellerId/jobs", (req, res) => {
  const sellerId = String(req.params.sellerId);
  return res.json({ ok: true, sellerId, jobs: getJobsBySellerId(sellerId).map(serializeJob) });
});

router.get("/admin/jobs", requireAdmin, (_req, res) => {
  return res.json({ ok: true, jobs: getAllJobs().map(serializeJob) });
});

router.get("/admin/jobs/:id/report", requireAdmin, (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (!job.report) return res.status(404).json({ error: "Report not available yet" });

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=\"${job.id}_report.json\"`);
  return res.send(JSON.stringify(job.report, null, 2));
});

router.get("/admin/jobs/:id/transcript", requireAdmin, (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (!job.transcript) return res.status(404).json({ error: "Transcript not available yet" });

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=\"${job.id}_transcript.txt\"`);
  return res.send(job.transcript);
});

export default router;
