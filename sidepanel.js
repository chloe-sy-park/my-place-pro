let dumps = [], boards = ['Inbox'], currentBoard = 'Inbox', activeId = null;

function getYouTubeId(url) {
  const match = (url || '').match(/(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*)/);
  return (match && match[1].length === 11) ? match[1] : null;
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
  } catch (_) {}
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

    // Tags
    if (m.tags && m.tags.length > 0) {
      const tagsRow = document.createElement('div');
      tagsRow.className = 'flex gap-1 flex-wrap mt-2';
      m.tags.slice(0, 3).forEach(tag => {
        const span = document.createElement('span');
        span.className = 'text-[8px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded-full font-bold';
        span.textContent = `#${tag}`;
        tagsRow.appendChild(span);
      });
      card.appendChild(tagsRow);
    }

    list.appendChild(card);
  });
}

// --- Detail View ---
function openDetail(id) {
  activeId = id;
  const m = dumps.find(x => x.id === id);
  if (!m) return;

  document.getElementById('d-cat').textContent = m.category || '';
  document.getElementById('d-title').textContent = m.title;

  const urlEl = document.getElementById('d-url');
  urlEl.href = m.url || '#';
  urlEl.textContent = m.url || '';
  urlEl.style.display = m.url ? '' : 'none';

  document.getElementById('d-sum').textContent = m.summary || '';

  // Tags
  const tagsEl = document.getElementById('d-tags');
  tagsEl.textContent = '';
  (m.tags || []).forEach(tag => {
    const span = document.createElement('span');
    span.className = 'text-[9px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded-full font-bold';
    span.textContent = `#${tag}`;
    tagsEl.appendChild(span);
  });

  // Content
  const contentEl = document.getElementById('d-content');
  contentEl.textContent = '';
  const ytId = m.videoId || getYouTubeId(m.url);
  if (ytId) {
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${ytId}`;
    iframe.className = 'w-full aspect-video rounded-lg';
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
    contentEl.appendChild(iframe);
  } else if (m.mediaUrl && !/\.(mp4|webm|ogg)$/i.test(m.mediaUrl)) {
    const img = document.createElement('img');
    img.src = m.mediaUrl;
    img.className = 'w-full rounded-lg';
    contentEl.appendChild(img);
  } else if (m.mediaUrl) {
    const video = document.createElement('video');
    video.src = m.mediaUrl;
    video.className = 'w-full rounded-lg';
    video.controls = true;
    contentEl.appendChild(video);
  } else if (m.text) {
    const div = document.createElement('div');
    div.className = 'whitespace-pre-wrap';
    div.textContent = m.text.slice(0, 500) + (m.text.length > 500 ? '...' : '');
    contentEl.appendChild(div);
  }

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
      chrome.storage.local.set({ dumps });
    }
  };

  // Threads
  const threadList = document.getElementById('d-threads');
  threadList.textContent = '';
  (m.threads || []).forEach(t => {
    const div = document.createElement('div');
    div.className = 'bg-white/60 backdrop-blur p-2.5 rounded-lg border border-white/30';

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
  saveBtn.textContent = 'Saving...';
  status.classList.add('hidden');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No tab');

    const videoId = getYouTubeId(tab.url || '');
    let pageText = '';
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const url = window.location.href;

          // YouTube: extract channel, description, visible content
          if (/youtube\.com\/(watch|shorts)/.test(url)) {
            const parts = [];
            const ch = document.querySelector('#channel-name a, ytd-channel-name a');
            if (ch) parts.push('Channel: ' + ch.textContent.trim());
            const desc = document.querySelector('#description-text, ytd-text-inline-expander, #description');
            if (desc) parts.push(desc.innerText.trim().slice(0, 1000));
            if (parts.length) return parts.join('\n');
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
            if (parts.length) return parts.join('\n');
          }

          // Twitter/X: extract tweet text
          if (/twitter\.com|x\.com/.test(url)) {
            const tweet = document.querySelector('[data-testid="tweetText"]');
            if (tweet) return tweet.textContent.trim().slice(0, 2000);
          }

          return document.body.innerText.slice(0, 1500);
        }
      });
      pageText = result || '';
    } catch (_) {}

    const data = {
      title: tab.title,
      url: tab.url,
      type: videoId ? 'media' : 'article',
      mediaUrl: videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null,
      text: pageText,
      note: document.getElementById('note').value,
      videoId: videoId,
      requestedBoard: document.getElementById('save-board').value
    };

    chrome.runtime.sendMessage({ action: 'save', data }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save This Page';
        saveBtn.className = 'w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition';
        status.textContent = 'Save failed. Try again.';
        status.classList.remove('hidden');
      } else {
        status.textContent = 'Saved!';
        status.classList.remove('hidden');
        saveBtn.textContent = 'Saved!';
        saveBtn.className = 'w-full bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs';
        document.getElementById('note').value = '';
        setTimeout(() => {
          saveBtn.className = 'w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition';
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save This Page';
          status.classList.add('hidden');
        }, 1500);
      }
    });
  } catch (_) {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save This Page';
    saveBtn.className = 'w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition';
    status.textContent = 'Cannot save this page.';
    status.classList.remove('hidden');
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
