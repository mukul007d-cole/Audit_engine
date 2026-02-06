const tokenInput = document.getElementById("admin-token");
const loadBtn = document.getElementById("load-jobs");
const autoRefreshBtn = document.getElementById("auto-refresh");
const output = document.getElementById("admin-output");
const jobsBody = document.getElementById("jobs-body");
const summary = document.getElementById("admin-summary");

let refreshTimer = null;

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
      acc[job.status] = (acc[job.status] || 0) + 1;
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
  if (!jobs.length) {
    jobsBody.innerHTML = '<tr><td colspan="6">No jobs found.</td></tr>';
    return;
  }

  jobsBody.innerHTML = jobs
    .map((job) => {
      const pdfLink =
        job.pdf && job.status === "completed"
          ? `<a href="${job.pdf}" target="_blank" rel="noopener">PDF</a>`
          : "PDF -";

      const reportLink =
        job.report && job.status === "completed"
          ? `<a href="/admin/jobs/${job.id}/report" data-auth-link="1" data-token="${token}">JSON</a>`
          : "JSON -";

      const transcriptLink =
        job.transcript && job.status === "completed"
          ? `<a href="/admin/jobs/${job.id}/transcript" data-auth-link="1" data-token="${token}">TXT</a>`
          : "TXT -";

      return `
      <tr>
        <td title="${job.id}"><code>${job.id}</code></td>
        <td>${job.sellerId}</td>
        <td>${job.uploaderName || "-"}</td>
        <td><span class="${statusClass(job.status)}">${job.status}</span></td>
        <td>${fmtDate(job.createdAt)}</td>
        <td class="download-cell">${pdfLink} | ${reportLink} | ${transcriptLink}</td>
      </tr>`;
    })
    .join("");

  wireProtectedDownloads();
}

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
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        await downloadWithAuth(link.getAttribute("href"), link.dataset.token);
      } catch (error) {
        output.textContent = error.message;
      }
    });
  });
}

async function loadJobs() {
  const token = tokenInput.value.trim();
  if (!token) {
    output.textContent = "Enter admin token first.";
    return;
  }

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

    updateSummary(data.jobs || []);
    renderJobs(data.jobs || [], token);
    output.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    output.textContent = `Failed to load jobs: ${error.message}`;
  }
}

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
