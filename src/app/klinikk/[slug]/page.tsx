import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPin, Phone, Globe, ExternalLink, Info } from 'lucide-react';
import { getCatalog } from '@/lib/server/catalog';
import { OfferCard } from '@/components/offer-card';
export const dynamic = 'force-dynamic';
export default async function ClinicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ demo?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const catalog = await getCatalog(query.demo === '1');
  if (catalog.error)
    return (
      <main id="main" className="shell clinic-page">
        <div role="alert" className="error-message">
          {catalog.error}
        </div>
        <Link href="/">Til forsiden</Link>
      </main>
    );
  const c = catalog.clinics.find((c) => c.slug === slug);
  if (!c) notFound();
  const offers = catalog.offers.filter((o) => o.clinicId === c.id);
  return (
    <main id="main" className="shell clinic-page">
      <Link className="back-link" href={`/${catalog.demo ? '?demo=1' : ''}#sammenlign`}>
        <ArrowLeft size={16} /> Tilbake til prisene
      </Link>
      {catalog.demo && (
        <div className="notice demo-notice">
          <Info size={18} />
          <p>
            <strong>Fiktiv eksempelklinikk.</strong> Dette er ikke en ekte klinikk eller ekte
            priser.
          </p>
        </div>
      )}
      <div className="clinic-hero">
        <span className="overline">{c.chain || 'KLINIKKAVDELING'}</span>
        <h1>{c.name}</h1>
        <p>
          <MapPin size={17} />
          {c.place} · Søkeområde: {c.area}
        </p>
        <p className="muted">Gjeldende kommune: {c.municipality}</p>
      </div>
      <div className="clinic-layout">
        <section>
          <h2>Behandlinger og priser</h2>
          <p className="muted">
            {offers.length} publiserte {catalog.demo ? 'eksempelpriser' : 'priser'}. Bekreft
            sluttprisen med klinikken.
          </p>
          <div className="results-list">
            {offers.map((o) => (
              <OfferCard key={o.id} offer={o} clinic={c} demo={catalog.demo} />
            ))}
            {!offers.length && (
              <div className="empty-state">
                <h3>Ingen godkjente priser ennå</h3>
                <p>Besøk klinikkens offisielle nettside for mer informasjon.</p>
              </div>
            )}
          </div>
          {!catalog.demo &&
            offers.map((o) => (
              <details className="source-detail" key={o.id}>
                <summary>Kildegrunnlag: {o.originalName}</summary>
                <blockquote>{o.originalText}</blockquote>
                <p>
                  Hentet{' '}
                  {new Date(o.fetchedAt).toLocaleString('nb-NO', { timeZone: 'Europe/Oslo' })}. Sist
                  vellykket kontroll{' '}
                  {new Date(o.checkedAt).toLocaleString('nb-NO', { timeZone: 'Europe/Oslo' })}.
                </p>
                <a href={o.sourceUrl} rel="noopener noreferrer" target="_blank">
                  Offisiell priskilde <ExternalLink size={13} />
                </a>
              </details>
            ))}
        </section>
        <aside className="contact-card">
          <h3>Kontakt klinikken</h3>
          {c.address ? (
            <p>
              <MapPin size={17} />
              <span>
                {c.address}
                <br />
                {c.postalCode} {c.place}
              </span>
            </p>
          ) : (
            <p>Ingen besøksadresse i eksempelvisningen.</p>
          )}
          {c.phone && (
            <p>
              <Phone size={17} />
              <a href={`tel:${c.phone.replace(/[^+0-9]/g, '')}`}>{c.phone}</a>
            </p>
          )}
          {c.website && (
            <p>
              <Globe size={17} />
              <a href={c.website} target="_blank" rel="noopener noreferrer">
                Offisiell nettside <ArrowLeft className="rotate" size={14} />
              </a>
            </p>
          )}
          <hr />
          <p className="muted">
            Dyrpris tilbyr ikke bestilling. Ta kontakt med klinikken for råd og timeavtale.
          </p>
        </aside>
      </div>
    </main>
  );
}
