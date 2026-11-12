import Link from "next/link";
import type { HomepageLayout, Story } from "@/lib/types";
import { StoryCard } from "./StoryCard";

export function HomeContent({ stories, layout }: { stories: Story[]; layout: HomepageLayout | null }) {
  const lookup = new Map(stories.map(story => [story.id, story]));
  const storyAt = (slot: keyof HomepageLayout["slots"]) => layout?.slots[slot] ? lookup.get(layout.slots[slot]!) : undefined;
  const top = storyAt("leftTop");
  const bottom = storyAt("leftBottom");
  const lead = storyAt("lead");
  const latest = (["latest1", "latest2", "latest3", "latest4"] as const).map(storyAt);
  return <main id="main" tabIndex={-1}>
    <div className="section-heading"><h1>News</h1><p>The stories. The team. The Kingdom.</p></div>
    {!layout ? <div className="edition-empty"><p>The newsroom is preparing the next edition.</p><Link className="archive-link" href="/news/">Browse the story archive →</Link></div> : <div className="news-grid">
      <section className="supporting-stories" aria-label="More stories">
        {top ? <StoryCard story={top} anchor="team" /> : <div className="empty-story-slot" id="team">No story selected</div>}
        {bottom ? <StoryCard story={bottom} anchor="photos" /> : <div className="empty-story-slot" id="photos">No story selected</div>}
      </section>
      <section className="lead-column" aria-label="Lead story">
        {lead ? <StoryCard story={lead} variant="lead" /> : <div className="empty-story-slot">No lead story selected</div>}
        <div className="editor-note"><span className="small-label">From the newsroom</span><p>A closer look at Kansas City football.</p></div>
      </section>
      <aside className="latest-column" id="latest" aria-labelledby="latest-heading">
        <h2 id="latest-heading"><span aria-hidden="true" />The Latest</h2>
        {latest.map((story, index) => story ? <StoryCard key={story.id} story={story} variant="latest" /> : <div className="empty-story-slot" key={`empty-${index}`}>No story selected</div>)}
        <Link className="archive-link" href="/news/">Browse the story archive →</Link>
        <div className="coverage-note"><span className="small-label">Red. Gold. All in.</span><p>Your corner of the Kingdom.</p></div>
      </aside>
    </div>}
  </main>;
}
