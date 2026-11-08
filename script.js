// The masthead scrolls away naturally; CSS keeps the navigation fixed at the top.
// This small enhancement returns focus to the stories when using in-page links.
document.querySelectorAll('a[href="#main"]').forEach(link => {
  link.addEventListener('click', () => {
    document.querySelector('#main').focus({ preventScroll: true });
  });
});
