import { getDraftLayout, getPublishedStories } from '@/lib/data';
import { requireEditorialViewer } from '@/components/editor/access';
import { HomeContent } from '@/components/public/HomeContent';

export default async function LayoutPreviewPage() {
  await requireEditorialViewer();
  const [stories, layout] = await Promise.all([getPublishedStories(), getDraftLayout()]);
  return <><div className="editor-preview-banner"><p><strong>Private layout preview.</strong> This arrangement uses published story copy. Unpublished story drafts stay private.</p><a href="/editor/layout/">Back to layout editor →</a></div><HomeContent stories={stories} layout={layout} /></>;
}
