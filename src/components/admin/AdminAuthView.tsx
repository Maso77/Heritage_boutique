import React, { FormEvent, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { createAdministratorAccount, signInAdministrator } from '../../lib/admin-api';

interface AdminAuthViewProps {
  mode: 'login' | 'create';
  navigate: (route: string) => void;
}

export const AdminAuthView: React.FC<AdminAuthViewProps> = ({ mode, navigate }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '');
    const password = String(form.get('password') || '');
    setError('');
    setNotice('');

    if (mode === 'create' && password.length < 12) {
      setError('Le mot de passe doit contenir au moins 12 caractères.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await signInAdministrator(email, password);
        navigate('/admin');
      } else {
        await createAdministratorAccount({
          fullName: String(form.get('fullName') || ''),
          email,
          password,
          invitationCode: String(form.get('invitationCode') || '')
        });
        setNotice('Compte créé. Connectez-vous avec vos nouveaux identifiants.');
        event.currentTarget.reset();
      }
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Une erreur est survenue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCreate = mode === 'create';

  return (
    <main className="min-h-screen bg-[#002141] px-4 py-8 sm:px-6 lg:grid lg:grid-cols-2 lg:p-0">
      <section className="hidden min-h-screen flex-col justify-between border-r border-[#D6BB8F]/20 bg-[radial-gradient(circle_at_20%_20%,#16466a_0%,#002141_48%,#00172e_100%)] p-12 text-[#FAF9F7] lg:flex">
        <img
          src="/assets/logo-white.svg"
          alt="HERITAGE — Montres et Accessoires"
          className="h-auto w-48 object-contain object-left"
        />
        <div className="max-w-lg">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.22em] text-[#D6BB8F]">Espace réservé</p>
          <h1 className="font-playfair text-5xl font-semibold leading-tight">Pilotez votre maison, avec précision.</h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-[#FAF9F7]/75">
            Les accès administrateur sont protégés par Supabase, des rôles vérifiés côté serveur et des invitations à usage unique.
          </p>
        </div>
        <p className="text-xs text-[#FAF9F7]/55">HERITAGE · Abidjan, Côte d’Ivoire</p>
      </section>

      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl items-center py-8 lg:min-h-screen lg:max-w-none lg:px-16 xl:px-24">
        <div className="w-full rounded-sm border border-[#D6BB8F]/25 bg-[#FAF9F7] p-6 shadow-2xl sm:p-10">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mb-8 inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#002141]/70 transition-colors hover:text-[#AC854B]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Retour à la boutique
          </button>

          <div className="mb-8">
            <img
              src="/assets/logo.svg"
              alt="HERITAGE — Montres et Accessoires"
              className="mb-5 h-auto w-36 object-contain object-left"
            />
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#AC854B]">Portail privé</p>
            <h2 className="font-playfair mt-2 text-3xl font-semibold text-[#002141]">
              {isCreate ? 'Créer un compte administrateur' : 'Connexion administrateur'}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#3A3A3A]">
              {isCreate
                ? 'Un code temporaire, généré par un administrateur actif, est indispensable.'
                : 'Utilisez uniquement vos identifiants administrateur HERITAGE.'}
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            {isCreate && (
              <label className="block text-sm font-semibold text-[#002141]">
                Nom complet
                <input
                  name="fullName"
                  required
                  autoComplete="name"
                  className="mt-2 min-h-12 w-full border border-[#002141]/20 bg-white px-4 text-base outline-none transition focus:border-[#AC854B] focus:ring-2 focus:ring-[#AC854B]/20"
                />
              </label>
            )}

            <label className="block text-sm font-semibold text-[#002141]">
              Adresse e-mail professionnelle
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                className="mt-2 min-h-12 w-full border border-[#002141]/20 bg-white px-4 text-base outline-none transition focus:border-[#AC854B] focus:ring-2 focus:ring-[#AC854B]/20"
              />
            </label>

            <label className="block text-sm font-semibold text-[#002141]">
              Mot de passe {isCreate && <span className="font-normal text-[#3A3A3A]">, 12 caractères minimum</span>}
              <span className="relative mt-2 block">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={isCreate ? 12 : undefined}
                  autoComplete={isCreate ? 'new-password' : 'current-password'}
                  className="min-h-12 w-full border border-[#002141]/20 bg-white py-3 pl-4 pr-12 text-base outline-none transition focus:border-[#AC854B] focus:ring-2 focus:ring-[#AC854B]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center text-[#002141]/65 transition-colors hover:text-[#AC854B]"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </span>
            </label>

            {isCreate && (
              <label className="block text-sm font-semibold text-[#002141]">
                Code d’invitation
                <input
                  name="invitationCode"
                  required
                  autoComplete="one-time-code"
                  className="mt-2 min-h-12 w-full border border-[#002141]/20 bg-white px-4 font-mono text-base uppercase tracking-[0.1em] outline-none transition focus:border-[#AC854B] focus:ring-2 focus:ring-[#AC854B]/20"
                  placeholder="HRT-XXXXXXXXXXXX"
                />
                <span className="mt-2 block text-xs font-normal leading-relaxed text-[#3A3A3A]">Valable une heure et utilisable une seule fois.</span>
              </label>
            )}

            {error && <p role="alert" className="border-l-4 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p>}
            {notice && <p role="status" className="border-l-4 border-emerald-700 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex min-h-12 w-full items-center justify-center gap-2 bg-[#002141] px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-[#FAF9F7] transition hover:bg-[#16466a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
              {isSubmitting ? 'Vérification…' : isCreate ? 'Créer le compte' : 'Accéder au portail'}
            </button>
          </form>

          <div className="mt-7 border-t border-[#002141]/10 pt-6 text-sm text-[#3A3A3A]">
            {isCreate ? (
              <button type="button" onClick={() => navigate('/admin/login')} className="font-semibold text-[#002141] underline decoration-[#AC854B] underline-offset-4 hover:text-[#AC854B]">
                J’ai déjà un compte administrateur
              </button>
            ) : (
              <button type="button" onClick={() => navigate('/admin/create')} className="font-semibold text-[#002141] underline decoration-[#AC854B] underline-offset-4 hover:text-[#AC854B]">
                Créer un compte avec un code d’invitation
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};
