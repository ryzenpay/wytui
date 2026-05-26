// Create context menu on install — works on any page
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'send-to-wytui',
    title: 'Send to wytui',
    contexts: ['link', 'page'],
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'send-to-wytui') return;

  const url = info.linkUrl || info.pageUrl;
  if (!url) return;

  const result = await sendToWytui(url);

  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'showToast',
      success: result.success,
      message: result.success ? 'Download started!' : result.error,
    }).catch(() => {});
  }
});

// Handle messages from popup and content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'quickDownload') {
    sendToWytui(message.url, message.profileId, message.saveToLibrary).then(sendResponse);
    return true;
  }
  if (message.action === 'fetchProfiles') {
    fetchProfiles().then(sendResponse);
    return true;
  }
  if (message.action === 'lookupUrl') {
    lookupUrl(message.url).then(sendResponse);
    return true;
  }
});

async function lookupUrl(url) {
  try {
    const data = await chrome.storage.local.get(['serverUrl', 'apiKey']);
    if (!data.serverUrl || !data.apiKey) return { success: false, downloads: [] };

    const res = await fetch(
      `${data.serverUrl.replace(/\/+$/, '')}/api/downloads/quick?url=${encodeURIComponent(url)}`,
      { headers: { Authorization: 'Bearer ' + data.apiKey } }
    );

    if (!res.ok) return { success: false, downloads: [] };
    const downloads = await res.json();
    return { success: true, downloads };
  } catch {
    return { success: false, downloads: [] };
  }
}

async function fetchProfiles() {
  try {
    const data = await chrome.storage.local.get(['serverUrl', 'apiKey']);
    if (!data.serverUrl || !data.apiKey) return { success: false, profiles: [] };

    const res = await fetch(`${data.serverUrl.replace(/\/+$/, '')}/api/profiles`, {
      headers: { Authorization: 'Bearer ' + data.apiKey },
    });

    if (!res.ok) return { success: false, profiles: [] };
    const profiles = await res.json();
    return { success: true, profiles };
  } catch {
    return { success: false, profiles: [] };
  }
}

async function sendToWytui(url, profileId, saveToLibrary) {
  try {
    const data = await chrome.storage.local.get(['serverUrl', 'apiKey']);

    if (!data.serverUrl || !data.apiKey) {
      return { success: false, error: 'Extension not configured. Open the popup to set server URL and API key.' };
    }

    const endpoint = data.serverUrl.replace(/\/+$/, '') + '/api/downloads/quick';

    const body = { url };
    if (profileId) body.profileId = profileId;
    if (saveToLibrary) body.saveToLibrary = true;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + data.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { success: false, error: body.message || body.error || 'Server returned ' + response.status };
    }

    const result = await response.json();
    return { success: true, downloadId: result.id };
  } catch (err) {
    return { success: false, error: 'Connection failed: ' + err.message };
  }
}
