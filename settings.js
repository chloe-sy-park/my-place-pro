document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('api-key');
  const toggleBtn = document.getElementById('toggle-key');
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

  function updateTrialDisplay(apiKey, trialDate, trialCount) {
    if (apiKey) {
      trialLabel.textContent = 'Unlimited AI';
      trialCounter.textContent = '';
      trialDesc.textContent = 'Your API key is active. AI analysis is unlimited.';
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

  // Save settings
  saveBtn.addEventListener('click', () => {
    chrome.storage.local.set({
      geminiApiKey: apiKeyInput.value.trim(),
      supabaseOptIn: optinCheckbox.checked
    }, () => {
      status.textContent = 'Settings saved!';
      status.classList.remove('hidden');
      setTimeout(() => status.classList.add('hidden'), 2000);
      chrome.storage.local.get({ trialDate: '', trialCount: 0 }, (res) => {
        updateTrialDisplay(apiKeyInput.value.trim(), res.trialDate, res.trialCount);
      });
    });
  });

  // Back to dashboard
  document.getElementById('go-dashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });
});
