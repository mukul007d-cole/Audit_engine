const jobs = new Map();

export function saveJob(job) {
  jobs.set(job.id, job);
  return job;
}

export function getJob(jobId) {
  return jobs.get(jobId) || null;
}

export function getJobsBySellerId(sellerId) {
  return Array.from(jobs.values())
    .filter((job) => job.sellerId === sellerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function updateJob(jobId, patch) {
  const existing = jobs.get(jobId);
  if (!existing) return null;
  const next = { ...existing, ...patch };
  jobs.set(jobId, next);
  return next;
}

export function serializeJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    sellerId: job.sellerId,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    error: job.error,
    fileName: job.fileName,
    pdf: job.pdf,
    report: job.report,
    transcript: job.transcript
  };
}
