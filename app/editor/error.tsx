'use client';

export default function EditorialError({ reset }: { reset: () => void }) {
  return <main className="editor-shell" id="main"><h1>The newsroom could not load</h1><p className="editor-description">The connection may have been interrupted. Try again; unsaved changes in another open tab will remain there.</p><button className="editor-button" onClick={reset}>Try again</button><p className="editor-help"><a className="editor-text-link" href="/account/">Your account</a> · <a className="editor-text-link" href="/">Public site</a></p></main>;
}
