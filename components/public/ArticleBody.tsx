import { Fragment, type ReactNode } from "react";

type Attribution = { paragraph: number; text: string; url: string };

export function ArticleBody({ paragraphs, paragraphLinks = [] }: { paragraphs: string[]; paragraphLinks?: Attribution[] }) {
  return <div className="article-body">{paragraphs.map((paragraph, index) => {
    const spans = paragraphLinks.filter(link => link.paragraph === index && link.text && link.url.startsWith("https://")).map(link => ({ start: paragraph.indexOf(link.text), end: paragraph.indexOf(link.text) + link.text.length, url: link.url })).filter(span => span.start >= 0).sort((a, b) => a.start - b.start);
    const pieces: ReactNode[] = [];
    let cursor = 0;
    for (const span of spans) {
      if (span.start < cursor) continue;
      pieces.push(<Fragment key={`plain-${cursor}`}>{paragraph.slice(cursor, span.start)}</Fragment>);
      pieces.push(<a key={`link-${span.start}`} href={span.url}>{paragraph.slice(span.start, span.end)}</a>);
      cursor = span.end;
    }
    pieces.push(<Fragment key={`plain-${cursor}`}>{paragraph.slice(cursor)}</Fragment>);
    return <p key={index}>{pieces}</p>;
  })}</div>;
}
