import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { requireEditorialViewer } from '@/components/editor/access';
import '@/components/editor/editor.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Account administration | Chiefs News', robots: { index: false, follow: false } };

export default async function AdministrationLayout({ children }: { children: ReactNode }) {
  await requireEditorialViewer(true);
  return children;
}
