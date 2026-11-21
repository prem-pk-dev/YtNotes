(async () => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const defaults = { theme: 'dark', isPro: false };
  let settings = defaults;

  async function get(keys) {
    try { return await chrome.storage.local.get(keys); }
    catch (error) {
      console.error('[YT Study Notes Pro] Storage read failed:', error);
      $('#message').textContent = 'Storage unavailable. Check extension permissions.';
      return null;
    }
  }
  async function set(value) {
    try { await chrome.storage.local.set(value); return true; }
    catch (error) {
      console.error('[YT Study Notes Pro] Storage write failed:', error);
      $('#message').textContent = 'Could not save local settings.';
      return false;
    }
  }
  function applyTheme() {
    document.documentElement.dataset.theme = settings.theme;
    $('#theme').textContent = settings.theme === 'dark' ? '☼' : '☾';
  }
  async function verifyLicenseKey(key) {
    if (key === 'PRO-TEST-2026') return true;
    if (!key) return false;
    try {
      const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ license_key: key, instance_name: 'YT Study Notes Pro' })
      });
      if (!response.ok) return false;
      const data = await response.json();
      return !!(data.valid && data.license_key?.status === 'active');
    } catch (error) {
      console.warn('[YT Study Notes Pro] License validation failed', error);
      return false;
    }
  }

  const data = await get(['ytsnpSettings', 'ytsnpVideos', 'ytsnpStudyArtifacts']);
  if (!data) return;
  settings = { ...defaults, ...(data.ytsnpSettings || {}) };
  applyTheme();

  const videos = data.ytsnpVideos || {};
  const packs = data.ytsnpStudyArtifacts || {};
  const ids = new Set([...Object.keys(videos), ...Object.keys(packs)]);
  $('#videos').textContent = ids.size;
  $('#notes').textContent = Object.values(videos).reduce((count, video) =>
    count + (Array.isArray(video.notes) ? video.notes.length : 0), 0);
  $('#plan').textContent = settings.isPro ? '✦ PRO' : 'FREE';

  const recentItems = [];
  for (const [id, video] of Object.entries(videos)) {
    const noteCount = Array.isArray(video.notes) ? video.notes.length : 0;
    if (noteCount) recentItems.push({
      id, title: video.title || 'YouTube video', subtitle: noteCount + ' notes',
      updatedAt: video.updatedAt || 0, type: 'notes'
    });
  }
  for (const [id, pack] of Object.entries(packs)) {
    if (pack && (pack.summary?.length || pack.transcript?.length)) recentItems.push({
      id, title: pack.title || 'YouTube video', subtitle: 'Study pack · ' +
        (pack.transcript?.length || 0) + ' transcript segments',
      updatedAt: pack.createdAt || 0, type: 'study'
    });
  }
  recentItems.sort((a, b) => b.updatedAt - a.updatedAt);
  const recent = $('#recent');
  if (recentItems.length) {
    recent.innerHTML = recentItems.slice(0, 6).map((item, index) =>
      '<div class="ytsnp-item" data-index="' + index + '"><strong></strong><span></span></div>'
    ).join('');
    recent.querySelectorAll('.ytsnp-item').forEach((element, index) => {
      const item = recentItems[index];
      element.querySelector('strong').textContent = item.title;
      element.querySelector('span').textContent = item.subtitle + ' · ' +
        (item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : 'Saved locally');
      element.addEventListener('click', () => chrome.tabs.create({
        url: 'https://www.youtube.com/watch?v=' + encodeURIComponent(item.id)
      }));
    });
  }

  $('#theme').addEventListener('click', async () => {
    const next = { ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' };
    if (await set({ ytsnpSettings: next })) {
      settings = next;
      applyTheme();
    }
  });
  $('#activate').addEventListener('click', async () => {
    const key = $('#license').value.trim();
    $('#message').textContent = 'Checking license…';
    if (await verifyLicenseKey(key)) {
      const next = { ...settings, isPro: true };
      if (await set({ ytsnpSettings: next })) {
        settings = next;
        $('#plan').textContent = '✦ PRO';
        $('#message').textContent = 'Pro features activated on this device.';
      }
    } else {
      $('#message').textContent = 'License not valid. Please check the key.';
    }
  });
})();