// Strip tracking params and fragment so stored URLs match on lookup
function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const p of ['si', 'feature', 'pp', 'index', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'ref', 'igshid']) {
      u.searchParams.delete(p);
    }
    return u.toString();
  } catch {
    return url;
  }
}

// Create context menu on install — works on any page
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'send-to-wytui',
    title: 'Send URL to wytui',
    contexts: ['link', 'page'],
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'send-to-wytui') return;

  const url = normalizeUrl(info.linkUrl || info.pageUrl);
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
    sendToWytui(normalizeUrl(message.url), message.profileId, message.saveToLibrary).then(sendResponse);
    return true;
  }
  if (message.action === 'fetchProfiles') {
    fetchProfiles().then(sendResponse);
    return true;
  }
  if (message.action === 'lookupUrl') {
    lookupUrl(normalizeUrl(message.url)).then(sendResponse);
    return true;
  }
  if (message.action === 'deleteDownload') {
    deleteDownload(message.id).then(sendResponse);
    return true;
  }
});

function authHeaders(apiKey) {
  return apiKey ? { Authorization: 'Bearer ' + apiKey } : {};
}

function authCredentials(apiKey) {
  return apiKey ? 'omit' : 'include';
}

async function lookupUrl(url) {
  try {
    const data = await chrome.storage.local.get(['serverUrl', 'apiKey']);
    if (!data.serverUrl) return { success: false, downloads: [] };

    const endpoint = `${data.serverUrl.replace(/\/+$/, '')}/api/downloads/quick?url=${encodeURIComponent(url)}`;

    const res = await fetch(endpoint, {
      credentials: authCredentials(data.apiKey),
      headers: authHeaders(data.apiKey),
    });

    if (!res.ok) return { success: false, downloads: [] };
    const downloads = await res.json();
    return { success: true, downloads };
  } catch (err) {
    console.error('[wytui] lookupUrl exception:', err);
    return { success: false, downloads: [] };
  }
}

async function deleteDownload(id) {
  try {
    if (!id) return { success: false, error: 'Missing download id' };
    const data = await chrome.storage.local.get(['serverUrl', 'apiKey']);
    if (!data.serverUrl) return { success: false, error: 'Extension not configured.' };

    const endpoint = `${data.serverUrl.replace(/\/+$/, '')}/api/downloads/${encodeURIComponent(id)}`;
    const res = await fetch(endpoint, {
      method: 'DELETE',
      credentials: authCredentials(data.apiKey),
      headers: authHeaders(data.apiKey),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body.message || body.error || 'Server returned ' + res.status };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Connection failed: ' + err.message };
  }
}

async function fetchProfiles() {
  try {
    const data = await chrome.storage.local.get(['serverUrl', 'apiKey']);
    if (!data.serverUrl) return { success: false, status: 0, profiles: [] };

    const base = data.serverUrl.replace(/\/+$/, '');
    const opts = { credentials: authCredentials(data.apiKey), headers: authHeaders(data.apiKey) };

    const [profilesRes, settingsRes] = await Promise.all([
      fetch(`${base}/api/profiles`, opts),
      fetch(`${base}/api/settings`, opts),
    ]);

    if (!profilesRes.ok) return { success: false, status: profilesRes.status, profiles: [] };

    const profiles = await profilesRes.json();
    let libraryEnabled = false;
    if (settingsRes.ok) {
      const settings = await settingsRes.json();
      libraryEnabled = !!(settings.libraryPath);
    }

    return { success: true, status: 200, profiles, libraryEnabled };
  } catch {
    return { success: false, status: 0, profiles: [] };
  }
}

async function sendToWytui(url, profileId, saveToLibrary) {
  try {
    const data = await chrome.storage.local.get(['serverUrl', 'apiKey']);

    if (!data.serverUrl) {
      return { success: false, error: 'Extension not configured. Open the popup to set the server URL.' };
    }

    const endpoint = data.serverUrl.replace(/\/+$/, '') + '/api/downloads/quick';

    const body = { url };
    if (profileId) body.profileId = profileId;
    if (saveToLibrary) body.saveToLibrary = true;

    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: authCredentials(data.apiKey),
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(data.apiKey),
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
