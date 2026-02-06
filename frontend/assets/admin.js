const tokenInput = document.getElementById("admin-token");
const loadBtn = document.getElementById("load-jobs");
const output = document.getElementById("admin-output");

loadBtn.addEventListener("click", async () => {
  const token = tokenInput.value.trim();
  if (!token) {
    output.textContent = "Enter admin token first.";
    return;
  }

  output.textContent = "Loading all jobs...";
  const response = await fetch("/admin/jobs", {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await response.json();
  output.textContent = JSON.stringify(data, null, 2);
});
