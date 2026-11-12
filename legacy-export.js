document.getElementById('export').addEventListener('click', () => {
  const status = document.getElementById('status');
  try {
    const saved = localStorage.getItem('vibe-log-entries');
    if (!saved) { status.textContent = 'There are no saved notes in this browser on this site.'; return; }
    const entries = JSON.parse(saved);
    if (!Array.isArray(entries)) throw new Error('Invalid notes');
    const notes = entries.filter(entry => entry && typeof entry.text === 'string' && typeof entry.createdAt === 'string').map(entry => ({ text: entry.text, createdAt: entry.createdAt }));
    const url = URL.createObjectURL(new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), notes }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'chiefs-news-private-notes.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'Your private copy was downloaded. The original notes are still saved in this browser.';
  } catch { status.textContent = 'Saved notes could not be read. Nothing has been uploaded or removed.'; }
});
