'use strict';

// Runs in the extension service worker so Lemon Squeezy validation uses
// the extension's declared host permission rather than the YouTube page origin.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'YTSNP_VALIDATE_LICENSE') return;
  const key = typeof message.key === 'string' ? message.key.trim() : '';
  if (!key) {
    sendResponse({ valid: false });
    return;
  }
  (async () => {
    try {
      const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          license_key: key,
          instance_name: 'YT Study Notes Pro'
        }).toString()
      });
      if (!response.ok) return sendResponse({ valid: false });
      const data = await response.json();
      sendResponse({ valid: !!(data.valid && data.license_key?.status === 'active') });
    } catch (error) {
      console.warn('[YT Study Notes Pro] License validation failed:', error);
      sendResponse({ valid: false });
    }
  })();
  return true;
});
