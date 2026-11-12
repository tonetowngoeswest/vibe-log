"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Viewer = { id: string; displayName: string; role: string; mustChangePassword: boolean };
type Comment = {
  id: string;
  userId: string;
  displayName: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  canEdit?: boolean;
  canDelete?: boolean;
};

function readComment(value: Record<string, unknown>): Comment {
  return {
    id: String(value.id),
    userId: String(value.userId ?? value.user_id ?? ""),
    displayName: String(value.displayName ?? value.display_name ?? "Reader"),
    text: String(value.text ?? value.body ?? ""),
    createdAt: String(value.createdAt ?? value.created_at ?? ""),
    updatedAt: String(value.updatedAt ?? value.updated_at ?? value.createdAt ?? value.created_at ?? ""),
    canEdit: typeof value.canEdit === "boolean" ? value.canEdit : undefined,
    canDelete: typeof value.canDelete === "boolean" ? value.canDelete : undefined,
  };
}

function commentTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function CommentsThread({ story, viewer, storyTitle }: { story: string; viewer: Viewer | null; storyTitle?: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const returnPath = story === "home" ? "/#comments-heading" : `/news/${encodeURIComponent(story)}/#comments-heading`;

  const load = useCallback(async (nextCursor?: string | null, signal?: AbortSignal) => {
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ story });
      if (nextCursor) query.set("cursor", nextCursor);
      const response = await fetch(`/api/comments?${query}`, { cache: "no-store", signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The conversation could not be loaded.");
      if (!Array.isArray(result.comments)) throw new Error("The conversation could not be loaded. Please retry.");
      const incoming: Comment[] = result.comments.map(readComment);
      setComments(current => nextCursor ? [...current, ...incoming.filter(comment => !current.some(existing => existing.id === comment.id))] : incoming);
      setCursor(result.nextCursor || null);
      setLoaded(true);
    } catch (reason) {
      if (signal?.aborted) return;
      setError(reason instanceof Error ? reason.message : "The connection failed. Please retry.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [story]);

  useEffect(() => {
    const controller = new AbortController();
    setComments([]); setCursor(null); setLoaded(false); setText(""); setEditingId(null); setDeleteId(null);
    void load(null, controller.signal);
    return () => controller.abort();
  }, [load]);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim()) { setError("Write a comment before posting."); return; }
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ story, text: text.trim() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your comment could not be posted. Your text is still here.");
      setText("");
      if (result.comment) {
        const comment = readComment(result.comment);
        setComments(current => [comment, ...current.filter(existing => existing.id !== comment.id)]);
        setLoaded(true);
      } else await load();
      setMessage("Your comment has been posted.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The connection failed. Your comment has not been cleared."); }
    finally { setPending(false); }
  }

  async function edit(event: FormEvent<HTMLFormElement>, comment: Comment) {
    event.preventDefault();
    if (!editingText.trim()) { setError("A comment cannot be empty."); return; }
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/comments/${encodeURIComponent(comment.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: editingText.trim() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your changes could not be saved. Your text is still here.");
      if (result.comment) {
        const updated = readComment(result.comment);
        setComments(current => current.map(existing => existing.id === updated.id ? updated : existing));
      } else await load();
      setEditingId(null); setMessage("Your comment has been updated.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The connection failed. Your changes have not been cleared."); }
    finally { setPending(false); }
  }

  async function remove(id: string) {
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/comments/${encodeURIComponent(id)}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || "That comment could not be removed."); }
      setComments(current => current.filter(comment => comment.id !== id));
      setDeleteId(null); setMessage("The comment has been removed.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The connection failed. Please try again."); }
    finally { setPending(false); }
  }

  return <section className="comments-section" aria-labelledby="comments-heading">
    <div className="comments-inner">
      <p className="comments-eyebrow">The conversation continues</p>
      <h2 id="comments-heading">Comments</h2>
      <p className="comments-intro">{storyTitle ? "Discuss this story with the Kingdom." : "What’s on your mind, Chiefs Kingdom?"}</p>
      <p className="comments-note">{story === "home" ? "The homepage conversation is open to all signed-in readers." : "This conversation belongs to this story."} Comments are shared with other readers and saved to your account.</p>
      {viewer && !viewer.mustChangePassword ? <form id="entry-form" onSubmit={add}>
        <label htmlFor="entry-text">Add your comment as {viewer.displayName}</label>
        <textarea id="entry-text" name="text" rows={4} maxLength={2000} value={text} onChange={event => setText(event.target.value)} placeholder="Join the conversation…" required disabled={pending} />
        <div className="comment-form-footer"><span className="field-help">{text.length}/2,000 characters</span><button type="submit" disabled={pending}>{pending ? "Saving…" : "Post comment"}</button></div>
      </form> : <div className="comment-login-prompt">{viewer ? <Link href="/reset-password/">Set your password to finish your account setup.</Link> : <><Link href={`/login/?next=${encodeURIComponent(returnPath)}`}>Log in</Link> or <Link href="/signup/">create an account</Link> to join the conversation.</>}</div>}
      <div className="comments-list-bar"><h3 className="comments-list-heading">The discussion</h3><button className="comment-refresh" type="button" disabled={loading || pending} onClick={() => void load()}>{loading ? "Loading…" : "Refresh comments"}</button></div>
      {!loaded && loading && <p role="status">Loading the conversation…</p>}
      {loaded && !comments.length && <p id="empty-state">Start the conversation. Be the first to comment.</p>}
      <ul id="entries" aria-label="Reader comments">
        {comments.map(comment => {
          const owner = viewer?.id === comment.userId;
          const canEdit = Boolean(viewer && !viewer.mustChangePassword && (comment.canEdit ?? owner));
          const canDelete = Boolean(viewer && !viewer.mustChangePassword && (comment.canDelete ?? (owner || viewer.role === "editor" || viewer.role === "admin")));
          return <li key={comment.id}>
            <p className="comment-author">{comment.displayName}</p>
            {editingId === comment.id ? <form className="comment-edit-form" onSubmit={event => void edit(event, comment)}><label htmlFor={`edit-${comment.id}`}>Edit your comment</label><textarea id={`edit-${comment.id}`} rows={4} maxLength={2000} required value={editingText} onChange={event => setEditingText(event.target.value)} disabled={pending} /><div className="comment-actions"><button type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button><button type="button" disabled={pending} onClick={() => setEditingId(null)}>Cancel</button></div></form> : <p>{comment.text}</p>}
            <div className="entry-footer"><time dateTime={comment.createdAt}>{commentTime(comment.createdAt)}{comment.updatedAt && comment.updatedAt !== comment.createdAt ? " · edited" : ""}</time><div className="comment-actions">
              {canEdit && editingId !== comment.id && <button type="button" disabled={pending} onClick={() => { setEditingId(comment.id); setEditingText(comment.text); setDeleteId(null); }}>Edit</button>}
              {canDelete && <button type="button" disabled={pending} onClick={() => setDeleteId(comment.id)}>Remove</button>}
            </div></div>
            {deleteId === comment.id && <div className="comment-delete-confirm"><p>Remove this comment?</p><button type="button" disabled={pending} onClick={() => void remove(comment.id)}>{pending ? "Removing…" : "Remove comment"}</button><button type="button" disabled={pending} onClick={() => setDeleteId(null)}>Cancel</button></div>}
          </li>;
        })}
      </ul>
      {cursor && <button className="comment-load-more" type="button" disabled={loading || pending} onClick={() => void load(cursor)}>{loading ? "Loading…" : "Load older comments"}</button>}
      {error && <div className="comments-error" role="alert"><p>{error}</p>{!loaded && <button type="button" disabled={loading} onClick={() => void load()}>Retry loading comments</button>}</div>}
      {message && <p id="status" role="status">{message}</p>}
    </div>
  </section>;
}
