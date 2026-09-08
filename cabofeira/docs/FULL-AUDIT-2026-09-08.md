# CaboFeira — technische, functionele en beveiligingsaudit

Onderzoek: 7–8 september 2026. Status: lokale reparaties, geen deployment en geen productiegegevens gewijzigd.

## Oordeel

CaboFeira is een herkenbare tweetalige advertentiemarktplaats voor kopers en verkopers op de negen bewoonde eilanden van Kaapverdië. De kern is aanwezig: advertenties, zoeken, accounts, favorieten, chat en moderatie. Het product is **nog niet aantoonbaar klaar voor een professionele brede lancering**. Vooral de ontbrekende geteste migratieketen, openbare profielgegevens, conflicterende SQL-triggers, chatbetrouwbaarheid en operationele inrichting zijn releaseblokkades.

De audit heeft concrete crashes en toegankelijkheidsproblemen gerepareerd. De huisstijl is behouden. Portugees is de standaard; een expliciete Engelse taalkeuze blijft beschikbaar en wordt bewaard. Het eerste jaar vanaf de lancering blijft gratis. Er is geen betaalintegratie toegevoegd.

## Methode en bewijskracht

- README, configuratie, routes, contexten, pagina’s, gedeelde componenten, CSS, vertalingen en SQL/Edge Function zijn onderzocht. De frontend is JavaScript/JSX, React 19, CRA 5. De backend is Supabase Auth/Postgres/Storage/Realtime, geen afzonderlijke Node-productie-API.
- De bestaande werkboom bevatte al wijzigingen uit eerdere werkzaamheden. Dit rapport onderscheidt die van de reparaties tijdens deze audit. Geen bestaande wijzigingen teruggedraaid.
- De productiefrontend is lokaal gebouwd. Voor browsertests draait dezelfde frontend met uitsluitend `http://127.0.0.1:4180` als API en `http://127.0.0.1:4174` als website.
- `scripts/audit-api.cjs` levert 28 fictieve advertenties en een fictieve gebruiker. Mutaties bestaan alleen in procesgeheugen. De server luistert uitsluitend op loopback. De tijdelijke build staat in de genegeerde map `build-audit`.
- Docker is aanwezig maar de daemon draait niet; een echte lokale Supabase/Postgres-stack kon daarom niet worden gestart. De fixture bewijst **geen RLS, SQL-trigger, storage-policy, JWT-validatie, e-mailbezorging of realtimegedrag**. Zoeksortering en keywordmatching zijn in de fixture niet volledig geïmplementeerd.
- Browser: Codex in-app browser, DOM/accessibility tree, schermafbeeldingen, toetsenbord, console en lokale serverrequests. Geen bewijs voor afzonderlijke Chrome-, Edge-, Firefox- of Safari-engines; geen fysiek touchapparaat, mobiel toetsenbord of echte screenreader beschikbaar.
- Geen destructieve securitytests, geen productiemutaties, geen migraties, geen deployment, push of commit uitgevoerd.

Prioriteiten: **Kritiek** = beveiligingsrisico/dataverlies/kernflow kapot; **Hoog** = belangrijke flow ernstig beperkt; **Middel** = merkbare UX/toegankelijkheid/kwaliteit; **Laag** = polish. SQL-bevindingen betreffen de repo-definities; de actuele live toestand is niet vastgesteld.

## Feature-inventarisatie en flowresultaten

| Feature/gebruiker | Aanwezig | Controle en resultaat | Openstaande beperking |
|---|---|---|---|
| Home en categorieën / bezoeker | Actieve advertenties, 12 categorieën, eilanden | Browserweergave en navigatie; categorie-overloop bij 320 px gerepareerd | Home- en categorietotalen komen deels uit de cache van maximaal 200 advertenties |
| Zoeken / koper | Keyword, categorie/subcategorie, eiland, prijs, sortering, paginering, URL-state | Resultaten en gesimuleerde 503; herstel via wissen werkt; foutmelding/retry verbeterd; vertraging van 2 s aangeboden | Echte PostgREST-filtering, sortering en indexprestaties nog integratietesten |
| Advertentiedetail / koper | Afbeelding/fallback, prijs, verkoper, delen, contact, rapporteren, vergelijkbaar | Detail- en verkoperpagina lokaal geopend; fallbacks zichtbaar | Fout bij ophalen wordt nog als niet-gevonden behandeld; native delen/contactaflevering niet bewezen |
| Registratie/auth / gebruiker | Registratie, login, logout, bevestiging opnieuw sturen, herstel/reset | Lokale login, refresh, opnieuw inloggen; sessierace gerepareerd en getest | Echte bevestigings-/resetmail, SMTP, tokenverloop en redirectallowlist niet getest |
| Publiceren / verkoper | Vier stappen, validatie, zes foto’s, 5 MB per foto, JPEG/PNG/WebP, voorbeeld, gratis publicatie | Volledige flow met fictieve advertentie zonder foto afgerond; nieuwe detailpagina zichtbaar | Echte upload, beperkte verbinding, orphan cleanup en servervalidatie niet bewezen |
| Eigen advertenties / verkoper | Paginering, bewerken, verkocht/actief, verwijderen met dialoog | Tweede pagina bereikt; nieuwe testadvertentie gevonden; dialoog en Escape/focus getest | Geen delete uitgevoerd; status-/editmutaties en storage cleanup nog op staging testen |
| Profiel / gebruiker | Naam/telefoon/bio bewerken, statistieken, accountverwijdering | Crash gerepareerd; 26 eigen advertenties na lokale publicatie zichtbaar; statistiektests incl. >1000 records | Accountverwijdering en langdurige sessies niet end-to-end getest |
| Favorieten / koper | Toevoegen/verwijderen, aparte pagina | Opslaan op detail; bewaard na refresh en opnieuw inloggen | Lege/laadstatus toont tijdelijk een nultelling; grotere collecties nog testen |
| Chat / koper en verkoper | Conversaties, berichten, ongelezen teller, realtime, blokkeren | Lege toestand bekeken; frontend- en SQL-paden beoordeeld | Twee echte accounts, notificatietrigger, aflevering, reconnect en gelezenstatus niet bewezen |
| Notificaties/blokkades | Notificatiepagina, gelezenmarkering, blokkeren/deblokkeren | Lege pagina’s geopend; routes bereikbaar | Geen echte notificaties/block policies getest; lege blokkeerlijst mist uitleg |
| Administratie / beheerder | Rollen, verificatie, advertenties, rapporten, auditlog | Gewone gebruiker ziet toegangsweigering; code en SQL geïnspecteerd | Geen echte adminmutaties/rolmatrix getest; veel beheertekst nog Engels |
| Informatie / iedereen | About, contact, FAQ, privacy, voorwaarden, 404 | Contact/privacy/voorwaarden/404 geopend | Nog geen supportmailbox, definitieve juridische gegevens of vastgelegde lanceringsdatum |

## Uitgevoerde fixes tijdens deze audit

| ID | Prioriteit | Probleem en reproductie | Reparatie / verificatie |
|---|---|---|---|
| F01 | Kritiek | Inloggen → `/profile`: blanco pagina, console `reduce is not a function`. `myAds` was een object met alleen `length`, maar werd als array gebruikt | Nieuwe `useSellerStats`: aparte beperkte kolomselectie met paginering, actieve/totale advertenties en views; laad-/fouttoestand; browser hercontrole en regressietests |
| F02 | Hoog | Ingelogd → harde navigatie/refresh naar favorieten: soms loginformulier terwijl navbar al gebruiker toont | Gelijktijdige sessie- en auth-eventaanvragen delen nu dezelfde profielpromise; provider wacht op profiel. Regressietest + refresh/favorieten hercontrole |
| F03 | Middel | Mobiel menu: Escape sluit niet; verborgen links blijven focusbaar | Visibility van gesloten lade, Escape, interne sluitknop, focusbeheer en sluiten bij desktopbreakpoint; toetsenbord gecontroleerd |
| F04 | Middel | Favorietenknop zat binnen een link; ongeldige geneste interactieve elementen | Knop en afbeeldingslink gescheiden, `aria-pressed` toegevoegd; accessibility tree toont zelfstandige knop |
| F05 | Middel | Geen skip-link of centrale main-landmark | Skip-link, één `main`, bestaande geneste mains omgezet; meting toont één main op onderzochte schermen |
| F06 | Middel | Zoeken met falende API kon oude resultaten/lege-resultaattekst tonen | Oude resultaatset wissen bij nieuwe query, herkenbare fout met alert en retry, geen onjuiste lege toestand bij fout |
| F07 | Middel | Verschillende filters en advertentievelden hadden geen gekoppelde labels | Labels/IDs bij zoeken en publiceren; foutrelaties bij publicatie; zoek/sorteerlabels; passwordtoggle toegankelijk via Tab met vertaalde naam |
| F08 | Middel | Verworpen resetrequest liet knop bezig; resetformulier was bruikbaar vóór sessiecontrole | Try/catch/finally, dubbel-submitguard, inputs uit tot geldige sessie; herstelrequest met mislukking en retry getest |
| F09 | Middel | Profielopslaan haalde ook voor gewone gebruiker de hele gebruikerslijst op | Lijst alleen voor admin; late lijstrespons wordt op huidige adminidentiteit gecontroleerd. Backendprivacy blijft apart open |
| F10 | Middel | Engelstalige relatieve datums en contactprijs in Portugese UI | Expliciete locale voor prijs/datums; Intl.RelativeTimeFormat; invalid-date/Infinity-fallback; taaltests |
| F11 | Middel | Categoriegrid had minimum van 280 px binnen smallere container bij 320 px | Minimum begrensd op beschikbare breedte; browser hercontrole geen overloop |
| F12 | Middel | Eigen advertenties toont aantal op huidige pagina als ‘actieve’ totaal, inclusief verkocht | Echte totaaltelling met neutrale tekst; laad-/fouttoestand zonder fictieve nul |
| F13 | Middel | Witte tekst op succesgroen had contrast 3,30:1 | Succes-token donkerder naar #15803d: 5,02:1 op wit; overige combinaties blijven te beoordelen |
| F14 | Middel | Focus, animaties en smalle controls inconsistent | Globale focus-visible, reduced-motion, min-width/reflow, zoekcontrols wrapping, chatwoordafbreking, small-screen advertentieacties onder elkaar |
| F15 | Laag | Bestandsnaam bepaalde extensie ondanks MIME-allowlist | Uploadextensie komt uit bekende MIME-mapping; dit vervangt geen backendbestandinspectie |
| F16 | Laag | Navigeren van bewerken naar nieuwe advertentie kon oude waarden behouden | Nieuwe publicatiemodus reset formulier/stap/fouten |
| F17 | Laag | Manifest heette Create React App Sample; adminweigering Engels | CaboFeira-naam in manifest; toegangsweigering vertaald en h1 |

Eerder voorbereid en behouden: Portugese standaardtaal, veilige interne redirects/WhatsApp-normalisatie, seller/notificatie/blokkeer/auditpagina’s, listing placeholders, gratis lanceringsbeleid, eerlijke contactpagina en twee SQL-reviewvoorstellen. Die zijn niet allemaal tijdens deze audit nieuw toegevoegd.

## Openstaande security- en databasebevindingen

| ID | Prioriteit | Bewijs / impact | Vereiste vervolgactie |
|---|---|---|---|
| S01 | Kritiek | `schema.sql`: `profiles_select_all using (true)` geeft alle profielen inclusief email/phone/bio vrij, niet uitsluitend publieke verkopersinformatie | Splits publieke/private velden of gebruik beperkte view/RPC + passende grants/RLS. Test anon, eigenaar, andere gebruiker, admin; frontendquery alleen aanpassen is onvoldoende |
| S02 | Kritiek | `security_guards.sql` verwijst naar `seller_verified`; `drop_seller_denorm.sql` verwijdert die kolom. Gecombineerd kunnen inserts/updates voor gewone gebruikers falen | Werkelijke trigger/schema-inventaris op staging, gecontroleerde vervanging. Bestaand `live_hardening_review.sql` is voorstel, niet uitgevoerd |
| S03 | Kritiek | `new_message_notification.sql` roept cross-user `create_notification` aan. SECURITY DEFINER verandert `auth.uid()` niet; de RPC weigert gewone afzender → berichttransactie kan terugrollen | Trigger/RPC-scheiding testen met twee accounts; reviewvoorstel beoordelen en migreren na goedkeuring |
| S04 | Hoog | `messages.sql`: conversatie-insert valideert buyer maar niet dat seller eigenaar is van product | Binden seller/product aan serverkant; negatieve IDOR-tests met derde account |
| S05 | Hoog | `reports.sql`: insertpolicy controleert alleen reporter. Client kan status/reviewed_by/reviewed_at kiezen en moderatieworkflow manipuleren | Serverdefaults/guard of beperkte insertgrants; status moet bij aanmaak open en reviewer leeg zijn |
| S06 | Hoog | Producttitel/omschrijving/prijs/categorie/images en berichten missen equivalente servergrenzen. UI-limieten zijn via directe API te omzeilen | Constraints/allowlists, maximumlengten, trim/finite/nonnegative prijzen, maximaal zes toegestane afbeeldingspaden; eerst bestaande data inventariseren |
| S07 | Hoog | Uploadbeleid in basisscripts mist consistente MIME/groottecontrole; publieke storage; account-/advertentieverwijdering kan objecten achterlaten | Bucketlimieten, eigenaarschap, inhoudscontrole/EXIF-beleid, opruimworkflow; nooit blind objecten verwijderen |
| S08 | Hoog | `product_post_log.sql` telt vóór insert zonder gebruikerslock; concurrerende inserts kunnen dezelfde telling zien. Berichten/rapporten hebben geen aangetoonde rate limit | Transactionele serverlimiet; staging concurrentietest; geen stresstest op live |
| S09 | Hoog | Geen betrouwbare versiegestuurde migratieketen; scripts vervangen policies en verwijderen kolommen. Live drift/back-ups/herstel niet vastgesteld | Staging + catalogusdiff + migratiehistorie + hersteltest voor iedere productiewijziging |
| S10 | Hoog | `admin_audit_log.actor_id` heeft restrictieve FK; accountverwijdering kan falen. Cascades wissen conversaties/rapporten; postlog bewaart user-ID; storage blijft mogelijk achter | Expliciet retentie-/anonimiseringsbeleid met herstelplan en gecontroleerde referentieaanpassing |
| S11 | Middel | `is_blocked_pair` accepteert willekeurige IDs; privileges moeten worden gecontroleerd. Mogelijke uitlek van blokkeerrelaties | RPC alleen voor betrokken gebruiker/admin of interne triggerroute; EXECUTE-grants auditen |
| S12 | Middel | Views-RPC kan willekeurige ID verhogen, zonder serverrate limit/statusfilter. Browser-sessionguard is te omzeilen | Beperk scope en telstrategie; analytics niet behandelen als betrouwbaar bewijs |
| S13 | Hoog | Turnstilefunctie is niet verbonden met een afdwingbare insertflow; directe DB-inserts omzeilen captcha. Functie mist strikte methode/tokenvalidatie en timeout | Pas een servergecontroleerde publicatieroute toe indien captcha nodig is; rate limit blijft vereist |
| S14 | Middel | Geen aangetoonde CSP/hosting security headers, monitoring/incidentmeldingen of export-/retentiebeleid | Eerst CSP report-only ontwerpen, toegestane Supabase/afbeeldingshosts vaststellen, headers op staging testen; monitoring zonder tokens/berichtinhoud |

Overige OWASP-controles:

- RLS is ingeschakeld op de onderzochte hoofdtabellen; profielrollen hebben een guard; favorites zijn op eigen user-ID begrensd; berichten-select controleert deelnemer. Dit zijn positieve codebevindingen, geen bevestiging van live policies.
- Frontend gebruikt React-tekstescaping en Supabase-querymethoden; geen aangetoonde applicatie-SQL-stringinjectie. Keywordfilters escapen gereserveerde tekens. Directe databasegrenzen blijven nodig.
- De Edge Function gebruikt een vaste Cloudflare-URL: geen aangetoonde SSRF via een vrij instelbare doel-URL. De wildcard-CORS is op zichzelf geen autorisatiemechanisme.
- Auth verloopt via Supabase; de repo bevat geen eigen wachtwoordhashing. SPA-sessies staan in browseropslag, niet in zelfbeheerde HttpOnly-cookies. SameSite/Secure/HttpOnly zijn daarom geen knop die op deze huidige tokenarchitectuur toepasbaar is. XSS-preventie is belangrijk; een BFF/cookiearchitectuur is een aparte ontwerpkeuze.
- Geen bewezen klassieke cookie-CSRF in de huidige bearer-tokenrequests. Router-serveraction/SSR-advisories zijn niet automatisch toepasbaar op deze client-only app.
- Gerichte patronenscan over 582 tracked paden: geen private-key/AWS/GitHub-token/`sb_secret_`-patroon gevonden. Alleen `.env.example` is tracked. Dit is geen volledige historische secretcertificering. Eerder verwijderde democredentials in gitgeschiedenis moeten voor de echte accounts ongeldig zijn; geen geschiedenis herschreven en geen waarden opgenomen.

## Dependencies

`docs/npm-audit.json` bevat de volledige registry-uitvoer: **61 pakketvermeldingen: 3 critical, 31 high, 13 moderate, 14 low**. Geen automatische force-fix uitgevoerd.

- Critical: `form-data`, `shell-quote`, `websocket-driver`, hoofdzakelijk transitieve CRA/test/dev-tooling. CRA staat in dependencies; npm noemt daardoor ook bouwtooling ‘prod’. Dit is niet hetzelfde als code in de browserbundle.
- `react-router`/`react-router-dom` hebben advisories voor redirects en daarnaast SSR/serverfunctionaliteit. Interne redirects worden lokaal beperkt; de exacte runtime-reikwijdte en een compatibele update moeten apart worden gevalideerd.
- Prioriteit **Hoog**: gecontroleerde dependency-updates, daarna CRA-migratie als eigen traject. Geen downgrade naar `react-scripts@0.0.0` of blind `npm audit fix --force`.

## WCAG 2.2 AA en visueel ontwerp

Geautomatiseerd: lokaal aanwezige axe-core, tags wcag2a/wcag2aa/wcag21aa/wcag22aa, op home, zoeken, profiel, publiceren stap 1, contact en categorieën bij 1440 px. **Geen automatische violations op deze zes snapshots**. Color-contrast staat bij alle zes onder incomplete; contact tevens link-in-text-block. Dit is geen AA-certificaat en dekt niet alle stappen/toestanden.

Handmatig: zelfstandige favorietenknop, menu openen/sluiten, focus in bevestigingsdialoog (Shift+Tab wrap), Escape, labels/landmarks, afbeeldingenfallbacks, smalle acties en portret/landscape. Focusindicator is zichtbaar; navigatiemenu geeft focus terug aan de toggle. Geen echte screenreadertest gedaan.

Nog open, prioriteit **Middel**:

- Alle publicatiestappen/modals/profielvelden met screenreader nalopen; focus naar foutoverzicht/eerste ongeldige veld ontbreekt nog op meerdere formulieren.
- Labels en knopnamen buiten de onderzochte snapshots verder controleren; category-keuze moet geselecteerde toestand ook programmatisch melden.
- Succes-/foutmeldingen overal via consistente live regions; chat laadfouten mogen niet als lege inbox ogen.
- Volledige contrastmatrix inclusief placeholders, badges, hover/focus, disabled, overlays. Berekening: muted #6b7280 op #f7f8fa 4,55:1; primaire blauw/wit 10,57:1; verbeterd succesgroen/wit 5,02:1.
- Echte browserzoom 200%, tekstafstand, 400%-reflow, hardwaretoetsenbord en NVDA/VoiceOver nog testen. Een smalle viewport is geen volledige zoomtest.
- Touch-targets zijn minimaal verbeterd, maar niet alle uitzonderingen/afstanden zijn handmatig bewezen; 24×24 CSS px is AA-minimum met uitzonderingen, 44 px is een bruikbaar ontwerptarget.
- Header/footer blijven huisstijlblauw/geel; geen generieke dashboardrestyling. Emoji-iconen, headingniveaus in footer en resterende Engelse admincopy zijn polish/backlog.

## Responsive en mobiele bevindingen

90 geometriecontroles: 15 routes × breedtes 320/375/768/1024/1440/1920, hoogte 900. Routes: home, search, profile, profile/ads, messages, notifications, profile/blocked, postad, categories, productdetail, seller, contact, privacy, terms en 404. De categoriepagina was de enige gemeten horizontale overloop (320); na fix opnieuw gecontroleerd zonder overloop. Login was eerder op alle zes breedtes gecontroleerd. Publicatievoorbeeld eveneens op alle zes. Gevulde eigen-advertentielijst en publicatievoorbeeld visueel bij 320 gecontroleerd; categorieën ook 900×375 landscape.

De meting controleert documentbreedte/landmarks, geen pixelperfect bewijs voor alle data. Op mobiel waren de advertentieacties smal en woordrijk; bij ≤400 px worden ze nu onder elkaar gezet. Nog te testen: langste echte titels, admin-tabellen, chat met lange geschiedenis, fotogalerij met uploads, softwaretoetsenbord, echte touch, schermoriëntatiewissels en verschillende browserengines.

## Performance en codekwaliteit

| Prioriteit | Bevinding | Aanpak |
|---|---|---|
| Hoog | Geen productie-foutregistratie/error boundary; een renderfout kan hele app leeg maken | Error boundary + privacybewuste errorreporting + alerting |
| Hoog | Chatgeschiedenis stopt op 100; unread haalt mogelijk veel berichten en wordt begrensd door serverlimiet; refreshes herladen veel data | Gepagineerde geschiedenis, serveraggregatie unread, reconnect/resync-test |
| Hoog | Auth-profielobject verandert bij sessie-events; chat-effecten kunnen actieve selectie/draft resetten | Effecten op stabiele account-ID; regressietests met tokenrefresh/accountwisseling |
| Middel | Chat-send mist catch/finally bij werkelijk verworpen promise; loadfout lijkt lege inbox | Betrouwbare loading/error/retry en berichtstatus/idempotentie |
| Middel | Alle routes, inclusief admin, worden eager geïmporteerd | Routecode splitsen op meetbare behoefte; behoud toegangscontrole serverkant |
| Middel | Home haalt tot 200 volledige advertenties met beschrijving/verkoper op; telling is gecapt | Dedicated homepagequery/totalen; serveraggregatie |
| Middel | Keyword `ilike` over titel/omschrijving, exacte counts en weinig samengestelde indices | EXPLAIN op representatieve stagingdata; trigram/fulltext en gerichte indices na meting |
| Middel | Profielstatistieken zijn nu correct maar halen status/views per eigen advertentie op | Bij grote aantallen serveraggregate met juiste RLS |
| Middel | Onvoldoende onderscheid 404/netwerkfout; inconsistent retries; draft niet refreshbestendig | Expliciete result/error contracten en optionele conceptopslag |
| Middel | Afbeeldingen tot 5 MB, geen aantoonbare resize/compressie/EXIF-strip | Thumbnailpipeline en geschikte srcset; objectopruiming |
| Middel | SEO slechts generieke SPA-metadata; geen sitemap/productmetadata/social preview per advertentie | Canonical domein, server/prerender metadata, structured data, sitemap |
| Laag | Oude browserslist-data, testresolvercompatibiliteit CRA/Jest27 vs Router7 | Toolchainonderhoud; router in geïsoleerde componenttest bewust gemockt |

Geen betrouwbare Core Web Vitals-percentielen gemeten: fictieve lokale data en localhost geven geen representatieve netwerk-/veldmeting. Geen N+1 in de product-sellerjoin gevonden; unread/realtimeverversing en paginering zijn wel schaalrisico’s.

## Geprioriteerde productbacklog

Complexiteit: klein = ongeveer 0,5–2 ontwikkelaarsdagen; middel = 3–5; groot = 1–3 weken. Indicatief, inclusief gerichte tests, afhankelijk van bestaande productieconfiguratie.

| Prioriteit | Feature/werk | Gebruiker en waarom | Impact | Complexiteit |
|---|---|---|---|---|
| Must-have | Staging, geteste migraties, herstelbare back-up en RLS-testmatrix | Iedereen; voorkomt dataverlies en ongeautoriseerde toegang | Kritiek | Groot |
| Must-have | Scheiding publieke/private profielen en volledige servervalidatie | Gebruiker; beschermt persoonsgegevens en moderatie | Kritiek | Middel/groot |
| Must-have | Betrouwbare chat/notificaties incl. triggerfix, retries, history en unread | Koper/verkoper; contact is kern van verkoop | Hoog | Groot |
| Must-have | Werkende bevestigings-/resetmail, SMTP en auth-redirectconfiguratie | Accounthouder; kan account veilig bereiken/herstellen | Hoog | Middel |
| Must-have | Supportadres en afhandeling rapporten/contact | Iedereen/beheer; echte hulp en misbruikrespons | Hoog | Klein + operationeel |
| Must-have | Privacy-/retentie-/accountverwijderingsbeleid en uitvoering | Accounthouder; datarechten en veilige verwijdering | Hoog | Middel/groot |
| Must-have | Dependencyonderhoud, headers en foutmonitoring | Iedereen/beheer; veiliger en beheersbaar product | Hoog | Middel/groot |
| Must-have | Lanceringsdatum en definitieve bedrijf/contactgegevens vastleggen | Iedereen; helder gratis jaar en voorwaarden | Hoog | Klein |
| Must-have | Kritieke E2E-tests op echte staging, mobiel en toegankelijkheid | Iedereen; releasekwaliteit aantoonbaar | Hoog | Middel/groot |
| Should-have | Volledige Portugese admin-/foutteksten en consequente states | Beheer/gebruikers; begrijpelijke bediening | Middel | Middel |
| Should-have | SEO/sitemap/social previews en canonical domein | Verkoper/bezoeker; vindbaarheid en delen | Middel/hoog | Middel/groot |
| Should-have | Conceptadvertentie, fotocompressie, uploadherstel/opruiming | Verkoper; minder verlies bij slechte verbinding | Middel | Middel |
| Should-have | Adminfilters, paginering, auditregistratie van alle mutaties | Beheer; schaalbare moderatie/verantwoording | Hoog | Middel |
| Should-have | Privacy-export en notificatievoorkeuren | Gebruiker; controle over eigen data en meldingen | Middel | Middel |
| Should-have | Search indexing/serveraggregaties/caching | Koper; snelle resultaten op mobiel | Middel | Middel |
| Nice-to-have | Opgeslagen zoekopdrachten en opt-in meldingen | Koper; passende advertenties terugvinden | Middel | Middel |
| Nice-to-have | Verkopersreputatie met anti-misbruikontwerp | Koper/verkoper; vertrouwen | Middel | Groot |
| Nice-to-have | Betaalde promoties na gratis jaar, pas na zakelijke inrichting | Verkoper/beheer; monetisatie | Later | Groot |

Geen checkout nodig voor de huidige marktplaats: koper en verkoper handelen rechtstreeks. Geen cookie-banner toegevoegd zonder vastgestelde niet-noodzakelijke tracking. Eventuele analytics/marketingcookies eerst inventariseren en passend toestemmingsbeheer ontwerpen.

## Validatie en bewijsbestanden

- Baseline had geen tests. Nieuwe tests dekken redirects/telefoonnormalisatie, default PT en EN-persistentie, vertaalpariteit, prijs/datumlocale, resetrequest-failure/retry, gelijktijdige profielaanvragen, paginering/statistiekfouten.
- `docs/test-results.json`: Jest-resultaten; laatste controle wordt bij afronding vastgelegd.
- `docs/lint-results.json`: ESLint-resultaten. Afzonderlijk `npm run lint` toegevoegd.
- Productiebuild en geïsoleerde auditbuild uitgevoerd; bundles circa 170 KB JS gzip en 8,8 KB CSS gzip. Exacte einduitvoer staat bij afronding hieronder.
- Geen TypeScriptproject of typecheck-script voor frontend; build/lint zijn geen volledige typecheck. De Deno Edge Function is alleen statisch beoordeeld; Deno-check niet uitgevoerd.
- Console toonde de gerepareerde profielcrash. Fixturelogs tonen product/favorite/profile-requests en opzettelijke 503 bij `audit-error`. Realtime-websocket404 en refresh-tokenfouten zijn beperkingen van de fixture, geen bewijs van live fouten.

### Definitieve controle-uitvoer

| Controle | Resultaat |
|---|---|
| Jest | 6 suites, 16 tests geslaagd, 0 mislukt |
| ESLint | 56 bestanden; 0 fouten, 0 waarschuwingen |
| Auditserver syntax | `node --check scripts/audit-api.cjs` geslaagd |
| Productiebuild | `Compiled successfully`; main JS 170,29 KB gzip, CSS 8,84 KB, extra chunk 1,77 KB |
| Git whitespacecontrole | Geen whitespacefouten; Git meldt wel Windows LF/CRLF-normalisatiewaarschuwingen |
| Resterende toolingwaarschuwing | Browserslist-data 17 maanden oud; Jest meldt Node `punycode`-deprecatie |
| Typecheck | Geen frontendtypecheck ingericht; Deno-check niet uitgevoerd |

## Reproduceerbare lokale audit

Vanuit `cabofeira`, PowerShell (nooit deze override publiceren):

```powershell
$env:REACT_APP_SUPABASE_URL='http://127.0.0.1:4180'
$env:REACT_APP_SUPABASE_ANON_KEY='local-audit-public-key'
$env:BUILD_PATH='build-audit'
npm run build
node scripts/audit-api.cjs
```

Open `http://127.0.0.1:4174`. Fictief account: `buyer@example.test` / `LocalAudit2026!`. Geen echt account of geheim. `search?q=audit-error` simuleert 503; `search?q=audit-slow` vertraagt twee seconden. `?audit-a11y=1` injecteert uitsluitend via de lokale auditserver axe; resultaat staat in DOM-element `audit-accessibility-results`. Restart wist alleen de synthetische in-memory data. Voor een normale build de drie overridevariabelen uit de shell verwijderen of een nieuwe shell gebruiken.

## Gewijzigde bestanden tijdens deze audit

- App/algemeen: `.gitignore`, `package.json`, `public/manifest.json`, `src/App.jsx`, `src/index.css`.
- Componenten: `Navbar.jsx/.css`, `ProductCard.jsx/.css`, `hooks/useDialogFocus.js`.
- Auth/account: `context/AuthContext.jsx`, `pages/Login.jsx`, `Register.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx`, `Profile.jsx/.css`, nieuwe `hooks/useSellerStats.js`.
- Zoeken/publiceren: `Home.jsx`, `Search.jsx/.css`, `PostAd.jsx`, `MyAds.jsx/.css`, `Categories.css`.
- Overig: `Messages.jsx/.css`, `Seller.jsx`, `Notifications.jsx`, `BlockedUsers.jsx`, `ProductInfo.jsx` (main-landmarks); `Admin.jsx`, `ProductDetail.jsx`, `utils/format.js`; beide vertaalbestanden.
- Zes testbestanden: `AuthContext.test.jsx`, `I18nContext.test.jsx`, `useSellerStats.test.jsx`, `ForgotPassword.test.jsx`, `format.test.js`, `links.test.js`.
- Auditmiddelen: `scripts/audit-api.cjs`, dit rapport en JSON-uitvoer in `docs`, quick-plan onder `.planning/quick/260907-rtb-full-technical-functional-accessibility-`.
- De overige wijzigingen in `git status` waren al aanwezig; geen SQL-bestand is tijdens deze audit uitgevoerd of toegepast.

## Wat nog handmatig/extern moet gebeuren

1. Veilige staging-Supabase beschikbaar maken en huidige live schema/policies/grants vergelijken; alle S01–S10 bevindingen toetsen zonder productiegegevens te wijzigen.
2. Back-up terugzetten op lege staging en herstelbaarheid aantonen; daarna migratievoorstel met expliciete goedkeuring voor productie.
3. Echte e-mailbezorging, twee-accounts-chat, uploads, accountverwijdering en adminrechten met testaccounts doorlopen.
4. Definitieve supportmailbox, lanceringsdatum, juridische identiteit/privacycontact en canonical domein vastleggen.
5. WCAG-handtest met NVDA/VoiceOver, echte touch en Chrome/Firefox/Safari/Edge, zoom en mobiel toetsenbord.
6. Monitoring en responsproces activeren; afhankelijkheden gecontroleerd bijwerken. Pas daarna releasebesluit. Deze audit geeft geen toestemming om automatisch te deployen.

Referenties: [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html). Dependencyadvisories staan met directe bronlinks in `npm-audit.json`.
