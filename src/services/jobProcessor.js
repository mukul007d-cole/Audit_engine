import fs from "fs";
import path from "path";
import { transcribeAudio, extractChecklist } from "./ai/extractor.js";
import { generatePdfReport } from "./report/pdfReport.js";
import { getJob, updateJob } from "../store/jobStore.js";
import { AUDIT_DIR, AUDIO_RETENTION_MS } from "../config/constants.js";
import { getDateTimeSuffix, sanitizeFileName } from "../utils/file.js";

export async function processJob(jobId) {
  const job = getJob(jobId);
  if (!job) return;

  updateJob(jobId, { status: "processing", startedAt: new Date().toISOString() });

  try {
    const transcript = await transcribeAudio(job.filePath, job.fileName, job.fileMime);
    const report = await extractChecklist(transcript);
    const pdfName = `${sanitizeFileName(job.fileName)}_${job.sellerId}_${getDateTimeSuffix()}.pdf`;
    const outPath = path.join(AUDIT_DIR, pdfName);

    await generatePdfReport(report, outPath);

    updateJob(jobId, {
      status: "completed",
      finishedAt: new Date().toISOString(),
      transcript,
      report,
      pdf: `/audits/${pdfName}`
    });
  } catch (error) {
    updateJob(jobId, {
      status: "failed",
      finishedAt: new Date().toISOString(),
      error: error?.message || "Unknown error"
    });
  } finally {
    if (AUDIO_RETENTION_MS > 0) return;
    try {
      fs.unlinkSync(job.filePath);
    } catch {}
  }
}

export function queueJob(jobId) {
  setImmediate(() => {
    processJob(jobId).catch((error) => {
      updateJob(jobId, {
        status: "failed",
        finishedAt: new Date().toISOString(),
        error: error?.message || "Unknown error"
      });
    });
  });
}
