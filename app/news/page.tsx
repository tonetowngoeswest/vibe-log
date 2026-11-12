import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedStories } from "@/lib/data";
import { StoryCard } from "@/components/public/StoryCard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Story archive", description: "Browse the Chiefs News story archive: football analysis, team news and life off the field.", alternates: { canonical: "/news/" } };

export default async function ArchivePage() {
  const stories = await getPublishedStories();
  return <main className="archive-main" id="main" tabIndex={-1}>
    <Link className="back-to-news" href="/">← Back to the news</Link><div className="archive-heading"><p className="category">From the newsroom</p><h1>Story archive</h1><p>Every story from Chiefs News, newest first. Catch up on the coverage you missed.</p></div>
    <div className="section-heading"><p>{stories.length} {stories.length === 1 ? "story" : "stories"}</p><p>Newest first</p></div>
    <div className="archive-grid">{stories.map(story => <StoryCard key={story.id} story={story} variant="archive" />)}</div>
    {!stories.length && <p>The newsroom is preparing its first stories. Check back soon.</p>}
  </main>;
}
