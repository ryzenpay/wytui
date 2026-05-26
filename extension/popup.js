// Elements
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const urlText = document.getElementById('urlText');
const urlFavicon = document.getElementById('urlFavicon');
const openWytuiBtn = document.getElementById('openWytuiBtn');
const profileSelect = document.getElementById('profileSelect');
const libraryToggle = document.getElementById('libraryToggle');
const libraryToggleRow = document.getElementById('libraryToggleRow');
const downloadBtn = document.getElementById('downloadBtn');
const messageEl = document.getElementById('message');
const viewLink = document.getElementById('viewLink');
const serverUrlInput = document.getElementById('serverUrl');
const apiKeyInput = document.getElementById('apiKey');
const saveBtn = document.getElementById('saveBtn');
const existingWrap = document.getElementById('existingWrap');
const existingTitle = document.getElementById('existingTitle');
const existingStatus = document.getElementById('existingStatus');
const existingProfile = document.getElementById('existingProfile');
const existingViewLink = document.getElementById('existingViewLink');
const redownloadBtn = document.getElementById('redownloadBtn');

let currentTabUrl = '';
let serverUrl = '';
let saveToLibrary = false;
let existingLocked = false;

// Tab switching
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
  });
});

// Library toggle
libraryToggleRow.addEventListener('click', () => {
  saveToLibrary = !saveToLibrary;
  libraryToggle.classList.toggle('on', saveToLibrary);
});

// Init: load settings, current tab, profiles
chrome.storage.local.get(['serverUrl', 'apiKey'], async (data) => {
  if (data.serverUrl) serverUrlInput.value = data.serverUrl;
  if (data.apiKey) apiKeyInput.value = data.apiKey;

  serverUrl = data.serverUrl || '';
  updateStatus(data.serverUrl, data.apiKey);

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url) {
    currentTabUrl = tab.url;
    urlText.textContent = formatUrl(tab.url);
    if (tab.favIconUrl) {
      urlFavicon.src = tab.favIconUrl;
      urlFavicon.style.display = '';
    } else {
      urlFavicon.style.display = 'none';
    }
  }

  // Load profiles and check for existing downloads if configured
  if (data.serverUrl && data.apiKey) {
    loadProfiles();
    if (currentTabUrl) lookupExisting(currentTabUrl);
  }
});

// Open in wytui (opens server root)
openWytuiBtn.addEventListener('click', () => {
  if (serverUrl) chrome.tabs.create({ url: serverUrl.replace(/\/+$/, '') + '/downloads' });
});

function formatUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 30 ? u.pathname.slice(0, 28) + '…' : u.pathname;
    return u.hostname + path;
  } catch {
    return url;
  }
}

function updateStatus(url, key) {
  if (url && key) {
    statusDot.className = 'status-dot connected';
    statusText.textContent = 'Connected';
    if (!existingLocked) downloadBtn.disabled = false;
  } else {
    statusDot.className = 'status-dot';
    statusText.textContent = 'Not configured';
    downloadBtn.disabled = true;
  }
}

async function lookupExisting(url) {
  let result;
  try {
    result = await chrome.runtime.sendMessage({ action: 'lookupUrl', url });
  } catch (err) {
    console.error('[wytui] sendMessage failed:', err);
    return;
  }
  if (!result?.success || !result.downloads?.length) return;

  const dl = result.downloads[0];
  existingTitle.textContent = dl.title || url;
  existingViewLink.href = serverUrl.replace(/\/+$/, '') + '/downloads/' + dl.id;

  const statusMap = {
    COMPLETED: ['completed', 'Completed'],
    PENDING: ['pending', 'Pending'],
    DOWNLOADING: ['downloading', 'Downloading'],
    FETCHING_INFO: ['downloading', 'Fetching info'],
    PROCESSING: ['downloading', 'Processing'],
    FAILED: ['failed', 'Failed'],
    CANCELLED: ['failed', 'Cancelled'],
  };
  const [cls, label] = statusMap[dl.status] || ['other', dl.status];
  existingStatus.className = 'existing-status ' + cls;
  existingStatus.textContent = label;
  existingProfile.textContent = dl.profile?.name || '';

  existingLocked = true;
  existingWrap.classList.add('visible');
  downloadBtn.disabled = true;
  libraryToggleRow.style.opacity = '0.4';
  libraryToggleRow.style.pointerEvents = 'none';
}

redownloadBtn.addEventListener('click', () => {
  existingLocked = false;
  existingWrap.classList.remove('visible');
  downloadBtn.disabled = false;
  libraryToggleRow.style.opacity = '';
  libraryToggleRow.style.pointerEvents = '';
});

async function loadProfiles() {
  profileSelect.disabled = true;
  profileSelect.innerHTML = '<option value="">Loading profiles…</option>';

  const result = await chrome.runtime.sendMessage({ action: 'fetchProfiles' });

  profileSelect.innerHTML = '';

  if (!result?.success || !result.profiles?.length) {
    profileSelect.innerHTML = '<option value="">Default profile</option>';
    profileSelect.disabled = false;
    return;
  }

  // Add default option
  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = 'Default profile';
  profileSelect.appendChild(defaultOpt);

  result.profiles.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    const badge = p.isDefault ? ' ★' : p.isSystem ? ' (system)' : '';
    const detail = p.audioOnly ? ' · audio' : p.quality ? ` · ${p.quality}` : '';
    opt.textContent = p.name + badge + detail;
    profileSelect.appendChild(opt);
  });

  if (!existingLocked) profileSelect.disabled = false;

  // Select default profile
  const defaultProfile = result.profiles.find((p) => p.isDefault);
  if (defaultProfile) profileSelect.value = defaultProfile.id;
}

// Save settings
saveBtn.addEventListener('click', () => {
  const url = serverUrlInput.value.trim().replace(/\/+$/, '');
  const key = apiKeyInput.value.trim();

  if (!url) {
    showSettingsError('Server URL is required.');
    return;
  }

  chrome.storage.local.set({ serverUrl: url, apiKey: key }, () => {
    serverUrl = url;
    updateStatus(url, key);
    saveBtn.textContent = 'Saved!';
    setTimeout(() => { saveBtn.textContent = 'Save'; }, 2000);
    if (url && key) loadProfiles();
  });
});

function showSettingsError(msg) {
  saveBtn.textContent = msg;
  saveBtn.style.background = '#ef4444';
  setTimeout(() => {
    saveBtn.textContent = 'Save';
    saveBtn.style.background = '';
  }, 2500);
}

// Download
downloadBtn.addEventListener('click', async () => {
  if (!currentTabUrl) {
    showMessage('No page URL found.', 'error');
    return;
  }

  downloadBtn.disabled = true;
  downloadBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite">
      <path d="M21 12a9 9 0 11-6.219-8.56"/>
    </svg>
    Sending…
  `;
  viewLink.style.display = 'none';

  const profileId = profileSelect.value || undefined;

  const response = await chrome.runtime.sendMessage({
    action: 'quickDownload',
    url: currentTabUrl,
    profileId,
    saveToLibrary,
  });

  downloadBtn.disabled = false;
  downloadBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 3v10M6 9l4 4 4-4"/><path d="M4 15h12"/>
    </svg>
    Download
  `;

  if (response?.success) {
    showMessage('Download started!', 'success');
    if (response.downloadId && serverUrl) {
      viewLink.href = serverUrl.replace(/\/+$/, '') + '/downloads/' + response.downloadId;
      viewLink.style.display = 'inline-flex';
    }
  } else {
    showMessage(response?.error || 'Failed to send download.', 'error');
  }
});

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = 'message ' + type;
  if (type === 'error') viewLink.style.display = 'none';
}

// Inject spin keyframe into popup
const style = document.createElement('style');
style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
document.head.appendChild(style);
