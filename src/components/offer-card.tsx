import Link from 'next/link';
import { ArrowUpRight, Check, MapPin, Dog, Cat, Clock3, Info } from 'lucide-react';
import { formatPrice, isStale, treatmentLabel, type Offer, type Clinic } from '@/lib/domain';
export function OfferCard({
  offer: o,
  clinic: c,
  demo,
}: {
  offer: Offer;
  clinic: Clinic;
  demo: boolean;
}) {
  const stale = !demo && isStale(o.checkedAt);
  return (
    <article className="offer-card">
      <div className="clinic-avatar">
        {o.treatment.species === 'dog' ? <Dog size={28} /> : <Cat size={28} />}
      </div>
      <div className="offer-main">
        <div className="offer-topline">
          <span className="eyebrow">{o.treatment.category}</span>
          {demo && <span className="mini-badge">Eksempel</span>}
        </div>
        <Link href={`/klinikk/${c.slug}${demo ? '?demo=1' : ''}`} className="clinic-name">
          {c.name}
          <ArrowUpRight size={17} />
        </Link>
        <div className="muted location">
          <MapPin size={13} />
          {c.place} <span>·</span> {treatmentLabel(o.treatment)}
        </div>
        <p className="original-name">{o.originalName}</p>
        <div className="inclusions">
          {o.includes.length ? (
            o.includes.map((item) => (
              <span key={item}>
                <Check size={13} />
                {item}
              </span>
            ))
          ) : (
            <span>
              <Info size={13} />
              Innhold ikke oppgitt
            </span>
          )}
        </div>
        <details className="offer-details">
          <summary>Innhold og forbehold</summary>
          <div>
            <p>
              <strong>Pakke:</strong> {o.treatment.packageLabel}
            </p>
            {o.extras.map((e, i) => (
              <p key={`e${i}`}>
                <strong>Tillegg:</strong> {e}
              </p>
            ))}
            {o.caveats.map((e, i) => (
              <p key={`c${i}`}>{e}</p>
            ))}
            <p>
              Mva.:{' '}
              {o.vat === 'included'
                ? 'inkludert'
                : o.vat === 'excluded'
                  ? 'ikke inkludert'
                  : 'ikke oppgitt i kilden'}
            </p>
            {!demo && (
              <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer">
                Åpne offisiell priskilde ↗
              </a>
            )}
          </div>
        </details>
      </div>
      <div className="offer-price">
        <span className={`price-type ${o.price.kind === 'from' ? 'price-from' : ''}`}>
          {
            {
              fixed: 'Fastpris',
              from: 'Fra-pris · tillegg kan komme',
              range: 'Prisintervall',
              unknown: 'Kontakt klinikken',
            }[o.price.kind]
          }
        </span>
        <strong>{formatPrice(o.price)}</strong>
        <span className={`checked ${stale ? 'stale' : ''}`}>
          <Clock3 size={12} />
          {demo
            ? 'Fiktiv eksempelpris'
            : stale
              ? 'Kan være utdatert'
              : `Kontrollert ${new Date(o.checkedAt).toLocaleDateString('nb-NO', { timeZone: 'Europe/Oslo' })}`}
        </span>
        {stale && (
          <span className="checked">
            Sist: {new Date(o.checkedAt).toLocaleDateString('nb-NO', { timeZone: 'Europe/Oslo' })}
          </span>
        )}
        <Link className="clinic-link" href={`/klinikk/${c.slug}${demo ? '?demo=1' : ''}`}>
          Se klinikken <ArrowUpRight size={14} />
        </Link>
      </div>
    </article>
  );
}
