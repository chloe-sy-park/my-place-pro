let dumps = [], currentB = 'Inbox', activeId = null;

const load = () => {
  chrome.storage.local.get({ dumps: [], boards: ['Inbox'] }, (res) => {
    dumps = res.dumps;
    document.getElementById('boards').innerHTML = res.boards.map(b => `
      <button onclick="setB('${b}')" class="w-full text-left px-4 py-2 rounded-lg text-sm font-bold ${currentB===b?'active':''}">${b}</button>
    `).join('');
    render();
  });
};

window.setB = (b) => { currentB = b; document.getElementById('b-title').innerText = b; load(); };

const render = () => {
  const filtered = dumps.filter(m => m.board === currentB || (!m.board && currentB === 'Inbox'));
  document.getElementById('grid').innerHTML = filtered.map(m => `
    <div onclick="openM(${m.id})" class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl cursor-pointer transition">
      <img id="thumb-${m.id}" src="${(m.mediaUrl && !isVideo(m.mediaUrl)) ? m.mediaUrl : ''}" class="w-full h-32 object-cover rounded-lg mb-4">
      <span class="text-[9px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-400 uppercase">${m.category}</span>
      <h3 class="font-bold mt-2 line-clamp-2">${m.title}</h3>
      <p class="text-xs text-slate-500 mt-2 italic">"${m.summary}"</p>
    </div>
  `).join('');

  filtered.forEach(m => {
    if (m.mediaUrl && isVideo(m.mediaUrl)) {
      generateVideoThumbnail(m.mediaUrl).then(thumb => {
        const img = document.getElementById(`thumb-${m.id}`);
        if(img) img.src = thumb;
      });
    }
  });
};

const generateVideoThumbnail = (url) => {
  return new Promise(resolve => {
    const video = document.createElement('video');
    video.src = url;
    video.crossOrigin = "anonymous";
    video.onloadeddata = () => {
      video.currentTime = 1;
    };
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL());
    };
  });
};

const isVideo = (url) => /\.(mp4|webm|ogg)$/i.test(url);

window.openM = (id) => {
  activeId = id;
  const m = dumps.find(x => x.id === id);
  document.getElementById('m-cat').innerText = m.category;
  document.getElementById('m-title').innerText = m.title;
  document.getElementById('m-sum').innerText = m.summary;
  
  let contentHtml = '';
  if (m.mediaUrl) {
    if (isVideo(m.mediaUrl)) {
      contentHtml = `<video src="${m.mediaUrl}" class="w-full rounded-lg" controls></video>`;
    } else {
      contentHtml = `<img src="${m.mediaUrl}" class="w-full rounded-lg">`;
    }
  } else {
    contentHtml = `<div class="whitespace-pre-wrap">${m.text.slice(0, 500)}...</div>`;
  }
  document.getElementById('m-content').innerHTML = contentHtml;

  document.getElementById('t-list').innerHTML = (m.threads||[]).map(t => `<div class="bg-slate-50 p-3 rounded-lg text-xs">${t.text} <span class="block text-[8px] text-slate-300 mt-1">${t.date}</span></div>`).join('');
  document.getElementById('modal').classList.remove('hidden');
};

document.getElementById('t-add').onclick = () => {
  const input = document.getElementById('t-input');
  const idx = dumps.findIndex(m => m.id === activeId);
  dumps[idx].threads = [{text: input.value, date: new Date().toLocaleString()}, ...(dumps[idx].threads||[])];
  chrome.storage.local.set({ dumps }, () => { openM(activeId); input.value = ''; });
};

document.getElementById('close').onclick = () => document.getElementById('modal').classList.add('hidden');
load();
