const storageKey = 'vibe-log-entries';
const form = document.querySelector('#entry-form');
const input = document.querySelector('#entry-text');
const list = document.querySelector('#entries');
const emptyState = document.querySelector('#empty-state');
const status = document.querySelector('#status');
let entries = [
  {
    id: 'hello-world',
    text: 'Sunday, November 8th: Hello, World!',
    createdAt: new Date(2026, 10, 8).toISOString(),
  },
  {
    id: 'chiefs-game',
    text: 'I am watching the Chiefs game',
    createdAt: new Date(2026, 10, 8).toISOString(),
  },
];

// Storage can be unavailable, or contain data from a different version.
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || JSON.stringify(entries));
  if (!Array.isArray(saved) || !saved.every(entry =>
    entry && typeof entry.id === 'string' && typeof entry.text === 'string' &&
    typeof entry.createdAt === 'string' && !Number.isNaN(Date.parse(entry.createdAt))
  )) throw new Error('Invalid saved entries');
  entries = saved;
} catch {
  status.textContent = 'Saved entries could not be loaded. New entries will appear here.';
}

function saveEntries() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(entries));
    status.textContent = 'Entries saved in this browser.';
  } catch {
    status.textContent = 'Entries are visible for this visit, but could not be saved. Copy anything you want to keep.';
  }
}

function renderEntries() {
  list.replaceChildren();
  emptyState.hidden = entries.length > 0;

  entries.forEach(entry => {
    const item = document.createElement('li');
    const text = document.createElement('p');
    text.textContent = entry.text;

    const footer = document.createElement('div');
    footer.className = 'entry-footer';
    const date = document.createElement('time');
    date.dateTime = entry.createdAt;
    date.textContent = new Date(entry.createdAt).toLocaleString(undefined, {
      dateStyle: 'medium', timeStyle: 'short',
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-entry';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove entry: ${entry.text.slice(0, 60)}`);
    remove.addEventListener('click', () => {
      entries = entries.filter(saved => saved.id !== entry.id);
      saveEntries();
      renderEntries();
      input.focus();
    });

    footer.append(date, remove);
    item.append(text, footer);
    list.append(item);
  });
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) {
    status.textContent = 'Write something before adding an entry.';
    input.focus();
    return;
  }
  entries.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    text,
    createdAt: new Date().toISOString(),
  });
  saveEntries();
  renderEntries();
  form.reset();
  input.focus();
});

renderEntries();
