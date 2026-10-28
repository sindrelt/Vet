# Kontrollert 28. oktober 2026

Dette beskriver lokal verifikasjon, ikke en offentlig produksjonssetting.

| Kontroll                             | Resultat                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `npm test`                           | 48 bestått, ingen hoppet over. Inkluderer PostgreSQL-integrasjon.                               |
| `npm run test:e2e` med lokal Chrome  | 12 bestått: 6 flyter på desktop og 6 på mobil (iPhone 13-størrelse i Chromium).                 |
| `npm run typecheck`                  | Bestått.                                                                                        |
| `npm run build`                      | Produksjonsbygg bestått.                                                                        |
| `npm run db:migrate`, gjentatt       | Bestått; kontrollsummer og migreringslås fungerer.                                              |
| `npm run db:check`                   | Databasen tilgjengelig; 0 ekte klinikker, 0 priser og 0 forslag.                                |
| `npm run setup:local`, gjentatt      | Eksisterende lokal konfigurasjon bevart.                                                        |
| Docker Compose-konfigurasjon         | Validert med `config --quiet`.                                                                  |
| `npm audit --omit=dev`               | Ingen kjente sårbarheter rapportert i kjøretidsavhengigheter på kontrolldatoen.                 |
| Prisinnhenting uten aktiverte kilder | Stopper med exitkode 1 og forklarende melding, uten nettbesøk. Ikke en bestått live-innhenting. |
| Ekte klinikkpriser                   | Ikke verifisert. Proxy avviste klinikkdomener med HTTP 403.                                     |
| GitHub API                           | Blokkert av proxy med HTTP 403 på CONNECT til `api.github.com`.                                 |

Enhets- og databaseprøvene dekker norske beløp og heltallsøre, fra-pris/intervall/ukjent, avvisning av tvetydige priser, HTML/PDF-uttrekk, feil ved endret/manglende rad, robots-policy, HTTP-retry og størrelsesgrenser, områdefiltrering, sammenlignbarhet, duplikater, godkjenning/avvisning, samtidige vurderinger, historikk og at publiserte priser bevares ved innhentingsfeil. Testene bruker lokale syntetiske dokumenter og mockede nettverkssvar, aldri løpende klinikkbesøk.

Nettleserprøvene tester også reell POST fra godkjenningsskjemaet til serveren og publisering i testdatabasen. Uinnlogget administrasjon og skrive-API returnerer 401, og feil eller manglende Origin gir 403. Deaktivert administrasjon ved manglende/kort passord dekkes av enhetstest. Eksempeldata legges aldri i den vanlige databasen. Testdatabaser er separate og data ryddes opp.

Desktop- og mobilskjermbilder ble også inspisert visuelt. Ingen horisontal rulling ved de testede skjermbreddene. Det er ikke gjort en full manuell tilgjengelighetsrevisjon eller testing på fysisk iPhone/Safari.

Ingen betalt tjeneste, kundekonto, booking, betaling, omtaler, offentlig utrulling eller planlagt innhenting er opprettet. For å fullføre den reelle piloten, følg [pilotplanen](pilot.md).
