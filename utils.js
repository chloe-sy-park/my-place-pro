function getYouTubeId(url) {
  const match = (url || '').match(/(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*)/);
  return (match && match[1].length === 11) ? match[1] : null;
}
