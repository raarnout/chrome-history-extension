let currentSession = null;

function getDateAndTimeParts(dateObj) {
  const date = dateObj.toISOString().slice(0, 10);
  const time = dateObj.toTimeString().slice(0, 8);
  return { date, time };
}

function appendLogToLocalStorage(logObj) {
  // Debug: output log object to the service worker console
  console.log(logObj);

  // Add log entry to the logs array in chrome.storage.local
  chrome.storage.local.get("logs", (data) => {
    const logs = data.logs || [];
    logs.push(logObj);
    chrome.storage.local.set({ logs });
  });
}

function getDomainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function getLabelForDomain(domain, callback) {
  chrome.storage.local.get("domainLabels", (data) => {
    const domainLabelMap = data.domainLabels || {};
    callback(domain && domainLabelMap[domain] ? domainLabelMap[domain] : "");
  });
}

function logSession(session) {
  const start = new Date(session.start);
  const end = new Date(session.end);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return;
  }

  const { date: startDate, time: startTime } = getDateAndTimeParts(start);
  const { date: endDate, time: endTime } = getDateAndTimeParts(end);
  const durationSeconds = session.durationSeconds;
  const domain = getDomainFromUrl(session.url);

  getLabelForDomain(domain, (label) => {
    const logObj = {
      tabId: session.tabId,
      url: session.url,
      title: session.title,
      windowId: session.windowId,
      startDate,
      startTime,
      endDate,
      endTime,
      durationSeconds,
      label
    };

    appendLogToLocalStorage(logObj);
  });
}

function endSession() {
  if (!currentSession) return;
  currentSession.end = new Date().toISOString();
  const durationSeconds = Math.round((new Date(currentSession.end) - new Date(currentSession.start)) / 1000);

  // Only log/store if session is >0 seconds
  if (durationSeconds > 0) {
    logSession({ ...currentSession, durationSeconds });
  }
  currentSession = null;
}

async function startSession(tab) {
  // Only start a new session if not already active on this tab and URL
  if (
    currentSession &&
    currentSession.tabId === tab.id &&
    currentSession.url === tab.url
  ) {
    return;
  }
  currentSession = {
    tabId: tab.id,
    windowId: tab.windowId,
    url: tab.url,
    title: tab.title,
    start: new Date().toISOString()
  };
}


// Listen for tab switches
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  endSession();
  startSession(tab);
});

// Listen for URL changes within the same tab
chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId !== 0) return; // Only log main frame navigations
  const tab = await chrome.tabs.get(details.tabId);
  const [activeTab] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
  if (activeTab && tab.id === activeTab.id) {
    endSession();
    startSession(tab);
  }
});

// Listen for Chrome window focus loss and regain
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    endSession();
  } else if (windowId !== chrome.windows.WINDOW_ID_CURRENT) {
    // If a real Chrome window gains focus, start a new session for its active tab
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab) {
      endSession();
      startSession(tab);
    }
  }
});
