# Catalogue produits administré

## Mise en service Supabase

1. Dans **Supabase > SQL Editor**, exécutez les migrations dans cet ordre :

   - `supabase/migrations/20260910_admin_portal.sql`
   - `supabase/migrations/20260911_cms_completion.sql`
   - `supabase/migrations/20260912_contact_messages_secure.sql` si elle n'a pas déjà été exécutée
   - `supabase/migrations/20260912_product_catalog_hardening.sql`

2. Dans **Storage**, vérifiez que le bucket public `heritage-media` existe. La migration du portail de base le crée. Les règles de Storage doivent autoriser le service-role à téléverser et gérer les fichiers. Aucun accès d'écriture Storage ne doit être accordé à `anon` ou `authenticated`.

3. Dans les variables de l'environnement du serveur local et de Vercel, renseignez :

   ```env
   SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<publishable_anon_key>
   ```

   `SUPABASE_SERVICE_ROLE_KEY` ne doit jamais être préfixée par `VITE_` et ne doit jamais être exposée dans le navigateur.

4. Créez le compte administrateur dans Supabase Auth, puis assurez-vous que la ligne correspondante de `public.profiles` possède `role = 'admin'` et `is_active = true`. Les opérations du catalogue passent par `server.ts`, qui vérifie cette session avant d'employer la clé service-role.

5. Redémarrez le serveur Vercel ou local après avoir changé les variables. Dans Vercel, placez les quatre variables dans les environnements Preview et Production qui doivent disposer du catalogue.

## Règles appliquées

- Les montants de produits et variantes sont stockés en nombres entiers XOF.
- Une promo n'est enregistrée que si elle est strictement positive et inférieure au prix normal.
- Une fiche publiée doit avoir une image principale appartenant à sa galerie, avec un texte alternatif, et aucune image de galerie ne peut être marquée comme générée par IA.
- Une publication invalide est refusée par le serveur et par le déclencheur SQL. Les anciennes fiches sans galerie conforme sont ramenées au statut `draft` par la migration.
- Les produits publiés sont la seule source du catalogue public. Les brouillons, produits archivés et références supprimées ne sont pas accessibles par URL ou par la liste publique.
- Les catégories Parfums et Lunettes ne sont proposées dans les filtres publics que lorsqu'au moins une fiche publiée existe dans chacune d'elles.

## Contrôle après déploiement

1. Téléversez une vraie photo produit et donnez-lui un alt text descriptif.
2. Créez une fiche, associez la photo, puis publiez-la.
3. Ouvrez `/boutique` dans une fenêtre privée : la fiche doit apparaître. Dépubliez-la, rechargez : elle doit disparaître.
4. Vérifiez que l'API publique ne renvoie aucune fiche en brouillon : `GET /api/public/products`.
