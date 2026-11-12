import Link from "next/link";
import type { Story } from "@/lib/types";

export function assetPath(path: string) {
  return path.startsWith("/") || path.startsWith("https://") ? path : `/${path}`;
}

export function StoryCard({ story, variant = "supporting", anchor }: { story: Story; variant?: "supporting" | "lead" | "latest" | "archive" | "related"; anchor?: string }) {
  const target = `/news/${story.slug}/`;
  const photo = story.image;
  const trimmed = photo.trim ? " trim-image" : "";
  const portrait = photo.portrait ? " portrait-thumbnail" : "";
  if (variant === "related") return <article className="related-story" data-story={story.slug}>
    <Link href={target}><div className={`related-image${trimmed}${portrait}`}><img src={assetPath(photo.src)} alt={photo.alt} width={photo.width || 2048} height={photo.height || 1152} loading="lazy" /></div><p className="category">{story.category}</p><h3>{story.title}</h3></Link>
    <p className="byline">{story.author}</p>
  </article>;
  const classes = { supporting: "story", lead: "lead-story", latest: "latest-story", archive: "archive-story" }[variant];
  const imageClasses = { supporting: "", lead: " lead-image", latest: " latest-image", archive: " archive-image" }[variant];
  const Heading = variant === "latest" ? "h3" : "h2";
  return <article className={classes} id={anchor} data-story={story.slug}>
    <Link className="story-photo-link" href={target} aria-label={`Read: ${story.title}`}><figure className={`story-image${imageClasses}${trimmed}${portrait}`}>
      <img src={assetPath(photo.src)} alt={photo.alt} width={photo.width || 2048} height={photo.height || 1152} loading={variant === "lead" ? "eager" : "lazy"} fetchPriority={variant === "lead" ? "high" : "auto"} />
      {variant === "lead" && <figcaption>{story.category}</figcaption>}
    </figure></Link>
    <div className="story-summary"><p className="category">{story.category}</p><Heading><Link href={target}>{story.title}</Link></Heading><p className="dek">{story.dek}</p>
      <p className="byline">{story.author}{(variant === "latest" || variant === "archive") && <> <span aria-hidden="true">·</span> <time dateTime={story.updated || story.published}>{story.dateLabel}</time></>}</p>
    </div>
    {variant === "lead" && <span className="story-rule" aria-hidden="true" />}
  </article>;
}
