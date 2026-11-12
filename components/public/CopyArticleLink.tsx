"use client";

import { useEffect, useState } from "react";

export function CopyArticleLink({ canonicalPath }: { canonicalPath?: string }) {
  const [available, setAvailable] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { setAvailable(Boolean(navigator.clipboard?.writeText)); }, []);
  async function copy() {
    setPending(true); setMessage("");
    try { await navigator.clipboard.writeText(canonicalPath ? new URL(canonicalPath, window.location.origin).href : window.location.href.split("#")[0]); setMessage("Article link copied."); }
    catch { setMessage("The link could not be copied. You can copy it from your browser’s address bar."); }
    finally { setPending(false); }
  }
  return <>{available && <button type="button" id="copy-article-link" disabled={pending} onClick={copy}>{pending ? "Copying…" : "Copy link"}</button>}<span id="article-status" role="status">{message}</span></>;
}
