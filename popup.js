document.getElementById('exportBtn').addEventListener('click', () => {
  chrome.storage.local.get("logs", (data) => {
    const logs = data.logs || [];
    if (logs.length === 0) {
      showStatus("No logs to export.", "warning");
      return;
    }
    const csv = convertLogsToCSV(logs);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-logs-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showStatus("Logs exported to CSV.", "success");
  });
});

document.getElementById('clearBtn').addEventListener('click', () => {
  if (confirm("Are you sure you want to clear all logs? This cannot be undone.")) {
    chrome.storage.local.remove("logs", () => {
      showStatus("All logs have been cleared.", "danger");
    });
  }
});

function convertLogsToCSV(logs) {
  if (logs.length === 0) return '';
  const header = Object.keys(logs[0]);
  const rows = logs.map(log =>
    header.map(key => `"${String(log[key]).replace(/"/g, '""')}"`).join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

function showStatus(message, type = "info") {
  const statusDiv = document.getElementById('status');
  let className = "text-info";
  if (type === "success") className = "text-success";
  if (type === "danger") className = "text-danger";
  if (type === "warning") className = "text-warning";
  statusDiv.className = `mt-2 text-center ${className}`;
  statusDiv.textContent = message;
  setTimeout(() => statusDiv.textContent = '', 3000);
}
