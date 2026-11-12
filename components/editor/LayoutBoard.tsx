'use client';

import { useState, type DragEvent } from 'react';
import { EditorRequestError, editorRequest, errorMessage } from './api';
import { SLOT_DEFINITIONS, type EditableStory, type EditorialLayout, type SlotKey } from './types';
import { layoutIsComplete, moveStoryToSlot, removeStoryFromLayout } from './layout-model';
import { useUnsavedChanges } from './useUnsavedChanges';

export function LayoutBoard({ stories, initialLayout }: { stories: EditableStory[]; initialLayout: EditorialLayout }) {
  const [slots, setSlots] = useState(initialLayout.slots);
  const [savedSlots, setSavedSlots] = useState(JSON.stringify(initialLayout.slots));
  const [version, setVersion] = useState(initialLayout.version);
  const [draggedStory, setDraggedStory] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'publish' | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false);
  const byId = new Map(stories.map(story => [story.id, story]));
  const knownIds = new Set(byId.keys());
  const assigned = new Set(Object.values(slots).filter((id): id is string => !!id));
  const archive = stories.filter(story => !assigned.has(story.id));
  const dirty = JSON.stringify(slots) !== savedSlots;
  const complete = layoutIsComplete(slots, knownIds);
  const reloadLatest = useUnsavedChanges(dirty);

  function moveToSlot(storyId: string | null, target: SlotKey) {
    if (busy || conflict) return;
    if (storyId && !byId.has(storyId)) return;
    setSlots(current => moveStoryToSlot(current, storyId, target, knownIds));
    setMessage(''); setDropTarget(null); setDraggedStory(null);
  }

  function returnToArchive(storyId: string) {
    if (busy || conflict) return;
    setSlots(current => removeStoryFromLayout(current, storyId));
    setMessage('Story moved to the draft archive pool. Fill the empty slot before publishing.');
    setDropTarget(null); setDraggedStory(null);
  }

  function dragStart(event: DragEvent, storyId: string) {
    event.dataTransfer.setData('application/x-chiefsstory', storyId);
    event.dataTransfer.effectAllowed = 'move';
    setDraggedStory(storyId);
  }

  function droppedStory(event: DragEvent): string | null {
    return event.dataTransfer.getData('application/x-chiefsstory') || draggedStory;
  }

  async function save() {
    setBusy('save'); setError(''); setMessage('');
    try {
      const result = await editorRequest<{ layout: EditorialLayout }>('/api/editor/layout', 'PATCH', { slots, expectedVersion: version });
      setSlots(result.layout.slots); setSavedSlots(JSON.stringify(result.layout.slots)); setVersion(result.layout.version);
      setConflict(false); setMessage('Layout draft saved. The public homepage has not changed.');
    } catch (failure) {
      if (failure instanceof EditorRequestError && failure.status === 409) {
        setConflict(true); setError(`${errorMessage(failure)} Your arrangement is still here. Download it before reloading the latest layout.`);
      } else setError(errorMessage(failure));
    } finally { setBusy(null); }
  }

  async function publish() {
    if (dirty) { setError('Save the draft layout before publishing.'); return; }
    if (!complete) { setError('Choose seven different stories, one for every homepage slot.'); return; }
    setBusy('publish'); setError(''); setMessage('');
    try {
      const result = await editorRequest<{ layout: EditorialLayout }>('/api/editor/layout/publish', 'POST', { expectedVersion: version });
      setSlots(result.layout.slots); setSavedSlots(JSON.stringify(result.layout.slots)); setVersion(result.layout.version);
      setConflict(false); setMessage('Homepage layout published. All seven positions changed together. Story drafts were not published.');
    } catch (failure) {
      if (failure instanceof EditorRequestError && failure.status === 409) {
        setConflict(true); setError(`${errorMessage(failure)} Your arrangement is still here. Keep a copy before reloading the latest layout.`);
      } else setError(errorMessage(failure));
    } finally { setBusy(null); }
  }

  function downloadCopy() {
    const blob = new Blob([JSON.stringify({ version, slots }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'chiefs-homepage-layout.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function slotCard(slot: (typeof SLOT_DEFINITIONS)[number]) {
    const story = slots[slot.key] ? byId.get(slots[slot.key]!) : null;
    return (
      <section className={`editor-layout-slot ${story ? '' : 'editor-layout-slot-empty'}`} key={slot.key} data-drag-over={dropTarget === slot.key} aria-labelledby={`slot-${slot.key}-label`} onDragOver={event => { if (draggedStory) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTarget(slot.key); } }} onDragLeave={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDropTarget(null); }} onDrop={event => { event.preventDefault(); const id = droppedStory(event); if (id) moveToSlot(id, slot.key); }}>
        <h3 id={`slot-${slot.key}-label`}>{slot.label}</h3>
        {story ? <div className="editor-draggable-story" draggable={!busy && !conflict} onDragStart={event => dragStart(event, story.id)} onDragEnd={() => { setDraggedStory(null); setDropTarget(null); }}><span className="editor-drag-handle" aria-hidden="true">⠿</span><p>{story.title}</p><a className="editor-text-link" href={`/editor/stories/${story.id}/`}>Edit story</a></div> : <p className="editor-empty-slot">Drop a story here or choose one below.</p>}
        <label className="editor-slot-select-label" htmlFor={`select-${slot.key}`}>Choose story for {slot.label.toLowerCase()}</label>
        <select id={`select-${slot.key}`} value={slots[slot.key] || ''} disabled={!!busy || conflict} onChange={event => moveToSlot(event.target.value || null, slot.key)}><option value="">Empty slot</option>{stories.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}</select>
        {story && <button type="button" className="editor-small-button" disabled={!!busy || conflict} onClick={() => returnToArchive(story.id)}>Move to archive pool</button>}
      </section>
    );
  }

  return (
    <section aria-labelledby="layout-heading">
      <div className="editor-heading-row"><div><p className="category">Front page</p><h1 id="layout-heading">Arrange the homepage</h1></div><span className={`editor-badge ${dirty ? 'editor-badge-pending' : ''}`}>{dirty ? 'Unsaved layout' : `Draft version ${version}`}</span></div>
      <p className="editor-description" id="layout-instructions">Drag stories between positions to swap them. Drag a story from the archive pool into a position to replace its current story. You can also use each position’s dropdown with a keyboard. The board shows published headlines. Save and preview the layout before publishing.</p>
      <div className="editor-layout-board" aria-describedby="layout-instructions">
        <div className="editor-layout-column editor-layout-left">{SLOT_DEFINITIONS.filter(slot => slot.column === 'left').map(slotCard)}</div>
        <div className="editor-layout-column editor-layout-lead">{SLOT_DEFINITIONS.filter(slot => slot.column === 'lead').map(slotCard)}</div>
        <div className="editor-layout-column editor-layout-latest">{SLOT_DEFINITIONS.filter(slot => slot.column === 'latest').map(slotCard)}</div>
      </div>
      <section className="editor-archive-pool" data-drag-over={dropTarget === 'archive'} aria-labelledby="archive-pool-heading" onDragOver={event => { if (draggedStory) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTarget('archive'); } }} onDragLeave={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDropTarget(null); }} onDrop={event => { event.preventDefault(); const id = droppedStory(event); if (id) returnToArchive(id); }}>
        <h2 id="archive-pool-heading">Archive pool <span className="editor-count">{archive.length}</span></h2>
        <p className="editor-description">Stories outside the homepage remain accessible in the public archive. Moving them here changes the draft layout until you publish.</p>
        <div className="editor-archive-pool-grid">{archive.map(story => <div className="editor-draggable-story" key={story.id} draggable={!busy && !conflict} onDragStart={event => dragStart(event, story.id)} onDragEnd={() => { setDraggedStory(null); setDropTarget(null); }}><span className="editor-drag-handle" aria-hidden="true">⠿</span><p>{story.title}</p><a className="editor-text-link" href={`/editor/stories/${story.id}/`}>Edit story</a></div>)}{archive.length === 0 && <p>Every story is currently on the draft homepage.</p>}</div>
      </section>
      {!complete && <p className="editor-warning">The layout needs seven different stories before it can be published. You can save an incomplete draft.</p>}
      {error && <p className="editor-error" role="alert">{error}</p>}{message && <p className="editor-status" role="status">{message}</p>}
      {conflict && <div className="editor-actions"><button type="button" className="editor-button editor-button-secondary" onClick={downloadCopy}>Download your layout</button><button type="button" className="editor-button editor-button-secondary" onClick={reloadLatest}>Reload latest layout</button></div>}
      <div className="editor-actions editor-actions-sticky"><button className="editor-button" type="button" disabled={!!busy || conflict} onClick={save}>{busy === 'save' ? 'Saving…' : 'Save layout draft'}</button><a className={`editor-button editor-button-secondary ${dirty || !complete || conflict || busy ? 'editor-disabled-link' : ''}`} href="/editor/preview/" target="_blank" rel="noreferrer" aria-disabled={dirty || !complete || conflict || !!busy} onClick={event => { if (dirty || !complete || conflict || busy) { event.preventDefault(); setError(conflict ? 'Reload the latest layout before previewing it.' : dirty ? 'Save the layout draft before previewing.' : 'Fill every position before previewing the homepage.'); } }}>Preview layout ↗</a><button className="editor-button editor-button-publish" type="button" disabled={!!busy || dirty || !complete || conflict} onClick={publish}>{busy === 'publish' ? 'Publishing…' : 'Publish layout'}</button></div>
    </section>
  );
}
