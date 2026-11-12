import Link from "next/link";
import type { CSSProperties } from "react";
import type { Story } from "@/lib/types";
import { ArticleBody } from "./ArticleBody";
import { CopyArticleLink } from "./CopyArticleLink";
import { assetPath, StoryCard } from "./StoryCard";

export function ArticleContent({ story, relatedStories = [] }: { story: Story; relatedStories?: Story[] }) {
  const photo = story.image;
  const words = story.paragraphs.join(" ").trim().split(/\s+/).filter(Boolean).length;
  const readMinutes = Math.max(1, Math.round(words / 200));
  const portraitStyle = photo.portrait ? { "--photo-width": `${photo.width || 600}px` } as CSSProperties : undefined;
  const safePhotoSource = photo.sourceUrl?.startsWith("https://") ? photo.sourceUrl : undefined;
  return <main className="article-main" id="main" tabIndex={-1}>
    <article aria-labelledby="article-title">
      <div className="article-heading"><Link className="back-to-news" href="/">← All news</Link><p className="category">{story.category}</p><h1 id="article-title">{story.title}</h1><p className="article-dek">{story.dek}</p>
        {story.archived && <p className="archive-notice">From the archive. This story is not currently featured on the homepage.</p>}
      </div>
      <figure className={`article-figure${photo.portrait ? " portrait-figure" : ""}`} style={portraitStyle}>
        <div className={`article-image${photo.trim ? " trim-image" : ""}${photo.portrait ? " portrait-image" : ""}`}><img src={assetPath(photo.src)} alt={photo.alt} width={photo.width || 2048} height={photo.height || 1152} fetchPriority="high" /></div>
        <figcaption>{photo.caption}{photo.credit && <> {safePhotoSource ? <a href={safePhotoSource}>{photo.credit}</a> : photo.credit}</>}</figcaption>
      </figure>
      <div className="article-layout">
        <aside className="author-rail" aria-label="About the author"><span className="author-monogram" aria-hidden="true">{story.author.split(" ").map(part => part[0]).join("").slice(0, 2)}</span><p className="author-name">By {story.author}</p><p className="author-role">Chiefs News contributor</p><Link href={`/news/${story.slug}/#comments-heading`}>Join the conversation</Link><p className="author-note">Independent coverage.<br />Red and gold perspective.</p></aside>
        <div className="article-copy"><div className="article-tools"><time dateTime={story.updated || story.published}>{story.dateLabel}</time><span>{readMinutes} min read</span><CopyArticleLink canonicalPath={`/news/${story.slug}/`} /></div><ArticleBody paragraphs={story.paragraphs} paragraphLinks={story.paragraphLinks} /></div>
      </div>
    </article>
    {relatedStories.length > 0 && <section className="related-section" aria-labelledby="related-heading"><div className="section-heading"><h2 id="related-heading">More from Chiefs News</h2><Link href="/news/">Story archive →</Link></div><div className="related-grid">{relatedStories.slice(0, 3).map(related => <StoryCard key={related.id} story={related} variant="related" />)}</div></section>}
  </main>;
}
