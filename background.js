const SUPABASE_URL = "";
const SUPABASE_KEY = "";
const TRIAL_FUNCTION_URL = "";

const DAILY_TRIAL_LIMIT = 10;

// Open side panel when extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// First-run: generate installID and open settings on fresh install
chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.local.get(['installID'], (res) => {
    if (!res.installID) {
      const uuid = `user_${Math.random().toString(36).substring(2, 11)}`;
      chrome.storage.local.set({ installID: uuid });
    }
  });
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
  }
});

// Supabase sync (only when user has opted in)
async function syncToSupabase(payload) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;

  const { supabaseOptIn } = await chrome.storage.local.get({ supabaseOptIn: false });
  if (!supabaseOptIn) return;

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
  } catch (err) {
    console.warn('Supabase sync failed:', err);
  }
}

// Trial: call Edge Function proxy (no API key exposed)
async function askAITrial(prompt, installID) {
  if (!TRIAL_FUNCTION_URL || !SUPABASE_KEY) {
    return { summary: 'AI analysis was skipped.', category: 'Uncategorized', tags: [], board: 'Inbox' };
  }

  try {
    const res = await fetch(TRIAL_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ prompt, installID })
    });

    const json = await res.json();

    if (json.error === "limit_reached") {
      return {
        summary: 'Free trial limit reached. Add your API key in Settings for unlimited use.',
        category: 'Uncategorized', tags: [], board: 'Inbox'
      };
    }
    if (json.error) {
      return { summary: 'AI analysis failed.', category: 'Uncategorized', tags: [], board: 'Inbox' };
    }

    // Update client-side trial counter
    const today = new Date().toISOString().split('T')[0];
    const store = await chrome.storage.local.get({ trialDate: '', trialCount: 0 });
    const count = store.trialDate === today ? store.trialCount + 1 : 1;
    await chrome.storage.local.set({ trialDate: today, trialCount: count });

    return json;
  } catch (err) {
    console.warn('AI trial call failed:', err);
    return { summary: 'AI analysis failed.', category: 'Uncategorized', tags: [], board: 'Inbox' };
  }
}

// Direct Gemini call (user's own API key)
async function askAIDirect(prompt, apiKey) {
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
  } catch (err) {
    console.warn('AI direct call failed:', err);
    return { summary: 'AI analysis failed.', category: 'Uncategorized', tags: [], board: 'Inbox' };
  }
}

async function askAI(prompt) {
  const { geminiApiKey, installID } = await chrome.storage.local.get({ geminiApiKey: '', installID: '' });

  if (geminiApiKey) {
    return askAIDirect(prompt, geminiApiKey);
  }
  return askAITrial(prompt, installID);
}

chrome.runtime.onMessage.addListener((msg, sender, sendRes) => {
  if (msg.action === 'save') {
    chrome.storage.local.get({ dumps: [], boards: ['Inbox'], installID: null }, (store) => {
      const boardList = store.boards.join(', ');
      const content = msg.data.text ? msg.data.text.slice(0, 500) : msg.data.title;
      const p = `Analyze: ${msg.data.title}. Content: ${content}. Provide: 1-sentence English summary, 1 category, 3 tags, and recommend ONE board from this list: [${boardList}]. If no board fits well, recommend "Inbox".`;

      askAI(p).then(ai => {
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
          date: new Date().toISOString().split('T')[0],
          board: finalBoard
        };

        chrome.storage.local.set({ dumps: [item, ...store.dumps] }, () => {
          if (chrome.runtime.lastError) {
            sendRes({ success: false });
          } else {
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
      }).catch((err) => {
        console.warn('Save failed:', err);
        sendRes({ success: false });
      });
    });
    return true;
  }
});
