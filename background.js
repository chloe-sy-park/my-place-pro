const apiKey = ""; // IMPORTANT: Add your Gemini API Key here

async function askAI(prompt) {
  if (!apiKey) {
    return { summary: 'API 키가 설정되지 않았습니다.', category: '기타', tags: [] };
  }
  // 모델명을 gemini-1.5-flash로 변경 (안정성 확보)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  try {
    const res = await fetch(url, {
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
              category: { type: "STRING" },
              tags: { type: "ARRAY", items: { type: "STRING" } }
            }
          }
        }
      })
    });
    const json = await res.json();
    return JSON.parse(json.candidates[0].content.parts[0].text);
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return { summary: '분석 실패', category: '미분류', tags: [] };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendRes) => {
  if (msg.action === 'save') {
    const p = `Analyze: ${msg.data.title}. Content: ${msg.data.text.slice(0, 500)}. 1-sentence Korean summary, 1 category, 3 tags.`;
    askAI(p).then(ai => {
      chrome.storage.local.get({ dumps: [] }, (r) => {
        const item = { ...msg.data, ...ai, id: Date.now(), threads: [], date: new Date().toLocaleDateString(), board: 'Inbox' };
        chrome.storage.local.set({ dumps: [item, ...r.dumps] }, () => sendRes({ success: true }));
      });
    });
    return true; 
  }
});
