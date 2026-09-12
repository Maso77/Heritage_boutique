-- HERITAGE: pages and FAQ linked from the public footer.
--
-- Prerequisite: run 20260910_admin_portal.sql and 20260911_cms_completion.sql
-- before this file. Existing administrator-written pages and FAQ entries are
-- preserved: this seed only fills an empty installation.

insert into public.legal_pages (page_key, title, content_html, status, published_at)
values
  (
    'mentions-legales',
    'Mentions légales',
    $$
      <h2>Éditeur du site</h2>
      <p>Le présent site est édité par HERITAGE, activité de sélection et de vente de montres, accessoires, parfums et lunettes à Abidjan, Côte d’Ivoire.</p>
      <p>Les coordonnées de contact à jour sont affichées dans le pied de page et sur la page Contact.</p>
      <h2>Informations d’identification à compléter</h2>
      <p>Avant toute mise en production commerciale, HERITAGE doit renseigner sur cette page sa dénomination ou raison sociale, sa forme juridique, son adresse professionnelle complète, son numéro RCCM, son compte contribuable le cas échéant, ainsi que l’identité du responsable de publication.</p>
      <h2>Propriété intellectuelle</h2>
      <p>Les contenus du site, notamment les textes, photographies, logos, visuels, mises en page et éléments graphiques, sont protégés. Toute reproduction, adaptation ou diffusion non autorisée est interdite, sauf accord écrit préalable de leurs titulaires.</p>
      <h2>Disponibilité du site</h2>
      <p>HERITAGE s’efforce de maintenir le site accessible et les informations à jour. Une interruption, une erreur ou une indisponibilité ponctuelle ne crée pas, à elle seule, un droit à indemnisation.</p>
    $$,
    'published',
    now()
  ),
  (
    'cgv',
    'Conditions Générales de Vente',
    $$
      <h2>Objet</h2>
      <p>Les présentes conditions encadrent les demandes et commandes de produits proposées par HERITAGE. Elles s’appliquent sous réserve des informations particulières communiquées pour chaque référence.</p>
      <h2>Produits, prix et disponibilité</h2>
      <p>Les fiches présentent les caractéristiques essentielles, le prix affiché en FCFA et la disponibilité annoncée. Une erreur manifeste, une modification de stock ou une indisponibilité peut conduire HERITAGE à vous proposer une solution ou à ne pas confirmer la demande concernée.</p>
      <h2>Commande et confirmation</h2>
      <p>Une demande transmise sur le site ne vaut pas, à elle seule, acceptation définitive. HERITAGE confirme avec le client la référence, le prix, la disponibilité, les modalités de paiement et les conditions de remise avant toute finalisation.</p>
      <h2>Paiement, remise et transfert</h2>
      <p>Les moyens de paiement acceptés, les éventuels frais et les modalités de remise sont indiqués ou confirmés avant la validation de la commande. Le client doit vérifier l’exactitude de ses coordonnées et des informations transmises.</p>
      <h2>Réclamations</h2>
      <p>Pour toute question relative à une commande, contactez HERITAGE avec la référence de la pièce et les éléments utiles. Les droits impératifs applicables au consommateur demeurent réservés.</p>
      <h2>À valider avant la mise en ligne commerciale</h2>
      <p>Les conditions définitives de paiement, d’annulation, de retour, de garantie et de règlement des litiges doivent être validées par le responsable de HERITAGE avant publication.</p>
    $$,
    'published',
    now()
  ),
  (
    'confidentialite',
    'Données personnelles',
    $$
      <h2>Données concernées</h2>
      <p>Lorsque vous contactez HERITAGE ou passez une demande, les données strictement utiles peuvent inclure votre nom, vos coordonnées, votre adresse e-mail, l’objet de votre demande et son contenu.</p>
      <h2>Finalités</h2>
      <p>Ces données sont utilisées pour répondre à votre demande, préparer ou suivre une commande, assurer le service client et respecter les obligations applicables. Elles ne sont pas utilisées à des fins de prospection sans base appropriée.</p>
      <h2>Accès et confidentialité</h2>
      <p>L’accès aux messages et informations de relation client est limité aux personnes autorisées par HERITAGE. Les données ne sont pas vendues. Elles ne sont communiquées à un prestataire que lorsqu’il est nécessaire au fonctionnement du service ou qu’une obligation le requiert.</p>
      <h2>Durée de conservation</h2>
      <p>Les données sont conservées pendant la durée nécessaire à la finalité concernée, puis archivées ou supprimées selon les obligations applicables et les besoins de preuve.</p>
      <h2>Vos demandes</h2>
      <p>Vous pouvez demander l’accès, la correction ou la suppression de vos données en utilisant les coordonnées de contact affichées sur le site. HERITAGE pourra demander les informations nécessaires pour vérifier votre identité et traiter votre demande.</p>
      <h2>Cadre de référence</h2>
      <p>Cette information doit être lue avec la réglementation ivoirienne applicable à la protection des données à caractère personnel. Les coordonnées et l’identité complète du responsable de traitement doivent être validées par HERITAGE avant la publication commerciale.</p>
    $$,
    'published',
    now()
  ),
  (
    'livraison-retours',
    'Livraison & retours',
    $$
      <h2>Confirmation avant remise</h2>
      <p>Avant toute remise ou livraison, HERITAGE confirme la référence, sa disponibilité, le prix, le lieu et les modalités applicables avec le client.</p>
      <h2>Livraison et remise à Abidjan</h2>
      <p>Les modalités dépendent de la pièce choisie, de sa disponibilité et de la zone concernée. Le délai et les éventuels frais ne sont engageants qu’après confirmation expresse de HERITAGE.</p>
      <h2>Vérification de la pièce</h2>
      <p>Le client est invité à vérifier la référence, l’état apparent et les documents remis avant de finaliser la réception. Toute réserve utile doit être signalée sans délai à HERITAGE.</p>
      <h2>Retours et annulations</h2>
      <p>Les conditions de retour ou d’annulation applicables sont confirmées avant la commande, selon la nature de la pièce et les droits impératifs applicables. Une demande doit être adressée à HERITAGE avec la référence concernée et les éléments utiles.</p>
    $$,
    'published',
    now()
  ),
  (
    'garantie-service',
    'Garantie & entretien',
    $$
      <h2>Garantie applicable</h2>
      <p>La garantie applicable dépend de la référence, de son état et des documents remis avec la pièce. Lorsqu’une garantie fabricant ou vendeur s’applique, sa durée, son étendue et ses exclusions sont communiquées au client avant la finalisation.</p>
      <h2>Ce qui est généralement exclu</h2>
      <p>L’usure normale, les chocs, l’usage non conforme, les dommages liés à l’eau au-delà de l’étanchéité annoncée, les interventions non autorisées et la perte ne sont pas nécessairement couverts. Les documents de garantie remis avec la pièce prévalent.</p>
      <h2>Conseils d’entretien</h2>
      <p>Respectez les recommandations du fabricant concernant l’étanchéité, le nettoyage, la réserve de marche et les révisions. Conservez la facture et les documents remis avec la pièce.</p>
      <h2>Demande de prise en charge</h2>
      <p>Pour une demande de service, contactez HERITAGE en indiquant la référence, la date d’achat et une description précise de la situation. Aucun délai de prise en charge n’est promis avant examen de la demande.</p>
    $$,
    'published',
    now()
  ),
  (
    'authenticite-provenance',
    'Authenticité & provenance',
    $$
      <h2>Une information claire par référence</h2>
      <p>HERITAGE présente pour chaque pièce les informations disponibles sur sa référence, sa marque, ses caractéristiques et sa provenance. Les éléments effectivement remis sont précisés avant la commande.</p>
      <h2>Documents et vérifications</h2>
      <p>Lorsque des documents, cartes, certificats, coffrets ou éléments de garantie accompagnent une pièce, leur disponibilité est indiquée ou confirmée avant la remise. Le client peut poser ses questions sur ces éléments avant de valider son choix.</p>
      <h2>Traçabilité</h2>
      <p>La vérification d’une référence s’effectue à partir des informations propres à la pièce et, le cas échéant, des documents qui l’accompagnent. Aucun document non disponible ne peut être présumé remis.</p>
      <h2>Besoin d’un éclaircissement</h2>
      <p>Pour obtenir un complément sur une montre ou un accessoire précis, contactez HERITAGE avant la commande. Une réponse adaptée sera apportée selon les informations disponibles pour la référence concernée.</p>
    $$,
    'published',
    now()
  ),
  (
    'cookies',
    'Cookies',
    $$
      <h2>À quoi servent les cookies ?</h2>
      <p>Les cookies et technologies similaires peuvent être utilisés pour le bon fonctionnement du site, la mémorisation de vos choix et, lorsque vous l’acceptez, la mesure d’audience ou le suivi marketing configuré par HERITAGE.</p>
      <h2>Votre choix</h2>
      <p>Les cookies non essentiels ne sont activés qu’après votre choix dans le bandeau de consentement. Vous pouvez refuser ces cookies sans empêcher l’accès aux fonctions essentielles du site.</p>
      <h2>Gestion</h2>
      <p>Vous pouvez également gérer ou supprimer les cookies depuis les réglages de votre navigateur. Cette action peut modifier certaines préférences enregistrées lors de votre prochaine visite.</p>
    $$,
    'published',
    now()
on conflict (page_key) do nothing;

insert into public.faqs (question, answer_html, category, placement, placements, sort_order, is_active)
select seed.question, seed.answer_html, seed.category, 'all', '["home", "catalog", "contact"]'::jsonb, seed.sort_order, true
from (
  values
    (1, 'Choisir une montre HERITAGE', 'Commencez par votre usage, votre style et le type de mouvement qui vous convient. Chaque fiche indique la référence, les caractéristiques et le prix. Pour un conseil avant votre choix, utilisez le formulaire de contact ou WhatsApp.', 'Conseil'),
    (2, 'La disponibilité affichée est-elle confirmée ?', 'La disponibilité présentée en ligne est mise à jour à partir du catalogue. Avant toute finalisation, HERITAGE confirme avec vous la référence, le prix et les modalités de remise de la pièce demandée.', 'Disponibilité'),
    (3, 'Comment vérifier l’authenticité d’une pièce ?', 'Les informations de provenance, les documents éventuellement remis et les conditions de garantie applicables sont précisés pour chaque référence. Vous pouvez demander les éléments disponibles avant de confirmer votre choix.', 'Authenticité'),
    (4, 'Comment se passent la livraison ou la remise ?', 'Les modalités sont convenues avec vous selon la référence et votre zone à Abidjan. Les conditions confirmées avant la commande prévalent sur toute information générale affichée sur le site.', 'Livraison'),
    (5, 'Quelle garantie accompagne ma montre ?', 'La garantie applicable dépend de la référence et des documents du fabricant ou du vendeur remis avec la pièce. Consultez la page Garantie &amp; Entretien ou échangez avec HERITAGE avant votre achat.', 'Garantie'),
    (6, 'Comment obtenir un conseil personnalisé ?', 'Vous pouvez écrire à HERITAGE depuis la page Contact, appeler le numéro indiqué dans le pied de page ou ouvrir la conversation WhatsApp. Votre demande sera examinée avec les informations que vous aurez communiquées.', 'Contact')
) as seed(sort_order, question, answer_html, category)
where not exists (select 1 from public.faqs where is_active = true);

insert into public.page_meta (page_key, title, description, og_title, og_description)
values
  ('faq', 'Foire aux questions | HERITAGE', 'Réponses aux questions fréquentes sur les pièces, la disponibilité, la remise et l’accompagnement HERITAGE.', 'Foire aux questions | HERITAGE', 'Les réponses essentielles avant votre choix.'),
  ('mentions-legales', 'Mentions légales | HERITAGE', 'Informations légales relatives à HERITAGE.', 'Mentions légales | HERITAGE', 'Informations légales HERITAGE.'),
  ('cgv', 'Conditions Générales de Vente | HERITAGE', 'Conditions applicables aux demandes et commandes HERITAGE.', 'Conditions Générales de Vente | HERITAGE', 'Conditions applicables aux commandes HERITAGE.'),
  ('confidentialite', 'Données personnelles | HERITAGE', 'Information relative au traitement des données personnelles par HERITAGE.', 'Données personnelles | HERITAGE', 'Vos données et vos droits auprès de HERITAGE.'),
  ('livraison-retours', 'Livraison & retours | HERITAGE', 'Modalités de remise, livraison, retours et annulations HERITAGE.', 'Livraison & retours | HERITAGE', 'Les modalités de remise et de retour HERITAGE.'),
  ('garantie-service', 'Garantie & entretien | HERITAGE', 'Conditions de garantie et conseils d’entretien des pièces HERITAGE.', 'Garantie & entretien | HERITAGE', 'Garantie et entretien des pièces HERITAGE.'),
  ('authenticite-provenance', 'Authenticité & provenance | HERITAGE', 'Informations de provenance et de vérification des pièces HERITAGE.', 'Authenticité & provenance | HERITAGE', 'La traçabilité des pièces HERITAGE.'),
  ('cookies', 'Cookies | HERITAGE', 'Information sur les cookies et le consentement HERITAGE.', 'Cookies | HERITAGE', 'Vos choix relatifs aux cookies.')
on conflict (page_key) do nothing;
