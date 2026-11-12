import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';

export async function requireEditorialViewer(adminOnly = false) {
  const viewer = await getViewer();
  if (!viewer) redirect('/login/?next=/editor/');
  if (viewer.mustChangePassword) redirect('/reset-password/');
  if (adminOnly ? viewer.role !== 'admin' : !['editor', 'admin'].includes(viewer.role)) {
    redirect('/account/?notice=editor-access-required');
  }
  return viewer;
}
