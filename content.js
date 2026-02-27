if (document.getElementById('mm-pin-btn')) throw new Error('JustDump already injected');

let target = null;
const btn = document.createElement('button');
btn.id = 'mm-pin-btn';
const btnLabel = document.createElement('span');
btnLabel.textContent = 'Save to JustDump';
btn.appendChild(btnLabel);
document.body.appendChild(btn);

document.addEventListener('mouseover', (e) => {
  const isMedia = (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') && e.target.offsetWidth > 100;
  const isArticle = (e.target.tagName === 'P' || e.target.tagName === 'H1') && e.altKey;

  if (isMedia || isArticle) {
    target = e.target;
    const rect = target.getBoundingClientRect();
    btn.style.top = `${rect.top + window.scrollY + 10}px`;
    btn.style.left = `${rect.left + window.scrollX + 10}px`;
    btn.style.display = 'flex';
    btn.classList.remove('saved');
    btn.style.background = '';
    btnLabel.textContent = isArticle ? 'Save Article' : 'Save to JustDump';
  }
});

btn.onclick = () => {
  const isArt = btnLabel.textContent.includes('Article');
  const data = {
    title: document.title, url: window.location.href,
    type: isArt ? 'article' : 'media',
    mediaUrl: target.src || target.currentSrc || null,
    text: isArt ? document.body.innerText.slice(0, 1500) : ""
  };
  btnLabel.textContent = 'Saving...';
  chrome.runtime.sendMessage({ action: 'save', data }, (response) => {
    if (chrome.runtime.lastError || !response || !response.success) {
      btnLabel.textContent = 'Error!';
      btn.style.background = '#ef4444';
    } else {
      btnLabel.textContent = 'Saved!';
      btn.classList.add('saved');
    }
    setTimeout(() => { btn.style.display = 'none'; btn.style.background = ''; }, 1500);
  });
};
