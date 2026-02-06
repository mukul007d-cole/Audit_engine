import fs from "fs";
import path from "path";
import { transcribeAudio, extractChecklist } from "../extract.js";
import { generatePdfReport } from "../pdf.js";
import { getJob, updateJob } from "../store/jobStore.js";
import { AUDIT_DIR } from "../config/constants.js";
import { getDateTimeSuffix, sanitizeFileName } from "../utils/file.js";

export async function processJob(jobId) {
  const job = getJob(jobId);
  if (!job) return;

  updateJob(jobId, {
    status: "processing",
    startedAt: new Date().toISOString()
  });

  try {
    const transcript = await transcribeAudio(job.filePath, job.fileName);
    const report = await extractChecklist(transcript);

    const baseName = sanitizeFileName(job.fileName);
    const timeSuffix = getDateTimeSuffix();
    const pdfName = `${baseName}_${job.sellerId}_${timeSuffix}.pdf`;
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
    try {
      fs.unlinkSync(job.filePath);
    } catch {
      // ignore cleanup errors
    }
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
