import { headers } from 'next/headers';
import { authenticated } from '@/lib/server/auth';
import { getPool } from '@/lib/server/db';
import { formatPrice, type Snapshot } from '@/lib/domain';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Administrasjon', robots: { index: false, follow: false } };
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  // Defence in depth: do not rely on proxy routing alone.
  if (!authenticated((await headers()).get('authorization')))
    return <main id="main">Ingen tilgang.</main>;
  const { result } = await searchParams;
  let pending: Record<string, unknown>[] = [],
    sources: Record<string, unknown>[] = [],
    recent: Record<string, unknown>[] = [];
  let failed = false;
  try {
    const pool = getPool();
    const results = await Promise.all([
      pool.query(`SELECT p.*, c.name AS clinic_name,t.category,t.species,t.sex,t.weight_min_grams,t.weight_max_grams,t.package_label,o.snapshot AS previous_snapshot
        FROM proposals p JOIN clinics c ON c.id=p.clinic_id JOIN treatments t ON t.id=p.treatment_id
        LEFT JOIN offers o ON o.clinic_id=p.clinic_id AND o.treatment_id=p.treatment_id WHERE p.status='pending' ORDER BY p.fetched_at DESC LIMIT 100`),
      pool.query(
        'SELECT s.id,s.url,s.last_success_at,s.last_error,s.enabled,c.name FROM sources s JOIN clinics c ON c.id=s.clinic_id ORDER BY c.name',
      ),
      pool.query(
        `SELECT p.id,p.status,p.reviewed_at,p.reviewed_by,p.review_note,c.name FROM proposals p JOIN clinics c ON c.id=p.clinic_id WHERE p.status<>'pending' ORDER BY p.reviewed_at DESC LIMIT 20`,
      ),
    ]);
    [pending, sources, recent] = results.map((r) => r.rows);
  } catch {
    failed = true;
  }
  return (
    <main id="main" className="shell admin-page">
      <span className="overline">BESKYTTET OMRÅDE</span>
      <h1>Kontroller før publisering.</h1>
      <p>Se originaltekst, pakkeinnhold og kilde. Bare godkjente forslag vises på søkesiden.</p>
      {failed && (
        <div className="error-message" role="alert">
          Databasen er utilgjengelig. Ingen forslag kan behandles nå.
        </div>
      )}
      {result && (
        <div className={result === 'ok' ? 'notice' : 'error-message'} role="status">
          {result === 'ok'
            ? 'Forslaget er behandlet.'
            : result === 'conflict'
              ? 'Forslaget er allerede behandlet eller bygger på en eldre pris. Kontroller og hent kilden på nytt.'
              : 'Handlingen kunne ikke gjennomføres. Kontroller databasen og prøv igjen.'}
        </div>
      )}
      <h2>
        Venter på godkjenning ({pending.length}
        {pending.length === 100 ? '+' : ''})
      </h2>
      {!failed && !pending.length && (
        <div className="empty-state">
          <h3>Ingen forslag å behandle</h3>
          <p>Kjør prisinnhentingen manuelt når verifiserte kilder er registrert.</p>
        </div>
      )}
      {pending.map((p) => {
        const s = p.snapshot as Snapshot;
        const previous = p.previous_snapshot as Snapshot | null;
        return (
          <article className="admin-card" key={String(p.id)}>
            <h3>
              {String(p.clinic_name)} · {s.originalName}
            </h3>
            <p>
              {String(p.category)} · {p.species === 'dog' ? 'Hund' : 'Katt'} · Kjønn:{' '}
              {String(p.sex)} · {String(p.package_label)}
            </p>
            <p>
              Vekt:{' '}
              {p.weight_min_grams == null
                ? 'ingen nedre grense'
                : `${Number(p.weight_min_grams) / 1000} kg`}{' '}
              –{' '}
              {p.weight_max_grams == null
                ? 'ingen øvre grense'
                : `${Number(p.weight_max_grams) / 1000} kg`}
            </p>
            <div className="admin-columns">
              <section>
                <h3>Publisert nå</h3>
                {previous ? (
                  <>
                    <strong>{formatPrice(previous.price)}</strong>
                    <pre>{JSON.stringify(previous, null, 2)}</pre>
                  </>
                ) : (
                  <p>Ingen tidligere pris.</p>
                )}
              </section>
              <section>
                <h3>Foreslått pris: {formatPrice(s.price)}</h3>
                <p>Inkludert: {s.includes.join(', ') || 'Ikke oppgitt'}</p>
                <p>Tillegg: {s.extras.join(', ') || 'Ikke oppgitt'}</p>
                <p>Forbehold: {s.caveats.join(', ') || 'Ikke oppgitt'}</p>
                <p>
                  Mva.:{' '}
                  {s.vat === 'included'
                    ? 'inkludert'
                    : s.vat === 'excluded'
                      ? 'ikke inkludert'
                      : 'ikke oppgitt'}
                </p>
                <blockquote>{s.originalText}</blockquote>
                <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer">
                  Åpne kilden ↗
                </a>
                <p>
                  Hentet{' '}
                  {new Date(p.fetched_at as string).toLocaleString('nb-NO', {
                    timeZone: 'Europe/Oslo',
                  })}
                </p>
                <p>
                  Siste kontroll{' '}
                  {new Date(p.checked_at as string).toLocaleString('nb-NO', {
                    timeZone: 'Europe/Oslo',
                  })}
                </p>
              </section>
            </div>
            <form method="post" action="/api/admin/review">
              <input type="hidden" name="id" value={String(p.id)} />
              <label className="sr-only" htmlFor={`note-${p.id}`}>
                Begrunnelse
              </label>
              <input
                id={`note-${p.id}`}
                name="note"
                placeholder="Merknad til vurderingen (valgfritt)"
                maxLength={1000}
              />
              <button className="button button-dark" name="action" value="approve">
                Godkjenn og publiser
              </button>
              <button className="button button-danger" name="action" value="reject">
                Avvis
              </button>
            </form>
          </article>
        );
      })}
      <h2>Innhentingskilder</h2>
      <p>Planlagt kjøring er deaktivert. Ingen nettsider besøkes ved brukersøk.</p>
      {sources.length ? (
        sources.map((s) => (
          <div className="source-status" key={String(s.id)}>
            <strong>
              {String(s.name)} · {s.enabled ? 'Manuelt aktivert kilde' : 'Deaktivert kilde'}
            </strong>
            <a href={String(s.url)} target="_blank" rel="noopener noreferrer">
              {String(s.url)}
            </a>
            <p>
              Sist vellykket:{' '}
              {s.last_success_at
                ? new Date(s.last_success_at as string).toLocaleString('nb-NO', {
                    timeZone: 'Europe/Oslo',
                  })
                : 'Aldri'}
            </p>
            {s.last_error != null && (
              <p className="error-message">
                Innhenting feilet. Tidligere priser beholdes. {String(s.last_error)}
              </p>
            )}
          </div>
        ))
      ) : (
        <p>Ingen verifiserte kilder er registrert.</p>
      )}
      <h2>Siste vurderinger</h2>
      {recent.map((p) => (
        <div key={String(p.id)} className="source-status">
          <strong>
            {String(p.name)} · {p.status === 'approved' ? 'Godkjent' : 'Avvist'}
          </strong>
          <p>
            {new Date(p.reviewed_at as string).toLocaleString('nb-NO', { timeZone: 'Europe/Oslo' })}{' '}
            · {String(p.reviewed_by)} · {String(p.review_note || 'Ingen merknad')}
          </p>
        </div>
      ))}
    </main>
  );
}
