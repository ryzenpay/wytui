// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'send-to-wytui',
    title: 'Send to wytui',
    contexts: ['link', 'page'],
    documentUrlPatterns: ['*://*.youtube.com/*'],
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'send-to-wytui') return;

  const url = info.linkUrl || info.pageUrl;
  if (!url) return;

  const result = await sendToWytui(url);

  // Notify the content script about the result
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'showToast',
      success: result.success,
      message: result.success ? 'Download started!' : result.error,
    }).catch(() => {
      // Content script may not be loaded on this page
    });
  }
});

// Handle messages from popup and content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'quickDownload') {
    sendToWytui(message.url).then(sendResponse);
    return true; // keep message channel open for async response
  }
});

async function sendToWytui(url) {
  try {
    const data = await chrome.storage.local.get(['serverUrl', 'apiKey']);

    if (!data.serverUrl || !data.apiKey) {
      return { success: false, error: 'Extension not configured. Open the popup to set server URL and API key.' };
    }

    const endpoint = data.serverUrl.replace(/\/+$/, '') + '/api/downloads/quick';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + data.apiKey,
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return {
        success: false,
        error: body.message || body.error || 'Server returned ' + response.status,
      };
    }

    const result = await response.json();
    return { success: true, downloadId: result.id };
  } catch (err) {
    return { success: false, error: 'Connection failed: ' + err.message };
  }
}
