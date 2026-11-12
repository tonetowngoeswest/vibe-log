import { notFound } from 'next/navigation';
import { getEditorStories, getPublishedStories } from '@/lib/data';
import { requireEditorialViewer } from '@/components/editor/access';
import { ArticleContent } from '@/components/public/ArticleContent';

export default async function StoryPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireEditorialViewer();
  const { id } = await params;
  const story = (await getEditorStories()).find(candidate => candidate.id === id);
  if (!story) notFound();
  const related = (await getPublishedStories()).filter(candidate => candidate.id !== id && !candidate.archived).slice(0, 3);
  return <><div className="editor-preview-banner"><p><strong>Private story preview.</strong> This draft is visible only to editors until it is published.</p><a href={`/editor/stories/${id}/`}>Back to story editor →</a></div><ArticleContent story={story} relatedStories={related} /></>;
}
