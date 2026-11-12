"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Viewer = { displayName: string; role: string; mustChangePassword: boolean };

export function SessionControls({ viewer }: { viewer: Viewer | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || "Could not log out. Please try again."); }
      router.push("/"); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not log out. Please try again."); }
    finally { setPending(false); }
  }
  return <div className="session-controls">
    {viewer ? <>
      {(viewer.role === "editor" || viewer.role === "admin") && !viewer.mustChangePassword && <Link className="header-account-link" href="/editor/">Editor</Link>}
      <Link className="header-account-link" href={viewer.mustChangePassword ? "/reset-password/" : "/account/"}>{viewer.mustChangePassword ? "Set password" : viewer.displayName}</Link>
      <button className="header-logout" type="button" disabled={pending} onClick={logout}>{pending ? "Logging out…" : "Log out"}</button>
    </> : <Link className="header-account-link" href="/login/">Log in</Link>}
    {error && <span className="session-error" role="alert">{error}</span>}
  </div>;
}
