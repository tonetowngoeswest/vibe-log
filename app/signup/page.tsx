import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Create an account", robots: { index: false, follow: false } };

export default function SignupPage() {
  return <main className="account-main" id="main" tabIndex={-1}>
    <div className="account-card"><p className="category">Pull up a seat</p><h1>Create an account</h1><p className="account-intro">Sign up to comment on Chiefs News. Verify your email before joining a discussion.</p>
      <AuthForm mode="signup" />
      <div className="account-links"><p>Already a reader? <Link href="/login/">Log in</Link></p></div>
    </div>
  </main>;
}
