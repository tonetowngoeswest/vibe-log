import type { Metadata } from "next";
import { LegacyNotesExport } from "@/components/public/LegacyNotesExport";

export const metadata: Metadata = { title: "Export your private notes", robots: { index: false, follow: false } };

export default function LegacyExportPage() {
  return <main className="account-main" id="main" tabIndex={-1}><div className="account-card"><p className="category">Your original conversation</p><h1>Export your private notes</h1><p className="account-intro">Your old comments were saved privately in your browser. Download a JSON backup to keep them. This export stays on your device; it does not post anything to a public discussion.</p><LegacyNotesExport /></div></main>;
}
