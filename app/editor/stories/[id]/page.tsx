import { notFound } from 'next/navigation';
import { getEditorStories, getStoryHistory } from '@/lib/data';
import { requireEditorialViewer } from '@/components/editor/access';
import { EditorShell } from '@/components/editor/EditorShell';
import { StoryEditor } from '@/components/editor/StoryEditor';

export default async function EditStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireEditorialViewer();
  const { id } = await params;
  const story = (await getEditorStories()).find(candidate => candidate.id === id);
  if (!story) notFound();
  const history = await getStoryHistory(id);
  return <EditorShell admin={viewer.role === 'admin'}><a className="editor-text-link" href="/editor/">← All stories</a><StoryEditor key={story.id} story={story} history={history} /></EditorShell>;
}
