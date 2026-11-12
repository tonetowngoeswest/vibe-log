import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";
import { getViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false, follow: false } };

export default async function ResetPasswordPage() {
  const viewer = await getViewer();
  return <main className="account-main" id="main" tabIndex={-1}>
    <div className="account-card"><p className="category">Your account</p><h1>Choose a new password</h1>
      {viewer ? <><p className="account-intro">{viewer.mustChangePassword ? "Choose your own password to finish setting up your account." : "Set a new password for your account."}</p><AuthForm mode="reset-password" /></> : <><p className="account-intro">Open the password reset link from your email, or log in before changing your password.</p><div className="account-links"><Link href="/forgot-password/">Request a new reset link</Link><Link href="/login/?next=/reset-password/">Log in</Link></div></>}
    </div>
  </main>;
}
