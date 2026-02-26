const apiKey = ""; // IMPORTANT: Add your Gemini API Key here

async function askAI(prompt) {
  if (!apiKey) {
    console.warn("Gemini API key is not set. Skipping AI analysis.");
    return { summary: 'AI analysis skipped.', category: 'Uncategorized', tags: [] };
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
              tags: { type: "ARRAY", items: { type: "STRING" } }
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
    return { summary: 'AI analysis failed.', category: 'Uncategorized', tags: [] };
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
