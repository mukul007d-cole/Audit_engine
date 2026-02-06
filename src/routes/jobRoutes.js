import express from "express";
import fs from "fs";
import multer from "multer";
import { randomUUID } from "crypto";
import { ALLOWED_EXT, AUDIO_DIR } from "../config/constants.js";
import { validateAudioFile } from "../utils/file.js";
import { getJob, getJobsBySellerId, saveJob, serializeJob } from "../store/jobStore.js";
import { queueJob } from "../services/jobProcessor.js";

const router = express.Router();
const upload = multer({ dest: `${AUDIO_DIR}/` });

router.post("/jobs", upload.single("audio"), (req, res) => {
  const sellerId = String(req.body?.sellerId || "").trim();
  const file = req.file;

  if (!sellerId) {
    if (file?.path) {
      try {
        fs.unlinkSync(file.path);
      } catch {}
    }
    return res.status(400).json({ error: "sellerId is required" });
  }

  if (!file) {
    return res.status(400).json({ error: "audio file required (field name: audio)" });
  }

  const validation = validateAudioFile(file);
  if (!validation.accepted) {
    try {
      fs.unlinkSync(file.path);
    } catch {}

    return res.status(400).json({
      error: "Unsupported file format",
      received: {
        originalname: file.originalname,
        ext: validation.ext,
        mimetype: validation.mime
      },
      allowedExtensions: Array.from(ALLOWED_EXT)
    });
  }

  const id = randomUUID();
  const createdAt = new Date().toISOString();

  saveJob({
    id,
    sellerId,
    status: "queued",
    createdAt,
    startedAt: null,
    finishedAt: null,
    error: null,
    fileName: file.originalname,
    filePath: file.path,
    pdf: null,
    report: null,
    transcript: null
  });

  queueJob(id);

  return res.status(202).json({
    ok: true,
    message: "Job accepted for async processing",
    job: serializeJob(getJob(id)),
    links: {
      job: `/jobs/${id}`,
      sellerJobs: `/sellers/${encodeURIComponent(sellerId)}/jobs`
    }
  });
});

router.get("/jobs/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  return res.json({ ok: true, job: serializeJob(job) });
});

router.get("/sellers/:sellerId/jobs", (req, res) => {
  const sellerId = String(req.params.sellerId);
  const jobs = getJobsBySellerId(sellerId).map(serializeJob);

  return res.json({ ok: true, sellerId, jobs });
});

export default router;
