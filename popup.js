const apiKey = ""; // Runtime provides the key

function getYouTubeId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", 
        responseSchema: { type: "OBJECT", properties: { summary: { type: "STRING" }, tags: { type: "ARRAY", items: { type: "STRING" } } } } }
    })
  });
  const data = await response.json();
  return JSON.parse(data.candidates[0].content.parts[0].text);
}

document.addEventListener('DOMContentLoaded', async () => {
  const boardSelect = document.getElementById('board-select');
  const thumbPreview = document.getElementById('video-preview');
  const thumbImg = document.getElementById('thumb-img');
  const saveBtn = document.getElementById('save-btn');
  const status = document.getElementById('status');

  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const videoId = getYouTubeId(tab.url);

  // 보드 목록 로드
  chrome.storage.local.get({ boards: ['Inbox'] }, (res) => {
    boardSelect.innerHTML = res.boards.map(b => `<option value="${b}">${b}</option>`).join('');
  });

  // 비디오 감지 및 썸네일 설정
  if (videoId) {
    thumbPreview.classList.remove('hidden');
    thumbImg.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  }

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    status.classList.remove('hidden');
    
    try {
      const [{result: pageText}] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText.slice(0, 1000)
      });

      const aiData = await callGemini(`Summarize this in 1 short Korean sentence. Title: ${tab.title}. Content: ${pageText}`);

      const newItem = {
        id: Date.now(),
        title: tab.title,
        url: tab.url,
        videoId: videoId,
        board: boardSelect.value,
        note: document.getElementById('note').value,
        summary: aiData.summary,
        tags: aiData.tags,
        timestamp: new Date().toLocaleDateString()
      };

      chrome.storage.local.get({ minds: [] }, (res) => {
        chrome.storage.local.set({ minds: [newItem, ...res.minds] }, () => {
          status.textContent = "저장 완료!";
          setTimeout(() => window.close(), 1000);
        });
      });
    } catch (e) {
      saveBtn.disabled = false;
      status.textContent = "오류 발생. 다시 시도해 주세요.";
    }
  });

  document.getElementById('go-dashboard').addEventListener('click', () => chrome.runtime.openOptionsPage());
});
