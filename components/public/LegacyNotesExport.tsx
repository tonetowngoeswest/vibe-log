"use client";

import { useEffect, useState } from "react";
import { legacyExportUrl, parseLegacyNotes, type LegacyNote } from "./legacy-notes";

export function LegacyNotesExport() {
  const [notes, setNotes] = useState<LegacyNote[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    try { setNotes(parseLegacyNotes(localStorage.getItem("vibe-log-entries"))); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "This browser could not read its saved notes."); }
    finally { setLoaded(true); }
  }, []);
  function download() {
    const backup = { format: "chiefs-news-private-notes", version: 1, exportedAt: new Date().toISOString(), sourceOrigin: window.location.origin, comments: notes };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2) + "\n"], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `chiefs-news-private-comments-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Your private backup download has started.");
  }
  return <div className="legacy-export">
    {!loaded ? <p role="status">Checking this browser for saved notes…</p> : notes.length ? <><p>{notes.length} saved {notes.length === 1 ? "comment was" : "comments were"} found at this address.</p><button className="action-primary" type="button" onClick={download}>Download private JSON backup</button></> : !error && <p>No saved comments were found at this address.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <p className="account-intro">Notes saved on the old GitHub Pages site belong to that address. Use the same browser where you wrote them and open its export page.</p>
    <a className="archive-link" href={legacyExportUrl}>Open the old site’s private export →</a>
    {message && <p className="form-success" role="status">{message}</p>}
  </div>;
}
