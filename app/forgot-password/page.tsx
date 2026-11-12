import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return <main className="account-main" id="main" tabIndex={-1}>
    <div className="account-card"><p className="category">Get back in the game</p><h1>Reset your password</h1><p className="account-intro">Enter your account email and we’ll send you a reset link.</p>
      <AuthForm mode="forgot-password" />
      <div className="account-links"><Link href="/login/">Back to log in</Link></div>
    </div>
  </main>;
}
