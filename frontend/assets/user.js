const form = document.getElementById("job-form");
const checkBtn = document.getElementById("check-job");
const jobIdInput = document.getElementById("job-id");
const output = document.getElementById("job-output");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  output.textContent = "Submitting...";

  const formData = new FormData(form);
  const response = await fetch("/jobs", { method: "POST", body: formData });
  const data = await response.json();
  output.textContent = JSON.stringify(data, null, 2);

  if (data?.job?.id) {
    jobIdInput.value = data.job.id;
  }
});

checkBtn.addEventListener("click", async () => {
  const jobId = jobIdInput.value.trim();
  if (!jobId) {
    output.textContent = "Enter a job ID first.";
    return;
  }

  output.textContent = "Loading job...";
  const response = await fetch(`/jobs/${encodeURIComponent(jobId)}`);
  const data = await response.json();
  output.textContent = JSON.stringify(data, null, 2);
});
