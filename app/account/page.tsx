import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { AccountForm } from "@/components/auth/AccountForm";

export const metadata: Metadata = { title: "Your account", robots: { index: false, follow: false } };

export default async function AccountPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login/?next=/account/");
  if (viewer.mustChangePassword) redirect("/reset-password/");
  return <main className="account-main" id="main" tabIndex={-1}>
    <div className="account-card"><p className="category">Your corner of the Kingdom</p><h1>Your account</h1><p className="account-intro">Signed in as {viewer.email}. Your email is visible only to you and account administrators.</p>
      <AccountForm displayName={viewer.displayName} />
      <div className="account-links"><Link href="/reset-password/">Change password</Link>{(viewer.role === "editor" || viewer.role === "admin") && <Link href="/editor/">Open the editor dashboard</Link>}</div>
    </div>
  </main>;
}
