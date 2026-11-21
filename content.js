(() => {
  'use strict';
  if (window.__ytsnpLoaded) return;
  window.__ytsnpLoaded = true;

  const PREFIX = 'ytsnp-';
  const FREE_NOTES = 5;
  const FREE_SHOTS = 2;
  const STORE_KEY = 'ytsnpVideos';
  const DEFAULTS = { theme: 'dark', focusMode: false, autoPause: true, minimized: false, isPro: false };
  let videoId = '';
  let videoTitle = '';
  let notes = [];
  let draftImage = '';
  let settings = { ...DEFAULTS };
  let rootHost, shadow, panel, body, list, editor, textarea, statusNode;
  let lastUrl = location.href;
  let resumeAfterSave = false;
  let focusHidden = [];
  let clockVideo = null;

  const $ = (selector, scope = shadow) => scope.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const currentVideo = () => document.querySelector('video.html5-main-video') || document.querySelector('video');
  const getVideoId = () => new URL(location.href).searchParams.get('v') || (location.pathname.startsWith('/shorts/') ? location.pathname.split('/')[2] : '');
  const formatTime = seconds => {
    const s = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h ? [h,m,sec].map(n => String(n).padStart(2,'0')).join(':') : [m,sec].map(n => String(n).padStart(2,'0')).join(':');
  };
  const notify = message => {
    if (!statusNode) return;
    statusNode.textContent = message;
    statusNode.classList.add(PREFIX + 'show');
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => statusNode.classList.remove(PREFIX + 'show'), 2600);
  };
  const storageGet = async keys => {
    try { return await chrome.storage.local.get(keys); }
    catch (error) { console.error('[YT Study Notes Pro] Storage read failed:', error); notify('Storage unavailable. Check extension permissions.'); return null; }
  };
  const storageSet = async data => {
    try { await chrome.storage.local.set(data); return true; }
    catch (error) { console.error('[YT Study Notes Pro] Storage write failed:', error); notify('Could not save. Local storage may be full.'); return false; }
  };
  const loadSettings = async () => {
    const data = await storageGet(['ytsnpSettings']);
    if (!data) return;
    settings = { ...DEFAULTS, ...(data.ytsnpSettings || {}) };
  };
  const saveSettings = async patch => {
    settings = { ...settings, ...patch };
    await storageSet({ ytsnpSettings: settings });
    applySettings();
  };
  const loadVideoNotes = async () => {
    const data = await storageGet([STORE_KEY]);
    if (!data) return;
    const all = data[STORE_KEY] || {};
    notes = Array.isArray(all[videoId]?.notes) ? all[videoId].notes : [];
    videoTitle = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent?.trim()
      || document.querySelector('h1.title')?.textContent?.trim() || document.title.replace(/ - YouTube$/, '') || 'YouTube video';
    renderNotes();
  };
  const persistNotes = async () => {
    const data = await storageGet([STORE_KEY]);
    if (!data) return false;
    const all = data[STORE_KEY] || {};
    all[videoId] = { title: videoTitle, url: 'https://www.youtube.com/watch?v=' + encodeURIComponent(videoId), updatedAt: Date.now(), notes };
    return storageSet({ [STORE_KEY]: all });
  };

  function buildUI() {
    if (rootHost) return;
    rootHost = document.createElement('div');
    rootHost.id = 'ytsnp-root';
    rootHost.style.cssText = 'all:initial;position:fixed;z-index:2147483000;right:18px;bottom:18px;';
    shadow = rootHost.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host{all:initial}.ytsnp-panel{font-family:Inter,Roboto,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;width:clamp(300px,24vw,380px);max-height:82vh;display:flex;flex-direction:column;color:var(--ytsnp-text);background:var(--ytsnp-surface);border:1px solid var(--ytsnp-border);border-radius:16px;box-shadow:0 12px 42px #0008;overflow:hidden;font-size:13px}
      .ytsnp-head{display:flex;align-items:center;gap:9px;padding:13px 14px;border-bottom:1px solid var(--ytsnp-border);background:var(--ytsnp-bg)}
      .ytsnp-brand{font-weight:750;font-size:14px;letter-spacing:-.2px;flex:1}.ytsnp-sub{color:var(--ytsnp-muted);font-size:11px;margin-top:2px;max-width:245px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .ytsnp-iconbtn{border:1px solid var(--ytsnp-border);background:transparent;color:var(--ytsnp-text);border-radius:8px;width:30px;height:30px;cursor:pointer;font-size:15px}
      .ytsnp-content{padding:12px;overflow:auto;display:flex;flex-direction:column;gap:11px}
      .ytsnp-actions{display:flex;gap:7px;flex-wrap:wrap}.ytsnp-btn{border:1px solid var(--ytsnp-border);background:var(--ytsnp-card);color:var(--ytsnp-text);border-radius:9px;padding:8px 10px;font:600 12px Inter,Roboto,sans-serif;cursor:pointer}.ytsnp-btn.primary{background:var(--ytsnp-accent);color:white;border-color:var(--ytsnp-accent)}.ytsnp-btn:disabled{opacity:.45;cursor:not-allowed}
      .ytsnp-row{display:flex;align-items:center;justify-content:space-between;gap:8px}.ytsnp-toggle{display:flex;align-items:center;gap:7px;color:var(--ytsnp-muted);font-size:12px}.ytsnp-toggle input{accent-color:var(--ytsnp-accent)}
      .ytsnp-field{width:100%;box-sizing:border-box;border:1px solid var(--ytsnp-border);background:var(--ytsnp-bg);color:var(--ytsnp-text);border-radius:10px;padding:10px;font:13px Inter,Roboto,sans-serif;outline:none}.ytsnp-field:focus{border-color:var(--ytsnp-accent)}textarea.ytsnp-field{min-height:86px;resize:vertical;line-height:1.5}
      .ytsnp-compose{display:flex;flex-direction:column;gap:8px}.ytsnp-shot{font-size:11px;color:var(--ytsnp-muted)}.ytsnp-note{padding:10px;border:1px solid var(--ytsnp-border);border-radius:11px;background:var(--ytsnp-card);display:flex;flex-direction:column;gap:7px}
      .ytsnp-notehead{display:flex;align-items:center;gap:8px}.ytsnp-time{font:600 12px "JetBrains Mono",Consolas,monospace;color:var(--ytsnp-accent);cursor:pointer;background:none;border:0;padding:0}.ytsnp-noteText{white-space:pre-wrap;line-height:1.5;overflow-wrap:anywhere}.ytsnp-noteActions{display:flex;gap:6px;margin-left:auto}.ytsnp-mini{border:0;background:none;color:var(--ytsnp-muted);cursor:pointer;font-size:12px;padding:2px}
      .ytsnp-thumb{width:100%;max-height:125px;object-fit:contain;border-radius:7px;background:#000}.ytsnp-muted{color:var(--ytsnp-muted)}.ytsnp-empty{text-align:center;padding:22px 10px;color:var(--ytsnp-muted);border:1px dashed var(--ytsnp-border);border-radius:10px}
      .ytsnp-footer{border-top:1px solid var(--ytsnp-border);padding:10px 12px;display:flex;justify-content:space-between;align-items:center;gap:8px}.ytsnp-pill{font-size:10px;padding:4px 7px;border-radius:20px;background:var(--ytsnp-card);color:var(--ytsnp-muted)}
      .ytsnp-toast{position:absolute;bottom:66px;left:12px;right:12px;background:var(--ytsnp-text);color:var(--ytsnp-bg);padding:9px 12px;border-radius:8px;opacity:0;pointer-events:none;transition:opacity .2s}.ytsnp-toast.ytsnp-show{opacity:1}
      .ytsnp-minimized{width:auto;max-height:none;border-radius:30px}.ytsnp-minimized .ytsnp-content,.ytsnp-minimized .ytsnp-footer,.ytsnp-minimized .ytsnp-sub{display:none}.ytsnp-minimized .ytsnp-head{border:0;border-radius:30px;padding:9px 12px}
      .ytsnp-modal{position:fixed;inset:0;background:#0009;display:grid;place-items:center;padding:18px;z-index:3}.ytsnp-dialog{width:min(100%,330px);padding:18px;border-radius:14px;background:var(--ytsnp-surface);border:1px solid var(--ytsnp-border);display:flex;flex-direction:column;gap:10px}.ytsnp-dialog h3{margin:0;font-size:16px}.ytsnp-dialog p{margin:0;color:var(--ytsnp-muted);line-height:1.5}
      @media(max-width:700px){.ytsnp-panel{width:min(94vw,380px);max-height:76vh}}
    `;
    shadow.append(style);
    panel = document.createElement('section');
    panel.className = PREFIX + 'panel';
    panel.innerHTML = `
      <header class="ytsnp-head"><div style="min-width:0;flex:1"><div class="ytsnp-brand">✦ YT Study Notes <span style="color:var(--ytsnp-accent)">Pro</span></div><div class="ytsnp-sub" id="ytsnp-title">Loading video…</div></div><button class="ytsnp-iconbtn" id="ytsnp-theme" title="Toggle theme" aria-label="Toggle theme">☼</button><button class="ytsnp-iconbtn" id="ytsnp-min" title="Minimize" aria-label="Minimize">−</button></header>
      <div class="ytsnp-content" id="ytsnp-body">
        <div class="ytsnp-row"><label class="ytsnp-toggle"><input type="checkbox" id="ytsnp-autopause"> Auto-pause while writing</label><label class="ytsnp-toggle"><input type="checkbox" id="ytsnp-focus"> Focus mode</label></div>
        <div class="ytsnp-compose"><textarea class="ytsnp-field" id="ytsnp-note-input" placeholder="Write a key idea, question, or takeaway…"></textarea><div class="ytsnp-row"><span class="ytsnp-shot" id="ytsnp-shot-label">No screenshot attached</span><button class="ytsnp-btn" id="ytsnp-shot">▣ Capture frame</button></div><div class="ytsnp-actions"><button class="ytsnp-btn primary" id="ytsnp-save">＋ Save note <span id="ytsnp-time-label">00:00</span></button><button class="ytsnp-btn" id="ytsnp-upgrade">Upgrade</button></div></div>
        <div class="ytsnp-row"><strong>Study notes</strong><span class="ytsnp-pill" id="ytsnp-count">0 notes</span></div><div id="ytsnp-list"></div>
      </div>
      <footer class="ytsnp-footer"><span class="ytsnp-pill" id="ytsnp-plan">FREE PLAN</span><div class="ytsnp-actions"><button class="ytsnp-btn" id="ytsnp-md">Copy MD</button><button class="ytsnp-btn" id="ytsnp-pdf">Export PDF</button></div></footer><div class="ytsnp-toast" id="ytsnp-toast" role="status"></div>`;
    shadow.append(panel);
    body = $('#ytsnp-body'); list = $('#ytsnp-list'); textarea = $('#ytsnp-note-input'); statusNode = $('#ytsnp-toast');
    $('#ytsnp-theme').addEventListener('click', () => saveSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' }));
    $('#ytsnp-min').addEventListener('click', () => saveSettings({ minimized: !settings.minimized }));
    $('#ytsnp-autopause').addEventListener('change', e => saveSettings({ autoPause: e.target.checked }));
    $('#ytsnp-focus').addEventListener('change', e => saveSettings({ focusMode: e.target.checked }));
    textarea.addEventListener('focus', () => {
      if (settings.autoPause) { const v = currentVideo(); resumeAfterSave = !!v && !v.paused; if (resumeAfterSave) v.pause(); }
    });
    $('#ytsnp-shot').addEventListener('click', captureScreenshot);
    $('#ytsnp-save').addEventListener('click', saveNote);
    $('#ytsnp-upgrade').addEventListener('click', showUpgrade);
    $('#ytsnp-md').addEventListener('click', exportMarkdown);
    $('#ytsnp-pdf').addEventListener('click', exportPdf);
    applySettings();
    document.documentElement.append(rootHost);
  }
  function applySettings() {
    if (!panel) return;
    const dark = settings.theme === 'dark';
    panel.style.cssText = dark
      ? '--ytsnp-bg:#0f0f0f;--ytsnp-surface:#181818;--ytsnp-card:#202020;--ytsnp-border:#2a2a2a;--ytsnp-text:#f1f1f1;--ytsnp-muted:#aaa;--ytsnp-accent:#3ea6ff;'
      : '--ytsnp-bg:#f8f9fa;--ytsnp-surface:#fff;--ytsnp-card:#f3f4f6;--ytsnp-border:#e5e7eb;--ytsnp-text:#202124;--ytsnp-muted:#687078;--ytsnp-accent:#065fd4;';
    panel.classList.toggle(PREFIX + 'minimized', !!settings.minimized);
    $('#ytsnp-min').textContent = settings.minimized ? '+' : '−';
    $('#ytsnp-theme').textContent = dark ? '☼' : '☾';
    $('#ytsnp-autopause').checked = !!settings.autoPause;
    $('#ytsnp-focus').checked = !!settings.focusMode;
    $('#ytsnp-plan').textContent = settings.isPro ? '✦ PRO PLAN' : 'FREE PLAN';
    $('#ytsnp-upgrade').textContent = settings.isPro ? 'PRO ACTIVE' : 'Upgrade';
    $('#ytsnp-upgrade').disabled = !!settings.isPro;
    applyFocusMode();
  }
  function applyFocusMode() {
    const selectors = ['#related', '#comments', 'ytd-rich-shelf-renderer[is-shorts]', 'ytd-reel-shelf-renderer', 'ytd-reel-video-renderer'];
    if (settings.focusMode) {
      selectors.forEach(selector => document.querySelectorAll(selector).forEach(el => {
        if (el.closest('#ytsnp-root')) return;
        if (!focusHidden.some(x => x.el === el)) focusHidden.push({ el, display: el.style.getPropertyValue('display'), priority: el.style.getPropertyPriority('display') });
        el.style.setProperty('display', 'none', 'important');
      }));
    } else {
      focusHidden.forEach(({el, display, priority}) => { if (el?.isConnected) { if (display) el.style.setProperty('display', display, priority || ''); else el.style.removeProperty('display'); } });
      focusHidden = [];
    }
  }
  function renderNotes() {
    if (!list) return;
    $('#ytsnp-title').textContent = videoTitle;
    $('#ytsnp-count').textContent = notes.length + ' notes';
    $('#ytsnp-time-label').textContent = formatTime(currentVideo()?.currentTime || 0);
    if (!notes.length) { list.innerHTML = '<div class="ytsnp-empty">Your study notes will appear here.<br><span class="ytsnp-muted">Capture a timestamp and save your first idea.</span></div>'; return; }
    list.innerHTML = notes.slice().sort((a,b) => a.time-b.time).map(note => `
      <article class="ytsnp-note" data-note-id="${escapeHtml(note.id)}"><div class="ytsnp-notehead"><button class="ytsnp-time" data-action="seek" data-id="${escapeHtml(note.id)}">${formatTime(note.time)}</button><div class="ytsnp-noteActions"><button class="ytsnp-mini" data-action="edit" data-id="${escapeHtml(note.id)}">Edit</button><button class="ytsnp-mini" data-action="delete" data-id="${escapeHtml(note.id)}">Delete</button></div></div><div class="ytsnp-noteText">${escapeHtml(note.text)}</div>${note.image ? '<img class="ytsnp-thumb" alt="Captured video frame" src="' + note.image + '">' : ''}</article>`).join('');
    list.querySelectorAll('button[data-action]').forEach(btn => btn.addEventListener('click', () => handleNoteAction(btn.dataset.action, btn.dataset.id)));
  }
  async function captureScreenshot() {
    const v = currentVideo();
    if (!v || !v.videoWidth) return notify('Video frame is not ready yet.');
    const count = notes.filter(n => n.image).length + (draftImage ? 1 : 0);
    if (!settings.isPro && count >= FREE_SHOTS) return showUpgrade('Free plan includes 2 screenshots per video.');
    try {
      const scale = Math.min(1, 640 / v.videoWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(v.videoWidth * scale)); canvas.height = Math.max(1, Math.round(v.videoHeight * scale));
      canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height);
      draftImage = canvas.toDataURL('image/jpeg', 0.65);
      $('#ytsnp-shot-label').textContent = '✓ Screenshot ready (' + Math.round(draftImage.length / 1024) + ' KB)';
      notify('Clean video frame captured.');
    } catch (error) {
      console.warn('[YT Study Notes Pro] Screenshot capture failed:', error);
      notify('Capture blocked by the video. Try again after playback starts.');
    }
  }
  async function saveNote() {
    const text = textarea.value.trim();
    if (!text && !draftImage) return notify('Write a note or capture a frame first.');
    if (!settings.isPro && notes.length >= FREE_NOTES) return showUpgrade('Free plan includes 5 notes per video.');
    const v = currentVideo();
    notes.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), time: v?.currentTime || 0, text, image: draftImage, createdAt: Date.now() });
    if (!(await persistNotes())) { notes.pop(); return; }
    textarea.value = ''; draftImage = ''; $('#ytsnp-shot-label').textContent = 'No screenshot attached';
    renderNotes();
    if (resumeAfterSave && v) v.play().catch(() => {}); resumeAfterSave = false;
    notify('Note saved on this device.');
  }
  async function handleNoteAction(action, id) {
    const index = notes.findIndex(n => n.id === id); if (index < 0) return;
    if (action === 'seek') { const v = currentVideo(); if (v) { v.currentTime = notes[index].time; v.play().catch(() => {}); } return; }
    if (action === 'delete') { if (!confirm('Delete this note?')) return; notes.splice(index,1); await persistNotes(); renderNotes(); return; }
    if (action === 'edit') {
      const updated = prompt('Edit note', notes[index].text); if (updated === null) return;
      notes[index].text = updated.trim(); await persistNotes(); renderNotes();
    }
  }
  function markdownText() {
    return '# ' + videoTitle + '\n\n' + 'Video: https://www.youtube.com/watch?v=' + videoId + '\n\n' +
      notes.slice().sort((a,b)=>a.time-b.time).map(n => '## ' + formatTime(n.time) + '\n\n' + (n.text || '_Screenshot note_') + (n.image ? '\n\n![Captured frame](' + n.image + ')' : '')).join('\n\n---\n\n');
  }
  async function exportMarkdown() {
    if (!settings.isPro) return showUpgrade('Markdown export is a Pro feature.');
    try { await navigator.clipboard.writeText(markdownText()); notify('Markdown copied to clipboard.'); }
    catch { notify('Clipboard access unavailable on this page.'); }
  }
  function exportPdf() {
    if (!settings.isPro) return showUpgrade('PDF export is a Pro feature.');
    const rows = notes.slice().sort((a,b)=>a.time-b.time).map(n => '<article><a href="https://www.youtube.com/watch?v=' + encodeURIComponent(videoId) + '&t=' + Math.floor(n.time) + 's">' + formatTime(n.time) + '</a><p>' + escapeHtml(n.text).replace(/\n/g,'<br>') + '</p>' + (n.image ? '<img src="' + n.image + '">' : '') + '</article>').join('');
    const w = window.open('', '_blank');
    if (!w) return notify('Allow pop-ups to export your notes.');
    w.document.write('<!doctype html><html><head><title>' + escapeHtml(videoTitle) + ' — Study Notes</title><style>body{font:15px/1.6 Arial,sans-serif;max-width:760px;margin:40px auto;color:#222}h1{font-size:25px}a{color:#065fd4;font-family:monospace}article{padding:16px 0;border-bottom:1px solid #ddd}img{max-width:100%;max-height:360px;object-fit:contain}p{white-space:pre-wrap}@media print{body{margin:15mm}a{color:#111}}</style></head><body><h1>' + escapeHtml(videoTitle) + '</h1><p><a href="https://www.youtube.com/watch?v=' + encodeURIComponent(videoId) + '">Open video</a></p>' + rows + '<script>window.onload=()=>window.print()<\/script></body></html>');
    w.document.close();
  }
  function showUpgrade(reason = 'Unlock unlimited notes, screenshots, and exports.') {
    if (settings.isPro) return;
    const modal = document.createElement('div'); modal.className = PREFIX + 'modal';
    modal.innerHTML = '<div class="ytsnp-dialog"><h3>Unlock Study Notes Pro</h3><p>' + escapeHtml(reason) + '</p><p>Pro includes unlimited notes, unlimited screenshots, PDF and Markdown exports.</p><input class="ytsnp-field" id="ytsnp-license" placeholder="Enter license key" autocomplete="off"><div class="ytsnp-actions"><button class="ytsnp-btn primary" id="ytsnp-activate">Activate Pro</button><button class="ytsnp-btn" id="ytsnp-close">Maybe later</button></div><small class="ytsnp-muted" id="ytsnp-license-status">Test key: PRO-TEST-2026</small></div>';
    shadow.append(modal);
    $('#ytsnp-close', modal).onclick = () => modal.remove();
    $('#ytsnp-activate', modal).onclick = async () => {
      const key = $('#ytsnp-license', modal).value.trim();
      $('#ytsnp-license-status', modal).textContent = 'Checking license…';
      const valid = await verifyLicenseKey(key);
      if (valid) { await saveSettings({ isPro: true }); modal.remove(); notify('Pro features activated.'); }
      else $('#ytsnp-license-status', modal).textContent = 'License not valid. Check the key and try again.';
    };
  }
  async function verifyLicenseKey(key) {
    if (key === 'PRO-TEST-2026') return true;
    if (!key) return false;
    try {
      const result = await chrome.runtime.sendMessage({ type: 'YTSNP_VALIDATE_LICENSE', key });
      return !!result?.valid;
    } catch (error) {
      console.warn('[YT Study Notes Pro] License validation failed:', error);
      return false;
    }
  }
  function bindClock() {
    const video = currentVideo();
    if (video && video !== clockVideo) {
      clockVideo = video;
      video.addEventListener('timeupdate', () => {
        const el = $('#ytsnp-time-label');
        if (el) el.textContent = formatTime(video.currentTime);
      });
    }
  }
  async function handleNavigation() {
    const next = getVideoId();
    if (!next || next === videoId) { applyFocusMode(); return; }
    videoId = next; draftImage = ''; resumeAfterSave = false;
    if (textarea) textarea.value = '';
    await loadVideoNotes();
    bindClock();
  }
  function watchUrl() {
    if (location.href !== lastUrl) { lastUrl = location.href; handleNavigation(); }
  }
  function syncVisibility() {
    if (!rootHost) return;
    const fullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
    rootHost.style.display = fullscreen ? 'none' : '';
  }
  async function init() {
    await loadSettings();
    buildUI();
    videoId = getVideoId();
    if (videoId) await loadVideoNotes();
    else { videoTitle = 'Open a YouTube video'; $('#ytsnp-title').textContent = videoTitle; }
    bindClock();
    document.addEventListener('yt-navigate-finish', handleNavigation);
    window.addEventListener('popstate', watchUrl);
    setInterval(watchUrl, 900);
    document.addEventListener('fullscreenchange', syncVisibility);
    document.addEventListener('webkitfullscreenchange', syncVisibility);
    const observer = new MutationObserver(() => { if (settings.focusMode) applyFocusMode(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    bindClock();
    syncVisibility();
  }
  init().catch(error => console.error('[YT Study Notes Pro] Initialization failed:', error));
})();