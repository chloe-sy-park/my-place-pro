let dumps = [], boards = ['Inbox'], currentB = 'Inbox', activeId = null;
let searchQuery = '', activeType = 'all';

const isVideo = (url) => /\.(mp4|webm|ogg)$/i.test(url);

function getContentType(item) {
  if (item.videoId || getYouTubeId(item.url)) return 'video';
  if (/instagram\.com/.test(item.url || '')) return 'instagram';
  if (/twitter\.com|x\.com/.test(item.url || '')) return 'xpost';
  if (item.mediaUrl && !isVideo(item.mediaUrl)) return 'image';
  return 'article';
}

function getSourceLabel(item) {
  const type = getContentType(item);
  const labels = { video: 'YouTube', instagram: 'Instagram', xpost: 'X', image: 'Image', article: 'Web' };
  return labels[type] || 'Web';
}

const TYPE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'video', label: 'Videos' },
  { key: 'article', label: 'Articles' },
  { key: 'image', label: 'Images' },
  { key: 'xpost', label: 'X Posts' },
  { key: 'instagram', label: 'Instagram' },
];

// --- Data Loading ---
const load = () => {
  chrome.storage.local.get({ dumps: [], boards: ['Inbox'] }, (res) => {
    dumps = res.dumps;
    boards = res.boards;
    renderBoardTabs();
    renderTypeFilters();
    render();
  });
};

// --- Board Tabs ---
const renderBoardTabs = () => {
  const container = document.getElementById('board-tabs');
  container.textContent = '';
  boards.forEach(b => {
    const btn = document.createElement('button');
    btn.className = `shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition ${currentB === b ? 'board-active' : 'bg-white/60 text-slate-500 hover:bg-slate-100'}`;
    btn.textContent = b;
    btn.addEventListener('click', () => {
      currentB = b;
      renderBoardTabs();
      render();
    });
    container.appendChild(btn);
  });
};

// --- Type Filters ---
const renderTypeFilters = () => {
  const container = document.getElementById('type-filters');
  container.textContent = '';
  TYPE_FILTERS.forEach(f => {
    const btn = document.createElement('button');
    btn.className = `shrink-0 px-3 py-1 rounded-full text-[11px] font-bold border transition ${activeType === f.key ? 'filter-active' : 'bg-white/40 text-slate-400 border-white/40 hover:bg-white/60'}`;
    btn.textContent = f.label;
    btn.addEventListener('click', () => {
      activeType = f.key;
      renderTypeFilters();
      render();
    });
    container.appendChild(btn);
  });
};

// --- Filtering ---
function getFiltered() {
  let result = dumps.filter(m => m.board === currentB || (!m.board && currentB === 'Inbox'));

  if (activeType !== 'all') {
    result = result.filter(m => getContentType(m) === activeType);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    result = result.filter(m =>
      (m.title || '').toLowerCase().includes(q) ||
      (m.summary || '').toLowerCase().includes(q) ||
      (m.category || '').toLowerCase().includes(q) ||
      (m.url || '').toLowerCase().includes(q) ||
      (m.text || '').toLowerCase().includes(q) ||
      (m.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }

  return result;
}

// --- Grid Rendering ---
const render = () => {
  const filtered = getFiltered();
  const grid = document.getElementById('grid');
  const empty = document.getElementById('empty-state');
  grid.textContent = '';

  document.getElementById('item-count').textContent = `${filtered.length} items`;

  if (filtered.length === 0) {
    grid.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  grid.classList.remove('hidden');
  empty.classList.add('hidden');

  filtered.forEach(m => {
    const card = document.createElement('div');
    card.className = 'bg-white/70 backdrop-blur p-0 rounded-2xl border border-white/50 shadow-sm hover:shadow-lg hover:bg-white cursor-pointer transition overflow-hidden';
    card.addEventListener('click', () => openM(m.id));

    const ytId = m.videoId || getYouTubeId(m.url);
    const thumbUrl = ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : m.mediaUrl;

    // Thumbnail
    if (thumbUrl && !isVideo(thumbUrl)) {
      const imgWrap = document.createElement('div');
      imgWrap.className = 'relative';
      const img = document.createElement('img');
      img.src = thumbUrl;
      img.className = 'w-full object-cover';
      img.onerror = () => imgWrap.remove();
      imgWrap.appendChild(img);

      // Play overlay for videos
      if (ytId) {
        const overlay = document.createElement('div');
        overlay.className = 'absolute inset-0 flex items-center justify-center bg-black/10';
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '40');
        svg.setAttribute('height', '40');
        svg.setAttribute('viewBox', '0 0 64 64');
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '32');
        circle.setAttribute('cy', '32');
        circle.setAttribute('r', '32');
        circle.setAttribute('fill', 'rgba(0,0,0,0.5)');
        svg.appendChild(circle);
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        poly.setAttribute('points', '26,20 26,44 46,32');
        poly.setAttribute('fill', 'white');
        svg.appendChild(poly);
        overlay.appendChild(svg);
        imgWrap.appendChild(overlay);
      }

      card.appendChild(imgWrap);
    }

    // Card body
    const body = document.createElement('div');
    body.className = 'p-4';

    // Source badge
    const source = document.createElement('span');
    source.className = 'text-[9px] font-bold text-slate-400 uppercase';
    source.textContent = getSourceLabel(m);
    body.appendChild(source);

    // Title
    const title = document.createElement('h3');
    title.className = 'text-sm font-bold mt-1 line-clamp-2 leading-snug';
    title.textContent = m.title;
    body.appendChild(title);

    // Category tag
    if (m.category && m.category !== 'Uncategorized') {
      const cat = document.createElement('span');
      cat.className = 'inline-block text-[8px] font-bold bg-indigo-50 text-indigo-400 px-1.5 py-0.5 rounded mt-2';
      cat.textContent = m.category;
      body.appendChild(cat);
    }

    // Summary (for articles without thumbnails)
    if (!thumbUrl && m.summary && !m.summary.includes('was skipped') && !m.summary.includes('failed')) {
      const sum = document.createElement('p');
      sum.className = 'text-[11px] text-slate-400 mt-1.5 italic line-clamp-3';
      sum.textContent = m.summary;
      body.appendChild(sum);
    }

    card.appendChild(body);
    grid.appendChild(card);
  });
};

// --- Related Content ---
const getRelated = (current, all, maxResults = 4) => {
  return all
    .filter(item => item.id !== current.id)
    .map(item => {
      let score = 0;
      if (item.category && current.category && item.category === current.category) score += 2;
      if (item.tags && current.tags) {
        score += item.tags.filter(t => current.tags.includes(t)).length;
      }
      return { item, score };
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(entry => entry.item);
};

// --- Detail Modal ---
const openM = (id) => {
  activeId = id;
  const m = dumps.find(x => x.id === id);
  if (!m) return;

  // Title
  document.getElementById('m-title').textContent = m.title;

  // Date & Source
  document.getElementById('m-date').textContent = m.date || '';
  document.getElementById('m-source').textContent = getSourceLabel(m);

  // URL
  const urlEl = document.getElementById('m-url');
  urlEl.href = m.url || '#';
  urlEl.textContent = m.url || '';
  urlEl.style.display = m.url ? '' : 'none';

  // Summary
  const sumWrap = document.getElementById('m-sum-wrap');
  const sumEl = document.getElementById('m-sum');
  if (m.summary && !m.summary.includes('was skipped') && !m.summary.includes('failed')) {
    sumEl.textContent = m.summary;
    sumWrap.style.display = '';
  } else {
    sumWrap.style.display = 'none';
  }

  // Note
  const noteWrap = document.getElementById('m-note-wrap');
  const noteEl = document.getElementById('m-note');
  if (m.note && m.note.trim()) {
    noteEl.textContent = m.note;
    noteWrap.classList.remove('hidden');
  } else {
    noteWrap.classList.add('hidden');
  }

  // Tags
  const tagsContainer = document.getElementById('m-tags');
  tagsContainer.textContent = '';
  (m.tags || []).forEach(tag => {
    const span = document.createElement('span');
    span.className = 'text-[11px] bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium';
    span.textContent = tag;
    tagsContainer.appendChild(span);
  });
  if (m.category && m.category !== 'Uncategorized') {
    const catSpan = document.createElement('span');
    catSpan.className = 'text-[11px] bg-indigo-50 text-indigo-500 px-2.5 py-1 rounded-full font-bold';
    catSpan.textContent = m.category;
    tagsContainer.insertBefore(catSpan, tagsContainer.firstChild);
  }

  // Content (left panel)
  const contentEl = document.getElementById('m-content');
  contentEl.textContent = '';
  const ytId = m.videoId || getYouTubeId(m.url);

  const igEmbed = getInstagramEmbedUrl(m.url);
  if (ytId) {
    // YouTube: embedded player
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${ytId}`;
    iframe.className = 'w-full aspect-video rounded-xl';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allowfullscreen', '');
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    contentEl.appendChild(iframe);

    // Description text below
    if (m.text) {
      const desc = document.createElement('div');
      desc.className = 'mt-4 text-sm text-slate-600 whitespace-pre-wrap leading-relaxed';
      desc.textContent = m.text.slice(0, 1000);
      contentEl.appendChild(desc);
    }
  } else if (igEmbed) {
    // Instagram: embedded post
    const iframe = document.createElement('iframe');
    iframe.src = igEmbed;
    iframe.className = 'w-full rounded-xl';
    iframe.style.minHeight = '500px';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'no');
    contentEl.appendChild(iframe);
  } else if (m.mediaUrl && !isVideo(m.mediaUrl)) {
    const img = document.createElement('img');
    img.src = m.mediaUrl;
    img.className = 'w-full rounded-xl';
    contentEl.appendChild(img);
  } else if (m.mediaUrl && isVideo(m.mediaUrl)) {
    const video = document.createElement('video');
    video.src = m.mediaUrl;
    video.className = 'w-full rounded-xl';
    video.controls = true;
    contentEl.appendChild(video);
  } else if (m.text) {
    const div = document.createElement('div');
    div.className = 'text-sm text-slate-700 whitespace-pre-wrap leading-relaxed';
    div.textContent = m.text;
    contentEl.appendChild(div);
  }

  // Visit link button
  if (m.url) {
    const visitBtn = document.createElement('a');
    visitBtn.href = m.url;
    visitBtn.target = '_blank';
    visitBtn.rel = 'noopener';
    visitBtn.className = 'inline-flex items-center gap-1.5 mt-4 text-xs font-bold text-indigo-500 hover:text-indigo-700 transition';
    visitBtn.textContent = 'Visit original page \u2192';
    contentEl.appendChild(visitBtn);
  }

  // Board selector
  const boardSelect = document.getElementById('m-board');
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
        render();
        if (boardSelect.value !== currentB) {
          document.getElementById('modal').classList.add('hidden');
        }
      });
    }
  };

  // Related content
  const related = getRelated(m, dumps);
  const rList = document.getElementById('r-list');
  rList.textContent = '';
  const relatedSection = document.getElementById('m-related');
  if (related.length > 0) {
    relatedSection.style.display = '';
    related.forEach(r => {
      const card = document.createElement('div');
      card.className = 'bg-slate-50 p-2.5 rounded-xl cursor-pointer hover:bg-indigo-50 transition flex items-center gap-2.5';
      card.addEventListener('click', () => openM(r.id));

      const rThumb = r.videoId || getYouTubeId(r.url);
      const rThumbUrl = rThumb ? `https://img.youtube.com/vi/${rThumb}/default.jpg` : r.mediaUrl;
      if (rThumbUrl && !isVideo(rThumbUrl)) {
        const img = document.createElement('img');
        img.src = rThumbUrl;
        img.className = 'w-10 h-10 rounded-lg object-cover shrink-0';
        img.onerror = () => img.remove();
        card.appendChild(img);
      }

      const info = document.createElement('div');
      info.className = 'min-w-0';
      const rTitle = document.createElement('p');
      rTitle.className = 'text-[11px] font-bold line-clamp-2';
      rTitle.textContent = r.title;
      info.appendChild(rTitle);
      card.appendChild(info);

      rList.appendChild(card);
    });
  } else {
    relatedSection.style.display = 'none';
  }

  // Threads
  const tList = document.getElementById('t-list');
  tList.textContent = '';
  (m.threads || []).forEach(t => {
    const div = document.createElement('div');
    div.className = 'bg-slate-50 p-2.5 rounded-lg';
    const text = document.createElement('span');
    text.className = 'text-xs';
    text.textContent = t.text;
    div.appendChild(text);
    const date = document.createElement('span');
    date.className = 'block text-[9px] text-slate-300 mt-0.5';
    date.textContent = t.date;
    div.appendChild(date);
    tList.appendChild(div);
  });

  document.getElementById('modal').classList.remove('hidden');
};

// --- Search ---
let searchTimeout;
document.getElementById('search').addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    searchQuery = e.target.value.trim();
    render();
  }, 300);
});

// --- Thread Add ---
document.getElementById('t-add').addEventListener('click', () => {
  const input = document.getElementById('t-input');
  if (!input.value.trim()) return;
  const idx = dumps.findIndex(m => m.id === activeId);
  if (idx !== -1) {
    dumps[idx].threads = [{ text: input.value, date: new Date().toLocaleString() }, ...(dumps[idx].threads || [])];
    chrome.storage.local.set({ dumps }, () => { openM(activeId); input.value = ''; });
  }
});

// --- Delete Item ---
document.getElementById('delete-item').addEventListener('click', () => {
  if (confirm('Delete this item?')) {
    dumps = dumps.filter(m => m.id !== activeId);
    chrome.storage.local.set({ dumps }, () => {
      document.getElementById('modal').classList.add('hidden');
      render();
    });
  }
});

// --- Add Board ---
document.getElementById('add-b').addEventListener('click', () => {
  const name = prompt('New board name:');
  if (name && name.trim() && !boards.includes(name.trim())) {
    boards.push(name.trim());
    chrome.storage.local.set({ boards }, load);
  }
});

// --- Close Modal ---
document.getElementById('close').addEventListener('click', () => {
  document.getElementById('modal').classList.add('hidden');
});

// Close modal on backdrop click
document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    document.getElementById('modal').classList.add('hidden');
  }
});

// --- Settings ---
document.getElementById('go-settings').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
});

// Live-refresh
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.dumps || changes.boards)) load();
});

// --- Init ---
load();
