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
    'article, .card'
  );

  if (container) {
    // Title from YouTube elements
    const titleEl = container.querySelector(
      '#video-title, #video-title-link, h3 a, h3, h2 a, h2'
    );
    if (titleEl) {
      const t = titleEl.textContent.trim();
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

  // Instagram: extract username + caption
  if (/instagram\.com/.test(window.location.href)) {
    const article = el.closest('article') || document.querySelector('article');
    if (article) {
      const user = article.querySelector('header a');
      if (user) {
        const username = user.textContent.trim();
        title = `@${username}`;
        text = `@${username}`;
      }
      const spans = article.querySelectorAll('span[dir="auto"]');
      for (const span of spans) {
        const t = span.textContent.trim();
        if (t.length > 20) { text += '\n' + t.slice(0, 800); break; }
      }
      const caption = article.querySelector('h1');
      if (caption) text += '\n' + caption.textContent.trim().slice(0, 800);
    }
  }

  // Twitter/X: extract username + tweet text
  if (/twitter\.com|x\.com/.test(window.location.href)) {
    const article = el.closest('article') || el.closest('[data-testid="tweet"]');
    if (article) {
      const userLink = article.querySelector('a[role="link"][href*="/"]');
      if (userLink) {
        const handle = userLink.getAttribute('href');
        if (handle && handle.startsWith('/')) title = `${handle.slice(1)} on X`;
      }
      const tweet = article.querySelector('[data-testid="tweetText"]');
      if (tweet) {
        const tweetText = tweet.textContent.trim().slice(0, 1000);
        text = tweetText;
        if (!title.includes(' on X')) title = tweetText.slice(0, 80);
      }
    }
  }

  const videoId = getYouTubeId(url);
  return { url, title, videoId, text };
}

document.addEventListener('mouseover', (e) => {
  let el = e.target;
  let isMedia = (el.tagName === 'IMG' || el.tagName === 'VIDEO') && el.offsetWidth > 100;
  const isArticle = (el.tagName === 'P' || el.tagName === 'H1') && e.altKey;

  // Instagram/Twitter/etc: images are behind overlay divs — find the largest image in the container
  if (!isMedia && !isArticle) {
    const container = el.closest('article, [role="link"]');
    if (container) {
      let bestImg = null;
      let maxArea = 0;
      container.querySelectorAll('img[src]').forEach(i => {
        const area = i.offsetWidth * i.offsetHeight;
        if (area > maxArea) { maxArea = area; bestImg = i; }
      });
      if (bestImg && bestImg.offsetWidth > 100) {
        el = bestImg;
        isMedia = true;
      }
    }
  }

  if (isMedia || isArticle) {
    target = el;
    const rect = el.getBoundingClientRect();
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
