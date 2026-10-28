import {
  ArrowRight,
  MapPin,
  Search,
  SlidersHorizontal,
  ShieldCheck,
  ListFilter,
  RefreshCw,
  CircleCheck,
  Sparkles,
  PawPrint,
  Info,
} from 'lucide-react';
import { getCatalog } from '@/lib/server/catalog';
import {
  areas,
  categories,
  filterOffers,
  comparisonKey,
  treatmentLabel,
  type Filters,
} from '@/lib/domain';
import { PetArt } from '@/components/pet-art';
import { OfferCard } from '@/components/offer-card';
export const dynamic = 'force-dynamic';
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const value = (key: string) =>
    typeof params[key] === 'string' ? (params[key] as string).slice(0, 300) : '';
  const demo = value('demo') === '1';
  const catalog = await getCatalog(demo);
  const filters: Filters = {
    q: value('q'),
    area: value('area'),
    category: value('category'),
    species: value('species'),
    variant: value('variant'),
    sort: value('sort'),
  };
  const { offers, comparable } = filterOffers(catalog, filters);
  const variants = [
    ...new Map(
      catalog.offers
        .filter(
          (o) =>
            (!filters.category || o.treatment.category === filters.category) &&
            (!filters.species || o.treatment.species === filters.species),
        )
        .map((o) => [comparisonKey(o.treatment), o.treatment]),
    ).entries(),
  ];
  const clinicMap = new Map(catalog.clinics.map((c) => [c.id, c]));
  return (
    <main id="main">
      <section className="hero">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <div className="overline">
              <span /> FOR SMÅ OG STORE FAMILIEMEDLEMMER
            </div>
            <h1>
              God omsorg begynner
              <br />
              med <em>god oversikt.</em>
            </h1>
            <p>
              Sammenlign veterinærpriser i nærheten.
              <br className="desktop-break" /> Se hva som er inkludert, og finn det som passer dere.
            </p>
            <a className="button button-dark" href="#sammenlign">
              Finn veterinærpriser <ArrowRight size={17} />
            </a>
            <div className="hero-footnote">
              <ShieldCheck size={16} /> Gratis å bruke. Ingen innlogging.
            </div>
          </div>
          <PetArt />
        </div>
      </section>
      <div className="region-strip">
        <div className="shell">
          <span>
            <MapPin size={16} /> Vi starter lokalt
          </span>
          <p>
            Modum <i /> Ringerike <i /> Øvre Eiker <i /> Nedre Eiker <i /> Drammen
          </p>
          <span className="pilot-tag">Førsteversjon</span>
        </div>
      </div>
      <section className="comparison shell" id="sammenlign">
        <div className="section-heading">
          <div>
            <span className="overline">LITT ENKLERE Å VELGE</span>
            <h2>Hva trenger din firbeinte?</h2>
            <p>Velg behandling og område for å finne priser.</p>
          </div>
          <span className="heading-note">
            <PawPrint size={17} /> Hund og katt
          </span>
        </div>
        <div className={`notice ${demo ? 'demo-notice' : ''}`} role="status">
          <Info size={19} />
          <div>
            <strong>
              {demo
                ? 'Du ser eksempeldata – ingen av prisene er ekte.'
                : 'Vi er i startfasen. Dekningen er begrenset.'}
            </strong>
            <p>
              {demo
                ? 'Klinikknavn og beløp er fiktive og viser bare hvordan tjenesten vil fungere.'
                : `${catalog.clinics.length} verifiserte klinikkavdelinger og ${catalog.offers.length} godkjente priser er tilgjengelige. Et søkeområde betyr ikke at vi har priser der.`}
            </p>
          </div>
          <a href={demo ? '/#sammenlign' : '/?demo=1#sammenlign'}>
            {demo ? 'Se ekte dekning' : 'Utforsk eksempelvisning'} <ArrowRight size={14} />
          </a>
        </div>
        <form className="filter-form" action="/#sammenlign" method="get">
          {demo && <input type="hidden" name="demo" value="1" />}
          <div className="primary-filters">
            <label>
              <span>
                <MapPin size={15} /> Område
              </span>
              <select name="area" defaultValue={filters.area}>
                <option value="">Alle fem områder</option>
                {areas.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <label>
              <span>
                <PawPrint size={15} /> Dyreart
              </span>
              <select name="species" defaultValue={filters.species}>
                <option value="">Hund og katt</option>
                <option value="dog">Hund</option>
                <option value="cat">Katt</option>
              </select>
            </label>
            <label>
              <span>
                <ListFilter size={15} /> Behandling
              </span>
              <select name="category" defaultValue={filters.category}>
                <option value="">Alle behandlinger</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <button className="button button-dark" type="submit">
              <Search size={18} /> Finn priser
            </button>
          </div>
          <details
            className="advanced-filters"
            open={Boolean(filters.q || filters.variant || filters.sort)}
          >
            <summary>
              <SlidersHorizontal size={14} /> Flere valg og sortering
            </summary>
            <div className="advanced-grid">
              <label>
                <span>Søk etter klinikk eller sted</span>
                <input
                  name="q"
                  type="search"
                  placeholder="Klinikknavn eller sted …"
                  defaultValue={filters.q}
                  maxLength={100}
                />
              </label>
              <label>
                <span>Sammenlignbar behandling / pakke</span>
                <select name="variant" defaultValue={filters.variant}>
                  <option value="">Alle varianter</option>
                  {variants.map(([key, t]) => (
                    <option key={key} value={key}>
                      {t.category} · {treatmentLabel(t)} · {t.packageLabel}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Sorter etter</span>
                <select name="sort" defaultValue={filters.sort || 'name'}>
                  <option value="name">Klinikknavn</option>
                  <option value="price">Pris innen samme pakke</option>
                </select>
              </label>
            </div>
            <p className="filter-help">
              Velg en pakke for prissortering. Fastpriser, fra-priser og intervaller vises hver for
              seg. Mva. og tillegg kan påvirke sluttprisen.
            </p>
          </details>
        </form>
        <div className="results-heading">
          <h3>
            {offers.length} {offers.length === 1 ? 'pris' : 'priser'}
            <span>{demo ? 'i eksempelvisningen' : 'i utvalget ditt'}</span>
          </h3>
          <a href={demo ? '/?demo=1#sammenlign' : '/#sammenlign'}>
            Nullstill filtre <RefreshCw size={13} />
          </a>
        </div>
        {catalog.error && (
          <div className="error-message" role="alert">
            {catalog.error}
          </div>
        )}
        {filters.sort === 'price' && !comparable && offers.length > 0 && (
          <div className="notice compact">
            <Info size={17} />
            <p>
              Tilbudene gjelder ulike behandlinger eller pakker. Vi viser klinikknavn i stedet for
              en misvisende prisrangering. Velg én pakke under «Flere valg».
            </p>
          </div>
        )}
        <div className="results-list">
          {offers.map((o) => (
            <OfferCard key={o.id} offer={o} clinic={clinicMap.get(o.clinicId)!} demo={demo} />
          ))}
          {offers.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon">
                <Search size={28} />
              </span>
              <h3>
                {catalog.offers.length
                  ? 'Ingen priser passer til søket ditt'
                  : 'Her kommer mer oversikt'}
              </h3>
              <p>
                {catalog.offers.length
                  ? 'Prøv et annet område eller en annen behandling. Vi har foreløpig et lite utvalg.'
                  : 'Ingen ekte priser er publisert ennå. Vi publiserer først når klinikk, kilde og pris er kontrollert.'}
              </p>
              <a
                className="button button-outline"
                href={
                  catalog.offers.length
                    ? demo
                      ? '/?demo=1#sammenlign'
                      : '/#sammenlign'
                    : '/?demo=1#sammenlign'
                }
              >
                {catalog.offers.length
                  ? 'Vis alle priser'
                  : 'Se hvordan sammenligningen vil fungere'}
                <ArrowRight size={16} />
              </a>
            </div>
          )}
        </div>
        <p className="results-disclaimer">
          Prisen er én del av valget. Dyrets behov, klinikkens kompetanse og innholdet i
          behandlingen er også viktig.
        </p>
      </section>
      <section className="how-section" id="slik-fungerer-det">
        <div className="shell">
          <div className="section-heading">
            <div>
              <span className="overline">TRYGGERE VALG, STEG FOR STEG</span>
              <h2>Oversikt uten overraskelser.</h2>
            </div>
            <p>
              Vi gjør prisinformasjon enklere å forstå.
              <br />
              Du tar valget sammen med veterinæren.
            </p>
          </div>
          <div className="how-grid">
            {[
              {
                icon: Search,
                title: 'Finn riktig behandling',
                text: 'Velg hund eller katt, behandling og området som passer deg.',
              },
              {
                icon: CircleCheck,
                title: 'Se hva du sammenligner',
                text: 'Se pakkens innhold, kjente tillegg og om prisen er fast eller en fra-pris.',
              },
              {
                icon: ShieldCheck,
                title: 'Sjekk kilden selv',
                text: 'Ekte priser får en offisiell kildelenke og dato for siste kontroll.',
              },
            ].map((item, i) => (
              <article key={item.title}>
                <div className="how-number">
                  0{i + 1}
                  <item.icon size={21} />
                </div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
          <div className="care-note">
            <Sparkles size={21} />
            <p>
              <strong>For deg som vil gjøre et godt valg.</strong> Dyrpris er en uavhengig
              sammenligningstjeneste under utvikling. Vi viser ikke betalte plasseringer.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
