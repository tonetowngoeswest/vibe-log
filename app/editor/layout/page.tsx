import { getDraftLayout, getPublishedStories } from '@/lib/data';
import { requireEditorialViewer } from '@/components/editor/access';
import { EditorShell } from '@/components/editor/EditorShell';
import { LayoutBoard } from '@/components/editor/LayoutBoard';

export default async function HomepageLayoutPage() {
  const viewer = await requireEditorialViewer();
  const [stories, layout] = await Promise.all([getPublishedStories(), getDraftLayout()]);
  return <EditorShell admin={viewer.role === 'admin'}><LayoutBoard stories={stories} initialLayout={layout} /></EditorShell>;
}
