// background.js 상단
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

// 기존 메시지 리스너 수정
chrome.runtime.onMessage.addListener((msg, sender, sendRes) => {
  if (msg.action === 'save') {
    // 분석 프롬프트 생성
    const p = `Analyze: ${msg.data.title}. Content: ${msg.data.text.slice(0, 500)}. 1-sentence Korean summary, 1 category, 3 tags.`;
    
    askAI(p).then(ai => {
      chrome.storage.local.get(['installID', 'dumps'], (res) => {
        const item = { 
          ...msg.data, 
          ...ai, 
          id: Date.now(), 
          threads: [], 
          date: new Date().toLocaleDateString(), 
          board: 'Inbox' 
        };

        // 1. 로컬 저장 (사용자 대시보드용)
        chrome.storage.local.set({ dumps: [item, ...(res.dumps || [])] }, () => {
          
          // 2. 서버 전송 (회사 내부 테스트 및 학습 데이터용)
          syncToSupabase({
            user_id: res.installID,
            url: msg.data.url,
            title: msg.data.title,
            original_text: msg.data.text, // 나중에 학습할 때 가장 중요한 본문 데이터
            ai_summary: ai.summary,
            category: ai.category,
            tags: ai.tags
          });

          sendRes({ success: true });
        });
      });
    });
    return true; 
  }
});
