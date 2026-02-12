const jobs = new Map();

export function saveJob(job) {
  jobs.set(job.id, job);
  return job;
}

export function getJob(jobId) {
  return jobs.get(jobId) || null;
}

export function getAllJobs() {
  return Array.from(jobs.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getJobsBySellerId(sellerId) {
  return getAllJobs().filter((job) => job.sellerId === sellerId);
}

export function updateJob(jobId, patch) {
  const existing = jobs.get(jobId);
  if (!existing) return null;
  const next = { ...existing, ...patch };
  jobs.set(jobId, next);
  return next;
}

export function serializeJob(job, options = {}) {
  if (!job) return null;

  const includeContent = options.includeContent ?? true;

  return {
    id: job.id,
    sellerId: job.sellerId,
    uploaderName: job.uploaderName,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    error: job.error,
    fileName: job.fileName,
    deleteAfter: job.deleteAfter,
    pdf: job.pdf,
    report: includeContent ? job.report : Boolean(job.report),
    transcript: includeContent ? job.transcript : Boolean(job.transcript)
  };
}
