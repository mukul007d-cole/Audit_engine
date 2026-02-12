const tokenInput = document.getElementById("admin-token");
const loadBtn = document.getElementById("load-jobs");
const autoRefreshBtn = document.getElementById("auto-refresh");
const output = document.getElementById("admin-output");
const jobsBody = document.getElementById("jobs-body");
const summary = document.getElementById("admin-summary");
const resultsCount = document.getElementById("results-count");
const pageIndicator = document.getElementById("page-indicator");
const prevPageBtn = document.getElementById("prev-page");
const nextPageBtn = document.getElementById("next-page");

const searchInput = document.getElementById("search");
const dateFromInput = document.getElementById("date-from");
const dateToInput = document.getElementById("date-to");
const statusFilter = document.getElementById("status-filter");
const pageSizeSelect = document.getElementById("page-size");
const clearFiltersBtn = document.getElementById("clear-filters");

let refreshTimer = null;
let currentPage = 1;
let pagination = { page: 1, totalPages: 1, total: 0, pageSize: 25, hasPrev: false, hasNext: false };
let currentToken = "";

function setOutput(message) {
  output.textContent = message;
}

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
    <div><strong>On This Page:</strong> ${counts.total}</div>
    <div><strong>Queued:</strong> ${counts.queued || 0}</div>
    <div><strong>Processing:</strong> ${counts.processing || 0}</div>
    <div><strong>Completed:</strong> ${counts.completed || 0}</div>
    <div><strong>Failed:</strong> ${counts.failed || 0}</div>
  `;
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderJobs(jobs) {
  if (!jobs || !jobs.length) {
    jobsBody.innerHTML = '<tr><td colspan="6">No jobs found.</td></tr>';
    return;
  }

  jobsBody.innerHTML = jobs
    .map((job) => {
      const done = String(job.status || "").toLowerCase() === "completed";
      const pdfLink = done && job.pdf ? `<a href="${job.pdf}" target="_blank" rel="noopener">PDF</a>` : "PDF -";
      const reportLink = done && job.report ? `<a href="/admin/jobs/${job.id}/report" data-auth-link="1">JSON</a>` : "JSON -";
      const transcriptLink = done && job.transcript ? `<a href="/admin/jobs/${job.id}/transcript" data-auth-link="1">TXT</a>` : "TXT -";

      return `
      <tr>
        <td title="${job.id}"><code>${job.id}</code></td>
        <td>${escapeHtml(job.sellerId || "-")}</td>
        <td>${escapeHtml(job.uploaderName || "-")}</td>
        <td><span class="${statusClass(job.status)}">${escapeHtml(job.status || "-")}</span></td>
        <td>${fmtDate(job.createdAt)}</td>
        <td class="download-cell">${pdfLink} | ${reportLink} | ${transcriptLink}</td>
      </tr>`;
    })
    .join("");

  wireProtectedDownloads();
}

async function downloadWithAuth(url) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${currentToken}` }
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
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        await downloadWithAuth(link.getAttribute("href"));
      } catch (error) {
        setOutput(error.message);
      }
    });
  });
}

function buildQueryParams() {
  const params = new URLSearchParams();
  params.set("page", String(currentPage));
  params.set("pageSize", pageSizeSelect.value || "25");

  if (searchInput.value.trim()) params.set("search", searchInput.value.trim());
  if (dateFromInput.value) params.set("from", dateFromInput.value);
  if (dateToInput.value) params.set("to", dateToInput.value);
  if (statusFilter.value) params.set("status", statusFilter.value);

  return params;
}

function updatePaginationUI() {
  pageIndicator.textContent = `Page ${pagination.page} / ${pagination.totalPages}`;
  resultsCount.textContent = `${pagination.total} matching jobs`;
  prevPageBtn.disabled = !pagination.hasPrev;
  nextPageBtn.disabled = !pagination.hasNext;
}

async function loadJobs() {
  const token = tokenInput.value.trim();
  if (!token) {
    setOutput("Enter admin token first.");
    return;
  }

  currentToken = token;
  setOutput("Loading jobs...");

  try {
    const response = await fetch(`/admin/jobs?${buildQueryParams().toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await response.json();
    if (!response.ok) {
      setOutput(data?.error || "Failed to load jobs.");
      return;
    }

    pagination = data.pagination || pagination;
    currentPage = pagination.page;
    renderJobs(data.jobs || []);
    updateSummary(data.jobs || []);
    updatePaginationUI();
    setOutput(`Showing page ${pagination.page} of ${pagination.totalPages}.`);
  } catch (error) {
    setOutput(`Failed to load jobs: ${error.message}`);
  }
}

function resetFilters() {
  searchInput.value = "";
  dateFromInput.value = "";
  dateToInput.value = "";
  statusFilter.value = "";
  currentPage = 1;
  loadJobs();
}

function wireFilterEvents() {
  [searchInput, dateFromInput, dateToInput, statusFilter, pageSizeSelect].forEach((element) => {
    element.addEventListener("change", () => {
      currentPage = 1;
      loadJobs();
    });
  });

  searchInput.addEventListener("input", () => {
    currentPage = 1;
  });

  clearFiltersBtn.addEventListener("click", resetFilters);
}

loadBtn.addEventListener("click", () => {
  currentPage = 1;
  loadJobs();
});

prevPageBtn.addEventListener("click", () => {
  if (!pagination.hasPrev) return;
  currentPage -= 1;
  loadJobs();
});

nextPageBtn.addEventListener("click", () => {
  if (!pagination.hasNext) return;
  currentPage += 1;
  loadJobs();
});

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

wireFilterEvents();
updatePaginationUI();
