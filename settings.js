document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('api-key');
  const toggleBtn = document.getElementById('toggle-key');
  const testBtn = document.getElementById('test-key');
  const testResult = document.getElementById('test-result');
  const optinCheckbox = document.getElementById('supabase-optin');
  const saveBtn = document.getElementById('save-btn');
  const status = document.getElementById('status');

  const trialStatus = document.getElementById('trial-status');
  const trialLabel = document.getElementById('trial-label');
  const trialCounter = document.getElementById('trial-counter');
  const trialDesc = document.getElementById('trial-desc');

  // Load saved settings and trial status
  chrome.storage.local.get({ geminiApiKey: '', supabaseOptIn: false, trialDate: '', trialCount: 0 }, (res) => {
    apiKeyInput.value = res.geminiApiKey;
    optinCheckbox.checked = res.supabaseOptIn;
    updateTrialDisplay(res.geminiApiKey, res.trialDate, res.trialCount);
  });

  // Check Built-in AI availability
  chrome.runtime.sendMessage({ action: 'getAIStatus' }, (s) => {
    if (chrome.runtime.lastError || !s) return;
    const container = document.getElementById('builtin-status');
    const label = document.getElementById('builtin-label');
    const badge = document.getElementById('builtin-badge');
    const desc = document.getElementById('builtin-desc');

    if (s.builtIn === 'available') {
      container.className = 'bg-emerald-50/80 backdrop-blur border border-emerald-100 rounded-xl p-4 space-y-1';
      label.className = 'text-sm font-bold text-emerald-600';
      badge.textContent = 'Active';
      badge.className = 'text-xs font-bold text-emerald-500';
      desc.textContent = 'Gemini Nano is available. AI analysis runs locally — free, instant, and private.';
    } else if (s.builtIn === 'downloading') {
      container.className = 'bg-blue-50/80 backdrop-blur border border-blue-100 rounded-xl p-4 space-y-1';
      label.className = 'text-sm font-bold text-blue-600';
      badge.textContent = 'Downloading...';
      badge.className = 'text-xs font-bold text-blue-500';
      desc.textContent = 'Gemini Nano is downloading. Cloud AI or Trial will be used in the meantime.';
    } else if (s.builtIn === 'after-download') {
      container.className = 'bg-amber-50/80 backdrop-blur border border-amber-100 rounded-xl p-4 space-y-1';
      label.className = 'text-sm font-bold text-amber-600';
      badge.textContent = 'Ready to download';
      badge.className = 'text-xs font-bold text-amber-500';
      desc.textContent = 'Your device supports Gemini Nano. The model will download automatically on first use (~1.7 GB).';
    } else {
      container.className = 'bg-slate-50/80 backdrop-blur border border-slate-200 rounded-xl p-4 space-y-1';
      label.className = 'text-sm font-bold text-slate-400';
      badge.textContent = 'Not available';
      badge.className = 'text-xs font-bold text-slate-400';
      desc.textContent = 'On-device AI requires Chrome 138+ with 22GB+ storage and adequate GPU/RAM. Cloud AI or Trial will be used.';
    }
  });

  function updateTrialDisplay(apiKey, trialDate, trialCount) {
    if (apiKey) {
      trialLabel.textContent = 'Unlimited Cloud AI';
      trialCounter.textContent = '';
      trialDesc.textContent = 'Your API key is active. On-device AI (if available) is tried first, then Cloud AI as fallback.';
      trialStatus.className = 'bg-emerald-50/80 backdrop-blur border border-emerald-100 rounded-xl p-4 space-y-1';
      trialLabel.className = 'text-sm font-bold text-emerald-600';
    } else {
      const today = new Date().toISOString().split('T')[0];
      const used = trialDate === today ? trialCount : 0;
      trialCounter.textContent = `${used}/10 used today`;
      trialLabel.textContent = 'Free Trial';
      trialDesc.textContent = 'AI analysis is available for free, up to 10 saves per day. Add your own API key for unlimited use.';
      trialStatus.className = 'bg-indigo-50/80 backdrop-blur border border-indigo-100 rounded-xl p-4 space-y-1';
      trialLabel.className = 'text-sm font-bold text-indigo-600';
    }
  }

  // Toggle API key visibility
  toggleBtn.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    toggleBtn.textContent = isPassword ? 'Hide' : 'Show';
  });

  // Test API key
  testBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      testResult.textContent = 'Enter an API key first.';
      testResult.className = 'text-xs font-bold text-red-500 mt-1';
      return;
    }

    testResult.textContent = 'Testing...';
    testResult.className = 'text-xs font-bold text-slate-400 mt-1';

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Say "OK" in one word.' }] }]
          })
        }
      );
      if (res.ok) {
        testResult.textContent = 'API key is valid! Click Save to apply.';
        testResult.className = 'text-xs font-bold text-emerald-500 mt-1';
      } else {
        const body = await res.json().catch(() => ({}));
        testResult.textContent = `Invalid: ${body.error?.message || `HTTP ${res.status}`}`;
        testResult.className = 'text-xs font-bold text-red-500 mt-1';
      }
    } catch (err) {
      testResult.textContent = `Network error: ${err.message}`;
      testResult.className = 'text-xs font-bold text-red-500 mt-1';
    }
  });

  // Save settings
  saveBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    chrome.storage.local.set({
      geminiApiKey: key,
      supabaseOptIn: optinCheckbox.checked
    }, () => {
      // Verify the save worked
      chrome.storage.local.get(['geminiApiKey'], (check) => {
        if (check.geminiApiKey === key) {
          status.textContent = key ? 'Settings saved! API key stored.' : 'Settings saved!';
          status.className = 'text-center text-xs text-emerald-500 font-bold';
        } else {
          status.textContent = 'Warning: API key may not have saved correctly.';
          status.className = 'text-center text-xs text-red-500 font-bold';
        }
        status.classList.remove('hidden');
        setTimeout(() => status.classList.add('hidden'), 3000);
      });
      chrome.storage.local.get({ trialDate: '', trialCount: 0 }, (res) => {
        updateTrialDisplay(key, res.trialDate, res.trialCount);
      });
    });
  });

  // Back to dashboard
  document.getElementById('go-dashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });
});
