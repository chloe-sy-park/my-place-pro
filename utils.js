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

// YouTube embed with thumbnail-first click-to-play (handles videos that block embedding)
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

  // Click to load embed (handles Error 153 gracefully — thumbnail is always visible first)
  wrapper.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${ytId}?autoplay=1`;
    iframe.className = 'absolute inset-0 w-full h-full';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allowfullscreen', '');
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    wrapper.textContent = '';
    wrapper.classList.remove('cursor-pointer', 'group');
    wrapper.appendChild(iframe);
  });

  containerEl.appendChild(wrapper);

  // "Watch on YouTube" link always shown below
  const link = document.createElement('a');
  link.href = `https://www.youtube.com/watch?v=${ytId}`;
  link.target = '_blank';
  link.rel = 'noopener';
  link.className = 'flex items-center gap-1.5 mt-2 text-xs font-bold text-red-500 hover:text-red-700 transition';
  link.textContent = 'Watch on YouTube \u2192';
  containerEl.appendChild(link);
}
