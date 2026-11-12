import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Log in", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; error?: string | string[] }> }) {
  const query = await searchParams;
  const next = typeof query.next === "string" ? query.next : undefined;
  const error = query.error === "verification" ? "That verification or reset link could not be used. Request a new link or try logging in." : typeof query.error === "string" ? "Your account request could not be completed. Please try logging in again." : undefined;
  return <main className="account-main" id="main" tabIndex={-1}>
    <div className="account-card"><p className="category">Welcome to the Kingdom</p><h1>Log in</h1><p className="account-intro">Join the conversation. Editors can manage stories and the homepage after logging in.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <AuthForm mode="login" next={next} />
      <div className="account-links"><Link href="/forgot-password/">Forgot your password?</Link><p>New here? <Link href="/signup/">Create a reader account</Link></p></div>
    </div>
  </main>;
}
