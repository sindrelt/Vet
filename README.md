# Dyrpris

En norsk nettapp for å sammenligne veterinærpriser. Bygget i det eksisterende `sindrelt/Vet`-repoet med Next.js 16, React 19, TypeScript og PostgreSQL 17.

**Status:** Søkeside, eksempelvisning, klinikksider, database, prishistorikk og beskyttet godkjenningsflyt er implementert. Det finnes **ingen verifiserte klinikker eller ekte priser** i leveransen. Nettverkspolicyen i skymiljøet blokkerte klinikkenes nettsteder. Pilot fra 2–3 faktiske avdelinger gjenstår; generelle HTML/PDF-adaptere er testet bare mot syntetiske, lagrede kilder. Se [pilotstatus og fremgangsmåte](docs/pilot.md).

## Start lokalt

Du trenger Node.js 22.13 eller nyere (Node 24 er testet), npm og Docker med Compose.

```sh
npm ci
npm run setup:local
docker compose --env-file .env.local up -d db
npm run db:migrate
npm run db:check
npm run dev
```

`setup:local` lager `.env.local` med tilfeldige database- og administratorpassord. Den overskriver aldri en eksisterende fil. Filen er ignorert av Git. Hvis du vil konfigurere selv, bruk `.env.example` som mal, og erstatt alle `CHANGE_ME`-verdier. `POSTGRES_PASSWORD` må være samme passord som i `DATABASE_URL`.

Åpne **http://localhost:3000** i nettleseren din. Dette er en lokal utviklingsadresse, ingen offentlig publisering. I et eksternt skymiljø må du bruke plattformens støttede portvideresending til port 3000; denne onboarding-visningen har ingen innebygd nettforhåndsvisning. Alternativt kjører du prosjektet på egen maskin.

- `/`: bare godkjente databasepriser, med tydelig tomtilstand ved null dekning.
- `/?demo=1`: separat eksempelvisning. Klinikknavn og priser er fiktive. Ingen eksempeldata legges i databasen.
- `/klinikk/<slug>`: avdelingens priser, kontakt og kildegrunnlag.
- `/admin`: nettleseren ber om brukernavn og passord fra `.env.local`.
- `/api/health`: 200 bare når databaseskjemaet er tilgjengelig, ellers 503.

I det klargjorte skymiljøet kjører PostgreSQL allerede som `vet-postgres`, med volumet `vet-postgres-data`. Start den igjen med `docker start vet-postgres` om nødvendig; ikke start en ekstra Compose-database på samme port. De lokale passordene ligger i den ignorerte `.env.local`-filen. Bruk `npm run db:check` før oppstart.

Migreringene er SQL-filer i `migrations/`, med kontrollsummer og låsing slik at gjentatte kjøringer er trygge. Endre aldri en allerede kjørt migrering; lag en ny. PostgreSQL-data ligger i Docker-volumet og overlever containeromstart. `docker compose down` beholder volumet; **ikke bruk `down -v`** hvis du vil beholde dataene. En databasebackup er fortsatt nødvendig før en eventuell produksjonssetting.

## Teknisk oppbygning

Ett prosjekt med serverrenderte React-sider og en separat Node/TypeScript-jobb (`npm run collect`). **Drizzle** gir typesikre databaseoppslag og et tydelig TypeScript-skjema. Lesbare SQL-migreringer håndhever også regler i databasen. Godkjenning bruker PostgreSQL-transaksjoner og låser, slik at to administratorhandlinger ikke kan publisere samme forslag to ganger.

- `src/app`: søk, klinikksider, administrasjon og serverruter.
- `src/db/schema.ts` og `migrations/`: klinikkjede, fysisk avdeling, behandling, kilde, publisert tilbud, forslag og historikk.
- `src/lib/collector`: prisnormalisering, hensynsfull henting og separate HTML/PDF-adaptere.
- `src/lib/server`: database, serverautentisering og godkjenning. Hemmeligheter brukes bare her eller i serverjobber.
- `src/lib/demo.ts`: isolerte, syntetiske eksempeldata.

### Områder og sammenlignbarhet

Søkeområdene er Modum, Ringerike, Øvre Eiker, Nedre Eiker og Drammen. Hver fysisk avdeling har **ett** lokalt søkeområde samt gjeldende kommune. En avdeling i Nedre Eiker registreres med kommune Drammen og område Nedre Eiker. «Alle fem» viser avdelingen én gang; valget Drammen viser området Drammen, ikke hele dagens kommune. Grenser og besøksadresse må verifiseres manuelt ved registrering; nettstedets markedsføringsområde er ikke nok. Unike avdelingsnøkler og behandlingsnøkler hindrer duplikater.

Beløp lagres som heltall i øre i validerte pris-snapshots, med `null` for manglende pris. Pristypene er fastpris, fra-pris, intervall og ukjent. Behandlinger inkluderer art, kjønn, vektgrenser og en manuelt kontrollert pakkedefinisjon. Prisrangering krever samme variant, inkluderte tjenester, kjente tillegg og mva.-status. Fastpriser kommer i egen gruppe, deretter fra-priser, intervaller og ukjent; en fra-pris regnes aldri som et bindende billigst-tilbud. Mva. som ikke fremgår, merkes «ikke oppgitt». Ingen pakker settes automatisk som likeverdige.

### Innhenting og godkjenning

```sh
# Først etter kontroll av identitet, geografi, vilkår, robots og prisinnhold:
npm run source:register -- /absolutt/sti/til/verifisert-kilde.json
npm run collect
```

Detaljert registreringsformat og oppstart av ekte pilot står i [docs/pilot.md](docs/pilot.md). Sett `COLLECTOR_CONTACT` til en ekte kontaktadresse før live kjøring. En kilde må være eksplisitt aktivert, ha gjennomgåtte vilkår (maks 90 dager) og tillates av robots.txt. Feil ved robots.txt stopper innhentingen, også 404; slike nettsteder krever separat vurdering før eventuell tilpasning av policyhåndteringen.

Jobben besøker kildene **bare når du starter den**. Den bruker proxyinnstillingene som finnes, HTTPS-verifisering, identifiserbar User-Agent, minst 2,5 sekunder mellom forespørsler per vert, 15 sekunders tidsavbrudd, maksimalt ett nytt forsøk ved midlertidige HTTP-feil, og maks 5 MB per prisdokument. `Retry-After` og robots-pause respekteres innen en 30-sekunders grense; lengre krav stopper jobben. Redirect, blokkeringer, innlogging og ukjent filtype stoppes. Ingen betalte AI-API-er brukes. HTML behandles som data, ikke kjørbar kode. PDF-parseren er støttet, men ingen faktisk klinikk-PDF er verifisert.

Alle forventede rader må kunne tolkes før forslag opprettes. Manglende pris, endret nettside eller hentefeil sletter aldri publiserte tilbud. Dato for siste vellykkede kontroll vises, og priser eldre enn 30 dager får varsel. Ved endring venter forslaget i `/admin`; publiserte beløp og kontrolltid forblir uendret til godkjenning. Uendret, bekreftet innhold kan oppdatere kontrolldato uten ny pris. Avviste forslag med samme innhold og utgangspunkt gjentas ikke. Godkjent historikk beholdes også når en tidligere pris kommer tilbake.

**Ingen cron-jobb, timer eller ekstern tidsplan er aktivert.** Kommandoen kan senere kjøres av en planlegger, men aktivering krever en egen bestilling. Ikke legg til en tidsplan under oppsett.

## Tester og bygg

```sh
npm run test:setup   # Oppretter isolerte lokale testdatabaser
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

`TEST_DATABASE_URL` og `E2E_DATABASE_URL` opprettes av `test:setup` i `.env.local`. De må peke til separate testdatabaser med navn som slutter på `_test`. **Testene tømmer disse databasene. Bruk aldri produksjonsdata.** Uten `TEST_DATABASE_URL` markeres databaseintegrasjonstestene som hoppet over; det er ikke en bestått databasekontroll. Nettlesertestene krever `E2E_DATABASE_URL` og et ferdig produksjonsbygg. De starter sin egen server på port 3001, bruker et tilfeldig testpassord og rydder sine syntetiske data.

Hvis Playwrights nedlasting er blokkert, kan en installert Chrome brukes:

```sh
CHROME_PATH=/full/sti/til/chrome npm run test:e2e
# I dette skymiljøet er den installerte stien:
CHROME_PATH=/workspace/Vet/.local/chrome/opt/google/chrome/chrome npm run test:e2e
```

Testene dekker presise pengeverdier, ugyldige/manglende beløp, HTML- og ekte PDF-byteparsing mot **syntetiske lokale fixtures**, filtrering, områdeoverlapp, sorteringsregler, duplikater, godkjenning/avvisning, samtidighet, historikk og feil ved innhenting. Playwright tester søk, tomtilstand, klinikkside, publisering, innlogging og CSRF på både desktop og mobil. Skjermbilder lagres lokalt i `test-results/`.

For produksjonsmodus lokalt:

```sh
npm run build
npm start
```

## Før offentlig drift

Dette prosjektet er ikke offentlig publisert. Før eventuell publisering må du:

1. Fullføre kildekartleggingen og teste en faktisk pilot fra 2–3 avdelinger, inkludert adresser, pakkeinnhold, robots.txt og bruksvilkår.
2. Bruke HTTPS og et sterkt, unikt `ADMIN_PASSWORD` (minst 20 tegn); uten dette er administrasjonen stengt med 503. HTTP Basic er bevisst enkelt for én administrator, og krever HTTPS i drift. Legg gjerne administrasjonen bak en gateway med påloggingsbegrensning/VPN. Skjult URL er aldri beskyttelsen.
3. Sette `APP_ORIGIN` til den eksakte HTTPS-adressen. Skrive-API-et krever innlogging og samme `Origin` for å hindre CSRF. Hemmeligheter skal aldri få `NEXT_PUBLIC_`-prefiks, legges i kildekode eller deles i chat.
4. Bruke en varig PostgreSQL-tjeneste du selv har godkjent, begrenset databaserolle og testede sikkerhetskopier. Ingen betalt tjeneste er opprettet.
5. Gjennomgå personvern, vilkår og driftsrutiner. Ikke aktiver planlagt innhenting før du ønsker det.

### Kjente begrensninger

Ingen ekte klinikkavdeling, besøksadresse, offisiell prisside eller live-adapter er verifisert. Kildekartlegging og innhenting er dermed **ikke ferdig levert**, selv om lokal mekanikk fungerer. Adapterne forventer eksakte tabellrader eller PDF-linjer og må konfigureres/testes mot hver faktisk kilde. Ingen nettleserautomatikk for dynamiske klinikksider er lagt til uten dokumentert behov. Ikke anta felles priser i en kjede. Det finnes ingen kundekontoer, booking, betaling eller omtaler.
