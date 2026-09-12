# Commandes HERITAGE — configuration Supabase

## 1. Appliquer les migrations dans cet ordre

Dans **Supabase Dashboard > SQL Editor**, exécuter intégralement les fichiers suivants, dans cet ordre :

1. `supabase/migrations/20260910_admin_portal.sql`
2. `supabase/migrations/20260911_cms_completion.sql`
3. `supabase/migrations/20260912_product_catalog_hardening.sql`
4. `supabase/migrations/20260912_orders_admin_hardening.sql`

La dernière migration :

- crée `order_status_events` et ses index ;
- ajoute les champs de compatibilité nécessaires aux snapshots d'articles ;
- empêche `delivered` sans référence ou lien de preuve de remise ;
- supprime toute insertion ou modification de commande directement depuis un navigateur ;
- réserve les consultations élargies au rôle administrateur, via `public.is_admin()` ;
- conserve les anciennes commandes et les dote d'un événement historique.

Si une exécution antérieure a échoué sur `column "price_xof" does not exist`,
reprendre le fichier corrigé dans son intégralité. Le script est transactionnel
(`begin` / `commit`) : l'échec annule les étapes de cette tentative, il ne faut
donc pas exécuter uniquement la ligne qui avait échoué.

Une commande historique marquée `delivered` sans preuve ou référence est replacée à `shipped_or_ready`. Aucune preuve n'est inventée par la migration.

## 2. Variables d'environnement

Dans l'environnement où tourne le serveur Express (local et Vercel), définir :

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable_ou_anon_key>
```

`SUPABASE_SERVICE_ROLE_KEY` reste exclusivement côté serveur : ne jamais la préfixer avec `VITE_` et ne jamais l'ajouter au code client. Le serveur vérifie la session Supabase de l'acheteur ou de l'administrateur avant d'utiliser cette clé.

## 3. Authentification et profils

Le passage en caisse exige une session Supabase valide. Vérifier que :

- **Authentication > Providers > Email** est activé ;
- l'URL locale (par exemple `http://localhost:3000`) et le domaine Vercel sont renseignés dans **Authentication > URL Configuration** ;
- chaque membre du portail a une ligne `profiles` avec `role = 'admin'` et `is_active = true`.

La migration de base crée le profil automatiquement lors d'une inscription. Pour promouvoir un compte existant, utiliser une requête contrôlée dans SQL Editor :

```sql
update public.profiles
set role = 'admin', is_active = true
where email = 'adresse-admin@exemple.ci';
```

## 4. Vérification fonctionnelle

1. Publier au moins un produit avec un prix entier, un stock adapté et le statut `published`.
2. Se connecter à un compte client, ajouter le produit au panier et finaliser une commande.
3. Vérifier que la confirmation ne s'affiche qu'après la réponse positive du serveur.
4. Se connecter au portail admin et ouvrir **Commandes** : la commande, son snapshot d'articles et l'événement initial `pending_payment` doivent apparaître.
5. Essayer de passer à `delivered` sans référence ni URL de preuve : l'interface et la base doivent refuser.
6. Ajouter une référence ou une URL HTTPS/HTTP, enregistrer, puis vérifier l'acteur et la date dans l'historique.

## 5. Vercel

Configurer les quatre variables ci-dessus pour **Production**, **Preview** et, si nécessaire, **Development**, puis redéployer. Aucune Edge Function n'est requise : les routes `/api/public/orders` et `/api/admin/orders` du serveur du projet assurent respectivement la création client et la gestion administrateur.
