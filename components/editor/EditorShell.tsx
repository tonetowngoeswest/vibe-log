import type { ReactNode } from 'react';

export function EditorShell({ children, admin }: { children: ReactNode; admin: boolean }) {
  return <main className="editor-shell" id="main" tabIndex={-1}>
    <div className="editor-topbar"><a className="editor-brand" href="/editor/">The newsroom</a><a className="editor-text-link" href="/">View public site →</a></div>
    <nav className="editor-navigation" aria-label="Newsroom navigation"><a href="/editor/">Stories</a><a href="/editor/layout/">Homepage layout</a>{admin && <a href="/admin/users/">Account roles</a>}<a href="/account/">Your account</a></nav>
    {children}
  </main>;
}
