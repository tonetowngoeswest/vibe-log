'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EditorRequestError, editorRequest, errorMessage } from './api';
import type { AttributionLink, EditableStory, StoryHistoryEntry } from './types';
import { useUnsavedChanges } from './useUnsavedChanges';

type ParagraphDraft = { key: string; text: string; links: { key: string; text: string; url: string }[] };
type DraftContent = Pick<EditableStory, 'title' | 'dek' | 'paragraphs'> & { paragraphLinks: AttributionLink[] };

function fromStory(story: EditableStory): ParagraphDraft[] {
  return story.paragraphs.map((text, paragraph) => ({
    key: `paragraph-${paragraph}`,
    text,
    links: (story.paragraphLinks || []).filter(link => link.paragraph === paragraph).map((link, index) => ({
      key: `link-${paragraph}-${index}`, text: link.text, url: link.url,
    })),
  }));
}

function contentOf(title: string, dek: string, paragraphs: ParagraphDraft[]): DraftContent {
  return {
    title: title.trim(), dek: dek.trim(),
    paragraphs: paragraphs.map(paragraph => paragraph.text.trim()),
    paragraphLinks: paragraphs.flatMap((paragraph, index) => paragraph.links.map(link => ({ paragraph: index, text: link.text, url: link.url }))),
  };
}

function contentErrors(content: DraftContent): string[] {
  const errors: string[] = [];
  if (!content.title.trim()) errors.push('Add a headline.');
  if (!content.dek.trim()) errors.push('Add a dek.');
  if (!content.paragraphs.length || content.paragraphs.some(text => !text.trim())) errors.push('Every paragraph needs text. Remove empty paragraphs before saving.');
  const spans = new Map<number, [number, number][]>();
  for (const link of content.paragraphLinks) {
    const position = content.paragraphs[link.paragraph]?.indexOf(link.text) ?? -1;
    if (!link.text || position < 0) errors.push(`Paragraph ${link.paragraph + 1}: the linked words must appear exactly in the paragraph.`);
    try {
      const url = new URL(link.url);
      if (url.protocol !== 'https:' || !link.url.startsWith('https://')) throw new Error('HTTPS required');
    } catch {
      errors.push(`Paragraph ${link.paragraph + 1}: source links need a complete HTTPS address.`);
    }
    if (position >= 0 && link.text) {
      const existing = spans.get(link.paragraph) || [];
      const end = position + link.text.length;
      if (existing.some(([start, finish]) => position < finish && end > start)) errors.push(`Paragraph ${link.paragraph + 1}: attribution links cannot overlap.`);
      existing.push([position, end]);
      spans.set(link.paragraph, existing);
    }
  }
  return [...new Set(errors)];
}

export function StoryEditor({ story, history = [] }: { story: EditableStory; history?: StoryHistoryEntry[] }) {
  const router = useRouter();
  const formId = useId();
  const [title, setTitle] = useState(story.title);
  const [dek, setDek] = useState(story.dek);
  const [paragraphs, setParagraphs] = useState(() => fromStory(story));
  const [version, setVersion] = useState(story.version);
  const [hasDraft, setHasDraft] = useState(Boolean(story.hasDraft || story.hasUnpublishedChanges));
  const [saved, setSaved] = useState(() => JSON.stringify(contentOf(story.title, story.dek, fromStory(story))));
  const [busy, setBusy] = useState<'save' | 'publish' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [validation, setValidation] = useState<string[]>([]);
  const content = contentOf(title, dek, paragraphs);
  const dirty = JSON.stringify(content) !== saved;
  const wordCount = paragraphs.map(paragraph => paragraph.text.trim()).join(' ').split(/\s+/).filter(Boolean).length;
  const reloadLatest = useUnsavedChanges(dirty);

  function changeParagraph(index: number, transform: (paragraph: ParagraphDraft) => ParagraphDraft) {
    setParagraphs(current => current.map((paragraph, candidate) => candidate === index ? transform(paragraph) : paragraph));
    setMessage('');
  }

  function moveParagraph(index: number, direction: -1 | 1) {
    setParagraphs(current => {
      const next = [...current];
      [next[index], next[index + direction]] = [next[index + direction], next[index]];
      return next;
    });
    setMessage('');
  }

  async function save() {
    const errors = contentErrors(content);
    setValidation(errors);
    if (errors.length) { setError('Review the highlighted issues before saving.'); return; }
    setBusy('save'); setError(''); setMessage('');
    try {
      const result = await editorRequest<{ story: EditableStory }>(`/api/editor/stories/${story.id}`, 'PATCH', { ...content, expectedVersion: version });
      setVersion(result.story.version);
      const canonical = contentOf(result.story.title, result.story.dek, fromStory(result.story));
      setTitle(result.story.title); setDek(result.story.dek); setParagraphs(fromStory(result.story));
      setSaved(JSON.stringify(canonical));
      setHasDraft(true);
      setConflict(false);
      setMessage('Draft saved. The published story has not changed.');
      router.refresh();
    } catch (failure) {
      if (failure instanceof EditorRequestError && failure.status === 409) {
        setConflict(true);
        setError(`${errorMessage(failure)} Your text is still here. Download your copy before reloading the latest draft.`);
      } else setError(errorMessage(failure));
    } finally { setBusy(null); }
  }

  async function publish() {
    if (dirty) { setError('Save your changes before publishing.'); return; }
    if (!hasDraft) { setMessage('This story is already up to date. Save a changed draft before publishing a new version.'); return; }
    const errors = contentErrors(content);
    setValidation(errors);
    if (errors.length) { setError('Fix the listed issues before publishing.'); return; }
    setBusy('publish'); setError(''); setMessage('');
    try {
      const result = await editorRequest<{ story: EditableStory }>(`/api/editor/stories/${story.id}/publish`, 'POST', { expectedVersion: version });
      setVersion(result.story.version);
      setHasDraft(false);
      setConflict(false);
      setMessage('Published. The article, homepage copy and archive now use this version.');
      router.refresh();
    } catch (failure) {
      if (failure instanceof EditorRequestError && failure.status === 409) {
        setConflict(true);
        setError(`${errorMessage(failure)} Your text is still here. Keep a copy before reloading the latest draft.`);
      } else setError(errorMessage(failure));
    } finally { setBusy(null); }
  }

  function downloadCopy() {
    const blob = new Blob([JSON.stringify({ slug: story.slug, ...content }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `${story.slug}-draft.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="editor-panel" aria-labelledby="story-editor-heading">
      <div className="editor-heading-row"><div><p className="category">Story editor</p><h1 id="story-editor-heading">Edit story</h1></div><a className="editor-text-link" href={`/news/${story.slug}/`} target="_blank" rel="noreferrer">View published story ↗</a></div>
      <p className="editor-description">Save a private draft, preview it, then publish when it is ready. Existing source links stay with their paragraphs.</p>
      <div className="editor-save-bar"><span className={`editor-badge ${dirty || hasDraft ? 'editor-badge-pending' : ''}`}>{dirty ? 'Unsaved changes' : hasDraft ? 'Unpublished draft saved' : 'Published version'}</span><span>Version {version} · {wordCount} words</span></div>
      <div className="editor-field"><label htmlFor={`${formId}-title`}>Headline</label><textarea id={`${formId}-title`} className="editor-title-input" rows={3} value={title} maxLength={240} onChange={event => { setTitle(event.target.value); setMessage(''); }} disabled={!!busy} /></div>
      <div className="editor-field"><label htmlFor={`${formId}-dek`}>Dek</label><textarea id={`${formId}-dek`} rows={3} value={dek} maxLength={1000} onChange={event => { setDek(event.target.value); setMessage(''); }} disabled={!!busy} /></div>
      <fieldset className="editor-paragraphs"><legend>Story paragraphs</legend>
        {paragraphs.map((paragraph, index) => (
          <section className="editor-paragraph" key={paragraph.key} aria-labelledby={`${formId}-paragraph-label-${paragraph.key}`}>
            <div className="editor-heading-row"><label id={`${formId}-paragraph-label-${paragraph.key}`} htmlFor={`${formId}-paragraph-${paragraph.key}`}>Paragraph {index + 1}</label><div className="editor-inline-actions"><button type="button" className="editor-small-button" disabled={index === 0 || !!busy} onClick={() => moveParagraph(index, -1)} aria-label={`Move paragraph ${index + 1} up`}>↑</button><button type="button" className="editor-small-button" disabled={index === paragraphs.length - 1 || !!busy} onClick={() => moveParagraph(index, 1)} aria-label={`Move paragraph ${index + 1} down`}>↓</button><button type="button" className="editor-small-button" disabled={paragraphs.length === 1 || !!busy} onClick={() => setParagraphs(current => current.filter((_, candidate) => candidate !== index))}>Remove</button></div></div>
            <textarea id={`${formId}-paragraph-${paragraph.key}`} rows={6} value={paragraph.text} maxLength={20000} onChange={event => changeParagraph(index, current => ({ ...current, text: event.target.value }))} disabled={!!busy} />
            {paragraph.links.map((link, linkIndex) => (
              <div className="editor-attribution" key={link.key}>
                <div className="editor-field"><label htmlFor={`${formId}-${link.key}-text`}>Linked words</label><input id={`${formId}-${link.key}-text`} value={link.text} placeholder="Exact words from this paragraph" onChange={event => changeParagraph(index, current => ({ ...current, links: current.links.map((item, candidate) => candidate === linkIndex ? { ...item, text: event.target.value } : item) }))} disabled={!!busy} /></div>
                <div className="editor-field"><label htmlFor={`${formId}-${link.key}-url`}>Source URL</label><input id={`${formId}-${link.key}-url`} type="url" value={link.url} placeholder="https://" onChange={event => changeParagraph(index, current => ({ ...current, links: current.links.map((item, candidate) => candidate === linkIndex ? { ...item, url: event.target.value } : item) }))} disabled={!!busy} /></div>
                <button className="editor-small-button" type="button" disabled={!!busy} onClick={() => changeParagraph(index, current => ({ ...current, links: current.links.filter((_, candidate) => candidate !== linkIndex) }))} aria-label={`Remove source link ${linkIndex + 1} from paragraph ${index + 1}`}>Remove link</button>
              </div>
            ))}
            <button type="button" className="editor-small-button" disabled={!!busy} onClick={() => changeParagraph(index, current => ({ ...current, links: [...current.links, { key: crypto.randomUUID(), text: '', url: '' }] }))}>Add attribution link</button>
          </section>
        ))}
        <button type="button" className="editor-button editor-button-secondary" disabled={!!busy} onClick={() => setParagraphs(current => [...current, { key: crypto.randomUUID(), text: '', links: [] }])}>Add paragraph</button>
      </fieldset>
      {validation.length > 0 && <div className="editor-error"><ul>{validation.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
      {error && <p className="editor-error" role="alert">{error}</p>}
      {message && <p className="editor-status" role="status">{message}</p>}
      {conflict && <div className="editor-actions"><button className="editor-button editor-button-secondary" type="button" onClick={downloadCopy}>Download your draft</button><button className="editor-button editor-button-secondary" type="button" onClick={reloadLatest}>Reload latest draft</button></div>}
      <div className="editor-actions editor-actions-sticky"><button className="editor-button" type="button" disabled={!!busy || conflict || !dirty} onClick={save}>{busy === 'save' ? 'Saving…' : 'Save draft'}</button><a className={`editor-button editor-button-secondary ${dirty || conflict || busy ? 'editor-disabled-link' : ''}`} href={`/editor/preview/${story.id}/`} target="_blank" rel="noreferrer" aria-disabled={dirty || conflict || !!busy} onClick={event => { if (dirty || conflict || busy) { event.preventDefault(); setError(conflict ? 'Reload the latest draft before previewing it.' : 'Save your draft before previewing it.'); } }}>Preview draft ↗</a><button className="editor-button editor-button-publish" type="button" disabled={!!busy || dirty || conflict || !hasDraft} onClick={publish}>{busy === 'publish' ? 'Publishing…' : 'Publish story'}</button></div>
      <section className="editor-revisions" aria-labelledby="revision-heading"><h2 id="revision-heading">Saved revisions</h2><p className="editor-description">Load an earlier revision into this form, then save and preview it before publishing. The public story stays unchanged until you publish.</p>{history.length ? <ol className="editor-revision-list">{history.map(revision => <li key={revision.id}><div><strong>{revision.content.title}</strong><p className="editor-help">{Number.isNaN(Date.parse(revision.createdAt)) ? 'Saved revision' : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' }).format(new Date(revision.createdAt))}{revision.published ? ' · Current published revision' : ' · Saved revision'}</p></div><button type="button" className="editor-small-button" disabled={!!busy || conflict} onClick={() => { if (dirty && !window.confirm('Replace the text in this form with this revision? Unsaved edits will be replaced.')) return; setTitle(revision.content.title); setDek(revision.content.dek); setParagraphs(fromStory(revision.content)); setValidation([]); setError(''); setMessage('Earlier revision loaded into the form. Save it as a new draft before previewing or publishing.'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Load into editor</button></li>)}</ol> : <p className="editor-help">Saved revisions will appear here after the story has been imported.</p>}</section>
    </section>
  );
}
