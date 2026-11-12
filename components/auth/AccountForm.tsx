"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AccountForm({ displayName }: { displayName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: String(values.get("displayName") || "").trim() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your profile could not be saved.");
      setMessage("Your display name has been saved.");
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The connection failed. Please try again."); }
    finally { setPending(false); }
  }
  return <form className="account-form" onSubmit={submit}>
    <fieldset disabled={pending}>
      <div className="form-field"><label htmlFor="displayName">Public display name</label><input id="displayName" name="displayName" autoComplete="nickname" defaultValue={displayName} minLength={2} maxLength={60} required /></div>
      <button className="action-primary" type="submit">{pending ? "Saving…" : "Save profile"}</button>
    </fieldset>
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p className="form-success" role="status">{message}</p>}
  </form>;
}
