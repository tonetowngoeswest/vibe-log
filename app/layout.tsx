import type { Metadata } from 'next';
import { SiteHeader } from '@/components/public/SiteHeader';
import { SiteFooter } from '@/components/public/SiteFooter';
import { backendConfigured } from '@/lib/supabase';
import '@/style.css';
import '@/components/public/ui.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { metadataBase: new URL(process.env.SITE_URL || 'http://localhost:3000'), title: { default: 'Chiefs News', template: '%s | Chiefs News' }, description: 'Independent Kansas City football coverage.' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body><SiteHeader />{!backendConfigured() && <div className="setup-notice" role="status">Site preview: stories are available. Accounts, editing and shared comments are awaiting setup.</div>}{children}<SiteFooter /></body></html>;
}
