const serverUrlInput = document.getElementById('serverUrl');
const apiKeyInput = document.getElementById('apiKey');
const saveBtn = document.getElementById('saveBtn');
const downloadBtn = document.getElementById('downloadBtn');
const messageEl = document.getElementById('message');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

// Load saved settings
chrome.storage.local.get(['serverUrl', 'apiKey'], (data) => {
  if (data.serverUrl) serverUrlInput.value = data.serverUrl;
  if (data.apiKey) apiKeyInput.value = data.apiKey;
  updateStatus(data.serverUrl, data.apiKey);
});

function updateStatus(url, key) {
  if (url && key) {
    statusDot.className = 'status-dot connected';
    statusText.textContent = 'Configured';
    downloadBtn.disabled = false;
  } else {
    statusDot.className = 'status-dot';
    statusText.textContent = 'Not configured';
    downloadBtn.disabled = true;
  }
}

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = 'message ' + type;
  setTimeout(() => {
    messageEl.className = 'message';
  }, 4000);
}

saveBtn.addEventListener('click', () => {
  const serverUrl = serverUrlInput.value.trim().replace(/\/+$/, '');
  const apiKey = apiKeyInput.value.trim();

  if (!serverUrl) {
    showMessage('Server URL is required.', 'error');
    return;
  }

  chrome.storage.local.set({ serverUrl, apiKey }, () => {
    showMessage('Settings saved.', 'success');
    updateStatus(serverUrl, apiKey);
  });
});

downloadBtn.addEventListener('click', async () => {
  downloadBtn.disabled = true;
  downloadBtn.textContent = 'Sending...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) {
      showMessage('No active tab found.', 'error');
      return;
    }

    const response = await chrome.runtime.sendMessage({
      action: 'quickDownload',
      url: tab.url,
    });

    if (response?.success) {
      showMessage('Download started!', 'success');
    } else {
      showMessage(response?.error || 'Failed to send download.', 'error');
    }
  } catch (err) {
    showMessage('Error: ' + err.message, 'error');
  } finally {
    downloadBtn.disabled = false;
    downloadBtn.textContent = 'Download Current Video';
  }
});
