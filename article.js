const copyArticleLink = document.querySelector('#copy-article-link');
const articleStatus = document.querySelector('#article-status');

// Only offer the copy action when the browser supports it.
if (navigator.clipboard?.writeText) {
  copyArticleLink.hidden = false;
  copyArticleLink.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      articleStatus.textContent = 'Article link copied.';
    } catch {
      articleStatus.textContent = 'Could not copy the link. You can copy the address from your browser.';
    }
  });
}
