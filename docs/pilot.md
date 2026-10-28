# Pilotinnhenting – status og aktivering

## Det som faktisk er kontrollert

28. oktober 2026 ble HTTPS-tilgang til `evidensia.no`, `www.modumdyreklinikk.no` og `www.eiker-dyreklinikk.no` forsøkt fra skymiljøet. Proxyen avviste CONNECT med HTTP 403 før kontakt med nettstedene. Responsene bekrefter **bare nettverksblokkeringen**, ikke at de to sistnevnte domenene er korrekte/offisielle eller at klinikker og priser finnes der.

Ingen klinikkidentitet, besøksadresse, område, robots.txt, bruksvilkår eller offisiell pris er derfor verifisert. Ingen live-kilder er registrert eller aktivert. Det finnes **0 ekte priser**. HTML- og PDF-filene i `tests/fixtures/` er laget for tester; de er ikke innhentede klinikkdata.

Et utkast til nettverkstilgang er lagret i miljøinnstillingene for kartlegging av Evidensia, AniCura og mulige lokale nettsteder. Domenene er kun kandidater til undersøkelse, ikke godkjente priskilder. Gå gjennom og lagre endringene i miljøinnstillingene, og publiser miljøkonfigurasjonen slik plattformen krever. Dette er separat fra offentlig publisering av appen. Ved nye redirects eller andre offisielle domener må nødvendige vertsnavn vurderes og tillates gjennom de samme innstillingene; ikke omgå proxyen.

## Slik fullføres faktisk pilot (2–3 avdelinger)

1. Finn offisielle nettsider til faktiske klinikkavdelinger fysisk i de fem søkeområdene. Kontroller navn, besøksadresse, telefon og offisiell hjemmeside. Dokumenter identitetskilden og kontrolltid. Behold Nedre Eiker som eget område med kommune Drammen. Ikke registrer én avdeling i begge områder.
2. Velg 2–3 avdelinger med egne offentlig tilgjengelige prislister. Kartlegg minst noen av konsultasjon, vaksinasjon, ID-merking og kastrering for hund/katt. Noter presise varianter: hann/hunn, kilo, vaksinetype, pakkeinnhold, mva., tillegg og forbehold.
3. Les nettstedets robots.txt og aktuelle bruksvilkår. Hvis innhenting ikke er tillatt eller uklar, avklar tillatelse eller velg en annen kilde. En feil eller manglende robots-fil stoppes av jobben; ikke marker automatisk tillatelse. Ikke omgå tekniske sperrer.
4. Lagre et tillatt eksempel fra hver priskilde som testfixture med kilde og kontrolldato, uten personopplysninger. Lag/juster en separat adapter om kildens struktur krever det. HTML-tabell og PDF med en pris per linje er allerede støttet. Skannede PDF-er/OCR og JavaScript-renderte priser er ikke verifisert.
5. Lag JSON-konfigurasjonen nedenfor med **kun verifiserte opplysninger**. Registrer og test én kilde om gangen. Pakkedefinisjoner gjenbrukes bare etter manuell kontroll av reelt likeverdig innhold.
6. Sett en ekte `COLLECTOR_CONTACT` i `.env.local`, kjør `npm run collect`, og kontroller forslag i `/admin`. Sammenhold originaltekst og live-kilde før publisering. Et ukjent eller manglende beløp skal aldri fylles med null.
7. Dokumenter i denne filen hvilke avdelinger, behandlinger og kildelenker som faktisk er bekreftet, og utvid testene. Behold tidsplanen deaktivert.

## Registreringsformat

Dette er et **format-eksempel med plassholdere, ikke en klinikk eller en fungerende kilde**. Opprett JSON-filen utenfor Git til opplysningene er kontrollert. `source:register` er en lokal administratorjobb, ikke et åpent bruker-API. `enabled: false` er et trygt utgangspunkt; endre til `true` først etter at kontrollene er utført. Kontrolltid settes ved registrering.

```json
{
  "clinic": {
    "id": "VERIFISERT_AVDELINGS_ID",
    "slug": "verifisert-avdelingsnavn",
    "name": "VERIFISERT NAVN",
    "chain": null,
    "municipality": "Drammen",
    "area": "Nedre Eiker",
    "place": "VERIFISERT STED",
    "address": "VERIFISERT BESØKSADRESSE",
    "postalCode": "3050",
    "phone": null,
    "website": "https://OFFISIELT-DOMENE.no"
  },
  "treatments": [
    {
      "id": "vaksine-hund-kontrollert-pakke",
      "category": "Vaksinasjon",
      "species": "dog",
      "sex": "any",
      "weightMinGrams": null,
      "weightMaxGrams": null,
      "packageKey": "KONTROLLERT_PAKKE",
      "packageLabel": "VERIFISERT PAKKEINNHOLD"
    }
  ],
  "source": {
    "id": "VERIFISERT_KILDE_ID",
    "url": "https://OFFISIELT-DOMENE.no/AVDELING/priser",
    "adapter": "html-table",
    "termsUrl": "https://OFFISIELT-DOMENE.no/VILKAAR",
    "termsNote": "Fyll inn hva vilkårene sier og hvorfor denne innhentingen er tillatt.",
    "verifiedIdentityUrl": "https://OFFISIELT-DOMENE.no/AVDELING/kontakt",
    "confirmedPhysicalArea": true,
    "confirmedTermsAllowCollection": true,
    "enabled": false,
    "config": {
      "rowSelector": "table tr",
      "nameSelector": "td:first-child",
      "priceSelector": "td:last-child",
      "rows": [
        {
          "treatmentId": "vaksine-hund-kontrollert-pakke",
          "label": "EKSAKT NAVN I PRISTABELLEN",
          "originalName": "EKSAKT NAVN I PRISTABELLEN",
          "includes": [],
          "extras": [],
          "caveats": ["Fyll inn verifiserte forbehold"],
          "vat": "unspecified"
        }
      ]
    }
  }
}
```

For PDF bruk `adapter: "pdf-lines"`; `label` må være eksakt start på linjen, etterfulgt av pris. Velgere brukes bare av HTML-adapteren. Jobben krever at alle konfigurerte rader finnes én gang. Ukjente formater må føre til feil og manuell kontroll, ikke gjetting.

Tomt `includes` betyr ukjent innhold. Det skal ikke brukes til å anta at flere pakker er likeverdige. Bruk egne `packageKey`-verdier for ukjente/ulike pakker. De manuelle innholdsbeskrivelsene vises sammen med den komplette originalraden i godkjenningsvisningen; kontroller at de fortsatt stemmer ved prisendringer.

På sikt kan vilkår eller struktur endre seg uten at selve beløpet endres. Gå derfor jevnlig gjennom kildene manuelt. Ved pakkeendring opprettes en ny behandlingsvariant og tilpasset kildekonfigurasjon; ikke skriv over historiske definisjoner med ny betydning.
