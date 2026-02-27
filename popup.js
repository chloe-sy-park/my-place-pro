function getYouTubeId(url) {
  const match = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/);
  return (match && match[2].length === 11) ? match[2] : null;
}

document.addEventListener('DOMContentLoaded', async () => {
  const boardSelect = document.getElementById('board-select');
  const thumbImg = document.getElementById('thumb-img');
  const saveBtn = document.getElementById('save-btn');
  const status = document.getElementById('status');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Guard: no active tab
  if (!tab) {
    status.textContent = 'No active tab found.';
    status.classList.remove('hidden');
    saveBtn.disabled = true;
    return;
  }

  const isRestricted = /^(chrome|chrome-extension|about|edge):\/\//.test(tab.url || '');
  const videoId = getYouTubeId(tab.url || '');

  // Display page info
  document.getElementById('page-title').textContent = tab.title || '';
  document.getElementById('page-url').textContent = tab.url || '';

  // Disable save on restricted pages
  if (isRestricted) {
    saveBtn.disabled = true;
    status.textContent = 'This page cannot be saved.';
    status.classList.remove('hidden');
  }

  // Load board list
  const populateBoards = (boardList) => {
    const saved = boardSelect.value;
    boardSelect.textContent = '';
    boardList.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b;
      opt.textContent = b;
      boardSelect.appendChild(opt);
    });
    if (boardList.includes(saved)) boardSelect.value = saved;
  };

  chrome.storage.local.get({ boards: ['Inbox'] }, (res) => {
    populateBoards(res.boards);
  });

  // Live-refresh board list when dashboard adds new boards
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.boards) {
      populateBoards(changes.boards.newValue);
    }
  });

  // YouTube thumbnail preview
  if (videoId) {
    document.getElementById('video-preview').classList.remove('hidden');
    thumbImg.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  }

  // Save via background.js message passing
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    status.classList.add('hidden');

    try {
      const [{ result: pageText }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText.slice(0, 1500)
      });

      const data = {
        title: tab.title,
        url: tab.url,
        type: videoId ? 'media' : 'article',
        mediaUrl: videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null,
        text: pageText || '',
        note: document.getElementById('note').value,
        videoId: videoId,
        requestedBoard: boardSelect.value
      };

      chrome.runtime.sendMessage({ action: 'save', data }, (response) => {
        if (chrome.runtime.lastError || !response || !response.success) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save This Page';
          status.textContent = 'Save failed. Please try again.';
          status.classList.remove('hidden');
        } else {
          status.textContent = 'Saved!';
          status.classList.remove('hidden');
          saveBtn.textContent = 'Saved!';
          saveBtn.classList.add('bg-emerald-500');
          setTimeout(() => window.close(), 1000);
        }
      });
    } catch (e) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save This Page';
      status.textContent = isRestricted
        ? 'This page cannot be saved.'
        : 'An error occurred. Please try again.';
      status.classList.remove('hidden');
    }
  });

  document.getElementById('go-dashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });
});
