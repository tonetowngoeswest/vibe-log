'use client';

import { useEffect, useRef } from 'react';

const discardMessage = 'You have unsaved changes. Leave this page and discard them?';

export function useUnsavedChanges(dirty: boolean) {
  const approvedNavigation = useRef(false);

  useEffect(() => {
    approvedNavigation.current = false;
    if (!dirty) return;

    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (approvedNavigation.current) { approvedNavigation.current = false; return; }
      event.preventDefault();
      event.returnValue = '';
    };

    const followLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
      const destination = new URL(anchor.href, window.location.href);
      if (!['http:', 'https:'].includes(destination.protocol)) return;
      if (destination.origin === window.location.origin && destination.pathname === window.location.pathname && destination.search === window.location.search) return;

      // Next client navigation does not trigger beforeunload. Handle both kinds
      // of links here and navigate once after the editor has confirmed.
      event.preventDefault();
      event.stopPropagation();
      if (!window.confirm(discardMessage)) return;
      approvedNavigation.current = true;
      try { window.location.assign(destination.href); }
      catch { approvedNavigation.current = false; }
    };

    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', followLink, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', followLink, true);
    };
  }, [dirty]);

  return function reloadAfterConfirm() {
    if (dirty && !window.confirm('Reload the latest version and discard the unsaved changes in this page?')) return;
    approvedNavigation.current = true;
    window.location.reload();
  };
}
