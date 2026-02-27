document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('api-key');
  const toggleBtn = document.getElementById('toggle-key');
  const optinCheckbox = document.getElementById('supabase-optin');
  const saveBtn = document.getElementById('save-btn');
  const status = document.getElementById('status');

  // Load saved settings
  chrome.storage.local.get({ geminiApiKey: '', supabaseOptIn: false }, (res) => {
    apiKeyInput.value = res.geminiApiKey;
    optinCheckbox.checked = res.supabaseOptIn;
  });

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
    });
  });

  // Back to dashboard
  document.getElementById('go-dashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });
});
