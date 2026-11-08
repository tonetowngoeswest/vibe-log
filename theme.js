const themeToggle = document.querySelector('#theme-toggle');
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
let preferredTheme = null;

try {
  const savedTheme = localStorage.getItem('vibe-log-theme');
  if (savedTheme === 'dark' || savedTheme === 'light') preferredTheme = savedTheme;
} catch {
  // The toggle still works when browser storage is unavailable.
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
}

applyTheme(preferredTheme || (systemTheme.matches ? 'dark' : 'light'));
themeToggle.hidden = false;

themeToggle.addEventListener('click', () => {
  preferredTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(preferredTheme);
  try {
    localStorage.setItem('vibe-log-theme', preferredTheme);
  } catch {
    // Keep the selected theme for this visit.
  }
});

systemTheme.addEventListener('change', event => {
  if (!preferredTheme) applyTheme(event.matches ? 'dark' : 'light');
});
