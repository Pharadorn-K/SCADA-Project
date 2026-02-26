// frontend/public/js/utils.js
function formatDuration(totalSeconds, statusStartedAt = null) {

  let seconds = totalSeconds;
  let msPart = 0;

  // If machine is currently active, add smooth ms
  if (statusStartedAt) {
    const now = Date.now();
    const diffMs = now - statusStartedAt;

    msPart = Math.floor((diffMs % 1000) / 10); // 0–99
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const pad = (n, size = 2) => String(n).padStart(size, '0');

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}.${pad(msPart)}`;
}

export { formatDuration };