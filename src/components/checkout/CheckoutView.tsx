import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { formatXOF } from '../../data/products';
import { OrderCustomer, UserProfile } from '../../types';
import {
  signUpWithSupabase,
  signInWithSupabase,
  fetchCurrentSessionProfile,
  fetchUserProfile
} from '../../lib/supabase';
import {
  ShieldCheck,
  Truck,
  MapPin,
  ArrowRight,
  AlertCircle,
  MessageSquare,
  CheckCircle2,
  UserCheck,
  UserPlus,
  LogIn,
  Lock
} from 'lucide-react';

interface CheckoutViewProps {
  navigate: (route: string) => void;
}

export const CheckoutView: React.FC<CheckoutViewProps> = ({ navigate }) => {
  const { cart, cartSubtotal, createOrder, userEmail, loginUser } = useStore();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Inline Auth state for visitors
  const [authTab, setAuthTab] = useState<'register' | 'login'>('register');
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regCommune, setRegCommune] = useState('Cocody');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  const [customer, setCustomer] = useState<OrderCustomer>({
    fullName: '',
    email: '',
    phone: '',
    commune: 'Cocody',
    deliveryAddress: '',
    notes: '',
    deliveryMode: 'livraison_abidjan'
  });

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Rehydrate profile on mount if session exists
  useEffect(() => {
    fetchCurrentSessionProfile().then((prof) => {
      if (prof) {
        setUserProfile(prof);
        if (!userEmail && prof.email) {
          loginUser(prof.email);
        }
        setCustomer((prev) => ({
          ...prev,
          fullName: prof.fullName || prev.fullName,
          email: prof.email || prev.email,
          phone: prof.phone || prev.phone,
          commune: prof.commune || prev.commune,
          deliveryAddress: prof.deliveryAddress || prev.deliveryAddress
        }));
      }
    });
  }, []);

  const deliveryCost = customer.deliveryMode === 'livraison_abidjan' ? 5000 : 0;
  const totalAmount = cartSubtotal + deliveryCost;

  const abidjanCommunes = [
    'Cocody',
    'Plateau',
    'Yopougon',
    'Marcory',
    'Treichville',
    'Port-Bouët',
    'Koumassi',
    'Adjamé',
    'Attécoubé',
    'Abobo',
    'Bingerville',
    'Songon'
  ];

  const handleInlineRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setIsAuthSubmitting(true);

    try {
      const cleanEmail = regEmail.trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        throw new Error('Veuillez saisir une adresse e-mail valide.');
      }
      if (regPassword.length < 6) {
        throw new Error('Le mot de passe doit comporter au moins 6 caractères.');
      }
      if (!regFullName.trim()) {
        throw new Error('Veuillez renseigner vos nom et prénoms complets.');
      }

      const { user } = await signUpWithSupabase({
        email: cleanEmail,
        password: regPassword,
        fullName: regFullName.trim(),
        whatsappPhone: regPhone.trim() || undefined,
        commune: regCommune
      });

      loginUser(cleanEmail);
      setCustomer((prev) => ({
        ...prev,
        fullName: regFullName.trim(),
        email: cleanEmail,
        phone: regPhone.trim() || prev.phone,
        commune: regCommune || prev.commune
      }));

      if (user) {
        setUserProfile({
          id: user.id,
          email: cleanEmail,
          fullName: regFullName.trim(),
          phone: regPhone.trim(),
          commune: regCommune,
          role: 'customer'
        });
      }

      setAuthSuccess('Votre compte utilisateur a été créé avec succès. Vous pouvez maintenant valider votre commande.');
    } catch (err: any) {
      setAuthError(err.message || 'Erreur lors de la création du compte.');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleInlineLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setIsAuthSubmitting(true);

    try {
      const cleanEmail = loginEmail.trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        throw new Error('Veuillez saisir votre adresse e-mail.');
      }

      const { user } = await signInWithSupabase({
        email: cleanEmail,
        password: loginPassword
      });

      const prof = user ? await fetchUserProfile(user.id) : null;
      loginUser(cleanEmail);

      setCustomer((prev) => ({
        ...prev,
        fullName: prof?.fullName || user?.user_metadata?.full_name || prev.fullName,
        email: cleanEmail,
        phone: prof?.phone || user?.user_metadata?.phone || prev.phone,
        commune: prof?.commune || user?.user_metadata?.commune || prev.commune,
        deliveryAddress: prof?.deliveryAddress || user?.user_metadata?.delivery_address || prev.deliveryAddress
      }));

      if (prof) setUserProfile(prof);
      setAuthSuccess('Connexion réussie ! Vous pouvez maintenant valider votre commande.');
    } catch (err: any) {
      setAuthError(err.message || 'Adresse e-mail ou mot de passe incorrect.');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (cart.length === 0) {
      setErrorMsg('Votre sélection est vide.');
      return;
    }

    if (!userEmail) {
      setErrorMsg('Création de compte requise : Veuillez créer votre compte ou vous connecter dans l’encadré ci-dessous avant de valider votre commande.');
      return;
    }

    if (!customer.fullName.trim()) {
      setErrorMsg('Veuillez renseigner votre nom complet.');
      return;
    }

    if (!customer.email.trim() || !customer.email.includes('@')) {
      setErrorMsg('Veuillez renseigner une adresse email valide.');
      return;
    }

    if (!customer.phone.trim()) {
      setErrorMsg('Veuillez renseigner votre numéro de téléphone ou WhatsApp.');
      return;
    }

    if (customer.deliveryMode === 'livraison_abidjan' && !customer.deliveryAddress.trim()) {
      setErrorMsg('Veuillez indiquer une adresse ou un repère de livraison à Abidjan.');
      return;
    }

    if (!termsAccepted) {
      setErrorMsg('Veuillez accepter les Conditions Générales de Vente.');
      return;
    }

    setIsProcessing(true);

    try {
      await createOrder(customer, 'transmission_whatsapp');
      setIsProcessing(false);
      navigate('/commande/confirmation');
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMsg(err.message || 'Erreur lors de la validation de la commande.');
    }
  };

  if (cart.length === 0) {
    return (
      <div className="bg-[#FAF9F7] min-h-screen pt-28 pb-20">
        <div className="max-w-md mx-auto px-4 text-center space-y-6 bg-white p-8 border border-[#002141]/10">
          <h2 className="font-playfair text-xl font-bold text-[#002141]">
            Votre panier est vide
          </h2>
          <p className="text-xs text-[#3A3A3A]">
            Veuillez ajouter une pièce horlogère à votre sélection avant de valider votre commande.
          </p>
          <button
            type="button"
            onClick={() => navigate('/montres')}
            className="px-6 py-3 bg-[#002141] text-[#FAF9F7] text-xs font-semibold uppercase tracking-widest"
          >
            DÉCOUVRIR LES MONTRES
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#FAF9F7] min-h-screen pt-24 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-[#3A3A3A] mb-8" aria-label="Fil d'Ariane">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="hover:text-[#002141] transition-colors"
          >
            Accueil
          </button>
          <span>/</span>
          <button
            type="button"
            onClick={() => navigate('/panier')}
            className="hover:text-[#002141] transition-colors"
          >
            Panier
          </button>
          <span>/</span>
          <span className="text-[#002141] font-semibold">Validation de commande</span>
        </nav>

        <div className="max-w-3xl mb-10">
          <h1 className="font-playfair text-3xl sm:text-4xl font-bold text-[#002141] mb-2">
            Finaliser votre commande
          </h1>
          <p className="text-sm text-[#3A3A3A]">
            Renseignez vos coordonnées pour la livraison de vos pièces à Abidjan et transmettez directement votre commande à nos conseillers.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Mandatory Account Section */}
        {!userEmail ? (
          <div className="bg-[#002141] text-[#FAF9F7] p-6 sm:p-8 border border-[#AC854B]/40 mb-10 rounded-xs shadow-lg">
            <div className="flex items-start gap-4 mb-6 pb-6 border-b border-[#AC854B]/30">
              <div className="p-3 bg-[#AC854B]/20 rounded-full text-[#AC854B] shrink-0">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#AC854B]">
                  Étape obligatoire pour la validation
                </span>
                <h3 className="font-playfair text-xl sm:text-2xl font-bold text-white mt-1">
                  Créer un compte client ou se connecter
                </h3>
                <p className="text-xs text-[#FAF9F7]/80 mt-1.5 leading-relaxed">
                  Pour valider votre commande et bénéficier d'un suivi personnalisé de vos pièces de haute horlogerie, la création d'un compte client est obligatoire. Votre commande sera ainsi directement rattachée à votre espace client.
                </p>
              </div>
            </div>

            {/* Auth Tabs */}
            <div className="flex border-b border-[#FAF9F7]/15 mb-6">
              <button
                type="button"
                onClick={() => setAuthTab('register')}
                className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 cursor-pointer ${
                  authTab === 'register'
                    ? 'border-[#AC854B] text-[#AC854B]'
                    : 'border-transparent text-[#FAF9F7]/60 hover:text-white'
                }`}
              >
                1. Créer mon compte
              </button>
              <button
                type="button"
                onClick={() => setAuthTab('login')}
                className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 cursor-pointer ${
                  authTab === 'login'
                    ? 'border-[#AC854B] text-[#AC854B]'
                    : 'border-transparent text-[#FAF9F7]/60 hover:text-white'
                }`}
              >
                2. Déjà client ? Se connecter
              </button>
            </div>

            {authError && (
              <div className="mb-6 p-3.5 bg-red-900/40 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {authSuccess && (
              <div className="mb-6 p-3.5 bg-emerald-900/40 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{authSuccess}</span>
              </div>
            )}

            {authTab === 'register' ? (
              <form onSubmit={handleInlineRegister} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#FAF9F7]/80 mb-1">
                      Nom complet *
                    </label>
                    <input
                      type="text"
                      required
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      placeholder="Ex: Marc Koffi"
                      className="w-full text-xs sm:text-sm bg-[#001830] px-3.5 py-2.5 border border-[#AC854B]/30 text-white placeholder-gray-400 focus:outline-hidden focus:border-[#AC854B]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#FAF9F7]/80 mb-1">
                      Adresse e-mail *
                    </label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="contact@exemple.ci"
                      className="w-full text-xs sm:text-sm bg-[#001830] px-3.5 py-2.5 border border-[#AC854B]/30 text-white placeholder-gray-400 focus:outline-hidden focus:border-[#AC854B]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#FAF9F7]/80 mb-1">
                      Mot de passe * (min. 6 caractères)
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full text-xs sm:text-sm bg-[#001830] px-3.5 py-2.5 border border-[#AC854B]/30 text-white placeholder-gray-400 focus:outline-hidden focus:border-[#AC854B]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#FAF9F7]/80 mb-1">
                      Téléphone / WhatsApp
                    </label>
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+225 07 00 00 00 00"
                      className="w-full text-xs sm:text-sm bg-[#001830] px-3.5 py-2.5 border border-[#AC854B]/30 text-white placeholder-gray-400 focus:outline-hidden focus:border-[#AC854B]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#FAF9F7]/80 mb-1">
                      Commune d'Abidjan
                    </label>
                    <select
                      value={regCommune}
                      onChange={(e) => setRegCommune(e.target.value)}
                      className="w-full text-xs sm:text-sm bg-[#001830] px-3.5 py-2.5 border border-[#AC854B]/30 text-white focus:outline-hidden focus:border-[#AC854B]"
                    >
                      {abidjanCommunes.map((c) => (
                        <option key={c} value={c} className="bg-[#002141] text-white">
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isAuthSubmitting}
                  className="w-full sm:w-auto px-6 py-3 bg-[#AC854B] hover:bg-[#8e6b39] text-[#002141] text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isAuthSubmitting ? 'Création du compte en cours...' : 'Créer mon compte & Débloquer la commande'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleInlineLogin} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#FAF9F7]/80 mb-1">
                      Adresse e-mail *
                    </label>
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="contact@exemple.ci"
                      className="w-full text-xs sm:text-sm bg-[#001830] px-3.5 py-2.5 border border-[#AC854B]/30 text-white placeholder-gray-400 focus:outline-hidden focus:border-[#AC854B]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#FAF9F7]/80 mb-1">
                      Mot de passe *
                    </label>
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full text-xs sm:text-sm bg-[#001830] px-3.5 py-2.5 border border-[#AC854B]/30 text-white placeholder-gray-400 focus:outline-hidden focus:border-[#AC854B]"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isAuthSubmitting}
                  className="w-full sm:w-auto px-6 py-3 bg-[#AC854B] hover:bg-[#8e6b39] text-[#002141] text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isAuthSubmitting ? 'Connexion en cours...' : 'Se connecter & Débloquer la commande'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="mb-10 p-5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between rounded-xs">
            <div className="flex items-center gap-3.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold uppercase tracking-wider text-[10px] text-emerald-700 block">
                  ✓ Compte utilisateur connecté
                </span>
                <span className="text-sm font-bold text-emerald-950">
                  {userProfile?.fullName ? `${userProfile.fullName} (${userEmail})` : userEmail}
                </span>
                <p className="text-[11px] text-emerald-800/80 mt-0.5">
                  Votre commande sera enregistrée dans votre espace client et transmise à l’administration.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/compte')}
              className="text-[11px] font-bold text-[#002141] underline hover:text-[#AC854B] shrink-0 ml-4 cursor-pointer"
            >
              Espace Client
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Form Section */}
            <div className="lg:col-span-8 space-y-8">
              {/* Step 1: Coordonnées */}
              <div className="bg-white border border-[#002141]/10 p-6 sm:p-8">
                <div className="flex items-center gap-3 pb-4 mb-6 border-b border-[#002141]/10">
                  <span className="w-6 h-6 rounded-full bg-[#002141] text-[#FAF9F7] text-xs font-bold flex items-center justify-center">
                    1
                  </span>
                  <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#002141]">
                    Vos coordonnées de livraison
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#3A3A3A] mb-1.5">
                      Nom complet *
                    </label>
                    <input
                      type="text"
                      required
                      value={customer.fullName}
                      onChange={(e) => setCustomer({ ...customer, fullName: e.target.value })}
                      placeholder="Ex: Kouassi Marc"
                      className="w-full text-xs sm:text-sm bg-[#FAF9F7] px-3.5 py-2.5 border border-[#002141]/15 text-[#002141] focus:outline-hidden focus:border-[#AC854B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#3A3A3A] mb-1.5">
                      Adresse e-mail *
                    </label>
                    <input
                      type="email"
                      required
                      value={customer.email}
                      onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                      placeholder="contact@exemple.ci"
                      className="w-full text-xs sm:text-sm bg-[#FAF9F7] px-3.5 py-2.5 border border-[#002141]/15 text-[#002141] focus:outline-hidden focus:border-[#AC854B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#3A3A3A] mb-1.5">
                      Téléphone / WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      value={customer.phone}
                      onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                      placeholder="+225 07 00 00 00 00"
                      className="w-full text-xs sm:text-sm bg-[#FAF9F7] px-3.5 py-2.5 border border-[#002141]/15 text-[#002141] focus:outline-hidden focus:border-[#AC854B]"
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Mode de réception */}
              <div className="bg-white border border-[#002141]/10 p-6 sm:p-8">
                <div className="flex items-center gap-3 pb-4 mb-6 border-b border-[#002141]/10">
                  <span className="w-6 h-6 rounded-full bg-[#002141] text-[#FAF9F7] text-xs font-bold flex items-center justify-center">
                    2
                  </span>
                  <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#002141]">
                    Mode de réception à Abidjan
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <label
                    className={`p-4 border cursor-pointer flex flex-col justify-between transition-colors ${
                      customer.deliveryMode === 'livraison_abidjan'
                        ? 'border-[#AC854B] bg-[#FAF9F7]'
                        : 'border-[#002141]/15 hover:border-[#002141]/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-[#AC854B]" />
                        <span className="font-semibold text-xs text-[#002141]">
                          Livraison sécurisée
                        </span>
                      </div>
                      <input
                        type="radio"
                        name="deliveryMode"
                        checked={customer.deliveryMode === 'livraison_abidjan'}
                        onChange={() => setCustomer({ ...customer, deliveryMode: 'livraison_abidjan' })}
                        className="text-[#002141] focus:ring-[#AC854B]"
                      />
                    </div>
                    <p className="text-[11px] text-[#3A3A3A] mb-2">
                      Sous pli scellé remis en main propre à Abidjan.
                    </p>
                    <span className="font-bold text-xs text-[#002141]">5 000 FCFA</span>
                  </label>

                  <label
                    className={`p-4 border cursor-pointer flex flex-col justify-between transition-colors ${
                      customer.deliveryMode === 'retrait_yopougon'
                        ? 'border-[#AC854B] bg-[#FAF9F7]'
                        : 'border-[#002141]/15 hover:border-[#002141]/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#AC854B]" />
                        <span className="font-semibold text-xs text-[#002141]">
                          Retrait sur rendez-vous
                        </span>
                      </div>
                      <input
                        type="radio"
                        name="deliveryMode"
                        checked={customer.deliveryMode === 'retrait_yopougon'}
                        onChange={() => setCustomer({ ...customer, deliveryMode: 'retrait_yopougon' })}
                        className="text-[#002141] focus:ring-[#AC854B]"
                      />
                    </div>
                    <p className="text-[11px] text-[#3A3A3A] mb-2">
                      Accueil à la Maison HERITAGE à Yopougon, Abidjan.
                    </p>
                    <span className="font-bold text-xs text-[#AC854B]">Gratuit</span>
                  </label>
                </div>

                {customer.deliveryMode === 'livraison_abidjan' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#3A3A3A] mb-1.5">
                        Commune d'Abidjan *
                      </label>
                      <select
                        value={customer.commune}
                        onChange={(e) => setCustomer({ ...customer, commune: e.target.value })}
                        className="w-full text-xs sm:text-sm bg-[#FAF9F7] px-3.5 py-2.5 border border-[#002141]/15 text-[#002141] focus:outline-hidden focus:border-[#AC854B]"
                      >
                        {abidjanCommunes.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#3A3A3A] mb-1.5">
                        Adresse précise ou repère *
                      </label>
                      <input
                        type="text"
                        required
                        value={customer.deliveryAddress}
                        onChange={(e) => setCustomer({ ...customer, deliveryAddress: e.target.value })}
                        placeholder="Quartier, rue, repère connu..."
                        className="w-full text-xs sm:text-sm bg-[#FAF9F7] px-3.5 py-2.5 border border-[#002141]/15 text-[#002141] focus:outline-hidden focus:border-[#AC854B]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3: Information sur le processus */}
              <div className="bg-white border border-[#002141]/10 p-6 sm:p-8">
                <div className="flex items-center gap-3 pb-4 mb-4 border-b border-[#002141]/10">
                  <span className="w-6 h-6 rounded-full bg-[#002141] text-[#FAF9F7] text-xs font-bold flex items-center justify-center">
                    3
                  </span>
                  <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#002141]">
                    Validation et transmission directes
                  </h2>
                </div>

                <div className="flex items-start gap-3.5 p-4 bg-[#FAF9F7] border border-[#002141]/10 text-xs text-[#3A3A3A] leading-relaxed">
                  <MessageSquare className="w-5 h-5 text-[#25D366] flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[#002141] block mb-1">
                      Enregistrement instantané & transmission WhatsApp
                    </span>
                    <p>
                      Aucun paiement en ligne n'est effectué sur ce site. Après validation de vos coordonnées, votre commande sera enregistrée et vous pourrez la transmettre directement par WhatsApp à notre conseiller pour convenir de la remise ou de la livraison à Abidjan.
                    </p>
                  </div>
                </div>
              </div>

              {/* CGV Checkbox */}
              <div className="bg-white border border-[#002141]/10 p-6">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-1 rounded-xs border-[#002141]/30 text-[#002141] focus:ring-[#AC854B]"
                  />
                  <span className="text-xs text-[#3A3A3A] leading-relaxed">
                    J'ai pris connaissance et j'accepte sans réserve les{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/cgv')}
                      className="underline text-[#002141] font-semibold"
                    >
                      Conditions Générales de Vente
                    </button>{' '}
                    et la{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/confidentialite')}
                      className="underline text-[#002141] font-semibold"
                    >
                      Politique de Confidentialité
                    </button>{' '}
                    de la Maison HERITAGE.
                  </span>
                </label>
              </div>
            </div>

            {/* Sidebar Summary Section */}
            <div className="lg:col-span-4 bg-white border border-[#002141]/10 p-6 sm:p-8 space-y-6 sticky top-24">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#002141] pb-4 border-b border-[#002141]/10">
                Votre commande ({cart.length})
              </h2>

              <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
                {cart.map(({ product, quantity }) => (
                  <div key={product.sku} className="flex gap-3 items-center justify-between text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={product.primaryImage}
                        alt=""
                        className="w-12 h-14 object-contain bg-[#FAF9F7] p-1 flex-shrink-0"
                      />
                      <div className="truncate">
                        <span className="font-semibold text-[#002141] block truncate">
                          {product.name}
                        </span>
                        <span className="text-[11px] text-[#3A3A3A]/70">
                          Qté : {quantity} &middot; Réf. {product.reference}
                        </span>
                      </div>
                    </div>
                    <span className="font-semibold text-[#002141] flex-shrink-0">
                      {formatXOF(product.priceXOF * quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-[#002141]/10 space-y-2 text-xs">
                <div className="flex justify-between text-[#3A3A3A]">
                  <span>Sous-total</span>
                  <span className="font-medium text-[#002141]">{formatXOF(cartSubtotal)}</span>
                </div>
                <div className="flex justify-between text-[#3A3A3A]">
                  <span>Livraison</span>
                  <span className="font-medium text-[#002141]">
                    {deliveryCost === 0 ? 'Gratuite (Retrait)' : formatXOF(deliveryCost)}
                  </span>
                </div>
                <div className="pt-3 border-t border-[#002141]/10 flex justify-between items-baseline">
                  <span className="text-sm font-bold text-[#002141]">Montant total</span>
                  <span className="font-playfair text-xl font-bold text-[#002141]">
                    {formatXOF(totalAmount)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isProcessing || !userEmail}
                id="checkout-pay-button"
                className={`w-full py-4 px-6 text-xs font-bold uppercase tracking-[0.18em] flex items-center justify-center gap-3 transition-all shadow-sm ${
                  !userEmail
                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    : 'premium-cta bg-[#002141] hover:bg-[#AC854B] text-[#FAF9F7] cursor-pointer'
                }`}
              >
                {isProcessing ? (
                  <span>TRANSMISSION EN COURS...</span>
                ) : !userEmail ? (
                  <span>CRÉATION DE COMPTE REQUISE</span>
                ) : (
                  <>
                    <span>VALIDER ET TRANSMETTRE MA COMMANDE</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="text-[11px] text-[#3A3A3A]/75 text-center leading-relaxed">
                Le prix et la disponibilité sont contrôlés à nouveau avant la validation.
              </p>

              <div className="pt-4 border-t border-[#002141]/10 space-y-2 text-xs text-[#3A3A3A]/80">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#AC854B]" />
                  <span>Enregistrement sécurisé de votre commande</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#AC854B]" />
                  <span>Conseiller dédié & suivi à Abidjan</span>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
