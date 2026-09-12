# Mise en service — messages de contact HERITAGE

Le formulaire public envoie les messages vers la route serveur Express
POST /api/public/contact-messages. Cette route utilise la clé serveur Supabase
et non la clé publique du navigateur.

## 1. Exécuter les migrations

Dans **Supabase → SQL Editor**, exécutez dans cet ordre :

1. migrations/20260910_admin_portal.sql
2. migrations/20260911_cms_completion.sql
3. migrations/20260912_contact_messages_secure.sql

La troisième migration crée ou met à niveau public.contact_messages, convertit
les anciens statuts unread et archived, ajoute les index, active RLS et retire
tout accès direct public.

## 2. Variables d'environnement

Ajoutez les variables suivantes à l'environnement qui exécute server.ts.
Dans Vercel, utilisez **Project Settings → Environment Variables** pour
Production, Preview et Development, puis redéployez.

    SUPABASE_URL=https://VOTRE_PROJECT_REF.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=VOTRE_CLE_SERVICE_ROLE
    VITE_SUPABASE_URL=https://VOTRE_PROJECT_REF.supabase.co
    VITE_SUPABASE_ANON_KEY=VOTRE_CLE_PUBLIQUE
    CONTACT_SPAM_HASH_SALT=UNE_VALEUR_ALEATOIRE_LONGUE_ET_SECRETE

SUPABASE_SERVICE_ROLE_KEY et CONTACT_SPAM_HASH_SALT sont exclusivement
serveur. Ne les préfixez jamais avec VITE_, ne les commitez pas et ne les
ajoutez pas au navigateur. Le sel permet de mémoriser seulement un hash HMAC
de l'adresse IP pour le diagnostic anti-spam, jamais l'adresse IP brute.

L'application actuelle utilise une route Express, pas une Edge Function
Supabase. Si elle est déployée sur Vercel, elle doit rester exécutée avec le
runtime Node.js qui sert cette route.

## 3. Contrôle de sécurité

- Les visiteurs ne peuvent pas lire, insérer, modifier ou supprimer
  directement contact_messages avec la clé publique.
- Seul le serveur valide et enregistre une soumission publique.
- Les administrateurs actifs peuvent lire, mettre à jour ou supprimer via les
  politiques RLS et via l'API administrateur authentifiée.
- Le formulaire utilise un honeypot invisible et limite les envois à 5 par IP
  ou 3 par e-mail sur 15 minutes. Cette limite légère est en mémoire et se
  réinitialise après un redémarrage du serveur.
- Aucun champ du formulaire de contact n'est transmis au tracking ou à
  l'analytics.

## 4. Test après déploiement

1. Envoyez un message de test depuis /contact.
2. Vérifiez la confirmation neutre affichée au visiteur.
3. Ouvrez **Messages reçus** avec un administrateur. Le message doit apparaître
   en premier avec le statut **Nouveau**.
4. Ouvrez-le : le statut devient **Lu**. Marquez-le ensuite comme **Traité**.
5. Vérifiez que la suppression affiche une confirmation avant la suppression.

Le site n'affiche aucun délai de réponse : cette promesse reste à décider par
la Maison HERITAGE.
