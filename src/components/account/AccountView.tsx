import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { formatXOF } from '../../data/products';
import {
  signUpWithSupabase,
  signInWithSupabase,
  signOutSupabase,
  fetchUserProfile,
  fetchCurrentSessionProfile,
  fetchUserOrdersFromSupabase
} from '../../lib/supabase';
import { usePublicContent } from '../../lib/public-content';
import { whatsappHref } from '../../lib/site-contact';
import { Order, UserProfile } from '../../types';
import {
  User,
  Package,
  Clock,
  ShieldCheck,
  Mail,
  Phone,
  LogOut,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Shield,
  ArrowRight,
  MapPin,
  Sparkles,
  ChevronRight,
  FileCheck,
  MessageSquare
} from 'lucide-react';

interface AccountViewProps {
  navigate: (route: string) => void;
}

const ABIDJAN_COMMUNES = [
  'Cocody (Ambassades / Deux-Plateaux / Riviera)',
  'Plateau (Centre des Affaires)',
  'Marcory (Zone 4 / Biétry)',
  'Yopougon (Maison HERITAGE)',
  'Treichville',
  'Koumassi',
  'Port-Bouët (Aéroport)',
  'Adjamé',
  'Attécoubé',
  'Bingerville',
  'Autre localité (Côte d\'Ivoire / International)'
];

export const AccountView: React.FC<AccountViewProps> = ({ navigate }) => {
  const { userEmail, loginUser, logoutUser, orders: storeOrders } = useStore();
  const { siteSettings } = usePublicContent();
  const orderSupportWhatsappUrl = whatsappHref(siteSettings, 'Bonjour Maison HERITAGE, je souhaite une information sur le suivi de ma commande.');

  // Auth Mode: login vs register
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [phonePrefix, setPhonePrefix] = useState('+225');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [commune, setCommune] = useState(ABIDJAN_COMMUNES[0]);
  const [deliveryAddress, setDeliveryAddress] = useState('');

  // States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Authenticated State
  const [activeTab, setActiveTab] = useState<'orders' | 'profile' | 'warranty' | 'privacy'>('orders');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userOrders, setUserOrders] = useState<Order[]>(storeOrders);

  // Rehydrate profile on mount if a Supabase session exists
  useEffect(() => {
    fetchCurrentSessionProfile().then((prof) => {
      if (prof) {
        setUserProfile(prof);
        if (!userEmail && prof.email) {
          loginUser(prof.email);
        }
      }
    });
  }, []);

  // Load user orders when email is defined or changed
  useEffect(() => {
    if (userEmail) {
      fetchUserOrdersFromSupabase(userEmail, userProfile?.phone).then((sbOrders) => {
        if (sbOrders.length > 0) {
          const map = new Map<string, Order>();
          storeOrders.forEach((o) => map.set(o.id, o));
          sbOrders.forEach((o) => map.set(o.id, o));
          setUserOrders(Array.from(map.values()));
        } else {
          setUserOrders(storeOrders);
        }
      });
    }
  }, [userEmail, userProfile?.phone]);

  // Form submission handler (Email-only login/register, optional WhatsApp on register)
  const handleSubmitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const cleanEmail = emailInput.trim().toLowerCase();

      if (!cleanEmail) {
        throw new Error('Veuillez saisir votre adresse e-mail.');
      }
      if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
        throw new Error('Veuillez saisir une adresse e-mail valide (ex: contact@domaine.ci).');
      }
      if (password.length < 6) {
        throw new Error('Le mot de passe doit comporter au moins 6 caractères.');
      }

      if (authMode === 'register') {
        if (!fullName.trim()) {
          throw new Error('Veuillez renseigner vos nom et prénoms complets.');
        }

        // WhatsApp number is optional on registration
        const rawPhone = phoneNumber.trim().replace(/[^0-9]/g, '');
        const fullWhatsApp = rawPhone ? `${phonePrefix} ${rawPhone}` : undefined;

        const { user } = await signUpWithSupabase({
          email: cleanEmail,
          password,
          fullName: fullName.trim(),
          whatsappPhone: fullWhatsApp,
          commune,
          deliveryAddress: deliveryAddress.trim()
        });

        loginUser(cleanEmail);
        setSuccessMessage('Votre compte privilégié a été créé avec succès. Bienvenue chez Maison HERITAGE.');

        // Initialiser profil local
        setUserProfile({
          id: user?.id || 'usr-' + Date.now(),
          email: cleanEmail,
          phone: fullWhatsApp,
          fullName: fullName.trim(),
          commune,
          deliveryAddress: deliveryAddress.trim(),
          role: cleanEmail.includes('heritageci15') ? 'admin' : 'customer'
        });
      } else {
        // Connexion avec Email uniquement
        const { user } = await signInWithSupabase({
          email: cleanEmail,
          password
        });

        loginUser(cleanEmail);
        setSuccessMessage('Connexion réussie. Bienvenue dans votre Espace Privilège.');

        if (user) {
          const prof = await fetchUserProfile(user.id);
          if (prof) setUserProfile(prof);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Une erreur est survenue lors de l'authentification.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await signOutSupabase();
    logoutUser();
    setUserProfile(null);
    setSuccessMessage('Vous êtes maintenant déconnecté.');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // L'accès administrateur dépend uniquement du rôle validé côté Supabase.
  const isAdmin = userProfile?.role === 'admin';

  return (
    <div className="bg-[#FAF9F7] min-h-screen pt-24 pb-24 text-[#002141]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-[#3A3A3A] mb-8" aria-label="Fil d'Ariane">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="hover:text-[#002141] transition-colors cursor-pointer"
          >
            Accueil
          </button>
          <span>/</span>
          <span className="text-[#002141] font-semibold">Espace Privilège Client</span>
        </nav>

        {/* Header Title */}
        <div className="max-w-3xl mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#002141]/5 border border-[#AC854B]/30 text-[#AC854B] text-[10px] font-bold uppercase tracking-widest mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Maison HERITAGE &middot; Espace Privé</span>
          </div>
          <h1 className="font-playfair text-3xl sm:text-4xl font-bold text-[#002141] mb-2">
            Espace Privilège Client
          </h1>
          <p className="text-sm text-[#3A3A3A] leading-relaxed">
            Authentifiez-vous avec votre adresse e-mail pour suivre l'acheminement sous pli scellé de vos pièces Tissot, consulter vos certificats d'authenticité et gérer vos adresses à Abidjan.
          </p>
        </div>

        {/* Global Notifications */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-3">
            <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 1 : VISITEUR NON CONNECTÉ (CONNEXION OU CRÉATION AVEC EMAIL)      */}
        {/* ========================================================================= */}
        {!userEmail ? (
          <div className="bg-white border border-[#002141]/10 p-6 sm:p-10 max-w-xl mx-auto shadow-xs">
            {/* Toggle Mode (Connexion vs Création de Compte) */}
            <div className="flex border-b border-[#002141]/10 mb-8">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setErrorMessage(null);
                }}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider text-center cursor-pointer border-b-2 transition-all ${
                  authMode === 'login'
                    ? 'border-[#AC854B] text-[#002141]'
                    : 'border-transparent text-[#3A3A3A]/60 hover:text-[#002141]'
                }`}
              >
                Se Connecter
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setErrorMessage(null);
                }}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider text-center cursor-pointer border-b-2 transition-all ${
                  authMode === 'register'
                    ? 'border-[#AC854B] text-[#002141]'
                    : 'border-transparent text-[#3A3A3A]/60 hover:text-[#002141]'
                }`}
              >
                Créer un Compte
              </button>
            </div>

            {/* Note d'introduction contextuelle */}
            <div className="mb-6 pb-4 border-b border-[#002141]/5">
              <p className="text-xs text-[#3A3A3A]/80 leading-relaxed">
                {authMode === 'login' ? (
                  <span>
                    Connectez-vous à l'aide de votre <strong>adresse e-mail</strong> et de votre mot de passe pour accéder à vos commandes et garanties.
                  </span>
                ) : (
                  <span>
                    Renseignez votre <strong>adresse e-mail</strong> qui servira d'identifiant unique. Vous pouvez également indiquer votre numéro <strong>WhatsApp</strong> pour le suivi personnalisé de votre garde-temps.
                  </span>
                )}
              </p>
            </div>

            <form onSubmit={handleSubmitAuth} className="space-y-4">
              {/* Nom Complet (en mode Inscription uniquement) */}
              {authMode === 'register' && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#3A3A3A] mb-1.5">
                    Nom & Prénoms complets <span className="text-[#AC854B]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex: Jean-Marc Koffi"
                    className="w-full text-xs sm:text-sm bg-[#FAF9F7] px-3.5 py-2.5 border border-[#002141]/15 text-[#002141] focus:outline-hidden focus:border-[#AC854B]"
                  />
                </div>
              )}

              {/* Champ E-mail (Identifiant de connexion obligatoire pour tous) */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#3A3A3A] mb-1.5">
                  Adresse e-mail <span className="text-[#AC854B]">*</span>
                  {authMode === 'register' && (
                    <span className="text-[10px] font-normal text-[#3A3A3A]/70 lowercase ml-1">
                      (votre identifiant unique de connexion)
                    </span>
                  )}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#3A3A3A]/50">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="votre.nom@exemple.ci"
                    className="w-full text-xs sm:text-sm bg-[#FAF9F7] pl-9.5 pr-3.5 py-2.5 border border-[#002141]/15 text-[#002141] focus:outline-hidden focus:border-[#AC854B]"
                  />
                </div>
              </div>

              {/* Champ Optionnel : Numéro WhatsApp (uniquement en mode Inscription) */}
              {authMode === 'register' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#3A3A3A]">
                      Numéro WhatsApp <span className="text-[10px] font-normal text-[#AC854B]">(Facultatif)</span>
                    </label>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-xs font-semibold flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      Suivi Conciergerie
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={phonePrefix}
                      onChange={(e) => setPhonePrefix(e.target.value)}
                      className="bg-[#FAF9F7] text-xs font-semibold px-2.5 py-2.5 border border-[#002141]/15 text-[#002141] focus:outline-hidden focus:border-[#AC854B]"
                    >
                      <option value="+225">+225 (Côte d'Ivoire)</option>
                      <option value="+33">+33 (France)</option>
                      <option value="+1">+1 (USA / Canada)</option>
                      <option value="+221">+221 (Sénégal)</option>
                      <option value="+229">+229 (Bénin)</option>
                      <option value="+226">+226 (Burkina Faso)</option>
                      <option value="+228">+228 (Togo)</option>
                      <option value="+237">+237 (Cameroun)</option>
                      <option value="+241">+241 (Gabon)</option>
                      <option value="+41">+41 (Suisse)</option>
                      <option value="+32">+32 (Belgique)</option>
                      <option value="+44">+44 (Royaume-Uni)</option>
                    </select>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="07 07 18 15 60"
                      className="flex-1 text-xs sm:text-sm bg-[#FAF9F7] px-3.5 py-2.5 border border-[#002141]/15 text-[#002141] focus:outline-hidden focus:border-[#AC854B]"
                    />
                  </div>
                  <span className="text-[10px] text-[#3A3A3A]/70 mt-1 block">
                    Permet à notre concierge horloger et au coursier de vous contacter sur WhatsApp pour coordonner la remise en mains propres.
                  </span>
                </div>
              )}

              {/* Mot de Passe */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#3A3A3A]">
                    Mot de passe <span className="text-[#AC854B]">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[10px] text-[#AC854B] hover:text-[#002141] flex items-center gap-1 cursor-pointer"
                  >
                    {showPassword ? (
                      <>
                        <EyeOff className="w-3 h-3" />
                        <span>Masquer</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" />
                        <span>Afficher</span>
                      </>
                    )}
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full text-xs sm:text-sm bg-[#FAF9F7] px-3.5 py-2.5 border border-[#002141]/15 text-[#002141] focus:outline-hidden focus:border-[#AC854B]"
                />
                {authMode === 'register' && (
                  <span className="text-[10px] text-[#3A3A3A]/60 mt-1 block">
                    Minimum 6 caractères de sécurité
                  </span>
                )}
              </div>

              {/* Commune et Adresse de livraison (en mode Inscription) */}
              {authMode === 'register' && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#3A3A3A] mb-1.5">
                      Commune de résidence (Abidjan)
                    </label>
                    <select
                      value={commune}
                      onChange={(e) => setCommune(e.target.value)}
                      className="w-full text-xs sm:text-sm bg-[#FAF9F7] px-3.5 py-2.5 border border-[#002141]/15 text-[#002141] focus:outline-hidden focus:border-[#AC854B]"
                    >
                      {ABIDJAN_COMMUNES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#3A3A3A] mb-1.5">
                      Quartier & Repères de livraison
                    </label>
                    <input
                      type="text"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Ex: Deux-Plateaux Vallon, non loin de l'église St Jacques"
                      className="w-full text-xs sm:text-sm bg-[#FAF9F7] px-3.5 py-2.5 border border-[#002141]/15 text-[#002141] focus:outline-hidden focus:border-[#AC854B]"
                    />
                  </div>
                </>
              )}

              {/* Bouton de Soumission */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-6 bg-[#002141] hover:bg-[#AC854B] text-[#FAF9F7] text-xs font-bold uppercase tracking-[0.16em] transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <span>Traitement en cours...</span>
                  ) : authMode === 'register' ? (
                    <>
                      <span>Créer mon compte privilège</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <span>Se connecter à mon espace</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-[#002141]/10 text-center">
              <p className="text-[11px] text-[#3A3A3A]/70">
                Vos données personnelles sont protégées par chiffrement et hébergées en conformité avec la réglementation ivoirienne (ARTCI - Loi 2013-450).
              </p>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* SECTION 2 : VISITEUR AUTHENTIFIÉ (ESPACE CLIENT VIP)                      */
          /* ========================================================================= */
          <div className="space-y-8">
            {/* VIP Client Header Bar */}
            <div className="bg-white border border-[#002141]/10 p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xs">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#FAF9F7] border-2 border-[#AC854B] flex items-center justify-center text-[#AC854B] shadow-xs">
                  <User className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-[#AC854B] px-2 py-0.5 bg-[#AC854B]/10 rounded-xs">
                      Membre Privilège HERITAGE
                    </span>
                    {isAdmin && (
                      <span className="text-[10px] uppercase font-bold tracking-widest text-white px-2 py-0.5 bg-[#002141] rounded-xs flex items-center gap-1">
                        <Shield className="w-3 h-3 text-[#AC854B]" />
                        Admin
                      </span>
                    )}
                  </div>
                  <h2 className="font-playfair text-xl sm:text-2xl font-bold text-[#002141] mt-1">
                    {userProfile?.fullName || 'Client Privilège'}
                  </h2>
                  <span className="text-xs text-[#3A3A3A]/80 font-mono flex items-center gap-1.5 mt-0.5">
                    <Mail className="w-3 h-3 text-[#AC854B]" />
                    {userEmail || userProfile?.email || 'Compte actif'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => navigate('/admin')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#002141] hover:bg-[#AC854B] text-[#FAF9F7] text-xs font-bold uppercase tracking-wider rounded-xs transition-colors cursor-pointer shadow-xs"
                  >
                    <Shield className="w-3.5 h-3.5 text-[#AC854B]" />
                    <span>Console Administration</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#FAF9F7] hover:bg-red-50 text-[#3A3A3A] hover:text-red-700 text-xs font-semibold border border-[#002141]/15 transition-colors cursor-pointer rounded-xs"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Déconnexion</span>
                </button>
              </div>
            </div>

            {/* Admin Quick Banner if Admin */}
            {isAdmin && (
              <div className="bg-gradient-to-r from-[#002141] to-[#003366] text-[#FAF9F7] p-5 border border-[#AC854B]/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Shield className="w-6 h-6 text-[#AC854B] flex-shrink-0" />
                  <div>
                    <h3 className="font-bold text-sm">
                      Vous disposez des privilèges Administrateur de la Maison HERITAGE
                    </h3>
                    <p className="text-xs text-[#FAF9F7]/70">
                      Accédez aux commandes en temps réel, suivez les clients et gérez les stocks de la Maison.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  className="px-4 py-2 bg-[#AC854B] hover:bg-[#97733E] text-[#002141] font-bold text-xs uppercase tracking-wider rounded-xs whitespace-nowrap cursor-pointer transition-colors"
                >
                  Ouvrir le Portail Admin
                </button>
              </div>
            )}

            {/* Client Tabs */}
            <div className="flex border-b border-[#002141]/10 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider cursor-pointer border-b-2 transition-all ${
                  activeTab === 'orders'
                    ? 'border-[#AC854B] text-[#002141] bg-white shadow-xs'
                    : 'border-transparent text-[#3A3A3A]/70 hover:text-[#002141]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5" />
                  Mes Commandes ({userOrders.length})
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider cursor-pointer border-b-2 transition-all ${
                  activeTab === 'profile'
                    ? 'border-[#AC854B] text-[#002141] bg-white shadow-xs'
                    : 'border-transparent text-[#3A3A3A]/70 hover:text-[#002141]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" />
                  Mon Profil & Adresses
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('warranty')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider cursor-pointer border-b-2 transition-all ${
                  activeTab === 'warranty'
                    ? 'border-[#AC854B] text-[#002141] bg-white shadow-xs'
                    : 'border-transparent text-[#3A3A3A]/70 hover:text-[#002141]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <FileCheck className="w-3.5 h-3.5" />
                  Garantie & Authenticité
                </span>
              </button>
            </div>

            {/* TAB 1: MES COMMANDES */}
            {activeTab === 'orders' && (
              <div className="space-y-6">
                {userOrders.length === 0 ? (
                  <div className="bg-white border border-[#002141]/10 p-12 text-center space-y-4">
                    <Package className="w-12 h-12 text-[#AC854B] mx-auto opacity-60" />
                    <h3 className="font-playfair text-xl font-bold text-[#002141]">
                      Aucune commande enregistrée
                    </h3>
                    <p className="text-xs text-[#3A3A3A] max-w-md mx-auto leading-relaxed">
                      Découvrez notre sélection horlogère suisse disponible à Abidjan et recevez votre garde-temps sous pli scellé.
                    </p>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => navigate('/montres')}
                        className="px-6 py-3 bg-[#002141] hover:bg-[#AC854B] text-[#FAF9F7] text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer"
                      >
                        Explorer les Montres Tissot
                      </button>
                    </div>
                  </div>
                ) : (
                  userOrders.map((ord) => (
                    <div key={ord.id} className="bg-white border border-[#002141]/10 overflow-hidden shadow-xs">
                      {/* Order Bar */}
                      <div className="bg-[#FAF9F7] p-5 border-b border-[#002141]/10 flex flex-wrap items-center justify-between gap-4 text-xs">
                        <div className="flex items-center gap-6">
                          <div>
                            <span className="text-[#3A3A3A]/70 block text-[10px] uppercase tracking-wider">
                              Commande Réf.
                            </span>
                            <span className="font-mono font-bold text-sm text-[#002141]">
                              {ord.orderNumber}
                            </span>
                          </div>
                          <div>
                            <span className="text-[#3A3A3A]/70 block text-[10px] uppercase tracking-wider">
                              Date
                            </span>
                            <span className="text-[#002141]">
                              {new Date(ord.createdAt).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                          <div>
                            <span className="text-[#3A3A3A]/70 block text-[10px] uppercase tracking-wider">
                              Lieu
                            </span>
                            <span className="text-[#002141] font-semibold">
                              {ord.customer.commune}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <span
                            className={`px-3 py-1 text-[10px] font-bold uppercase rounded-xs tracking-wider ${
                              ord.status === 'delivered'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : ord.status === 'shipped_or_ready'
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : ord.status === 'paid'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-stone-200 text-stone-800'
                            }`}
                          >
                            {ord.status === 'paid'
                              ? 'Payée — Préparation scellée'
                              : ord.status === 'shipped_or_ready'
                              ? 'En cours d\'acheminement'
                              : ord.status === 'delivered'
                              ? 'Livrée en mains propres'
                              : ord.status}
                          </span>
                          <span className="font-bold text-sm text-[#002141]">
                            {formatXOF(ord.totalXOF)}
                          </span>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="p-6 divide-y divide-[#002141]/5">
                        {ord.items.map(({ product, quantity }) => (
                          <div key={product.sku} className="py-3 flex items-center justify-between gap-4 text-xs">
                            <div className="flex items-center gap-4">
                              <img
                                src={product.primaryImage}
                                alt=""
                                className="w-14 h-16 object-contain bg-[#FAF9F7] p-1 border border-[#002141]/10 flex-shrink-0"
                              />
                              <div>
                                <span className="font-bold text-sm text-[#002141] block">
                                  {product.name}
                                </span>
                                <span className="text-[#3A3A3A]/70 text-[11px]">
                                  Réf. {product.reference} &middot; Quantité : {quantity}
                                </span>
                                <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
                                  ✓ Garantie internationale suisse 2 ans incluse
                                </span>
                              </div>
                            </div>
                            <span className="font-semibold text-sm text-[#002141]">
                              {formatXOF(product.priceXOF * quantity)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Footer & Support WhatsApp */}
                      <div className="bg-[#FAF9F7]/70 px-6 py-4 border-t border-[#002141]/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 text-[#3A3A3A]">
                          <Clock className="w-4 h-4 text-[#AC854B]" />
                          <span>
                            Dernier statut : {ord.statusHistory?.[ord.statusHistory.length - 1]?.note || 'Enregistrée'}
                          </span>
                        </div>
                        {orderSupportWhatsappUrl && <a
                          href={whatsappHref(siteSettings, `Bonjour Maison HERITAGE, je souhaite une information sur le suivi de ma commande ${ord.orderNumber}.`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#002141] hover:text-[#AC854B] font-semibold text-xs inline-flex items-center gap-1.5"
                        >
                          <span>Assistance WhatsApp pour cette pièce</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </a>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 2: MON PROFIL & ADRESSES */}
            {activeTab === 'profile' && (
              <div className="bg-white border border-[#002141]/10 p-6 sm:p-8">
                <h3 className="font-playfair text-xl font-bold text-[#002141] mb-2">
                  Mes Coordonnées de Membre Privilège
                </h3>
                <p className="text-xs text-[#3A3A3A] mb-6">
                  Votre compte et votre adresse e-mail certifient vos garanties suisses et facilitent la livraison scellée en mains propres.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 bg-[#FAF9F7] border border-[#002141]/10">
                    <span className="text-[10px] uppercase font-bold text-[#3A3A3A]/60 block mb-1">
                      Identifiant de Connexion (E-mail)
                    </span>
                    <span className="font-mono font-bold text-sm text-[#002141] flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-[#AC854B]" />
                      {userProfile?.email || userEmail}
                    </span>
                  </div>

                  <div className="p-4 bg-[#FAF9F7] border border-[#002141]/10">
                    <span className="text-[10px] uppercase font-bold text-[#3A3A3A]/60 block mb-1">
                      Numéro WhatsApp & Contact
                    </span>
                    {userProfile?.phone ? (
                      <span className="font-semibold text-sm text-emerald-800 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        {userProfile.phone}
                      </span>
                    ) : (
                      <span className="text-xs text-[#3A3A3A]/60 italic">
                        Non renseigné
                      </span>
                    )}
                  </div>

                  <div className="p-4 bg-[#FAF9F7] border border-[#002141]/10">
                    <span className="text-[10px] uppercase font-bold text-[#3A3A3A]/60 block mb-1">
                      Nom & Prénoms
                    </span>
                    <span className="font-semibold text-sm text-[#002141]">
                      {userProfile?.fullName || 'Client Privilège'}
                    </span>
                  </div>

                  <div className="p-4 bg-[#FAF9F7] border border-[#002141]/10">
                    <span className="text-[10px] uppercase font-bold text-[#3A3A3A]/60 block mb-1">
                      Statut Membre
                    </span>
                    <span className="font-bold text-emerald-800 inline-flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Client Vérifié HERITAGE
                    </span>
                  </div>

                  <div className="p-4 bg-[#FAF9F7] border border-[#002141]/10 sm:col-span-2">
                    <span className="text-[10px] uppercase font-bold text-[#3A3A3A]/60 block mb-1">
                      Commune habituelle à Abidjan
                    </span>
                    <span className="font-semibold text-sm text-[#002141]">
                      {userProfile?.commune || 'Abidjan'}
                    </span>
                    {userProfile?.deliveryAddress && (
                      <span className="text-xs text-[#3A3A3A]/80 block mt-1">
                        Repères : {userProfile.deliveryAddress}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: GARANTIE & AUTHENTICITÉ */}
            {activeTab === 'warranty' && (
              <div className="bg-white border border-[#002141]/10 p-6 sm:p-8 space-y-6">
                <div>
                  <h3 className="font-playfair text-xl font-bold text-[#002141] mb-2">
                    Certificat d'Authenticité & Garantie Suisse
                  </h3>
                  <p className="text-xs text-[#3A3A3A] leading-relaxed">
                    Chaque montre distribuée par la Maison HERITAGE bénéficie d'un certificat d'origine suisse et de la garantie internationale constructeur Tissot de 2 ans.
                  </p>
                </div>

                <div className="p-6 bg-[#FAF9F7] border border-[#AC854B]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#002141] text-[#AC854B] flex items-center justify-center flex-shrink-0">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#002141]">
                        Sceau de Garantie HERITAGE Abidjan
                      </h4>
                      <p className="text-xs text-[#3A3A3A]/80">
                        Prise en charge et révision auprès de notre atelier d'horlogerie partenaire à Abidjan.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/authenticite-garantie')}
                    className="px-4 py-2 bg-[#002141] hover:bg-[#AC854B] text-[#FAF9F7] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Consulter la Charte
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
