# CaboFeira — checklist vertrouwen, privacy en toegankelijkheid

Beoordeeld op 8 september 2026 op basis van de lokale code, de eerdere browseraudit en officiële bronnen. De nieuwe wijzigingen zijn niet gedeployd. Geen productiegegevens of databasebeleid gewijzigd. Dit is een controlelijst met open punten, geen verklaring van volledige juridische conformiteit.

## Checklist

| Punt | Resultaat | Actie / resterend werk |
|---|---|---|
| Check colour contrast | Gedeeltelijk gecontroleerd | Eerdere audit: primaire blauw/wit 10,57:1, muted op achtergrond 4,55:1, aangepast succesgroen/wit 5,02:1. Inline groen #10b981 bij bevestigingen en alle badges/disabled/focuscombinaties blijven controleren. Axe gaf incomplete contrastresultaten; geen volledige AA-aftekening. |
| Alt text on images | Verbeterd | Advertenties gebruiken titels als alt; logo heeft alt; uploadfoto’s nu genummerd in PT/EN en publicatievoorbeeld gebruikt advertentietitel. Gebruikersfoto’s kunnen inhoudelijk nog slechte beschrijvingen hebben. |
| Refund policy | Toegevoegd | `/returns` met uitleg: geen platformbetalingen, afspraken met verkoper, onderscheid particulier/professional en behoud van wettelijke rechten. Geen algemene ‘no refunds’-clausule of verzonnen universele bedenktijd. |
| Privacy policy page | Aanwezig, niet af | `/privacy` beschrijft werkelijke gegevensstromen. Naam/contact verwerkingsverantwoordelijke, rechtsgronden per doel, bewaartermijnen, ontvangers/doorgiften, rechten en klachtenroute moeten worden aangevuld zodra exploitant/inrichting bekend zijn. |
| Remove fake reviews | Geen gevonden in actieve frontend | Geen review-/testimonialcomponent of sterrenbeoordeling aangetroffen. Ongebruikte mockadvertenties in `src/data/products.js` zijn geen echte verkopers of reviews en mogen niet als echte activiteit worden gepubliceerd. Geen records uit live database verwijderd. |
| Fix accessibility | Verbeterd, vervolg nodig | Zie volledige audit: menu, focus, skip-link, landmarks, labels, reflow. Nu ook duidelijke fotoverwijderlabels, herstelbare registratie-alert en autocomplete. Screenreader/echte zoom/touch niet volledig afgetekend. |
| T&C’s page | Aanwezig, basis | `/terms` beschrijft bemiddeling, gedrag en transacties; toestemming voor gebruikte foto’s expliciet toegevoegd. Identiteit exploitant, klachten/moderatieprocedures, zakelijke verkopers en relevante dwingende regels nog afronden. |
| Check 3rd party embeds | Geen actieve embeds gevonden | Geen iframe, sociale widget, YouTube, Maps of betaalwidget in actieve frontend. Facebook/WhatsApp zijn externe links, geen embeds. Supabase en Vercel blijven derde dienstverleners. Turnstile-serverfunctie bestaat maar geen gekoppelde frontendcaptcha aangetroffen. |
| Check copyright on images | Niet volledig te bewijzen | Lokale logo-/placeholderassets en door gebruikers geüploade foto’s. Ongebruikte mockdata verwijst naar Picsum; geen actieve import gevonden. Een stock-URL of beschikbaar bestand bewijst geen gebruiksrecht. Leg herkomst/licentie van eigen assets vast; gebruikers moeten bevoegd zijn foto's te publiceren; richt auteursrechtenmeldingen in. Geen willekeurige foto's verwijderd. |
| Cookies policy | Toegevoegd | `/cookies`: sessie, taalvoorkeur, bekeken-advertentieregistratie, serverviewtotalen, externe diensten, verwijderen browserdata en mogelijke technische logs. Browseropslag is expliciet meegenomen; niet alleen klassieke cookies. |
| Check tracking | Geen marketingtracking in actieve broncode gevonden | Geen GA/GTM/Meta/TikTok/Hotjar-script of analyticscallback. `reportWebVitals()` wordt zonder callback aangeroepen. Wel view-RPC + sessionStorage; Supabase/Vercel kunnen logs hebben. Hostinginstellingen, live headers en extern geladen advertentieafbeeldingen apart inventariseren. ‘Geen tracking in code’ is geen bewijs dat de live infrastructuur niets logt. |
| Form consent | Verbeterd | Registratie: niet vooraf aangevinkte voorwaardenacceptatie, privacyinformatie apart als kennisgeving. Privacybeleid is geen algemene toestemming voor alle verwerking. Geen marketingconsent toegevoegd want geen marketingfunctie. Versie/tijdstip van voorwaardenacceptatie is nog niet server-side vastgelegd. |
| Check local laws | Nederland bevestigd; verdere beoordeling nodig | De eigenaar gaat vanuit Nederland exploiteren. Neem de AVG als uitgangspunt en beoordeel platformverplichtingen op de daadwerkelijke dienstverlening en bediende landen. Zie bronanalyse hieronder voor Nederland/EU en Kaapverdië. Geen rechtskeuze, KVK-nummer of wettelijke termijn verzonnen. Gratis aanbieden ontslaat een platform niet automatisch van privacy-/informatieplichten. |
| Clear button labels | Verbeterd | Foto verwijderen heeft nu index; passwordtoggle naam/state; registratieactie blijft duidelijk. Markering ‘Verified’ vraagt een echte verificatieprocedure of een expliciete andere naam: huidige adminflag bewijst op zichzelf geen identiteit of betrouwbare verkoper. |
| Check for cookie consent | Geen generieke banner toegevoegd | Alleen strikt noodzakelijke cookies vragen volgens AP geen toestemming. Classificeer ook taalopslag/viewtelling en eventuele hostinginjecties vóór definitieve conclusie. Als niet-noodzakelijke tracking wordt toegevoegd: blokkeren vóór toestemming, gelijkwaardige weigering, afzonderlijke doelen en eenvoudig intrekken. Een banner zonder daadwerkelijke blokkering is geen oplossing. |
| Add real business details | Open, hoog | Er is nog geen supportmailbox en geen geregistreerde onderneming opgegeven. Nodig: verantwoordelijke naam/handelsnaam, vestigingsland, bruikbaar contact, passend bedrijfsadres en registratienummers indien van toepassing. Persoonlijke gegevens alleen publiceren na bevestiging. Een niet-bestaand KVK-nummer niet toevoegen. |
| Only collect necessary data | Gedeeltelijk | Registratie vraagt nu om weergavenaam in plaats van volledige wettelijke naam; telefoon blijft optioneel en wordt als openbaar toegelicht. Geen geboortedatum, huisadres, ID-document of betaalgegevens toegevoegd. **Kritiek:** huidige repo-RLS maakt profielvelden incl. email/telefoon/bio openbaar; dat moet server-side worden beperkt. Een waarschuwing/checkbox maakt overmatige publicatie niet rechtmatig. |
| Keyboard friendly forms | Verbeterd | Native labels, focus, niet uit tabvolgorde verwijderde passwordtoggle, autocomplete, niet-vooraf-aangevinkt required checkbox. Foutfocus en toetsenbord/screenreadertest van alle formuliertoestanden blijven nodig. |
| Remove unsupported claims | Concrete claim verwijderd | ‘Buyers nearby will see your ad first’ is vervangen door neutrale locatie-instructie; code biedt die voorrang niet. Geen fake garanties toegevoegd. Open: ‘Verified’-criteria, gecapte homepageaantallen en definitieve lanceringsdatum voor ‘eerste jaar gratis’. |

## Belangrijkste blokkades

1. **Kritiek:** publieke profielgegevens in databasebeleid. Zie S01 in de volledige audit. Dit is een technische/privacyfix, geen redactiewerk.
2. **Hoog:** Nederland is bevestigd, maar de identiteit van de exploitant en een bruikbaar contactkanaal ontbreken nog; privacy/voorwaarden kunnen daardoor niet definitief worden gemaakt. Leg ook een procedure voor inzage, correctie en verwijdering vast.
3. **Hoog:** live verwerkersinstellingen, bewaartermijnen, back-upretentie en eventuele datadoorgiften zijn niet vastgesteld.
4. **Middel:** geen aantoonbare verificatieprocedure achter ‘Verified’; leg criteria vast of presenteer de vlag niet als vertrouwen-/identiteitsbewijs.
5. **Middel:** rechten op live advertentiefoto’s en gebruikte merkassets niet uit code af te leiden; licentieregister en meldingsafhandeling nodig.

## Officiële bronnen en betekenis voor CaboFeira

- **Nederland, cookies:** de AP bevestigt dat voor uitsluitend strikt noodzakelijke cookies geen toestemming nodig is. Dit is geen vrijstelling voor alle localStorage of analytics. [AP: foute cookiebanners](https://www.autoriteitpersoonsgegevens.nl/actueel/foute-cookiebanners-aangepast-na-ingrijpen-ap), [Rijksoverheid: cookies](https://www.rijksoverheid.nl/vraag-en-antwoord/telecommunicatie/mag-een-website-ongevraagd-cookies-plaatsen).
- **EU, privacytoepasselijkheid:** de eigenaar heeft Nederland bevestigd als exploitatieland. Voor verwerking in het kader van die EU-vestiging is de AVG relevant, ook als de doelgroep buiten de EU zit. Werk daarom verantwoordelijke/contact, doelen en rechtsgronden, bewaartermijnen, ontvangers/doorgiften en privacyrechten concreet uit. [Europese Commissie: toepasselijkheid](https://commission.europa.eu/law/law-topic/data-protection/reform/rules-business-and-organisations/application-regulation/who-does-data-protection-law-apply_en), [Your Europe: GDPR](https://europa.eu/youreurope/business/governance-and-sustainability/digital-and-data-compliance/data-protection-gdpr/index_en.htm).
- **Nederland, online verkoop/platforms:** duidelijke bedrijfsinformatie en het voorkomen van misleiding zijn belangrijk. CaboFeira is een tussenpersoon; regels voor de professionele verkoper, particuliere verkoper en de platformdienst zijn niet één op één hetzelfde. Controleer ook platformverplichtingen en eventuele DSA/P2B-toepasselijkheid zodra exploitant en zakelijke doelgroep vaststaan. [RVO: online verkoop](https://business.gov.nl/regulations/long-distance-sales-and-purchases/), [Ondernemersplein: online verkoop](https://ondernemersplein.overheid.nl/wetten-en-regels/regels-voor-online-verkoop/).
- **Kaapverdië, privacy:** CNPD publiceert het algemene beschermingskader en de wijziging bij Lei 121/IX/2021. Rechten, verantwoordelijke, beveiliging en eventuele kennisgevings-/doorgifteverplichtingen moeten op de werkelijke inrichting worden beoordeeld. [CNPD: rechten](https://www.cnpd.cv/direitos/), [CNPD: verplichtingen](https://www.cnpd.cv/obrigacoes/), [wetwijziging 2021](https://www.cnpd.cv/wp-content/uploads/2025/03/Lei-121.IX_.2021-alteracao-Lei-41.VIII_.2013.pdf).
- **Kaapverdië, consument:** Lei 88/V/98 beschrijft consumentenbescherming en duidelijke informatie. Daaruit volgt geen reden om zonder analyse een Europese ‘14 dagen’-regel op iedere onderlinge verkoop te plakken. [Banco de Cabo Verde: wettekst](https://www.bcv.cv/pt/Supervisao/Consumidores/Legislacao/Documents/Lei%20n%C2%BA%2088-V-98%20de%2031%20Dezembro%20-%20regime%20jur%C3%ADdico%20de%20protec%C3%A7%C3%A3o%20e%20defesa%20dos%20consumidores.pdf).

De precieze wettelijke plichten blijven afhankelijk van vestiging, professionele/particuliere verkoop, landen waar gebruikers worden bediend en feitelijke verwerkingen. Geen universeel refundbeleid of volledig juridisch keurmerk afgeleid uit deze eerste broncontrole.

Voor de DSA moet de dienst worden geclassificeerd en het aanbieden aan gebruikers in de EU worden beoordeeld. Bepaal welke hosting-/platformregels en eventuele aanvullende marktplaatsregels gelden; niet iedere verplichting geldt automatisch voor deze advertentiedienst zonder checkout. Kleine ondernemingen zijn niet van alle regels vrijgesteld. Leg passende meldings- en moderatieprocedures vast. [ACM: online marktplaatsen](https://www.acm.nl/nl/digitale-economie/online-diensten-aanbieden/online-marktplaatsen), [Europese Commissie: DSA-vragen](https://digital-strategy.ec.europa.eu/nl/faqs/digital-services-act-questions-and-answers).

## Wijzigingen in deze checklistpass

- `src/pages/ProductInfo.jsx`: cookies/browseropslag en retouren/reembolsopagina.
- `src/App.jsx`, `src/components/Footer.jsx`: bereikbare routes en footerlinks.
- `src/pages/Register.jsx`: voorwaardenacceptatie los van privacykennisgeving, weergavenaam, optionele-openbare-telefoonuitleg, autocomplete, alert en required checkbox.
- `src/pages/PostAd.jsx`: vertaalde foto-altteksten en genummerde verwijderlabels.
- `src/i18n/en.json`, `src/i18n/pt-cv.json`: alle nieuwe tekst tweetalig, claim over nabijheidsvoorrang verwijderd, fotorechten in voorwaarden.
- Dit document. Bestaande gegevens/functionaliteit niet verwijderd, geen betaalprovider toegevoegd, geen productieconfiguratie gewijzigd.

Voor de eerdere technische/securitybevindingen en browsermetingen: [volledige audit](FULL-AUDIT-2026-09-08.md).

## Validatie van deze wijzigingen

- Bestaande tests: 6 suites, 16 tests geslaagd.
- ESLint op `src`: geen fouten of waarschuwingen.
- Productiebuild: geslaagd; hoofd-JavaScript 172,55 kB gzip, CSS 8,84 kB gzip.
- De nieuwe beleidspagina’s zijn in deze checklistpass niet opnieuw in de browser getest. De eerdere responsive- en toegankelijkheidsmetingen gelden voor de schermen en toestanden uit de volledige audit, niet automatisch voor deze nieuwe pagina’s.
- Alleen lokale wijzigingen. Geen deployment, productie-databasewijziging of betalingsintegratie uitgevoerd.
