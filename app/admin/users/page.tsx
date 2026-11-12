import { requireEditorialViewer } from '@/components/editor/access';
import { EditorShell } from '@/components/editor/EditorShell';
import { UserManagement } from '@/components/editor/UserManagement';

export default async function AccountAdministrationPage() {
  const viewer = await requireEditorialViewer(true);
  return <EditorShell admin><UserManagement viewerId={viewer.id} /></EditorShell>;
}
