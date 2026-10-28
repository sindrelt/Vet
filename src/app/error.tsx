'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="shell empty-state">
      <h1>Noe gikk galt</h1>
      <p>Vi kunne ikke laste siden. Prøv på nytt om litt.</p>
      <button className="button button-dark" onClick={reset}>
        Prøv igjen
      </button>
    </main>
  );
}
