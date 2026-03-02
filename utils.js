function getYouTubeId(url) {
  const match = (url || '').match(/(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*)/);
  return (match && match[1].length === 11) ? match[1] : null;
}

function getYouTubeEmbedUrl(url) {
  const id = getYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

function getInstagramEmbedUrl(url) {
  const match = (url || '').match(/instagram\.com\/(p|reel|reels)\/([\w-]+)/);
  return match ? `https://www.instagram.com/${match[1]}/${match[2]}/embed/` : null;
}

// YouTube embed with thumbnail-first click-to-play (embeds iframe on click)
function createYouTubePlayer(ytId, containerEl) {
  const wrapper = document.createElement('div');
  wrapper.className = 'relative w-full aspect-video rounded-xl overflow-hidden bg-black cursor-pointer group';

  // Show thumbnail first (always loads, even for non-embeddable videos)
  const thumb = document.createElement('img');
  thumb.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
  thumb.className = 'w-full h-full object-cover';
  thumb.alt = 'YouTube video thumbnail';
  wrapper.appendChild(thumb);

  // Play button overlay
  const overlay = document.createElement('div');
  overlay.className = 'absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '56');
  svg.setAttribute('height', '56');
  svg.setAttribute('viewBox', '0 0 64 64');
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '32');
  circle.setAttribute('cy', '32');
  circle.setAttribute('r', '32');
  circle.setAttribute('fill', 'rgba(255,0,0,0.85)');
  svg.appendChild(circle);
  const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  poly.setAttribute('points', '26,20 26,44 46,32');
  poly.setAttribute('fill', 'white');
  svg.appendChild(poly);
  overlay.appendChild(svg);
  wrapper.appendChild(overlay);

  // Click replaces thumbnail with iframe embed for in-place playback
  wrapper.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${ytId}?autoplay=1`;
    iframe.className = 'absolute inset-0 w-full h-full';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
    wrapper.textContent = '';
    wrapper.appendChild(iframe);
    wrapper.classList.remove('cursor-pointer', 'group');
  });

  containerEl.appendChild(wrapper);

  // "Watch on YouTube" link always shown below
  const link = document.createElement('a');
  link.href = `https://www.youtube.com/watch?v=${ytId}`;
  link.target = '_blank';
  link.rel = 'noopener';
  link.className = 'flex items-center gap-1.5 mt-2 text-xs font-bold text-red-500 hover:text-red-700 transition';
  link.textContent = 'Watch on YouTube \u2192';
  // Use chrome.tabs.create in extension pages for reliable tab opening
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: `https://www.youtube.com/watch?v=${ytId}` });
    });
  }
  containerEl.appendChild(link);
}

// --- Shared content type helpers (used by sidepanel.js and dashboard.js) ---
function isVideoUrl(url) { return /\.(mp4|webm|ogg)$/i.test(url); }

function getContentType(item) {
  if (item.videoId || getYouTubeId(item.url)) return 'video';
  if (/instagram\.com/.test(item.url || '')) return 'instagram';
  if (/twitter\.com|x\.com/.test(item.url || '')) return 'xpost';
  if (item.mediaUrl && !isVideoUrl(item.mediaUrl)) return 'image';
  return 'article';
}

const TYPE_LABELS = { video: 'Video', instagram: 'Instagram', xpost: 'X Post', image: 'Image', article: 'Web Page' };
const TYPE_COLORS = {
  video: 'bg-red-50 text-red-600',
  instagram: 'bg-pink-50 text-pink-600',
  xpost: 'bg-slate-800 text-white',
  image: 'bg-emerald-50 text-emerald-600',
  article: 'bg-blue-50 text-blue-600'
};

function getSourceLabel(item) {
  return TYPE_LABELS[getContentType(item)] || 'Web Page';
}

// Image carousel component for multi-image posts (Instagram carousel, etc.)
function createImageCarousel(images, containerEl) {
  if (!images || images.length === 0) return;

  if (images.length === 1) {
    const img = document.createElement('img');
    img.src = images[0];
    img.className = 'w-full rounded-xl';
    containerEl.appendChild(img);
    return;
  }

  let currentIdx = 0;

  const wrapper = document.createElement('div');
  wrapper.className = 'relative w-full rounded-xl overflow-hidden bg-black/5';

  const img = document.createElement('img');
  img.src = images[0];
  img.className = 'w-full object-contain';
  img.style.maxHeight = '500px';
  wrapper.appendChild(img);

  // Navigation buttons
  const prevBtn = document.createElement('button');
  prevBtn.className = 'absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-slate-600 hover:bg-white transition text-sm font-bold';
  prevBtn.textContent = '\u2039';
  prevBtn.style.display = 'none';
  wrapper.appendChild(prevBtn);

  const nextBtn = document.createElement('button');
  nextBtn.className = 'absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-slate-600 hover:bg-white transition text-sm font-bold';
  nextBtn.textContent = '\u203a';
  wrapper.appendChild(nextBtn);

  // Counter badge
  const counter = document.createElement('div');
  counter.className = 'absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full';
  counter.textContent = `1 / ${images.length}`;
  wrapper.appendChild(counter);

  // Dot indicators
  const dots = document.createElement('div');
  dots.className = 'flex justify-center gap-1.5 mt-2';
  images.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = `w-1.5 h-1.5 rounded-full transition ${i === 0 ? 'bg-indigo-500' : 'bg-slate-300'}`;
    dots.appendChild(dot);
  });

  function update() {
    img.src = images[currentIdx];
    counter.textContent = `${currentIdx + 1} / ${images.length}`;
    prevBtn.style.display = currentIdx === 0 ? 'none' : 'flex';
    nextBtn.style.display = currentIdx === images.length - 1 ? 'none' : 'flex';
    [...dots.children].forEach((dot, i) => {
      dot.className = `w-1.5 h-1.5 rounded-full transition ${i === currentIdx ? 'bg-indigo-500' : 'bg-slate-300'}`;
    });
  }

  prevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentIdx > 0) { currentIdx--; update(); }
  });

  nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentIdx < images.length - 1) { currentIdx++; update(); }
  });

  containerEl.appendChild(wrapper);
  containerEl.appendChild(dots);
}
