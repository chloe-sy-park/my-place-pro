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

// YouTube embed with thumbnail fallback (for videos that block embedding)
function createYouTubePlayer(ytId, containerEl) {
  const wrapper = document.createElement('div');
  wrapper.className = 'relative w-full aspect-video rounded-xl overflow-hidden bg-black';

  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube.com/embed/${ytId}`;
  iframe.className = 'w-full h-full';
  iframe.setAttribute('frameborder', '0');
  iframe.setAttribute('allowfullscreen', '');
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  wrapper.appendChild(iframe);
  containerEl.appendChild(wrapper);

  // Fallback link always shown below (works even if embed fails)
  const link = document.createElement('a');
  link.href = `https://www.youtube.com/watch?v=${ytId}`;
  link.target = '_blank';
  link.rel = 'noopener';
  link.className = 'flex items-center gap-1.5 mt-2 text-xs font-bold text-red-500 hover:text-red-700 transition';
  link.textContent = 'Watch on YouTube \u2192';
  containerEl.appendChild(link);
}
