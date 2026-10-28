import Link from 'next/link';
export default function NotFound() {
  return (
    <main id="main" className="shell empty-state">
      <h1>Vi fant ikke denne siden</h1>
      <p>Klinikken kan mangle i det begrensede utvalget vårt.</p>
      <Link className="button button-dark" href="/">
        Til forsiden
      </Link>
    </main>
  );
}
