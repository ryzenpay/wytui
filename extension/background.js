// Strip tracking/session params so stored URLs match on lookup
function normalizeUrl(url) {
  try {
    const u = new URL(url);
    // YouTube watch page: keep only v=
    if ((u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com') && u.pathname === '/watch') {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/watch?v=${v}`;
    }
    // youtu.be short links: keep only the path
    if (u.hostname === 'youtu.be') {
      return `https://youtu.be${u.pathname}`;
    }
    // Generic: remove fragment and known tracking params
    u.hash = '';
    for (const p of ['si', 'feature', 'pp', 'index', 'utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid']) {
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
    title: 'Send to wytui',
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
});

async function lookupUrl(url) {
  try {
    const data = await chrome.storage.local.get(['serverUrl', 'apiKey']);
    if (!data.serverUrl || !data.apiKey) return { success: false, downloads: [] };

    const endpoint = `${data.serverUrl.replace(/\/+$/, '')}/api/downloads/quick?url=${encodeURIComponent(url)}`;
    console.log('[wytui] lookupUrl GET', endpoint);

    const res = await fetch(endpoint, { headers: { Authorization: 'Bearer ' + data.apiKey } });

    console.log('[wytui] lookupUrl response status:', res.status);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.log('[wytui] lookupUrl error body:', body);
      return { success: false, downloads: [] };
    }
    const downloads = await res.json();
    console.log('[wytui] lookupUrl downloads found:', downloads.length, downloads);
    return { success: true, downloads };
  } catch (err) {
    console.error('[wytui] lookupUrl exception:', err);
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
