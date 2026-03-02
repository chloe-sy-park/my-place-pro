let dumps = [], boards = ['Inbox'], currentBoard = 'Inbox', activeId = null;

const ENGINE_LABELS = { 'built-in': 'On-Device AI', 'cloud': 'Cloud AI', 'trial': 'Trial AI' };

// --- AI Status ---
function updateAIStatus() {
  chrome.runtime.sendMessage({ action: 'getAIStatus' }, (s) => {
    if (chrome.runtime.lastError || !s) return;
    const el = document.getElementById('ai-status');
    if (!el) return;
    if (s.builtIn === 'available') {
      el.textContent = 'On-Device AI';
      el.className = 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600';
    } else if (s.hasApiKey) {
      el.textContent = 'Cloud AI';
      el.className = 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600';
    } else if (s.trialConfigured) {
      el.textContent = `Trial (${s.trialRemaining})`;
      el.className = 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600';
    } else {
      el.textContent = 'No AI';
      el.className = 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500';
    }
  });
}

// --- Data Loading ---
function load() {
  chrome.storage.local.get({ dumps: [], boards: ['Inbox'] }, (res) => {
    dumps = res.dumps;
    boards = res.boards;
    renderBoardFilter();
    renderItems();
    populateSaveBoards();
  });
}

// --- Current Page Info ---
async function loadCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    document.getElementById('page-title').textContent = tab.title || '';
    document.getElementById('page-url').textContent = tab.url || '';

    const isRestricted = /^(chrome|chrome-extension|about|edge):\/\//.test(tab.url || '');
    const saveBtn = document.getElementById('save-btn');
    if (isRestricted) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Cannot save this page';
      saveBtn.className = 'w-full bg-slate-300 text-slate-500 font-bold py-2.5 rounded-xl text-xs cursor-not-allowed';
    } else {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save This Page';
      saveBtn.className = 'w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition';
    }

    // YouTube preview
    const videoId = getYouTubeId(tab.url || '');
    const preview = document.getElementById('save-preview');
    if (videoId) {
      document.getElementById('preview-thumb').src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
      preview.classList.remove('hidden');
    } else {
      preview.classList.add('hidden');
    }
  } catch (err) {
    console.warn('Failed to load current page info:', err);
  }
}

// --- Board Filter ---
function renderBoardFilter() {
  const select = document.getElementById('board-filter');
  const prev = select.value || currentBoard;
  select.textContent = '';
  boards.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b;
    opt.textContent = b;
    opt.selected = b === prev;
    select.appendChild(opt);
  });
  currentBoard = boards.includes(prev) ? prev : 'Inbox';
}

function populateSaveBoards() {
  const select = document.getElementById('save-board');
  const prev = select.value;
  select.textContent = '';
  boards.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b;
    opt.textContent = b;
    select.appendChild(opt);
  });
  if (boards.includes(prev)) select.value = prev;
}

// --- Items List ---
function renderItems() {
  const filtered = dumps.filter(m => m.board === currentBoard || (!m.board && currentBoard === 'Inbox'));
  const list = document.getElementById('items-list');
  list.textContent = '';
  document.getElementById('item-count').textContent = `${filtered.length} items`;

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'text-center py-10 text-slate-400';
    const emptyTitle = document.createElement('p');
    emptyTitle.className = 'text-sm font-bold';
    emptyTitle.textContent = 'No items yet';
    const emptyDesc = document.createElement('p');
    emptyDesc.className = 'text-xs mt-1';
    emptyDesc.textContent = 'Save a page to get started!';
    empty.appendChild(emptyTitle);
    empty.appendChild(emptyDesc);
    list.appendChild(empty);
    return;
  }

  filtered.forEach(m => {
    const card = document.createElement('div');
    card.className = 'bg-white/60 backdrop-blur p-4 rounded-2xl border border-white/40 shadow-sm hover:shadow-md hover:bg-white/80 cursor-pointer transition';
    card.addEventListener('click', () => openDetail(m.id));

    // Thumbnail
    const ytId = m.videoId || getYouTubeId(m.url);
    const thumbUrl = ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : m.mediaUrl;
    if (thumbUrl && !/\.(mp4|webm|ogg)$/i.test(thumbUrl)) {
      const img = document.createElement('img');
      img.src = thumbUrl;
      img.className = 'w-full h-28 object-cover rounded-xl mb-3';
      img.onerror = () => img.remove();
      card.appendChild(img);
    }

    // Category
    if (m.category && m.category !== 'Uncategorized') {
      const badge = document.createElement('span');
      badge.className = 'text-[8px] font-bold bg-slate-100/80 px-1.5 py-0.5 rounded text-slate-400 uppercase';
      badge.textContent = m.category;
      card.appendChild(badge);
    }

    // Title
    const title = document.createElement('h3');
    title.className = 'text-sm font-bold mt-1.5 line-clamp-2';
    title.textContent = m.title;
    card.appendChild(title);

    // Summary
    if (m.summary && !m.summary.includes('was skipped') && !m.summary.includes('failed')) {
      const sum = document.createElement('p');
      sum.className = 'text-[10px] text-slate-500 mt-1 italic line-clamp-2';
      sum.textContent = m.summary;
      card.appendChild(sum);
    }

    // Tag cloud
    const tagsRow = document.createElement('div');
    tagsRow.className = 'flex gap-1 flex-wrap mt-2';

    // Content type badge first
    const cType = getContentType(m);
    const typeBadge = document.createElement('span');
    typeBadge.className = `text-[8px] font-bold px-1.5 py-0.5 rounded-full ${TYPE_COLORS[cType] || 'bg-slate-100 text-slate-500'}`;
    typeBadge.textContent = TYPE_LABELS[cType] || 'Web Page';
    tagsRow.appendChild(typeBadge);

    // AI-generated tags
    if (m.tags && m.tags.length > 0) {
      m.tags.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'text-[8px] bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded-full font-medium';
        span.textContent = tag;
        tagsRow.appendChild(span);
      });
    }
    card.appendChild(tagsRow);

    list.appendChild(card);
  });
}

function getContentType(item) {
  if (item.videoId || getYouTubeId(item.url)) return 'video';
  if (/instagram\.com/.test(item.url || '')) return 'instagram';
  if (/twitter\.com|x\.com/.test(item.url || '')) return 'xpost';
  if (item.mediaUrl && !/\.(mp4|webm|ogg)$/i.test(item.mediaUrl)) return 'image';
  return 'article';
}

const TYPE_LABELS = { video: 'Video', instagram: 'Instagram', xpost: 'X Post', image: 'Image', article: 'Web Page' };
const TYPE_COLORS = {
  video: 'bg-red-50 text-red-600',
  instagram: 'bg-pink-50 text-pink-600',
  xpost: 'bg-slate-800 text-white',
  image: 'bg-emerald-50 text-emerald-600',
  article: 'bg-blue-50 text-blue-600'
};

function getSourceLabel(item) {
  return TYPE_LABELS[getContentType(item)] || 'Web Page';
}

// --- Detail View ---
function openDetail(id) {
  activeId = id;
  const m = dumps.find(x => x.id === id);
  if (!m) return;

  // Content preview (top)
  const contentEl = document.getElementById('d-content');
  contentEl.textContent = '';
  const ytId = m.videoId || getYouTubeId(m.url);
  const igEmbed = getInstagramEmbedUrl(m.url);
  if (ytId) {
    createYouTubePlayer(ytId, contentEl);
  } else if (igEmbed) {
    const iframe = document.createElement('iframe');
    iframe.src = igEmbed;
    iframe.className = 'w-full rounded-xl';
    iframe.style.minHeight = '400px';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'no');
    contentEl.appendChild(iframe);
  } else if (m.mediaUrl && !/\.(mp4|webm|ogg)$/i.test(m.mediaUrl)) {
    const img = document.createElement('img');
    img.src = m.mediaUrl;
    img.className = 'w-full rounded-xl';
    contentEl.appendChild(img);
  } else if (m.mediaUrl) {
    const video = document.createElement('video');
    video.src = m.mediaUrl;
    video.className = 'w-full rounded-xl';
    video.controls = true;
    contentEl.appendChild(video);
  }

  // Metadata
  document.getElementById('d-title').textContent = m.title;
  document.getElementById('d-date').textContent = m.date || '';
  document.getElementById('d-source').textContent = getSourceLabel(m);

  const urlEl = document.getElementById('d-url');
  urlEl.href = m.url || '#';
  urlEl.textContent = m.url || '';
  urlEl.style.display = m.url ? '' : 'none';

  // Summary
  const sumWrap = document.getElementById('d-sum-wrap');
  const sumEl = document.getElementById('d-sum');
  if (m.summary && !m.summary.includes('was skipped') && !m.summary.includes('failed')) {
    sumEl.textContent = m.summary;
    sumWrap.style.display = '';
  } else {
    sumWrap.style.display = 'none';
  }

  // Note
  const noteWrap = document.getElementById('d-note-wrap');
  const noteEl = document.getElementById('d-note');
  if (m.note && m.note.trim()) {
    noteEl.textContent = m.note;
    noteWrap.classList.remove('hidden');
  } else {
    noteWrap.classList.add('hidden');
  }

  // Tag cloud
  const tagsEl = document.getElementById('d-tags');
  tagsEl.textContent = '';

  // Content type badge
  const dType = getContentType(m);
  const dTypeBadge = document.createElement('span');
  dTypeBadge.className = `text-[9px] font-bold px-2 py-0.5 rounded-full ${TYPE_COLORS[dType] || 'bg-slate-100 text-slate-500'}`;
  dTypeBadge.textContent = TYPE_LABELS[dType] || 'Web Page';
  tagsEl.appendChild(dTypeBadge);

  // Category badge
  if (m.category && m.category !== 'Uncategorized') {
    const catSpan = document.createElement('span');
    catSpan.className = 'text-[9px] bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full font-bold';
    catSpan.textContent = m.category;
    tagsEl.appendChild(catSpan);
  }

  // AI-generated tags (show all)
  (m.tags || []).forEach(tag => {
    const span = document.createElement('span');
    span.className = 'text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium';
    span.textContent = tag;
    tagsEl.appendChild(span);
  });

  // Board selector
  const boardSelect = document.getElementById('d-board');
  boardSelect.textContent = '';
  boards.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b;
    opt.textContent = b;
    opt.selected = b === (m.board || 'Inbox');
    boardSelect.appendChild(opt);
  });
  boardSelect.onchange = () => {
    const idx = dumps.findIndex(x => x.id === id);
    if (idx !== -1) {
      dumps[idx].board = boardSelect.value;
      chrome.storage.local.set({ dumps }, () => {
        renderItems();
      });
    }
  };

  // Threads
  const threadList = document.getElementById('d-threads');
  threadList.textContent = '';
  (m.threads || []).forEach(t => {
    const div = document.createElement('div');
    div.className = 'bg-white/60 p-2 rounded-lg';
    const text = document.createElement('span');
    text.className = 'text-xs';
    text.textContent = t.text;
    div.appendChild(text);
    const date = document.createElement('span');
    date.className = 'block text-[8px] text-slate-300 mt-0.5';
    date.textContent = t.date;
    div.appendChild(date);
    threadList.appendChild(div);
  });

  document.getElementById('detail-overlay').classList.remove('hidden');
}

// --- Save Current Page ---
async function saveCurrentPage() {
  const saveBtn = document.getElementById('save-btn');
  const status = document.getElementById('save-status');
  saveBtn.disabled = true;
  saveBtn.classList.add('hidden');
  document.getElementById('save-loading').classList.remove('hidden');
  document.getElementById('save-loading-text').textContent = 'Analyzing with AI...';
  status.classList.add('hidden');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No tab');

    const videoId = getYouTubeId(tab.url || '');
    let pageText = '';
    let ogImage = null;
    let ogTitle = null;
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const url = window.location.href;
          const ogTitle = document.querySelector('meta[property="og:title"]');
          const ogDesc = document.querySelector('meta[property="og:description"]');
          const ogImg = document.querySelector('meta[property="og:image"]');
          const ogImage = ogImg?.content || null;
          const metaDesc = document.querySelector('meta[name="description"]');

          // YouTube: extract channel, description
          if (/youtube\.com\/(watch|shorts)/.test(url)) {
            const parts = [];
            const ch = document.querySelector('#channel-name a, ytd-channel-name a');
            if (ch) parts.push('Channel: ' + ch.textContent.trim());
            const desc = document.querySelector('#description-text, ytd-text-inline-expander, #description');
            if (desc) parts.push(desc.innerText.trim().slice(0, 1000));
            if (parts.length) return { text: parts.join('\n'), ogImage, title: ogTitle?.content || null };
          }

          // Instagram: extract username + caption
          if (/instagram\.com\/(p|reel|reels)\//.test(url)) {
            const parts = [];
            const article = document.querySelector('article');
            if (article) {
              const user = article.querySelector('header a');
              if (user) parts.push('@' + user.textContent.trim());
              const caption = article.querySelector('h1') || article.querySelector('div > span[dir="auto"]');
              if (caption) parts.push(caption.textContent.trim().slice(0, 1000));
            }
            if (parts.length) return { text: parts.join('\n'), ogImage, title: ogTitle?.content || null };
          }

          // Twitter/X: extract tweet text
          if (/twitter\.com|x\.com/.test(url)) {
            const tweet = document.querySelector('[data-testid="tweetText"]');
            if (tweet) return { text: tweet.textContent.trim().slice(0, 2000), ogImage, title: ogTitle?.content || null };
          }

          // Generic: try semantic content containers first
          const mainEl = document.querySelector('article, [role="main"], main, .post-content, .article-body, .entry-content, #content');
          if (mainEl) {
            const mainText = mainEl.innerText.trim();
            if (mainText.length > 100) return { text: mainText.slice(0, 2000), ogImage, title: ogTitle?.content || null };
          }

          // OG / meta description fallback
          if (ogDesc?.content && ogDesc.content.length > 20) {
            return { text: ogDesc.content, ogImage, title: ogTitle?.content || null };
          }
          if (metaDesc?.content && metaDesc.content.length > 20) {
            return { text: metaDesc.content, ogImage, title: ogTitle?.content || null };
          }

          // Last resort: body text with nav/footer stripped
          const clone = document.body.cloneNode(true);
          clone.querySelectorAll('nav, footer, aside, header, script, style, noscript, [role="navigation"], [role="banner"], [role="contentinfo"]').forEach(n => n.remove());
          return { text: clone.innerText.trim().slice(0, 2000), ogImage, title: ogTitle?.content || null };
        }
      });
      const extracted = result || {};
      pageText = typeof extracted === 'string' ? extracted : (extracted.text || '');
      ogImage = typeof extracted === 'object' ? extracted.ogImage : null;
      ogTitle = typeof extracted === 'object' ? extracted.title : null;
    } catch (err) {
      console.warn('Failed to extract page text:', err);
    }

    const data = {
      title: ogTitle || tab.title,
      url: tab.url,
      type: videoId ? 'media' : 'article',
      mediaUrl: videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : (ogImage || null),
      text: pageText,
      note: document.getElementById('note').value,
      videoId: videoId,
      requestedBoard: document.getElementById('save-board').value
    };

    chrome.runtime.sendMessage({ action: 'save', data }, (response) => {
      document.getElementById('save-loading').classList.add('hidden');
      saveBtn.classList.remove('hidden');

      if (chrome.runtime.lastError || !response || !response.success) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save This Page';
        saveBtn.className = 'w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition';
        status.textContent = 'Save failed. Try again.';
        status.className = 'text-center text-[10px] text-red-500 font-bold mt-1.5';
      } else {
        const engineLabel = ENGINE_LABELS[response.engine] || 'AI';
        document.getElementById('note').value = '';
        updateAIStatus();

        if (response.warning) {
          // Saved but AI analysis failed — show warning
          status.textContent = `Saved (no AI): ${response.warning.slice(0, 80)}`;
          status.className = 'text-center text-[10px] text-amber-600 font-bold mt-1.5';
          saveBtn.textContent = 'Saved (no AI)';
          saveBtn.className = 'w-full bg-amber-500 text-white font-bold py-2.5 rounded-xl text-xs';
        } else {
          status.textContent = `Saved! (${engineLabel})`;
          status.className = 'text-center text-[10px] text-emerald-500 font-bold mt-1.5';
          saveBtn.textContent = 'Saved!';
          saveBtn.className = 'w-full bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs';
        }

        setTimeout(() => {
          saveBtn.className = 'w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition';
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save This Page';
          status.classList.add('hidden');
        }, 3000);
      }
    });
  } catch (err) {
    console.warn('Save failed:', err);
    document.getElementById('save-loading').classList.add('hidden');
    saveBtn.classList.remove('hidden');
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save This Page';
    saveBtn.className = 'w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition';
    status.textContent = 'Cannot save this page.';
    status.className = 'text-center text-[10px] text-red-500 font-bold mt-1.5';
  }
}

// --- Event Listeners ---
document.getElementById('board-filter').addEventListener('change', (e) => {
  currentBoard = e.target.value;
  renderItems();
});

document.getElementById('save-btn').addEventListener('click', saveCurrentPage);

document.getElementById('back-btn').addEventListener('click', () => {
  document.getElementById('detail-overlay').classList.add('hidden');
  renderItems();
});

document.getElementById('delete-item').addEventListener('click', () => {
  if (confirm('Delete this item?')) {
    dumps = dumps.filter(m => m.id !== activeId);
    chrome.storage.local.set({ dumps }, () => {
      document.getElementById('detail-overlay').classList.add('hidden');
      renderItems();
    });
  }
});

document.getElementById('d-thread-add').addEventListener('click', () => {
  const input = document.getElementById('d-thread-input');
  if (!input.value.trim()) return;
  const idx = dumps.findIndex(m => m.id === activeId);
  if (idx !== -1) {
    dumps[idx].threads = [{ text: input.value, date: new Date().toLocaleString() }, ...(dumps[idx].threads || [])];
    chrome.storage.local.set({ dumps }, () => { openDetail(activeId); input.value = ''; });
  }
});

document.getElementById('add-board').addEventListener('click', () => {
  const name = prompt('New board name:');
  if (name && name.trim() && !boards.includes(name.trim())) {
    boards.push(name.trim());
    chrome.storage.local.set({ boards }, load);
  }
});

document.getElementById('go-settings').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
});

document.getElementById('open-dashboard').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
});

// Live-refresh when data changes (e.g., save from content script)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.dumps || changes.boards)) {
    load();
  }
});

// Update page info when user switches tabs
chrome.tabs.onActivated.addListener(() => loadCurrentPage());
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') loadCurrentPage();
});

// --- Init ---
loadCurrentPage();
load();
updateAIStatus();
