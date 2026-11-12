'use client';

import { useState } from 'react';
import type { EditableStory } from './types';

export function StoryList({ stories }: { stories: EditableStory[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'archived' | 'pending'>('all');
  const search = query.trim().toLocaleLowerCase();
  const visible = stories.filter(story =>
    (!search || `${story.title} ${story.dek} ${story.slug}`.toLocaleLowerCase().includes(search)) &&
    (filter !== 'archived' || story.archived) &&
    (filter !== 'pending' || story.hasUnpublishedChanges || story.hasDraft),
  );
  return <>
    <div className="editor-search-row"><div className="editor-field"><label htmlFor="story-search">Find a story</label><input id="story-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Headline, dek or story slug" /></div><div className="editor-field"><label htmlFor="story-filter">Show</label><select id="story-filter" value={filter} onChange={event => setFilter(event.target.value as typeof filter)}><option value="all">All stories</option><option value="pending">With unpublished changes</option><option value="archived">Archived stories</option></select></div></div>
    <div className="editor-table-scroll"><table className="editor-table"><caption className="editor-visually-hidden">All editable stories, including archived stories</caption><thead><tr><th scope="col">Story</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead><tbody>{visible.map(story => <tr key={story.id}><td><a href={`/editor/stories/${story.id}/`}><strong>{story.title}</strong></a><p className="editor-help">{story.category} · {story.author}</p><p className="editor-help">{story.slug}</p></td><td>{story.archived ? 'Archive' : 'Published'}{(story.hasUnpublishedChanges || story.hasDraft) && <span className="editor-badge editor-badge-pending">Draft changes</span>}<p className="editor-help">Version {story.version}</p></td><td><a className="editor-button editor-button-secondary" href={`/editor/stories/${story.id}/`}>Edit story</a></td></tr>)}{!visible.length && <tr><td colSpan={3}>No stories match this search.</td></tr>}</tbody></table></div>
    <p className="editor-help">{visible.length} of {stories.length} stories shown. Archived stories keep their public article addresses.</p>
  </>;
}
