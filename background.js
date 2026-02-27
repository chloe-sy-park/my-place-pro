const apiKey = ""; // 빌드 시 주입됨
const SUPABASE_URL = ""; // 빌드 시 주입됨
const SUPABASE_KEY = ""; // 빌드 시 주입됨

// 익명 ID 생성 로직 (설치 시 1회 실행)
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['installID'], (res) => {
    if (!res.installID) {
      const uuid = `user_${Math.random().toString(36).substring(2, 11)}`;
      chrome.storage.local.set({ installID: uuid });
    }
  });
});

// Supabase 데이터 동기화 함수
async function syncToSupabase(payload) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/learning_data`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error("Supabase Sync Error:", e);
  }
}

async function askAI(prompt) {
  if (!apiKey) {
    console.warn("Gemini API key is not set. Skipping AI analysis.");
    return { summary: 'AI 분석을 건너뛰었습니다.', category: 'Uncategorized', tags: [], board: 'Inbox' };
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${apiKey}`;
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
              tags: { type: "ARRAY", items: { type: "STRING" } },
              board: { type: "STRING" }
            }
          }
        }
      })
    });
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const json = await res.json();
    return JSON.parse(json.candidates[0].content.parts[0].text);
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return { summary: 'AI 분석에 실패했습니다.', category: 'Uncategorized', tags: [], board: 'Inbox' };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendRes) => {
  if (msg.action === 'save') {
    chrome.storage.local.get({ dumps: [], boards: ['Inbox'], installID: null }, (store) => {
      const boardList = store.boards.join(', ');
      const content = msg.data.text ? msg.data.text.slice(0, 500) : msg.data.title;
      const p = `Analyze: ${msg.data.title}. Content: ${content}. Provide: 1-sentence Korean summary, 1 category, 3 tags, and recommend ONE board from this list: [${boardList}]. If no board fits well, recommend "Inbox".`;

      askAI(p).then(ai => {
        // User-selected board (from popup) takes priority over AI recommendation
        const userBoard = msg.data.requestedBoard;
        const aiBoard = store.boards.includes(ai.board) ? ai.board : 'Inbox';
        const finalBoard = userBoard && store.boards.includes(userBoard) ? userBoard : aiBoard;

        const item = {
          ...msg.data,
          summary: ai.summary,
          category: ai.category,
          tags: ai.tags,
          id: crypto.randomUUID(),
          threads: [],
          date: new Date().toLocaleDateString(),
          board: finalBoard
        };

        // 1. 로컬 저장
        chrome.storage.local.set({ dumps: [item, ...store.dumps] }, () => {
          if (chrome.runtime.lastError) {
            sendRes({ success: false });
          } else {
            // 2. Supabase 동기화
            syncToSupabase({
              user_id: store.installID,
              url: msg.data.url,
              title: msg.data.title,
              original_text: msg.data.text,
              ai_summary: ai.summary,
              category: ai.category,
              tags: ai.tags
            });

            sendRes({ success: true, board: finalBoard });
          }
        });
      }).catch(() => {
        sendRes({ success: false });
      });
    });
    return true;
  }
});
