// wytui content script — injects a download button on YouTube video pages

let currentUrl = '';
let buttonInjected = false;

const BUTTON_ID = 'wytui-download-btn';
const TOAST_ID = 'wytui-toast';

function isVideoPage() {
  return location.pathname === '/watch';
}

function createDownloadButton() {
  const btn = document.createElement('button');
  btn.id = BUTTON_ID;
  btn.title = 'Send to wytui';
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 5v10M7 12l5 5 5-5"/>
      <line x1="5" y1="19" x2="19" y2="19"/>
    </svg>
    <span>wytui</span>
  `;

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    btn.classList.add('wytui-loading');
    btn.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'quickDownload',
        url: location.href,
      });

      if (response?.success) {
        showToast('Download started!', true);
      } else {
        showToast(response?.error || 'Failed to send download.', false);
      }
    } catch (err) {
      showToast('Error: ' + err.message, false);
    } finally {
      btn.classList.remove('wytui-loading');
      btn.disabled = false;
    }
  });

  return btn;
}

function injectButton() {
  if (!isVideoPage()) return;
  if (document.getElementById(BUTTON_ID)) return;

  // Target the action bar below the video title (owner row actions)
  const actionsContainer =
    document.querySelector('#actions #actions-inner #menu') ||
    document.querySelector('#top-level-buttons-computed') ||
    document.querySelector('#actions');

  if (!actionsContainer) return;

  const btn = createDownloadButton();
  actionsContainer.insertBefore(btn, actionsContainer.firstChild);
  buttonInjected = true;
}

function removeButton() {
  const btn = document.getElementById(BUTTON_ID);
  if (btn) btn.remove();
  buttonInjected = false;
}

function showToast(message, success) {
  // Remove existing toast
  const existing = document.getElementById(TOAST_ID);
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = TOAST_ID;
  toast.className = success ? 'wytui-toast-success' : 'wytui-toast-error';
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('wytui-toast-visible');
  });

  setTimeout(() => {
    toast.classList.remove('wytui-toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Listen for toast messages from background script (context menu)
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'showToast') {
    showToast(message.message, message.success);
  }
});

// Watch for YouTube SPA navigation
function onNavigate() {
  const newUrl = location.href;
  if (newUrl === currentUrl) return;
  currentUrl = newUrl;

  if (isVideoPage()) {
    // YouTube loads elements dynamically, retry a few times
    let attempts = 0;
    const tryInject = () => {
      injectButton();
      if (!document.getElementById(BUTTON_ID) && attempts < 15) {
        attempts++;
        setTimeout(tryInject, 500);
      }
    };
    tryInject();
  } else {
    removeButton();
  }
}

// Use MutationObserver to detect YouTube SPA navigation
const observer = new MutationObserver(() => {
  onNavigate();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Initial run
onNavigate();
