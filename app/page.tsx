import { getPublishedLayout, getPublishedStories } from "@/lib/data";
import { getViewer } from "@/lib/auth";
import { HomeContent } from "@/components/public/HomeContent";
import { CommentsThread } from "@/components/comments/CommentsThread";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [stories, layout, viewer] = await Promise.all([getPublishedStories(), getPublishedLayout(), getViewer()]);
  return <><HomeContent stories={stories} layout={layout} /><CommentsThread story="home" viewer={viewer} /></>;
}
