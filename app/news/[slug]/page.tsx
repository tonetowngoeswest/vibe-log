import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedStories, getPublishedStory } from "@/lib/data";
import { getViewer } from "@/lib/auth";
import { ArticleContent } from "@/components/public/ArticleContent";
import { CommentsThread } from "@/components/comments/CommentsThread";
import { assetPath } from "@/components/public/StoryCard";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const story = await getPublishedStory(slug);
  if (!story) return { title: "Story not found", robots: { index: false } };
  return {
    title: story.title,
    description: story.dek,
    alternates: { canonical: `/news/${story.slug}/` },
    openGraph: { type: "article", title: story.title, description: story.dek, url: `/news/${story.slug}/`, publishedTime: story.published, modifiedTime: story.updated || story.published, authors: [story.author], images: [{ url: assetPath(story.image.src), alt: story.image.alt, width: story.image.width, height: story.image.height }] },
    twitter: { card: "summary_large_image", title: story.title, description: story.dek, images: [assetPath(story.image.src)] },
  };
}

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const story = await getPublishedStory(slug);
  if (!story) notFound();
  const [stories, viewer] = await Promise.all([getPublishedStories(), getViewer()]);
  const relatedStories = stories.filter(other => other.id !== story.id && !other.archived).slice(0, 3);
  return <><ArticleContent story={story} relatedStories={relatedStories} /><CommentsThread key={story.slug} story={story.slug} storyTitle={story.title} viewer={viewer} /></>;
}
