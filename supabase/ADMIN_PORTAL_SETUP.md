# Mise en service Supabase — CMS HERITAGE

Cette procédure met en service le portail, le catalogue, le journal et les contenus publics depuis une source unique : Supabase. Faites les étapes dans cet ordre.

## 1. Sécuriser les clés

Dans **Supabase → Project Settings → API**, réinitialisez toute ancienne clé `service_role` qui aurait pu être partagée. Ne mettez jamais une clé `service_role` dans Git, une variable `VITE_*` ou le navigateur.

Dans Hostinger (variables de l'application Node.js), vérifiez ces quatre variables, puis redémarrez/redéployez l'application :

```dotenv
SUPABASE_URL=https://VOTRE_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=VOTRE_NOUVELLE_CLE_SERVICE_ROLE
VITE_SUPABASE_URL=https://VOTRE_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=VOTRE_CLE_ANON_PUBLIQUE
```

`SUPABASE_SERVICE_ROLE_KEY` est uniquement lue par `server.ts`. Elle ne doit pas commencer par `VITE_`.

## 2. Exécuter les migrations SQL

Dans **Supabase → SQL Editor → New query**, copiez-collez et exécutez entièrement, une par une, dans cet ordre :

1. [`migrations/20260910_admin_portal.sql`](./migrations/20260910_admin_portal.sql)
2. [`migrations/20260911_cms_completion.sql`](./migrations/20260911_cms_completion.sql)

La première crée également le bucket Storage public `heritage-media`, limité à 10 Mo et aux fichiers JPEG/PNG/WebP/AVIF. Vérifiez dans **Storage** que le bucket existe et qu'il est public. Les envois restent protégés par le serveur administrateur ; aucun accès d'écriture navigateur n'est créé.

## 3. Reprendre le catalogue et les articles historiques

Depuis le terminal à la racine du projet, générez le SQL de reprise :

```powershell
npx tsx supabase/generate_legacy_seed.ts > supabase/20260911_legacy_seed.sql
```

Ouvrez ensuite `supabase/20260911_legacy_seed.sql`, copiez son contenu dans le SQL Editor Supabase et exécutez-le.

Ce script reprend produits, prix publics, stocks, images publiques, caractéristiques, FAQ produit, articles et les coordonnées provenant de l'ancienne page Contact. Les champs **provenance**, **garantie**, **livraison**, réseaux sociaux et notices du footer sont volontairement laissés vides : ils doivent être validés puis renseignés dans le portail avant toute publication.

## 4. Premier administrateur

1. Dans **Authentication → Users → Add user**, créez le premier compte avec son e-mail et un mot de passe robuste.
2. Dans SQL Editor, remplacez l'e-mail puis exécutez :

```sql
insert into public.profiles (id, email, full_name, role, is_active)
select id, email, coalesce(raw_user_meta_data ->> 'full_name', ''), 'admin', true
from auth.users
where lower(email) = lower('admin@votre-domaine.com')
on conflict (id) do update
set email = excluded.email,
    full_name = excluded.full_name,
    role = 'admin',
    is_active = true;
```

3. Contrôlez le rôle :

```sql
select email, full_name, role, is_active
from public.profiles
where lower(email) = lower('admin@votre-domaine.com');
```

Le compte peut ensuite se connecter sur `/admin/login`. Les comptes suivants sont créés uniquement via un code d'invitation d'une heure depuis **Administrateurs**.

## 5. Réglages Auth Supabase

Dans **Authentication → Providers**, activez Email. Dans **Authentication → URL Configuration**, définissez l'URL de production et ajoutez-la aux Redirect URLs :

```text
https://navajowhite-okapi-833640.hostingersite.com
```

Ajoutez aussi l'URL locale si vous testez sur votre PC :

```text
http://localhost:3000
```

Conservez une longueur minimale de mot de passe de 12 caractères ou davantage. Le formulaire des administrateurs impose déjà 12 caractères.

## 6. Données à renseigner dans le portail

Après connexion, complétez d'abord :

1. **Coordonnées** : téléphone, WhatsApp, e-mail, adresse, horaires et réseaux sociaux. Les trois notices du footer restent vides tant qu'elles ne sont pas validées.
2. **Produits / Stocks** : renseignez notamment le prix d'achat, les médias avec alt text, et toute information de garantie/provenance/livraison validée. Une publication exige nom, catégorie, prix normal et image principale non-IA avec texte alternatif.
3. **Pages légales** : rédigez-les et publiez-les seulement après validation juridique. Elles sont en brouillon par défaut.
4. **Pixels** : entrez seulement un ID Meta/Google réel. Le site affiche un choix de consentement avant tout chargement.

Les mises à jour se reflètent sur le site public au prochain chargement et au plus tard dans la minute grâce au rafraîchissement de contenu.

## 7. Contrôle après déploiement Hostinger

Dans la configuration Node.js Hostinger, conservez **Node 22.x**, la commande de build `npm run build` et le fichier d’entrée `dist/server.cjs` (ou la commande de démarrage `npm run start` si Hostinger demande une commande). Ne définissez pas manuellement `PORT` : le serveur utilise automatiquement `process.env.PORT` fourni par Hostinger.

Après `git push hostinger main`, attendez le déploiement puis testez :

- `https://navajowhite-okapi-833640.hostingersite.com/api/health` doit retourner `status: ok`.
- `https://navajowhite-okapi-833640.hostingersite.com/admin/login` doit afficher la connexion HERITAGE.
- Connectez-vous, ajoutez un brouillon produit, puis vérifiez qu'il n'est pas visible sur le catalogue public.
- Publiez le produit avec ses champs requis et contrôlez sa visibilité.
- Créez un FAQ, un avis validé, un article ou une coordonnée et vérifiez la synchronisation de l'emplacement public correspondant.

Le portail ne révèle jamais la clé serveur, les informations bancaires des clients ou le contenu de WhatsApp.
