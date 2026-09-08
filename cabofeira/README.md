# CaboFeira

Tweetalige advertentiemarktplaats voor de negen bewoonde eilanden van Kaapverdië. React 19 + Create React App, Supabase Auth/Postgres/Storage/Realtime. Kopers en verkopers regelen hun transactie rechtstreeks; CaboFeira verwerkt geen betalingen.

## Productafspraken

- De site is al live op https://cabofeira.vercel.app; cabofeira.com verwijst daarheen.
- Het eerste jaar vanaf lancering is gratis voor iedereen. Geen automatische betaalactivatie, geen betalingsprovider. De exacte lanceringsdatum moet nog vastgelegd worden.
- Er is nog geen supportmailbox. De contactpagina zegt dit eerlijk; stel REACT_APP_SUPPORT_EMAIL in zodra er een echte mailbox is.
- De eigenaar heeft Nederland bevestigd als land van juridische exploitatie. Er is nog geen KVK-registratie; definitieve exploitantgegevens en een privacycontact moeten nog worden vastgelegd.
- Nieuwe tekst bestaat in Engels en Portugees (pt-CV).
- Geen destructieve databasewijzigingen zonder expliciete toestemming van de eigenaar.

## Lokaal ontwikkelen

Gebruik Node 22 en npm. In deze map:

```sh
npm ci
cp .env.example .env.local
npm start
npm run build
```

Vul de Supabase URL en publieke anon/publishable key in. Gebruik bij voorkeur een apart testproject. REACT_APP_ variabelen zijn openbaar in de browser: zet daar nooit een service-role key of geheim in. Een service-role key is niet nodig om de frontend te bouwen of te draaien.

## Code

- src/pages: advertenties, zoeken, eigen advertenties, favorieten, verkopers, berichten, account, beheer en informatie.
- src/context: authenticatie, producten, prijzen en ongelezen berichten.
- src/i18n: alle vertalingen.
- supabase: handmatig te beoordelen SQL; geen automatische migraties.
- docs/RELEASE-AUDIT.md: bevindingen, resterende releasevoorwaarden en QA.
- [Volledige audit 8 september 2026](docs/FULL-AUDIT-2026-09-08.md): feature-inventaris, fixes, security/WCAG/responsive-bevindingen, testresultaten en productbacklog. Bevat ook instructies voor een volledig lokale synthetische testomgeving.

## Database en uitrollen

Voer schema.sql alleen op een leeg testproject uit. Voer nooit blind alle SQL-bestanden uit: oude bestanden bevatten kolomverwijderingen, backfills en vervanging van policies. Er bestaat nog geen betrouwbare automatisch geteste migratieketen.

De bestanden live_hardening_review.sql en admin_audit_capture_review.sql zijn voorstellen en zijn NIET uitgevoerd. Test ze eerst op staging, vergelijk met de daadwerkelijk toegepaste schema-/policydefinities en maak een herstelplan. Frontendwijzigingen zijn lokaal voorbereid; geen deployment of push uitgevoerd.

Voor Vercel: project-root cabofeira, build npm run build, output build. Controleer bij deployment dat diepe routes zoals /product/:id, /terms en /reset-password naar de SPA gaan. Supabase Auth moet de echte site-URL en toegestane reset-/bevestigingsredirects kennen.

## Marktwaardigheid

Een geslaagde build bewijst geen werkende RLS, notificatietrigger, e-mailbezorging of herstelbaarheid. Lees de releaseaudit voordat je de aangepaste versie publiceert.
