let domainLabelMap = {};
let knownDomains = [];
let currentFilter = "_unlabeled_";
let currentSearch = "";

document.addEventListener('DOMContentLoaded', () => {
  // Tabs
  document.querySelectorAll('#popupTabs .nav-link').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('#popupTabs .nav-link').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      document.querySelectorAll('.tab-pane').forEach(tab => {
        tab.classList.remove('show', 'active');
      });
      const tabId = this.getAttribute('data-tab-target');
      const activePane = document.getElementById(tabId);
      if (activePane) {
        activePane.classList.add('show', 'active');
      }
      if (tabId === "labelsTab") {
        updateFilterOptions();
        renderDomainLabelInputs();
      }
    });
  });

  // Load logs and domainLabels from storage
  chrome.storage.local.get(["logs", "domainLabels"], (data) => {
    const logs = data.logs || [];
    domainLabelMap = data.domainLabels || {};
    knownDomains = Array.from(
      new Set(logs.map(log => getDomainFromUrl(log.url)).filter(Boolean))
    ).sort();
    updateFilterOptions();
    renderDomainLabelInputs();
  });

  // Save labels button
  document.getElementById("saveLabelsBtn").addEventListener("click", () => {
    filteredDomains().forEach(domain => {
      const input = document.getElementById(`label-${domain}`);
      if (input && input.value.trim()) {
        domainLabelMap[domain] = input.value.trim();
      } else {
        delete domainLabelMap[domain];
      }
    });
    chrome.storage.local.set({ domainLabels: domainLabelMap }, () => {
      showStatus("Labels saved.", "success", "statusLabels");
      updateFilterOptions();
      renderDomainLabelInputs();
    });
  });

  // Export logs to CSV button
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

  // Clear all logs button
  document.getElementById('clearBtn').addEventListener('click', () => {
    if (confirm("Are you sure you want to clear all logs? This cannot be undone.")) {
      chrome.storage.local.remove("logs", () => {
        showStatus("All logs have been cleared.", "danger");
        knownDomains = [];
        renderDomainLabelInputs();
      });
    }
  });

  // Filter dropdown
  document.getElementById('filterLabel').addEventListener('change', (e) => {
    currentFilter = e.target.value;
    renderDomainLabelInputs();
  });

  // Reset filters knop
  document.getElementById('resetFilters').addEventListener('click', () => {
    document.getElementById('searchDomain').value = "";
    currentSearch = "";
    document.getElementById('filterLabel').value = "_unlabeled_";
    currentFilter = "_unlabeled_";
    renderDomainLabelInputs();
  });

  // Search domain
  document.getElementById('searchDomain').addEventListener('input', (e) => {
    currentSearch = e.target.value.toLowerCase();
    renderDomainLabelInputs();
  });
});

function getDomainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (e) {
    return null;
  }
}

// Filtered domains op basis van zoek en filter
function filteredDomains() {
  let filtered = knownDomains;

  if (currentFilter === "_unlabeled_") {
    filtered = filtered.filter(domain => !domainLabelMap[domain]);
  } else if (currentFilter !== "_all_") {
    filtered = filtered.filter(domain => domainLabelMap[domain] === currentFilter);
  }

  if (currentSearch) {
    filtered = filtered.filter(domain => domain.includes(currentSearch));
  }

  return filtered;
}

function updateFilterOptions() {
  const filterLabel = document.getElementById('filterLabel');
  if (!filterLabel) return;

  const uniqueLabels = Array.from(new Set(Object.values(domainLabelMap).filter(Boolean))).sort();

  filterLabel.innerHTML = `
    <option value="_unlabeled_">Unlabeled domains</option>
    <option value="_all_">All domains</option>
    ${uniqueLabels.map(l => `<option value="${l}">${l}</option>`).join("")}
  `;
  filterLabel.value = currentFilter;
}

function renderDomainLabelInputs() {
  const container = document.getElementById("domainLabels");
  container.innerHTML = "";
  let domains = filteredDomains();

  if (domains.length === 0) {
    container.innerHTML = '<div class="text-muted">No domains found for this filter.</div>';
    setInputGroupTextWidth([]);
    setDomainLabelsHeight(10); // toch 10 rijen voor consistent uiterlijk
    return;
  }

  domains.slice(0, 10).forEach(domain => {
    const labelValue = domainLabelMap[domain] || "";
    const row = document.createElement("div");
    row.className = "input-group input-group-sm mb-2";
    row.innerHTML = `
      <span class="input-group-text">${domain}</span>
      <input type="text" class="form-control" id="label-${domain}" value="${labelValue}" placeholder="Label (e.g. work)">
    `;
    container.appendChild(row);
  });

  if (domains.length > 10) {
    const note = document.createElement('div');
    note.className = "text-end text-muted small";
    note.textContent = `Showing first 10 of ${domains.length} domains. Narrow your filter or search for more.`;
    container.appendChild(note);
  }

  setInputGroupTextWidth(domains.slice(0, 10));
  setDomainLabelsHeight(10);
}

function setInputGroupTextWidth(domains) {
  // Bepaal breedte langste domein (zichtbare 10)
  if (!domains || domains.length === 0) {
    document.querySelectorAll('#domainLabels .input-group-text').forEach(span => {
      span.style.minWidth = "120px";
      span.style.maxWidth = "120px";
    });
    return;
  }
  const testSpan = document.createElement('span');
  testSpan.style.visibility = 'hidden';
  testSpan.style.position = 'absolute';
  testSpan.style.fontSize = '0.93em';
  testSpan.style.fontFamily = 'inherit';
  testSpan.style.fontWeight = '400';
  testSpan.style.padding = '0.375rem 0.75rem';
  testSpan.textContent = domains.reduce((a, b) => a.length > b.length ? a : b);
  document.body.appendChild(testSpan);
  const maxWidth = Math.ceil(testSpan.offsetWidth) + 24; // extra ruimte
  document.body.removeChild(testSpan);

  document.querySelectorAll('#domainLabels .input-group-text').forEach(span => {
    span.style.minWidth = maxWidth + "px";
    span.style.maxWidth = maxWidth + "px";
    span.style.display = "inline-block";
    span.style.overflow = "hidden";
    span.style.textOverflow = "ellipsis";
    span.style.whiteSpace = "nowrap";
  });
}

function setDomainLabelsHeight(visibleRows) {
  // Bepaal exacte pixelhoogte per regel en zet dat als max/min op de container
  const rowHeight = 32; // typ. hoogte input-group-sm in px
  const margin = 5;     // marge tussen regels
  const container = document.getElementById("domainLabels");
  container.style.maxHeight = ((rowHeight + margin) * visibleRows) + "px";
  container.style.minHeight = ((rowHeight + margin) * visibleRows) + "px";
}

function convertLogsToCSV(logs) {
  if (logs.length === 0) return '';
  const header = Object.keys(logs[0]);
  const rows = logs.map(log =>
    header.map(key => `"${String(log[key]).replace(/"/g, '""')}"`).join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

function showStatus(message, type = "info", elementId = "status") {
  const statusDiv = document.getElementById(elementId);
  let className = "text-info";
  if (type === "success") className = "text-success";
  if (type === "danger") className = "text-danger";
  if (type === "warning") className = "text-warning";
  statusDiv.className = `mt-2 text-center ${className}`;
  statusDiv.textContent = message;
  setTimeout(() => statusDiv.textContent = '', 3000);
}
