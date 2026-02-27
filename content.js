if (document.getElementById('mm-pin-btn')) throw new Error('JustDump already injected');

let target = null;
const btn = document.createElement('button');
btn.id = 'mm-pin-btn';
const btnLabel = document.createElement('span');
btnLabel.textContent = 'Save to JustDump';
btn.appendChild(btnLabel);
document.body.appendChild(btn);

function getYouTubeId(url) {
  const m = url.match(/(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*)/);
  return (m && m[1].length === 11) ? m[1] : null;
}

function extractContext(el) {
  let url = window.location.href;
  let title = document.title;
  let text = '';

  // Find closest link to get the real destination URL
  const link = el.closest('a[href]');
  if (link && link.href) {
    try { url = new URL(link.href, window.location.origin).href; } catch (_) {}
  }

  // Find title and text from surrounding container
  const container = el.closest(
    'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ' +
    'ytd-grid-video-renderer, ytd-reel-item-renderer, ytd-playlist-video-renderer, ' +
    'article, .card, [data-testid]'
  );

  if (container) {
    // Title
    const titleEl = container.querySelector(
      '#video-title, #video-title-link, h3 a, h3, h2 a, h2, [aria-label]'
    );
    if (titleEl) {
      const t = (titleEl.textContent || titleEl.getAttribute('aria-label') || '').trim();
      if (t.length > 2) title = t;
    }

    // Extra metadata from container (channel name, view count, caption, etc.)
    const metaEls = container.querySelectorAll(
      '#metadata-line span, #channel-name, .ytd-channel-name, ' +
      'span[dir="auto"], .caption, time, [datetime]'
    );
    const metaParts = [...metaEls]
      .map(el => el.textContent.trim())
      .filter(t => t.length > 2 && t.length < 200);
    if (metaParts.length) text = metaParts.join(' | ').slice(0, 500);
  } else if (link) {
    const alt = link.title || link.getAttribute('aria-label') || el.alt;
    if (alt && alt.length > 2) title = alt;
  }

  // If on a YouTube watch page, grab description
  if (/youtube\.com\/(watch|shorts)/.test(url) || /youtube\.com\/(watch|shorts)/.test(window.location.href)) {
    const desc = document.querySelector('#description-text, ytd-text-inline-expander, #description');
    if (desc) {
      const descText = desc.innerText.trim().slice(0, 800);
      if (descText.length > 10) text = text ? text + '\n' + descText : descText;
    }
    const ch = document.querySelector('#channel-name a, ytd-channel-name a');
    if (ch) text = `Channel: ${ch.textContent.trim()}\n${text}`;
  }

  // Instagram: extract caption
  if (/instagram\.com/.test(window.location.href)) {
    const article = el.closest('article') || document.querySelector('article');
    if (article) {
      const user = article.querySelector('header a');
      const caption = article.querySelector('h1') || article.querySelector('div > span[dir="auto"]');
      const parts = [];
      if (user) parts.push(`@${user.textContent.trim()}`);
      if (caption) parts.push(caption.textContent.trim().slice(0, 800));
      if (parts.length) text = parts.join('\n');
    }
  }

  // Twitter/X: extract tweet text
  if (/twitter\.com|x\.com/.test(window.location.href)) {
    const tweet = el.closest('article')?.querySelector('[data-testid="tweetText"]')
      || document.querySelector('[data-testid="tweetText"]');
    if (tweet) text = tweet.textContent.trim().slice(0, 1000);
  }

  const videoId = getYouTubeId(url);
  return { url, title, videoId, text };
}

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
  const ctx = extractContext(target);
  const data = {
    title: ctx.title,
    url: ctx.url,
    type: isArt ? 'article' : 'media',
    mediaUrl: ctx.videoId
      ? `https://img.youtube.com/vi/${ctx.videoId}/mqdefault.jpg`
      : (target.src || target.currentSrc || null),
    videoId: ctx.videoId || null,
    text: isArt ? document.body.innerText.slice(0, 1500) : ctx.text
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
