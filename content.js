if (document.getElementById('jd-host')) throw new Error('JustDump already injected');

let target = null;

// --- Shadow DOM encapsulated button ---
const host = document.createElement('div');
host.id = 'jd-host';
host.style.cssText = 'position:absolute;z-index:2147483647;top:0;left:0;pointer-events:none;';
const shadow = host.attachShadow({ mode: 'closed' });

const style = document.createElement('style');
style.textContent = `
  button {
    position: relative; padding: 8px 16px;
    background: #6366f1; color: white; border: none; border-radius: 30px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px; font-weight: 800; cursor: pointer; pointer-events: auto;
    box-shadow: 0 10px 25px rgba(99, 102, 241, 0.4);
    display: none; align-items: center; gap: 8px;
    transition: background 0.15s, transform 0.15s;
  }
  button:hover { background: #4f46e5; transform: translateY(-2px); }
  button.saved { background: #10b981; }
  button.error { background: #ef4444; }
`;
shadow.appendChild(style);

const btn = document.createElement('button');
const btnLabel = document.createElement('span');
btnLabel.textContent = 'Save to JustDump';
btn.appendChild(btnLabel);
shadow.appendChild(btn);
document.body.appendChild(host);

// --- Image capture (converts DOM image to data URL to bypass CORS in extension pages) ---
function captureImageAsDataUrl(imgEl, maxWidth = 400) {
  try {
    if (!imgEl || !imgEl.naturalWidth || !imgEl.complete) return null;
    const scale = Math.min(1, maxWidth / imgEl.naturalWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(imgEl.naturalWidth * scale);
    canvas.height = Math.round(imgEl.naturalHeight * scale);
    canvas.getContext('2d').drawImage(imgEl, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.6);
  } catch (e) {
    return null; // canvas tainted or other error
  }
}

// --- Context extraction ---
function extractContext(el) {
  let url = window.location.href;
  let title = document.title;
  let text = '';

  // Open Graph meta tags (general fallback — platform-specific logic below overrides)
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const ogDesc = document.querySelector('meta[property="og:description"]');
  const ogImg = document.querySelector('meta[property="og:image"]');
  if (ogTitle && ogTitle.content && ogTitle.content.length > 2) title = ogTitle.content;
  if (ogDesc && ogDesc.content) text = ogDesc.content.slice(0, 500);
  const ogImage = (ogImg && ogImg.content) ? ogImg.content : null;

  // Fallback: meta description tag
  if (!text) {
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && metaDesc.content) text = metaDesc.content.slice(0, 500);
  }

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
    const titleEl = container.querySelector(
      '#video-title, #video-title-link, h3 a, h3, h2 a, h2'
    );
    if (titleEl) {
      const t = titleEl.textContent.trim();
      if (t.length > 2) title = t;
    }

    const metaEls = container.querySelectorAll(
      '#metadata-line span, #channel-name, .ytd-channel-name, ' +
      'span[dir="auto"], .caption, time, [datetime]'
    );
    const metaParts = [...metaEls]
      .map(metaEl => metaEl.textContent.trim())
      .filter(t => t.length > 2 && t.length < 200);
    if (metaParts.length) text = metaParts.join(' | ').slice(0, 500);
  } else if (link) {
    const alt = link.title || link.getAttribute('aria-label') || el.alt;
    if (alt && alt.length > 2) title = alt;
  }

  // YouTube watch/shorts page
  if (/youtube\.com\/(watch|shorts)/.test(url) || /youtube\.com\/(watch|shorts)/.test(window.location.href)) {
    const desc = document.querySelector('#description-text, ytd-text-inline-expander, #description');
    if (desc) {
      const descText = desc.innerText.trim().slice(0, 800);
      if (descText.length > 10) text = text ? text + '\n' + descText : descText;
    }
    const ch = document.querySelector('#channel-name a, ytd-channel-name a');
    if (ch) text = `Channel: ${ch.textContent.trim()}\n${text}`;
  }

  // Instagram: extract username + caption (handle both feed and modal views)
  if (/instagram\.com/.test(window.location.href)) {
    const article = el.closest('article') || document.querySelector('article[role="presentation"]') || document.querySelector('article') || document.querySelector('main[role="main"]');
    if (article) {
      const user = article.querySelector('header a');
      if (user) {
        const username = user.textContent.trim();
        if (username) {
          title = `@${username}`;
          text = `@${username}`;
        }
      }

      // Try multiple caption/text selectors (Instagram DOM varies by view)
      const caption = article.querySelector('h1')
        || article.querySelector('div > span[dir="auto"]');
      if (caption) {
        const capText = caption.textContent.trim();
        if (capText.length > 5) text += '\n' + capText.slice(0, 800);
      }

      // Also grab all visible text spans for richer context
      const spans = article.querySelectorAll('span[dir="auto"]');
      for (const span of spans) {
        const t = span.textContent.trim();
        if (t.length > 20 && !text.includes(t.slice(0, 50))) {
          text += '\n' + t.slice(0, 800);
          break;
        }
      }

      // Extract hashtags from the post
      const hashtags = article.querySelectorAll('a[href*="/explore/tags/"]');
      if (hashtags.length > 0) {
        const tags = [...hashtags].map(a => a.textContent.trim()).filter(Boolean);
        if (tags.length) text += '\nHashtags: ' + tags.join(' ');
      }
    }

    // Safety net: if title is still a generic page title, derive from URL or caption
    if (/^(Instagram|.*게시물.*Instagram|.*Photos.*Videos)/.test(title)) {
      const postMatch = url.match(/instagram\.com\/(p|reel|reels)\/([\w-]+)/);
      if (postMatch && text.length > 5) {
        // Use first line of extracted text as title
        const firstLine = text.split('\n').find(l => l.trim().length > 2);
        if (firstLine) title = firstLine.trim().slice(0, 100);
      }
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

  // Instagram: extract ALL post images from article container (carousel support)
  let firstImage = ogImage;
  let mediaImages = [];
  if (/instagram\.com/.test(window.location.href)) {
    const article = el.closest('article') || document.querySelector('article[role="presentation"]') || document.querySelector('article') || document.querySelector('main[role="main"]');
    if (article) {
      for (const img of article.querySelectorAll('img[src]')) {
        if (img.closest('header')) continue; // skip profile pictures
        if (img.naturalWidth > 100 && img.complete) {
          const dataUrl = captureImageAsDataUrl(img);
          if (dataUrl) mediaImages.push(dataUrl);
          else mediaImages.push(img.src);
        }
      }
      if (mediaImages.length > 0) firstImage = mediaImages[0];
    }
  }

  // Fallback: find the first large image on the page if no image yet
  if (!firstImage) {
    const imgs = document.querySelectorAll('img[src]');
    let maxArea = 0;
    for (const img of imgs) {
      const area = img.naturalWidth * img.naturalHeight;
      if (area > maxArea && img.naturalWidth > 200) {
        maxArea = area;
        firstImage = img.src;
      }
    }
  }

  const videoId = getYouTubeId(url);
  return { url, title, videoId, text, ogImage: firstImage, mediaImages };
}

// --- Target detection (media + article containers) ---
function findMediaTarget(el) {
  // 1. Direct IMG/VIDEO > 100px — save as media
  if ((el.tagName === 'IMG' || el.tagName === 'VIDEO') && el.offsetWidth > 100) {
    return { el, isMedia: true, isArticle: false };
  }

  // 2. Content container — check for media first, then article fallback
  const container = el.closest(
    'article, [role="article"], [data-testid="tweet"], [role="link"], ' +
    'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ' +
    'ytd-grid-video-renderer, ytd-reel-item-renderer, ' +
    '.post, .h-entry, .entry, .card'
  );
  if (container && container.offsetHeight > 80) {
    // Find largest image inside container
    let bestImg = null;
    let maxArea = 0;
    container.querySelectorAll('img[src]').forEach(i => {
      const area = i.offsetWidth * i.offsetHeight;
      if (area > maxArea) { maxArea = area; bestImg = i; }
    });
    if (bestImg && bestImg.offsetWidth > 100) {
      return { el: bestImg, isMedia: true, isArticle: false };
    }
    // No large image — save as article
    return { el: container, isMedia: false, isArticle: true };
  }

  return null;
}

// --- Mouseover handler ---
document.addEventListener('mouseover', (e) => {
  const result = findMediaTarget(e.target);

  if (result) {
    target = result.el;
    const rect = target.getBoundingClientRect();
    if (result.isArticle) {
      // For article containers, position near cursor to avoid being far from hover point
      host.style.top = `${e.pageY - 15}px`;
      host.style.left = `${e.pageX + 15}px`;
    } else {
      host.style.top = `${rect.top + window.scrollY + 10}px`;
      host.style.left = `${rect.left + window.scrollX + 10}px`;
    }
    btn.style.display = 'flex';
    btn.classList.remove('saved', 'error');
    btn.style.background = '';
    btnLabel.textContent = result.isArticle ? 'Save Article' : 'Save to JustDump';
  } else if (!btn.contains(e.target) && e.target !== host) {
    btn.style.display = 'none';
  }
});

// --- Save handler ---
btn.onclick = () => {
  const isArt = btnLabel.textContent.includes('Article');
  const ctx = extractContext(target);

  // For articles, extract text from the target container or cleaned body
  let text = ctx.text;
  if (isArt) {
    if (target.innerText) {
      const containerText = target.innerText.trim();
      if (containerText.length > 50) text = containerText.slice(0, 2000);
    }
    if (!text || text.length < 50) {
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('nav, footer, aside, header, script, style, noscript, [role="navigation"]').forEach(n => n.remove());
      text = clone.innerText.trim().slice(0, 2000);
    }
  }

  // Determine mediaUrl — for Instagram, capture as data URL to avoid CORS
  let mediaUrl;
  if (ctx.videoId) {
    mediaUrl = `https://img.youtube.com/vi/${ctx.videoId}/mqdefault.jpg`;
  } else if (isArt) {
    mediaUrl = ctx.ogImage || null;
  } else if (/instagram\.com/.test(window.location.href) && target.tagName === 'IMG') {
    mediaUrl = captureImageAsDataUrl(target) || ctx.ogImage || null;
  } else {
    mediaUrl = target.src || target.currentSrc || ctx.ogImage || null;
  }

  const data = {
    title: ctx.title,
    url: ctx.url,
    type: isArt ? 'article' : 'media',
    mediaUrl,
    mediaUrls: ctx.mediaImages && ctx.mediaImages.length > 1 ? ctx.mediaImages : undefined,
    videoId: ctx.videoId || null,
    text: text
  };
  btnLabel.textContent = 'Saving...';
  chrome.runtime.sendMessage({ action: 'save', data }, (response) => {
    if (chrome.runtime.lastError || !response || !response.success) {
      btnLabel.textContent = 'Error!';
      btn.classList.add('error');
    } else {
      btnLabel.textContent = 'Saved!';
      btn.classList.add('saved');
    }
    setTimeout(() => { btn.style.display = 'none'; btn.classList.remove('saved', 'error'); }, 1500);
  });
};

// --- MutationObserver for SPA navigation ---
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    // Re-ensure host is in the DOM (some SPAs rebuild body)
    if (!document.body.contains(host)) {
      document.body.appendChild(host);
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });
