let dumps = [], boards = ['Inbox'], currentB = 'Inbox', activeId = null;

// --- Data Loading ---
const load = () => {
  chrome.storage.local.get({ dumps: [], boards: ['Inbox'] }, (res) => {
    dumps = res.dumps;
    boards = res.boards;
    renderBoards();
    render();
  });
};

// --- Board Sidebar ---
const renderBoards = () => {
  const container = document.getElementById('boards');
  container.textContent = '';
  boards.forEach(b => {
    const btn = document.createElement('button');
    btn.className = `w-full text-left px-4 py-2 rounded-lg text-sm font-bold transition ${currentB === b ? 'active' : 'hover:bg-slate-100'}`;
    btn.textContent = b;
    btn.addEventListener('click', () => {
      currentB = b;
      document.getElementById('b-title').textContent = b;
      renderBoards();
      render();
    });
    container.appendChild(btn);
  });
};

// --- Grid Rendering ---
const render = () => {
  const filtered = dumps.filter(m => m.board === currentB || (!m.board && currentB === 'Inbox'));
  const grid = document.getElementById('grid');
  grid.textContent = '';

  document.getElementById('item-count').textContent = `${filtered.length} items`;

  filtered.forEach(m => {
    const card = document.createElement('div');
    card.className = 'bg-white/60 backdrop-blur p-6 rounded-3xl border border-white/40 shadow-sm hover:shadow-xl hover:bg-white/80 cursor-pointer transition';
    card.addEventListener('click', () => openM(m.id));

    const img = document.createElement('img');
    img.id = `thumb-${m.id}`;
    img.className = 'w-full h-32 object-cover rounded-lg mb-4';
    if (m.mediaUrl && !isVideo(m.mediaUrl)) {
      img.src = m.mediaUrl;
    }
    card.appendChild(img);

    const badge = document.createElement('span');
    badge.className = 'text-[9px] font-bold bg-slate-100/80 px-2 py-0.5 rounded text-slate-400 uppercase';
    badge.textContent = m.category || '';
    card.appendChild(badge);

    const title = document.createElement('h3');
    title.className = 'font-bold mt-2 line-clamp-2';
    title.textContent = m.title;
    card.appendChild(title);

    const summary = document.createElement('p');
    summary.className = 'text-xs text-slate-500 mt-2 italic line-clamp-2';
    summary.textContent = m.summary ? `"${m.summary}"` : '';
    card.appendChild(summary);

    grid.appendChild(card);

    // Generate video thumbnails async
    if (m.mediaUrl && isVideo(m.mediaUrl)) {
      generateVideoThumbnail(m.mediaUrl).then(thumb => {
        const thumbEl = document.getElementById(`thumb-${m.id}`);
        if (thumbEl) thumbEl.src = thumb;
      }).catch(() => {});
    }
  });
};

const generateVideoThumbnail = (url) => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = url;
    video.crossOrigin = "anonymous";
    video.onerror = () => reject(new Error('Video load failed'));
    video.onloadeddata = () => { video.currentTime = 1; };
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL());
    };
  });
};

const isVideo = (url) => /\.(mp4|webm|ogg)$/i.test(url);

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

  document.getElementById('m-cat').textContent = m.category || '';
  document.getElementById('m-title').textContent = m.title;
  document.getElementById('m-sum').textContent = m.summary || '';

  // Tags
  const tagsContainer = document.getElementById('m-tags');
  tagsContainer.textContent = '';
  (m.tags || []).forEach(tag => {
    const span = document.createElement('span');
    span.className = 'text-[10px] bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full font-bold';
    span.textContent = `#${tag}`;
    tagsContainer.appendChild(span);
  });

  // Content
  const contentEl = document.getElementById('m-content');
  contentEl.textContent = '';
  if (m.mediaUrl) {
    if (isVideo(m.mediaUrl)) {
      const video = document.createElement('video');
      video.src = m.mediaUrl;
      video.className = 'w-full rounded-lg';
      video.controls = true;
      contentEl.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = m.mediaUrl;
      img.className = 'w-full rounded-lg';
      contentEl.appendChild(img);
    }
  } else if (m.text) {
    const div = document.createElement('div');
    div.className = 'whitespace-pre-wrap';
    div.textContent = m.text.slice(0, 500) + (m.text.length > 500 ? '...' : '');
    contentEl.appendChild(div);
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
  if (related.length > 0) {
    document.getElementById('m-related').style.display = '';
    related.forEach(r => {
      const card = document.createElement('div');
      card.className = 'bg-slate-50/80 p-3 rounded-xl cursor-pointer hover:bg-indigo-50 transition';
      card.addEventListener('click', () => openM(r.id));

      const cat = document.createElement('span');
      cat.className = 'text-[9px] font-bold text-indigo-400 uppercase';
      cat.textContent = r.category || '';
      card.appendChild(cat);

      const title = document.createElement('h5');
      title.className = 'text-xs font-bold mt-1 line-clamp-2';
      title.textContent = r.title;
      card.appendChild(title);

      rList.appendChild(card);
    });
  } else {
    document.getElementById('m-related').style.display = 'none';
  }

  // Threads
  const tList = document.getElementById('t-list');
  tList.textContent = '';
  (m.threads || []).forEach(t => {
    const div = document.createElement('div');
    div.className = 'bg-slate-50/80 p-3 rounded-lg text-xs';

    const text = document.createElement('span');
    text.textContent = t.text;
    div.appendChild(text);

    const date = document.createElement('span');
    date.className = 'block text-[8px] text-slate-300 mt-1';
    date.textContent = t.date;
    div.appendChild(date);

    tList.appendChild(div);
  });

  document.getElementById('modal').classList.remove('hidden');
};

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
  if (confirm('이 항목을 삭제하시겠습니까?')) {
    dumps = dumps.filter(m => m.id !== activeId);
    chrome.storage.local.set({ dumps }, () => {
      document.getElementById('modal').classList.add('hidden');
      render();
    });
  }
});

// --- Add Board ---
document.getElementById('add-b').addEventListener('click', () => {
  const name = prompt('새 보드 이름:');
  if (name && name.trim() && !boards.includes(name.trim())) {
    boards.push(name.trim());
    chrome.storage.local.set({ boards }, load);
  }
});

// --- Close Modal ---
document.getElementById('close').addEventListener('click', () => {
  document.getElementById('modal').classList.add('hidden');
});

// --- Init ---
load();
