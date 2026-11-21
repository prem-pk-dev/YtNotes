(() => {
  'use strict';
  if (window.__ytsnpStudyLoaded) return;
  window.__ytsnpStudyLoaded = true;

  const STORE = 'ytsnpStudyArtifacts';
  const $ = (s, root = shadow) => root.querySelector(s);
  let host, shadow, transcript = [], artifacts = null, videoId = '', activeTab = 'overview', transcriptLimit = 150, transcriptQuery = '';

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const getId = () => { const url = new URL(location.href); if (url.pathname === '/watch') return url.searchParams.get('v') || ''; const match = url.pathname.match(/^\/(?:shorts|live|embed)\/([\\w-]{6,})/); return match ? match[1] : ''; };
  const getTitle = () => document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent?.trim() || document.title.replace(/ - YouTube$/, '');
  const fmt = sec => {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
  };
  const words = text => (text.toLowerCase().match(/[\\p{L}\\p{N}][\\p{L}\\p{N}'’\\-]{2,}/gu) || []);
  const stop = new Set(('about after again against also among because before being between both could did does doing down during each few from further had has have having here how into itself just more most other our out over same should some such than that their them then there these they this those through under until very was were what when where which while who will with would your you video videos like make made using used use can could one two get got its his her she him he we us are and the for not but all any as at be by do if in is it of on or to an a i me my we aur hai hain tha thi theek kya ka ki ke ko se mein me par yah yeh wo vah aap hum unka unki unke ek aur lekin nahi nahin hai ho hain tha thi this that').split(' '));

  function ensureUI() {
    if (host) return;
    host = document.createElement('div');
    host.id = 'ytsnp-study-root';
    host.style.cssText = 'all:initial;position:fixed;z-index:2147483001;right:18px;bottom:18px;';
    shadow = host.attachShadow({mode:'open'});
    const style = document.createElement('style');
    style.textContent = ':host{all:initial}*{box-sizing:border-box}.dock{font:13px Inter,Roboto,Arial,sans-serif;color:#f4f6f8;background:#15181d;border:1px solid #343a44;border-radius:16px;width:min(390px,92vw);max-height:78vh;display:flex;flex-direction:column;box-shadow:0 12px 42px #0009;overflow:hidden}.head{display:flex;align-items:center;gap:8px;padding:12px 14px;background:#1d222a;border-bottom:1px solid #343a44}.brand{font-weight:800;flex:1}.sub{font-size:10px;color:#aab3c0;margin-top:3px}.close,.tab,.btn{cursor:pointer;border:1px solid #3b4654;background:#242b35;color:#f4f6f8;border-radius:8px;padding:7px 9px;font:600 11px inherit}.tabs{display:flex;gap:5px;padding:9px 10px;border-bottom:1px solid #343a44;flex-wrap:wrap}.tab[aria-selected=true]{background:#1269bd;border-color:#1269bd}.content{padding:12px;overflow:auto;display:flex;flex-direction:column;gap:10px}.muted{color:#aab3c0}.hint{background:#202833;border:1px solid #394656;padding:10px;border-radius:9px;line-height:1.45}.actions{display:flex;gap:7px;flex-wrap:wrap}.btn.primary{background:#1473cc;border-color:#1473cc}.btn:disabled{opacity:.4;cursor:not-allowed}.card{border:1px solid #343a44;background:#1c222b;border-radius:10px;padding:10px;line-height:1.5}.card h3{font-size:13px;margin:0 0 6px}.card p{margin:0}.point{display:flex;gap:8px;align-items:flex-start}.time{color:#68b7ff;font:600 11px monospace;white-space:nowrap}.list{display:flex;flex-direction:column;gap:7px}.field{width:100%;min-height:115px;resize:vertical;background:#101419;color:#f4f6f8;border:1px solid #3b4654;border-radius:9px;padding:10px;font:12px/1.5 inherit}.q{font-weight:700;line-height:1.5}.option{display:block;width:100%;text-align:left;margin-top:6px;white-space:normal}.answer{color:#83d7a2;margin-top:8px}.fab{position:fixed;right:18px;bottom:18px;background:#1269bd;color:white;border:0;border-radius:30px;padding:11px 15px;font:700 12px Inter,Arial;box-shadow:0 6px 22px #0008;cursor:pointer}.empty{color:#b5bfcc;text-align:center;padding:16px 8px;line-height:1.5}@media(max-width:900px){#ytsnp-study-root{right:12px!important;bottom:76px!important}.dock{width:min(390px,94vw);max-height:70vh}}';
    shadow.append(style);
    const fab = document.createElement('button');
    fab.className = 'fab';
    fab.textContent = '✦ Study Assistant';
    fab.addEventListener('click', () => { const dock = $('.dock'); if (dock) { dock.hidden = false; fab.hidden = true; } else render(); });
    shadow.append(fab);
    document.documentElement.append(host);
  }

  function render() {
    const old = $('.dock');
    if (old) old.remove();
    const dock = document.createElement('section');
    dock.className = 'dock';
    dock.innerHTML = '<header class="head"><div class="brand">✦ Study Assistant<div class="sub">Transcript-based · Runs locally · No AI API</div></div><button class="close" id="close">×</button></header><nav class="tabs"><button class="tab" data-tab="overview">Study</button><button class="tab" data-tab="transcript">Transcript</button><button class="tab" data-tab="quiz">Quiz</button><button class="tab" data-tab="cards">Flashcards</button></nav><main class="content" id="content"></main>';
    shadow.insertBefore(dock, $('.fab'));
    $('.fab').hidden = true;
    $('#close').addEventListener('click', () => { dock.hidden = true; $('.fab').hidden = false; });
    dock.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { activeTab = b.dataset.tab; drawTab(); }));
    drawTab();
  }

  function drawTab() {
    const area = $('#content');
    if (!area) return;
    shadow.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === activeTab)));
    if (activeTab === 'overview') drawOverview(area);
    if (activeTab === 'transcript') drawTranscript(area);
    if (activeTab === 'quiz') drawQuiz(area);
    if (activeTab === 'cards') drawCards(area);
  }

  function drawOverview(area) {
    const title = escapeHtml(getTitle());
    const summary = artifacts?.summary || [];
    const points = artifacts?.keyPoints || [];
    const chapters = artifacts?.chapters || [];
    area.innerHTML = '<div class="hint"><b>' + title + '</b><br><span class="muted">Load this video’s transcript to create a study pack. Transcript availability depends on the video’s captions.</span></div><div class="actions"><button class="btn primary" id="load">↧ Load transcript & build study pack</button><button class="btn" id="paste">Paste transcript</button></div><div class="muted" id="status">' + (transcript.length ? transcript.length + ' transcript segments loaded' : 'No transcript loaded yet') + '</div>' +
      (summary.length ? '<div class="card"><h3>Video summary</h3><div class="list">' + summary.map(s => '<p>' + escapeHtml(s.text) + '</p>').join('') + '</div></div><div class="card"><h3>Key points</h3><div class="list">' + points.map(p => '<div class="point"><span class="time">' + fmt(p.time) + '</span><span>' + escapeHtml(p.text) + '</span></div>').join('') + '</div></div><div class="card"><h3>Smart chapters</h3><div class="list">' + chapters.map(c => '<div class="point"><button class="btn" data-seek="' + c.time + '">' + fmt(c.time) + '</button><span>' + escapeHtml(c.title) + '</span></div>').join('') + '</div></div><div class="actions"><button class="btn" id="export-md">Export Markdown</button><button class="btn" id="export-txt">Export TXT</button><button class="btn" id="export-pdf">Print / PDF</button></div>' : '<div class="empty">Your summary, key points and chapters will appear here after transcript analysis.</div>');
    $('#load')?.addEventListener('click', loadTranscript);
    $('#paste')?.addEventListener('click', showPaste);
    $('#export-md')?.addEventListener('click', () => download('study-notes.md', toMarkdown(), 'text/markdown'));
    $('#export-txt')?.addEventListener('click', () => download('study-notes.txt', toText(), 'text/plain'));
    $('#export-pdf')?.addEventListener('click', printPack);
    area.querySelectorAll('[data-seek]').forEach(b => b.addEventListener('click', () => seek(Number(b.dataset.seek))));
  }

  function showPaste() {
    const area = $('#content');
    area.innerHTML = '<div class="hint">Paste transcript text below. Add timestamps like <b>00:12</b> at the start of lines if available.</div><textarea class="field" id="paste-area" placeholder="Paste YouTube transcript here..."></textarea><div class="actions"><button class="btn primary" id="build">Build study pack</button><button class="btn" id="back">Back</button></div>';
    $('#build').addEventListener('click', () => {
      const raw = $('#paste-area').value.trim();
      if (!raw) return;
      transcript = raw.split(/\n+/).map((line, i) => {
        const match = line.match(/^\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+(.*)$/);
        const time = match ? Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) : i * 8;
        return {time, text:(match ? match[4] : line).trim()};
      }).filter(x => x.text);
      buildPack();
    });
    $('#back').addEventListener('click', () => { activeTab = 'overview'; drawTab(); });
  }

  async function loadTranscript() {
    const status = $('#status');
    const id = getId();
    if (!id) { status.textContent = 'Open a YouTube watch page first.'; return; }
    status.textContent = 'Looking for the YouTube transcript…';
    let rows = readSegments();
    if (!rows.length) {
      const buttons = Array.from(document.querySelectorAll('button, ytd-button-renderer button, tp-yt-paper-button'));
      const trigger = buttons.find(b => /show transcript|transcript/i.test((b.getAttribute('aria-label') || '') + ' ' + (b.textContent || '')));
      if (trigger) { trigger.click(); await wait(1100); rows = readSegments(); }
    }
    if (!rows.length) {
      status.textContent = 'Transcript not detected. Open the video description → Show transcript, then press Load transcript again. You can also use Paste transcript.';
      return;
    }
    transcript = rows;
    status.textContent = 'Loaded ' + rows.length + ' transcript segments. Building study pack…';
    buildPack();
  }

  function readSegments() {
    const selectors = ['ytd-transcript-segment-renderer', 'transcript-segment-view-model', '[class*="transcript-segment"]'];
    let nodes = [];
    for (const selector of selectors) { nodes = Array.from(document.querySelectorAll(selector)); if (nodes.length) break; }
    const rows = new Map();
    const parseTime = value => {
      const m = String(value || '').trim().match(/(?:(\d+):)?(\d{1,2}):(\d{2})/);
      return m ? Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
    };
    nodes.forEach(node => {
      const text = (node.querySelector('.segment-text, [class*="segment-text"]')?.textContent || node.textContent || '').trim();
      const timeText = node.querySelector('.segment-timestamp, [class*="timestamp"]')?.textContent || node.getAttribute('start') || '';
      const time = parseTime(timeText);
      if (text) rows.set(time + ':' + text, {time, text});
    });
    return Array.from(rows.values()).sort((a,b) => a.time - b.time);
  }

  function buildPack() {
    if (!transcript.length) return;
    const clean = transcript.map((s,i) => ({time:Number(s.time)||i*8,text:String(s.text||'').replace(/\s+/g,' ').trim()})).filter(s => s.text.length > 8);
    const sentences = [];
    let buffer = '', bufferTime = 0;
    clean.forEach(seg => {
      if (!buffer) bufferTime = seg.time;
      buffer += (buffer ? ' ' : '') + seg.text;
      if (/[.!?]$/.test(seg.text) || buffer.length >= 180) {
        if (buffer.length > 35) sentences.push({time:bufferTime,text:buffer});
        buffer = '';
      }
    });
    if (buffer.length > 35) sentences.push({time:bufferTime,text:buffer});
    const freq = new Map();
    words(clean.map(s=>s.text).join(' ')).forEach(w => { if (!stop.has(w)) freq.set(w,(freq.get(w)||0)+1); });
    const score = s => {
      const ws = words(s.text).filter(w=>!stop.has(w));
      return ws.reduce((n,w)=>n+(freq.get(w)||0),0) / Math.max(4,Math.sqrt(ws.length)) + Math.min(s.text.length,180)/180;
    };
    const ranked = sentences.map(s=>({...s,score:score(s)})).sort((a,b)=>b.score-a.score);
    const summary = ranked.slice(0,Math.min(5,ranked.length)).sort((a,b)=>a.time-b.time);
    const keyPoints = ranked.slice(0,Math.min(9,ranked.length)).sort((a,b)=>a.time-b.time);
    const chapters = [];
    const duration = clean[clean.length-1]?.time || 0;
    const bucketSize = duration > 1800 ? 300 : duration > 600 ? 180 : 90;
    const buckets = new Map();
    clean.forEach(s => { const bucket = Math.floor(s.time/bucketSize); if (!buckets.has(bucket)) buckets.set(bucket,[]); buckets.get(bucket).push(s); });
    for (const [bucket, items] of buckets) {
      const candidate = items.slice().sort((a,b)=>score(b)-score(a))[0];
      if (candidate && (chapters.length === 0 || candidate.time - chapters[chapters.length-1].time > 35)) chapters.push({time:items[0].time,title:trimTitle(candidate.text)});
    }
    const quiz = makeQuiz(keyPoints, freq);
    const cards = keyPoints.slice(0,12).map(p => {
      const terms = words(p.text).filter(w => !stop.has(w)).sort((a,b) => (freq.get(b)||0) - (freq.get(a)||0));
      const term = terms[0] || 'Key idea';
      return {front:'Explain: ' + term,back:p.text,time:p.time};
    });
    artifacts = {videoId:getId(),title:getTitle(),createdAt:Date.now(),summary,keyPoints,chapters,quiz,cards,transcript:clean};
    saveArtifacts().then(() => { activeTab='overview'; drawTab(); });
  }

  function trimTitle(text) {
    const clean = text.replace(/^[,.\s]+/,'').replace(/[.!?].*$/,'').trim();
    return clean.length > 64 ? clean.slice(0,61) + '…' : clean || 'Key topic';
  }

  function makeQuiz(points, freq) {
    const pool = Array.from(freq.entries()).filter(([w,n])=>w.length>3 && n>1).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
    return points.slice(0,8).map((p,i) => {
      const answer = pool.find(w=>p.text.toLowerCase().includes(w)) || words(p.text).find(w=>!stop.has(w)) || 'idea';
      const distractors = [];
      for (const word of pool) {
        if (word !== answer && !p.text.toLowerCase().includes(word) && !distractors.includes(word)) distractors.push(word);
        if (distractors.length === 3) break;
      }
      const fallbacks = ['concept','process','result','method','example','principle'];
      for (const word of fallbacks) {
        if (distractors.length === 3) break;
        if (word !== answer && !distractors.includes(word)) distractors.push(word);
      }
      const options = [answer,...distractors].sort((a,b)=>a.localeCompare(b));
      return {question:'Which keyword is explicitly present in this transcript excerpt: “' + p.text.slice(0,115) + (p.text.length>115?'…':'') + '”?',options,answer,time:p.time};
    });
  }

  function drawTranscript(area) {
    if (!transcript.length) {
      area.innerHTML = '<div class="empty">No transcript loaded. Go to Study → Load transcript, or paste a transcript.</div>';
      return;
    }
    const filtered = transcript.filter(s => !transcriptQuery || s.text.toLowerCase().includes(transcriptQuery));
    const visible = filtered.slice(0, transcriptLimit);
    area.innerHTML = '<div class="hint">Transcript segments: ' + transcript.length + '. Search and select a timestamp to jump to that point.</div>' +
      '<input class="field" id="transcript-search" style="min-height:0" placeholder="Search transcript…" value="' + escapeHtml(transcriptQuery) + '">' +
      '<div class="muted">Showing ' + visible.length + ' of ' + filtered.length + ' matching segments</div>' +
      '<div class="list">' + visible.map(s=>'<div class="point"><button class="btn" data-seek="' + s.time + '">' + fmt(s.time) + '</button><span>' + escapeHtml(s.text) + '</span></div>').join('') + '</div>' +
      (visible.length < filtered.length ? '<button class="btn" id="more-transcript">Load more transcript</button>' : '');
    $('#transcript-search').addEventListener('input', e => {
      transcriptQuery = e.target.value.toLowerCase().trim();
      transcriptLimit = 150;
      drawTranscript(area);
      const input = $('#transcript-search');
      input.focus();
      input.setSelectionRange(input.value.length,input.value.length);
    });
    $('#more-transcript')?.addEventListener('click', () => { transcriptLimit += 150; drawTranscript(area); });
    area.querySelectorAll('[data-seek]').forEach(b=>b.addEventListener('click',()=>seek(Number(b.dataset.seek))));
  }

  function drawQuiz(area) {
    const quiz = artifacts?.quiz || [];
    if (!quiz.length) { area.innerHTML='<div class="empty">Load a transcript first to generate a practice quiz.</div>'; return; }
    area.innerHTML='<div class="hint">Practice questions generated locally from the transcript. These are extractive study checks, not AI-generated explanations.</div>' + quiz.map((q,i)=>'<div class="card"><div class="muted">Question ' + (i+1) + ' · ' + fmt(q.time) + '</div><p class="q">' + escapeHtml(q.question) + '</p>' + q.options.map(o=>'<button class="btn option" data-q="' + i + '" data-option="' + escapeHtml(o) + '">' + escapeHtml(o) + '</button>').join('') + '<div class="answer" id="answer-' + i + '" hidden></div></div>').join('');
    area.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',()=>{
      const q=quiz[Number(b.dataset.q)], box=$('#answer-'+b.dataset.q);
      box.hidden=false; box.textContent=(b.dataset.option===q.answer?'Correct. ':'Review: ')+'Best matching keyword: '+q.answer;
    }));
  }

  function drawCards(area) {
    const cards = artifacts?.cards || [];
    if (!cards.length) { area.innerHTML='<div class="empty">Load a transcript first to create revision flashcards.</div>'; return; }
    area.innerHTML='<div class="hint">Tap a card to reveal the transcript-based answer.</div>' + cards.map((c,i)=>'<button class="card" style="text-align:left;color:inherit;cursor:pointer" data-card="' + i + '"><div class="muted">Flashcard ' + (i+1) + ' · ' + fmt(c.time) + '</div><div class="q">' + escapeHtml(c.front) + '</div><p class="answer" id="card-' + i + '" hidden>' + escapeHtml(c.back) + '</p></button>').join('');
    area.querySelectorAll('[data-card]').forEach(b=>b.addEventListener('click',()=>{const p=$('#card-'+b.dataset.card);p.hidden=!p.hidden;}));
  }

  async function saveArtifacts() {
    const snapshot = artifacts;
    const targetId = snapshot && snapshot.videoId;
    if (!targetId) return false;
    try {
      const data = await chrome.storage.local.get([STORE]);
      if (targetId !== videoId) return false;
      const all = data[STORE] || {};
      all[targetId] = snapshot;
      await chrome.storage.local.set({[STORE]:all});
      return true;
    } catch(e) {
      console.warn('[YT Study Notes Pro] Study pack storage failed',e);
      const status = $('#status');
      if (status) status.textContent = 'Could not save study pack. Check extension storage space.';
      return false;
    }
  }

  function seek(time) {
    const v=document.querySelector('video.html5-main-video')||document.querySelector('video');
    if (v) {v.currentTime=time;v.play().catch(()=>{});}
  }

  function toMarkdown() {
    if (!artifacts) return '';
    return '# '+artifacts.title+'\n\n## Summary\n'+artifacts.summary.map(s=>'- ['+fmt(s.time)+'] '+s.text).join('\n')+'\n\n## Key points\n'+artifacts.keyPoints.map(s=>'- ['+fmt(s.time)+'] '+s.text).join('\n')+'\n\n## Chapters\n'+artifacts.chapters.map(c=>'- ['+fmt(c.time)+'] '+c.title).join('\n')+'\n\n## Quiz\n'+artifacts.quiz.map((q,i)=>(i+1)+'. '+q.question+'\n   Answer: '+q.answer).join('\n\n')+'\n\n## Flashcards\n'+artifacts.cards.map(c=>'- **'+c.front+'**\n  '+c.back).join('\n');
  }
  function toText() { return toMarkdown().replace(/^#+ /gm,'').replace(/\*\*/g,''); }
  function download(name,content,type) {
    const url=URL.createObjectURL(new Blob([content],{type:type+';charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function printPack() {
    if (!artifacts) return;
    const w=window.open('','_blank'); if(!w) return;
    w.document.write('<!doctype html><meta charset="utf-8"><title>Study pack</title><style>body{font:15px/1.6 Arial;max-width:800px;margin:40px auto;color:#222}h1,h2{line-height:1.2}li{margin:8px 0}@media print{body{margin:15mm}}</style><h1>'+escapeHtml(artifacts.title)+'</h1><h2>Summary</h2><ul>'+artifacts.summary.map(s=>'<li><b>'+fmt(s.time)+'</b> '+escapeHtml(s.text)+'</li>').join('')+'</ul><h2>Key points</h2><ul>'+artifacts.keyPoints.map(s=>'<li><b>'+fmt(s.time)+'</b> '+escapeHtml(s.text)+'</li>').join('')+'</ul><h2>Chapters</h2><ul>'+artifacts.chapters.map(c=>'<li><b>'+fmt(c.time)+'</b> '+escapeHtml(c.title)+'</li>').join('')+'</ul><h2>Quiz</h2><ol>'+artifacts.quiz.map(q=>'<li>'+escapeHtml(q.question)+'<br><b>Answer:</b> '+escapeHtml(q.answer)+'</li>').join('')+'</ol><h2>Flashcards</h2><ul>'+artifacts.cards.map(c=>'<li><b>'+escapeHtml(c.front)+'</b><br>'+escapeHtml(c.back)+'</li>').join('')+'</ul><script>window.onload=()=>window.print()<\\/script>');
    w.document.close();
  }

  async function loadSavedPack() {
    const requestedId = videoId;
    try {
      const data = await chrome.storage.local.get([STORE]);
      if (requestedId !== videoId) return;
      artifacts = data[STORE]?.[requestedId] || null;
      transcript = artifacts?.transcript || [];
    } catch (e) {
      if (requestedId !== videoId) return;
      artifacts = null;
      transcript = [];
    }
    if (host && $('.dock')) { activeTab='overview'; drawTab(); }
  }

  function onNavigation() {
    const next = getId();
    if (!next) {
      if (host) host.style.display = 'none';
      videoId = '';
      return;
    }
    if (next === videoId) {
      if (host) host.style.display = '';
      return;
    }
    videoId = next;
    transcript = [];
    artifacts = null;
    transcriptLimit = 150;
    transcriptQuery = '';
    if (!host) {
      const legacy = document.getElementById('ytsnp-root');
      if (legacy) legacy.style.right = '410px';
      ensureUI();
      render();
    } else {
      host.style.display = '';
      if ($('.dock')) { activeTab='overview'; drawTab(); }
    }
    loadSavedPack();
  }

  function init() {
    let last = location.href;
    const checkNavigation = () => {
      if (location.href !== last) { last = location.href; onNavigation(); }
    };
    new MutationObserver(checkNavigation).observe(document.documentElement,{subtree:true,childList:true});
    window.addEventListener('yt-navigate-finish',onNavigation);
    window.addEventListener('popstate',onNavigation);
    onNavigation();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();