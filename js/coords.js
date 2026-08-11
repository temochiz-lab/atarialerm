export function syncCanvasToVideo(video, canvas) {
  const width = video.videoWidth || canvas.clientWidth || 640;
  const height = video.videoHeight || canvas.clientHeight || 360;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

export function eventToVideoPoint(event, video) {
  const rect = video.getBoundingClientRect();
  const videoRatio = video.videoWidth / video.videoHeight;
  const rectRatio = rect.width / rect.height;
  let drawWidth = rect.width;
  let drawHeight = rect.height;
  let offsetX = 0;
  let offsetY = 0;

  if (rectRatio > videoRatio) {
    drawWidth = rect.height * videoRatio;
    offsetX = (rect.width - drawWidth) / 2;
  } else {
    drawHeight = rect.width / videoRatio;
    offsetY = (rect.height - drawHeight) / 2;
  }

  const x = ((event.clientX - rect.left - offsetX) / drawWidth) * video.videoWidth;
  const y = ((event.clientY - rect.top - offsetY) / drawHeight) * video.videoHeight;

  if (x < 0 || y < 0 || x > video.videoWidth || y > video.videoHeight) {
    return null;
  }

  return { x, y };
}
