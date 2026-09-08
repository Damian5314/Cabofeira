# Product- en releaseaudit — 7 september 2026

## Uitgangspunt

Broncode en aanwezige SQL onderzocht; geen toegang tot daadwerkelijk toegepaste databaseobjecten aangenomen. Geen productiedata veranderd, geen deployment, geen history rewrite. Bestaande wijzigingen in .planning en .claude behouden. Oude afgevinkte requirements zijn geen betrouwbaar bewijs: CAPTCHA, notificatiebel en blokkeren waren niet in de frontend aanwezig.

## Lokaal aangepakt

- Eigen advertenties: serverpaginering inclusief verkochte/verborgen advertenties; foutmeldingen bij verwijderen en statuswijzigingen.
- Favorieten: afzonderlijke gepagineerde productopvraging, ook buiten de homepagecache; mutatiefouten zichtbaar, dubbelklikken begrensd en accountwissels beschermd.
- Productdetails: opnieuw ophalen bij navigatie, reset galerij/contactvensters, verkochte badge, null-veilige verkoper, alleen actieve soortgelijke advertenties.
- Veilige interne loginredirects; niet-werkende sociale login en remember-me verwijderd; profiel opslaan wacht op resultaat.
- Zoekterm geciteerd voor PostgREST-filtergrammatica; stabiele sortering; zoek-URL-wijzigingen synchroniseren met filters; navbarzoekveld remount niet meer bij iedere letter.
- Plaatsen: gratis lanceerjaar, geen onuitvoerbare betaalpromotie; ontbrekende edit-advertentie afgehandeld; eindige prijs en getrimde tekstvalidatie; JPEG/PNG/WebP, gedeeltelijk mislukte uploads behouden succesvolle resultaten.
- Geen willekeurige stockfoto meer bij lege advertentie. Lokale neutrale beeldfallback.
- Rapportredenen als vaste codes en herhaalde melding vriendelijk afgehandeld.
- WhatsApp-contact, kopieerfouten zichtbaar, openbare verkopersadvertenties en blokkeerknoppen.
- Chat: bescherming tegen late antwoorden van andere gesprekken, deduplicatie realtime/optimistische berichten, ongelezen teller verversen en accountwisseling beschermen.
- Eerlijke contactpagina zonder nepverzending, neptelefoon of nepkantoor. Tweetalige informatiepagina's en werkende /terms en /privacy routes. Dit zijn productteksten, geen afgeronde juridische beoordeling.
- Admin ziet alle advertentiestatussen. Beheerlogboek kan bestaande records lezen. Prijsinstellingen tijdens gratis fase uitgeschakeld.

## Kritieke open voorwaarden

1. **Live SQL controleren en staging testen.** security_guards.sql verwijst naar seller_verified, terwijl drop_seller_denorm.sql die kolom verwijdert. Combinatie kan posten, wijzigen en views laten falen. live_hardening_review.sql ondersteunt beide schema's.
2. **Chatnotificatietrigger corrigeren.** notify_new_message roept create_notification aan voor de ontvanger, maar auth.uid() blijft de afzender ondanks SECURITY DEFINER. Daardoor kan de hele berichtinsert falen. Reviewbestand doet de insert in de vertrouwde trigger zonder de publieke RPC open te zetten.
3. **Gespreksintegriteit.** Oude INSERT-policy controleert alleen buyer_id. Reviewbestand vereist dat seller_id echt de eigenaar van een actieve advertentie is en dat er geen blokkade is.
4. **Publieke profielgegevens.** profiles_select_all maakt ook emails, telefoons en bio van niet-verkopende accounts opvraagbaar. Minder data ophalen in de frontend lost dit NIET op. Nodig: private accountgegevens scheiden van publieke verkopersgegevens en alle joins/auth-/adminqueries gecoördineerd aanpassen en testen. Geen blind beleid wijzigen op live.
5. **CAPTCHA is niet aangesloten.** De voorbeeldconfiguratie vermeldt zelf uitstel. Voor signup Supabase Auth CAPTCHA configureren; voor posten is een servermatige verificatiegrens nodig die directe inserts niet omzeilen. Alleen een frontendwidget is onvoldoende.
6. **Support en privacy.** Echte mailbox, verantwoordelijke exploitant, bewaartermijnen, werkend verwijderingsproces voor foto's en passende privacy-/voorwaardencontrole ontbreken. Account-RPC verwijdert geen Storage-objecten. Audit actor-FK kan verwijdering van een admin blokkeren.
7. **Uploadrestricties servermatig toepassen.** Nieuwe SQL zet 5 MiB en MIME-allowlist op bucket; frontendvalidatie alleen beveiligt de API niet. Content-inspectie blijft nodig voor sterkere bescherming.
8. **Adminaudit vastleggen.** admin_audit_capture_review.sql legt wijzigingen transactioneel vast in triggers; frontendlogboek alleen is geen auditgarantie. Test de gevolgen van actor-FK en cascadeverwijderingen.

## Nog te voltooien productwerk

- Notificatiecentrum en bel zijn lokaal toegevoegd; live fan-out en ongelezen belbadge nog verifiëren/aanvullen.
- Beheerbare lijst van geblokkeerde accounts lokaal toegevoegd; nog met twee stagingaccounts testen.
- Chatgeschiedenispaginering: momenteel worden de laatste 100 berichten geladen; oudere geschiedenis moet bereikbaar worden. Ongelezen telling kan de Supabase-resultaatlimiet bereiken; verplaats aggregatie naar beveiligde SQL/RPC.
- Herstel bij offlineverbindingen, retries en complete cross-account/realtime QA; werkelijke fouten onderscheiden van niet gevonden bij detail-opvraging.
- Adminlokalisatie, rapportfilter, nauwkeurige account-/advertentiestatistieken en serverpaginering van gebruikers/rapporten.
- Toegankelijkheid: modalfocustrap, labels, toetsenbordbediening en screenreadercontrole; mobiel visueel testen.
- Fotoverkleining, opruimen afgebroken uploads, veilige accountverwijdering met Storage-cleanup.
- Vermijden willekeurige externe media in legacyadvertenties, ontbrekende demo-assets controleren.
- Vercel-domein direct koppelen aan cabofeira.com in plaats van enkel redirect; DNS, TLS, canonical URL, social previews, sitemap en crawlbare advertentiepagina's beoordelen.
- Dependency-audit en upgradeplan voor verouderde CRA-toolchain; geen blinde npm audit fix --force.
- Bewaking, back-ups plus aantoonbare restoretest, e-mailbezorging, abuse-rate-limits, auditlogretentie en foutregistratie.
- Lanceringsdatum vastleggen; pas daarna tarieven onderzoeken op lokale adoptie en kosten. Geen betalingsprovider nodig voor deze gratis fase.

## Verificatie

Bronbestanden door Babel-parser; EN/PT-sleutelsets gelijk en alle statische t()-sleutels aanwezig. Productiebuild succesvol. 13 redirect-/WhatsApp-checks geslaagd; 460 vertaalsleutels gelijk. Lokale browser: contact, voorwaarden, Portugese taalwissel en twee opeenvolgende navbarzoekopdrachten gecontroleerd. Geen claims over live RLS of accountgebaseerde E2E-tests.

Staging-QA met twee gewone accounts en één admin: registratie/bevestiging/reset; plaats/edit/sold/reactivate/delete; oude favorieten; 25+ eigen advertenties; komma/quotes/procent in zoektermen; berichten snel wisselen en gelijktijdig verzenden; blokkeren beide kanten; herhaalde reports; adminrollen/prijzen/log; upload verkeerde MIME en >5 MiB via directe API; privilege-escalatie, advertentiediefstal en ander gesprek lezen via directe API moeten geweigerd worden.

Technische referenties: https://supabase.com/docs/guides/database/functions en https://supabase.com/docs/guides/storage/uploads/file-limits .
