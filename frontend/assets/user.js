const form = document.getElementById("job-form");
const checkBtn = document.getElementById("check-job");
const jobIdInput = document.getElementById("job-id");
const output = document.getElementById("job-output");
const audioInput = form.querySelector('input[name="audio"]');
const submitBtn = document.getElementById("submit-job");
const fileError = document.getElementById("file-error");
const allowedExtensions = [".mp3", ".wav", ".m4a"];

function validateSelectedFile() {
  const selectedFile = audioInput?.files?.[0];

  if (!selectedFile) {
    submitBtn.disabled = true;
    fileError.textContent = "Upload a file in MP3, WAV, or M4A format.";
    return false;
  }

  const lowerName = String(selectedFile.name || "").toLowerCase();
  const hasAllowedExtension = allowedExtensions.some((ext) => lowerName.endsWith(ext));

  if (!hasAllowedExtension) {
    submitBtn.disabled = true;
    fileError.textContent = "Upload a file in MP3, WAV, or M4A format.";
    return false;
  }

  submitBtn.disabled = false;
  fileError.textContent = "";
  return true;
}

if (audioInput) {
  audioInput.addEventListener("change", validateSelectedFile);
  validateSelectedFile();
}


function setMessage(message) {
  output.textContent = message;
}

function renderJobStatus(job) {
  if (!job) {
    setMessage("Job details are not available right now.");
    return;
  }

  const lines = [
    `Job ID: ${job.id}`,
    `Status: ${job.status}`,
    `Created: ${new Date(job.createdAt).toLocaleString()}`
  ];

  if (job.error) lines.push(`Reason: ${job.error}`);
  if (job.pdf) lines.push(`PDF Ready: ${job.pdf}`);

  setMessage(lines.join("\n"));
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validateSelectedFile()) {
    return;
  }

  setMessage("Submitting your file...");

  const formData = new FormData(form);
  try {
    const response = await fetch("/jobs", { method: "POST", body: formData });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data?.error || "Upload failed. Please try another audio file.");
      return;
    }

    if (data?.job?.id) jobIdInput.value = data.job.id;
    setMessage(`Upload accepted. Track your job using ID: ${data?.job?.id || "-"}`);
  } catch (error) {
    setMessage(`Request failed: ${error.message}`);
  }
});

checkBtn.addEventListener("click", async () => {
  const jobId = jobIdInput.value.trim();
  if (!jobId) {
    setMessage("Enter a Job ID first.");
    return;
  }

  setMessage("Checking status...");
  try {
    const response = await fetch(`/jobs/${encodeURIComponent(jobId)}`);
    const data = await response.json();

    if (!response.ok) {
      setMessage(data?.error || "Unable to fetch this job.");
      return;
    }

    renderJobStatus(data.job);
  } catch (error) {
    setMessage(`Unable to fetch status: ${error.message}`);
  }
});

const adminBtn = document.getElementById("admin-btn");
if (adminBtn) {
  adminBtn.addEventListener("click", () => {
    window.location.href = "/admin";
  });
}
