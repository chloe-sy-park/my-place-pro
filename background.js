const SUPABASE_URL = "";
const SUPABASE_KEY = "";
const TRIAL_FUNCTION_URL = "";

const DAILY_TRIAL_LIMIT = 10;

// --- Built-in AI (Gemini Nano via Prompt API) ---
let builtInSession = null;

const BUILTIN_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    category: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    board: { type: "string" }
  },
  required: ["summary", "category", "tags", "board"]
};

async function getBuiltInStatus() {
  try {
    if (typeof LanguageModel === 'undefined') return 'unavailable';
    return await LanguageModel.availability();
  } catch { return 'unavailable'; }
}

async function createBuiltInSession() {
  return LanguageModel.create({
    initialPrompts: [{
      role: 'system',
      content: 'You analyze web content. Return JSON with: summary (1 concise English sentence), category (1 word), tags (exactly 3 relevant lowercase tags), board (from the given list, or "Inbox" if none fits).'
    }]
  });
}

async function askAIBuiltIn(prompt) {
  if (!builtInSession) {
    const status = await getBuiltInStatus();
    if (status !== 'available') throw new Error('Built-in AI ' + status);
    builtInSession = await createBuiltInSession();
  }

  // Recreate session if approaching token context window limit
  if (builtInSession.contextUsage > builtInSession.contextWindow * 0.8) {
    builtInSession.destroy();
    builtInSession = null;
    builtInSession = await createBuiltInSession();
  }

  const raw = await builtInSession.prompt(prompt, {
    responseConstraint: BUILTIN_SCHEMA
  });
  return JSON.parse(raw);
}

// Cache Built-in AI status on startup
getBuiltInStatus().then(s => chrome.storage.local.set({ builtInAIStatus: s }));

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
    return { summary: 'No AI available. Add a Gemini API key in Settings, or use Chrome 138+ for free on-device AI.', category: 'Uncategorized', tags: [], board: 'Inbox' };
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

// Direct Gemini call (user's own API key) — throws on failure for fallback chain
async function askAIDirect(prompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;
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
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini API ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const candidates = json.candidates;
  if (!candidates || !candidates.length) {
    const reason = json.promptFeedback?.blockReason || 'no candidates returned';
    throw new Error(`Gemini blocked: ${reason}`);
  }
  const text = candidates[0].content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned empty response');
  return JSON.parse(text);
}

async function askAI(prompt) {
  const { geminiApiKey, installID } = await chrome.storage.local.get({ geminiApiKey: '', installID: '' });
  let cloudError = null;

  // Tier 1: Built-in AI (Gemini Nano) — free, instant, private
  try {
    const r = await askAIBuiltIn(prompt);
    r._engine = 'built-in';
    return r;
  } catch (err) {
    console.warn('Built-in AI skipped:', err.message);
  }

  // Tier 2: Gemini Cloud — user's own API key
  if (geminiApiKey) {
    try {
      const r = await askAIDirect(prompt, geminiApiKey);
      r._engine = 'cloud';
      return r;
    } catch (err) {
      cloudError = err.message;
      console.warn('Cloud AI failed:', err.message);
    }
  }

  // Tier 3: Trial — Supabase Edge Function (10/day)
  const r = await askAITrial(prompt, installID);
  r._engine = 'trial';

  // If user has API key but cloud failed, override the generic message with specific error
  if (cloudError && r.summary.startsWith('No AI available')) {
    r.summary = `Cloud AI failed: ${cloudError}. Check your API key in Settings.`;
  }

  return r;
}

chrome.runtime.onMessage.addListener((msg, sender, sendRes) => {
  if (msg.action === 'getAIStatus') {
    getBuiltInStatus().then(builtIn => {
      chrome.storage.local.get({ geminiApiKey: '', trialDate: '', trialCount: 0 }, (store) => {
        const today = new Date().toISOString().split('T')[0];
        const trialUsed = store.trialDate === today ? store.trialCount : 0;
        sendRes({
          builtIn,
          hasApiKey: !!store.geminiApiKey,
          trialRemaining: Math.max(0, DAILY_TRIAL_LIMIT - trialUsed),
          trialConfigured: !!(TRIAL_FUNCTION_URL && SUPABASE_KEY)
        });
      });
    });
    return true;
  }

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
          board: finalBoard,
          engine: ai._engine || null
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

            const warning = (ai.category === 'Uncategorized' && ai.tags.length === 0) ? ai.summary : null;
            sendRes({ success: true, board: finalBoard, engine: ai._engine || null, warning });
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
