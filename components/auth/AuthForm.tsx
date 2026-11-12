"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "signup" | "forgot-password" | "reset-password";

function safeReturnPath(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return "/account/";
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decoded)) return "/account/";
    if (new URL(value, "https://chiefs-news.invalid").origin !== "https://chiefs-news.invalid") return "/account/";
  }
  catch { return "/account/"; }
  return value;
}

export function AuthForm({ mode, next }: { mode: Mode; next?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const needsPassword = mode !== "forgot-password";
  const creatingPassword = mode === "signup" || mode === "reset-password";
  const endpoint = `/api/auth/${mode}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const password = String(values.get("password") || "");
    if (creatingPassword && password !== values.get("confirmPassword")) {
      setError("The passwords do not match.");
      return;
    }
    setPending(true);
    setError("");
    setMessage("");
    const payload: Record<string, string> = {};
    if (mode === "login") {
      payload.identifier = String(values.get("identifier") || "").trim();
      payload.next = safeReturnPath(next);
    } else if (mode !== "reset-password") {
      payload.email = String(values.get("email") || "").trim();
    }
    if (needsPassword) payload.password = password;
    if (mode === "signup") payload.displayName = String(values.get("displayName") || "").trim();
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We could not complete that request. Please try again.");
      if (mode === "login" || mode === "reset-password") {
        router.push(safeReturnPath(result.redirectTo || (mode === "login" ? next : "/account/")));
        router.refresh();
      } else {
        form.reset();
        setMessage(result.message || (mode === "signup" ? "Check your email to verify your account before logging in." : "If that address has an account, a password reset link is on its way."));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The connection failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const buttonLabel = { login: "Log in", signup: "Create account", "forgot-password": "Send reset link", "reset-password": "Save new password" }[mode];
  return <form className="account-form" onSubmit={submit}>
    <fieldset disabled={pending}>
      {mode === "signup" && <div className="form-field"><label htmlFor="displayName">Public display name</label><input id="displayName" name="displayName" autoComplete="nickname" minLength={2} maxLength={60} required /><p className="field-help">This name appears beside your comments. Your email stays private.</p></div>}
      {mode === "login" ? <div className="form-field"><label htmlFor="identifier">Email or admin username</label><input id="identifier" name="identifier" autoComplete="username" maxLength={254} required /></div> : mode !== "reset-password" && <div className="form-field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" maxLength={254} required /></div>}
      {needsPassword && <div className="form-field"><label htmlFor="password">{mode === "reset-password" ? "New password" : "Password"}</label><input id="password" name="password" type="password" autoComplete={creatingPassword ? "new-password" : "current-password"} minLength={creatingPassword ? 12 : undefined} maxLength={128} required />{creatingPassword && <p className="field-help">Use at least 12 characters.</p>}</div>}
      {creatingPassword && <div className="form-field"><label htmlFor="confirmPassword">Confirm password</label><input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></div>}
      <button className="action-primary" type="submit">{pending ? "Please wait…" : buttonLabel}</button>
    </fieldset>
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p className="form-success" role="status">{message}</p>}
  </form>;
}
