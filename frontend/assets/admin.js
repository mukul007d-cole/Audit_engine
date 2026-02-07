
const tokenInput = document.getElementById("admin-token");
const loadBtn = document.getElementById("load-jobs");
const autoRefreshBtn = document.getElementById("auto-refresh");
const output = document.getElementById("admin-output");
const jobsBody = document.getElementById("jobs-body");
const summary = document.getElementById("admin-summary");

// Filter UI elements (may be null if HTML not present; code guards for that)
const searchInput = document.getElementById("search");
const dateFromInput = document.getElementById("date-from");
const dateToInput = document.getElementById("date-to");
const onlyCompleted = document.getElementById("only-completed");
const onlyFailed = document.getElementById("only-failed");
const onlyProcessing = document.getElementById("only-processing");
const clearFiltersBtn = document.getElementById("clear-filters");
const resultsCount = document.getElementById("results-count");

let allJobs = [];      // raw jobs from server
let filteredJobs = []; // jobs after filters
let currentToken = ""; // token used to fetch jobs (passed to render for download links)

let refreshTimer = null;

/* ---------- existing helper functions ---------- */

function fmtDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function statusClass(status) {
  return `status-pill status-${String(status || "unknown").toLowerCase()}`;
}

function updateSummary(jobs) {
  const counts = jobs.reduce(
    (acc, job) => {
      acc.total += 1;
      const s = job.status || "unknown";
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    },
    { total: 0 }
  );

  summary.innerHTML = `
    <div><strong>Total:</strong> ${counts.total}</div>
    <div><strong>Queued:</strong> ${counts.queued || 0}</div>
    <div><strong>Processing:</strong> ${counts.processing || 0}</div>
    <div><strong>Completed:</strong> ${counts.completed || 0}</div>
    <div><strong>Failed:</strong> ${counts.failed || 0}</div>
  `;
}

function renderJobs(jobs, token) {
  // keep existing render behavior; accept jobs array and token
  if (!jobs || !jobs.length) {
    jobsBody.innerHTML = '<tr><td colspan="6">No jobs found.</td></tr>';
    return;
  }

  jobsBody.innerHTML = jobs
    .map((job) => {
      const pdfLink =
        job.pdf && (job.status === "completed" || String(job.status).toLowerCase().includes("complete"))
          ? `<a href="${job.pdf}" target="_blank" rel="noopener">PDF</a>`
          : "PDF -";

      const reportLink =
        job.report && (job.status === "completed" || String(job.status).toLowerCase().includes("complete"))
          ? `<a href="/admin/jobs/${job.id}/report" data-auth-link="1" data-token="${token}">JSON</a>`
          : "JSON -";

      const transcriptLink =
        job.transcript && (job.status === "completed" || String(job.status).toLowerCase().includes("complete"))
          ? `<a href="/admin/jobs/${job.id}/transcript" data-auth-link="1" data-token="${token}">TXT</a>`
          : "TXT -";

      return `
      <tr>
        <td title="${job.id}"><code>${job.id}</code></td>
        <td>${escapeHtml(job.sellerId || job.sellerName || job.seller || "-")}</td>
        <td>${escapeHtml(job.uploaderName || job.uploader || "-")}</td>
        <td><span class="${statusClass(job.status)}">${escapeHtml(job.status || "-")}</span></td>
        <td>${fmtDate(job.createdAt || job.created_at || job.created)}</td>
        <td class="download-cell">${pdfLink} | ${reportLink} | ${transcriptLink}</td>
      </tr>`;
    })
    .join("");

  wireProtectedDownloads();
}

/* ---------- protected downloads (existing) ---------- */

async function downloadWithAuth(url, token) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Download failed (${response.status}): ${errorBody}`);
  }

  const blob = await response.blob();
  const filenameHeader = response.headers.get("Content-Disposition") || "";
  const match = filenameHeader.match(/filename="?([^";]+)"?/i);
  const filename = match?.[1] || "download.txt";

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

function wireProtectedDownloads() {
  document.querySelectorAll("a[data-auth-link='1']").forEach((link) => {
    // remove previous listeners if any (simple idempotency)
    link.replaceWith(link.cloneNode(true));
  });

  // re-query after clones
  document.querySelectorAll("a[data-auth-link='1']").forEach((link) => {
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        const token = link.dataset.token || currentToken;
        await downloadWithAuth(link.getAttribute("href"), token);
      } catch (error) {
        output.textContent = error.message;
      }
    });
  });
}

/* ---------- utility helpers for filtering ---------- */

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeStr(v) {
  return String(v || "").toLowerCase().trim();
}

function parseJobDate(job) {
  // Accept common fields; return Date or null
  const raw = job.createdAt || job.created_at || job.created || job.timestamp || job.createdAtIso;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inDateRange(jobDate, fromDate, toDate) {
  if (!jobDate) return false;
  if (fromDate) {
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    if (jobDate < from) return false;
  }
  if (toDate) {
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);
    if (jobDate > to) return false;
  }
  return true;
}

function statusMatches(jobStatus, wants) {
  const s = normalizeStr(jobStatus);
  return wants.some((w) => s.includes(w));
}

/* ---------- filtering logic (new) ---------- */

function applyFilters() {
  // Use search + date + status chips
  const q = searchInput ? normalizeStr(searchInput.value) : "";
  const fromDate = dateFromInput ? dateFromInput.value : "";
  const toDate = dateToInput ? dateToInput.value : "";

  const wants = [];
  if (onlyCompleted && onlyCompleted.checked) wants.push("complete", "completed", "done", "success");
  if (onlyFailed && onlyFailed.checked) wants.push("fail", "failed", "error");
  if (onlyProcessing && onlyProcessing.checked) wants.push("process", "processing", "running", "queued");

  filteredJobs = allJobs.filter((job) => {
    const id = normalizeStr(job.id);
    const seller = normalizeStr(job.seller || job.sellerName || job.sellerId || job.seller_id);
    const uploader = normalizeStr(job.uploader || job.uploaderName || job.uploader_name);
    const status = normalizeStr(job.status);

    // 1) search across multiple fields
    if (q) {
      const blob = `${id} ${seller} ${uploader} ${status}`;
      if (!blob.includes(q)) return false;
    }

    // 2) date range
    if (fromDate || toDate) {
      const d = parseJobDate(job);
      if (!inDateRange(d, fromDate, toDate)) return false;
    }

    // 3) status chips
    if (wants.length) {
      if (!statusMatches(job.status || "", wants)) return false;
    }

    return true;
  });

  // update UI
  renderJobs(filteredJobs, currentToken);
  if (resultsCount) resultsCount.textContent = `${filteredJobs.length} / ${allJobs.length} jobs shown`;
}

/* ---------- wire filter UI ---------- */

function wireFilters() {
  const handler = () => applyFilters();

  if (searchInput) searchInput.addEventListener("input", handler);
  if (dateFromInput) dateFromInput.addEventListener("change", handler);
  if (dateToInput) dateToInput.addEventListener("change", handler);

  if (onlyCompleted) onlyCompleted.addEventListener("change", handler);
  if (onlyFailed) onlyFailed.addEventListener("change", handler);
  if (onlyProcessing) onlyProcessing.addEventListener("change", handler);

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (dateFromInput) dateFromInput.value = "";
      if (dateToInput) dateToInput.value = "";
      if (onlyCompleted) onlyCompleted.checked = false;
      if (onlyFailed) onlyFailed.checked = false;
      if (onlyProcessing) onlyProcessing.checked = false;
      applyFilters();
    });
  }
}

/* ---------- load jobs (existing but now sets allJobs and currentToken) ---------- */

async function loadJobs() {
  const token = tokenInput.value.trim();
  if (!token) {
    output.textContent = "Enter admin token first.";
    return;
  }

  currentToken = token;
  output.textContent = "Loading all jobs...";

  try {
    const response = await fetch("/admin/jobs", {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await response.json();
    if (!response.ok) {
      output.textContent = JSON.stringify(data, null, 2);
      return;
    }

    // Preserve updateSummary + prior behavior
    const jobs = data.jobs || data || [];
    allJobs = Array.isArray(jobs) ? jobs : [];
    // Apply filters (this will call renderJobs)
    applyFilters();

    // update summary and raw output
    updateSummary(allJobs);
    output.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    output.textContent = `Failed to load jobs: ${error.message}`;
  }
}

/* ---------- UI wiring for buttons (existing) ---------- */

loadBtn.addEventListener("click", loadJobs);

autoRefreshBtn.addEventListener("click", () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
    autoRefreshBtn.textContent = "Enable Auto Refresh";
    autoRefreshBtn.classList.remove("danger");
    return;
  }

  refreshTimer = setInterval(loadJobs, 10000);
  autoRefreshBtn.textContent = "Disable Auto Refresh";
  autoRefreshBtn.classList.add("danger");
  loadJobs();
});

/* ---------- initial wiring ---------- */

// wire filters if present
wireFilters();

// Initial UX: show existing placeholder if no jobs loaded (keeps original behavior)
if (!jobsBody || jobsBody.children.length === 0) {
  if (jobsBody) jobsBody.innerHTML = '<tr><td colspan="6">Load jobs to view records.</td></tr>';
}
