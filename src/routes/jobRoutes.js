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
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function cleanupUpload(file) {
  if (file?.path) {
    try {
      fs.unlinkSync(file.path);
    } catch {}
  }
}

function parsePagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(query.pageSize, 10) || DEFAULT_PAGE_SIZE));
  return { page, pageSize };
}

function filterJobs(jobs, query) {
  const search = String(query.search || "").trim().toLowerCase();
  const status = String(query.status || "").trim().toLowerCase();
  const from = query.from ? new Date(String(query.from)) : null;
  const to = query.to ? new Date(String(query.to)) : null;

  const fromTs = from && !Number.isNaN(from.getTime()) ? from.setHours(0, 0, 0, 0) : null;
  const toTs = to && !Number.isNaN(to.getTime()) ? to.setHours(23, 59, 59, 999) : null;

  return jobs.filter((job) => {
    if (search) {
      const haystack = `${job.id} ${job.sellerId} ${job.uploaderName} ${job.status}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    if (status && String(job.status || "").toLowerCase() !== status) return false;

    if (fromTs || toTs) {
      const created = new Date(job.createdAt).getTime();
      if (!Number.isFinite(created)) return false;
      if (fromTs && created < fromTs) return false;
      if (toTs && created > toTs) return false;
    }

    return true;
  });
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
    fileMime: file.mimetype,
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

router.get("/admin/jobs", requireAdmin, (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  const filtered = filterJobs(getAllJobs(), req.query);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pagedJobs = filtered.slice(start, start + pageSize).map((job) => serializeJob(job, { includeContent: false }));

  return res.json({
    ok: true,
    jobs: pagedJobs,
    pagination: {
      page: currentPage,
      pageSize,
      total,
      totalPages,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1
    }
  });
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
