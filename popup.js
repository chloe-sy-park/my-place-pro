const apiKey = ""; // API 키는 보안을 위해 사용자 설정으로 옮기는 것이 좋습니다.

function getYouTubeId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

async function callGemini(prompt) {
  // 모델명을 현재 사용 가능한 gemini-1.5-flash로 수정
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { 
        responseMimeType: "application/json", 
        responseSchema: { 
          type: "OBJECT", 
          properties: { 
            summary: { type: "STRING" }, 
            tags: { type: "ARRAY", items: { type: "STRING" } } 
          } 
        } 
      }
    })
  });
  const data = await response.json();
  return JSON.parse(data.candidates[0].content.parts[0].text);
}

document.addEventListener('DOMContentLoaded', async () => {
  const boardSelect = document.getElementById('board-select');
  const thumbImg = document.getElementById('thumb-img');
  const saveBtn = document.getElementById('save-btn');
  const status = document.getElementById('status');

  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const videoId = getYouTubeId(tab.url);

  chrome.storage.local.get({ boards: ['Inbox'] }, (res) => {
    boardSelect.innerHTML = res.boards.map(b => `<option value="${b}">${b}</option>`).join('');
  });

  if (videoId) {
    document.getElementById('video-preview').classList.remove('hidden');
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
        category: "Web", // 대시보드 표시를 위한 기본 카테고리 추가
        timestamp: new Date().toLocaleDateString()
      };

      // 저장 키를 'minds'에서 'dumps'로 통일하여 대시보드와 연동
      chrome.storage.local.get({ dumps: [] }, (res) => {
        chrome.storage.local.set({ dumps: [newItem, ...res.dumps] }, () => {
          status.textContent = "저장 완료!";
          setTimeout(() => window.close(), 1000);
        });
      });
    } catch (e) {
      saveBtn.disabled = false;
      status.textContent = "오류 발생. 다시 시도해 주세요.";
    }
  });
});
