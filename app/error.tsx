'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main id="main"><h1>We couldn’t load this page</h1><p>Please try again. Your saved stories and comments have not been removed.</p><button onClick={reset}>Try again</button></main>;
}
