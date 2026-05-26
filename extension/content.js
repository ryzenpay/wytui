// wytui content script — universal toast notifications

const TOAST_ID = 'wytui-toast';

function showToast(message, success) {
  const existing = document.getElementById(TOAST_ID);
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = TOAST_ID;
  toast.className = success ? 'wytui-toast-success' : 'wytui-toast-error';
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('wytui-toast-visible'));

  setTimeout(() => {
    toast.classList.remove('wytui-toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Listen for toast messages from background (context menu downloads)
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'showToast') {
    showToast(message.message, message.success);
  }
});
