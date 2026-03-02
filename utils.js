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
