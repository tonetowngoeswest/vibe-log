import { getEditorStories } from '@/lib/data';
import { requireEditorialViewer } from '@/components/editor/access';
import { EditorShell } from '@/components/editor/EditorShell';
import { StoryList } from '@/components/editor/StoryList';

export default async function EditorPage() {
  const viewer = await requireEditorialViewer();
  const stories = await getEditorStories();
  return <EditorShell admin={viewer.role === 'admin'}><div className="editor-heading-row"><div><p className="category">The newsroom</p><h1>Stories</h1></div><a className="editor-button editor-button-secondary" href="/editor/layout/">Arrange the homepage</a></div><p className="editor-description">Edit headlines, deks and paragraphs for every story. Save a draft and preview your changes before publishing them.</p><StoryList stories={stories} /></EditorShell>;
}
