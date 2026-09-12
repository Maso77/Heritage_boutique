import React, { useState } from 'react';
import { MessageCircle, Phone, Mail, MapPin, Clock, Send, CheckCircle2 } from 'lucide-react';
import { usePublicContent } from '../../lib/public-content';
import { PublicFeedbackSections } from '../common/PublicFeedbackSections';

interface ContactViewProps {
  navigate: (route: string) => void;
}

export const ContactView: React.FC<ContactViewProps> = ({ navigate }) => {
  const { siteSettings, faqs, reviews } = usePublicContent();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'Renseignement sur une montre',
    message: '',
    website: ''
  });

  const [submitted, setSubmitted] = useState(false);
  const [submissionError, setSubmissionError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionError('');
    try {
      const response = await fetch('/api/public/contact-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: form.name, email: form.email, phone: form.phone, subject: form.subject, message: form.message, website: form.website })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Votre message ne peut pas être transmis pour le moment.');
      setSubmitted(true);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Votre message ne peut pas être transmis pour le moment. Veuillez réessayer.');
    }
  };
  const whatsappNumber = (siteSettings?.whatsapp_phone || siteSettings?.phone || '').replace(/\D/g, '');
  const contactFaqs = faqs.filter((faq) => faq.placements.includes('contact'));
  const featuredReviews = reviews.filter((review) => review.is_featured_contact).slice(0, 3);
  const socialLinks = Object.entries(siteSettings?.social_links || {}).filter(([, url]) => Boolean(url));

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
          <span className="text-[#002141] font-semibold">Contact & Conseil</span>
        </nav>

        <div className="max-w-3xl mb-12">
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#AC854B] block mb-2">
            À VOTRE ÉCOUTE
          </span>
          <h1 className="font-playfair text-3xl sm:text-4xl md:text-5xl font-bold text-[#002141] leading-tight mb-4">
            Échanger avec HERITAGE
          </h1>
          <p className="text-sm sm:text-base text-[#3A3A3A] leading-relaxed">
            Une question technique sur un calibre, une hésitation entre deux références ou une
            demande de prise de rendez-vous à Yopougon. Notre équipe vous répond avec attention.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Contact Details Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="premium-section-card bg-white border border-[#002141]/10 p-6 sm:p-8 space-y-6">
              <h2 className="font-playfair text-xl font-bold text-[#002141] pb-4 border-b border-[#002141]/10">
                Coordonnées de la Maison
              </h2>

              <div className="space-y-4 text-xs sm:text-sm text-[#3A3A3A]">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#FAF9F7] border border-[#AC854B]/30 flex items-center justify-center text-[#AC854B] flex-shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-[#002141] block mb-0.5">Adresse</strong>
                    <span>{siteSettings?.address || ''}</span>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#FAF9F7] border border-[#AC854B]/30 flex items-center justify-center text-[#AC854B] flex-shrink-0 mt-0.5">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-[#002141] block mb-0.5">Téléphone & WhatsApp</strong>
                    <a href={siteSettings?.phone ? `tel:${siteSettings.phone.replace(/\s/g, '')}` : undefined} className="hover:text-[#AC854B] transition-colors">
                      {siteSettings?.phone || ''}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#FAF9F7] border border-[#AC854B]/30 flex items-center justify-center text-[#AC854B] flex-shrink-0 mt-0.5">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-[#002141] block mb-0.5">Courriel direct</strong>
                    <a
                      href={siteSettings?.email ? `mailto:${siteSettings.email}` : undefined}
                      className="hover:text-[#AC854B] transition-colors"
                    >
                      {siteSettings?.email || ''}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#FAF9F7] border border-[#AC854B]/30 flex items-center justify-center text-[#AC854B] flex-shrink-0 mt-0.5">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-[#002141] block mb-0.5">Horaires de conseil</strong>
                    <span>{siteSettings?.hours || ''}</span>
                  </div>
                </div>
              </div>

              {whatsappNumber && <div className="pt-4 border-t border-[#002141]/10">
                <a
                  href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Bonjour HERITAGE, je souhaite un conseil au sujet de vos montres.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="premium-cta w-full py-3.5 px-6 bg-[#25D366] hover:bg-[#20b858] text-white text-xs font-bold uppercase tracking-[0.16em] flex items-center justify-center gap-2.5 shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>CONVERSATION WHATSAPP IMMÉDIATE</span>
                </a>
              </div>}
              {socialLinks.length > 0 && <div className="pt-4 border-t border-[#002141]/10"><p className="text-xs font-semibold uppercase tracking-wider text-[#002141]">Retrouvez HERITAGE</p><div className="mt-3 flex flex-wrap gap-3">{socialLinks.map(([network, url]) => <a key={network} href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#AC854B] hover:text-[#002141] transition-colors">{network}</a>)}</div></div>}
            </div>
          </div>

          {/* Form Column */}
          <div className="premium-section-card lg:col-span-7 bg-white border border-[#002141]/10 p-6 sm:p-10">
            {submitted ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="font-playfair text-2xl font-bold text-[#002141]">
                  Message transmis avec succès
                </h3>
                <p className="text-xs sm:text-sm text-[#3A3A3A] max-w-md mx-auto leading-relaxed">
                  Merci {form.name}. Votre demande a bien été enregistrée et sera examinée par la Maison HERITAGE.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setForm({
                      name: '',
                      email: '',
                      phone: '',
                      subject: 'Renseignement sur une montre',
                      message: '',
                      website: ''
                    });
                  }}
                  className="px-6 py-2.5 bg-[#002141] text-[#FAF9F7] text-xs font-semibold uppercase tracking-wider"
                >
                  ENVOYER UN AUTRE MESSAGE
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <h2 className="font-playfair text-xl font-bold text-[#002141] pb-2">
                  Formulaire de contact
                </h2>

                <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
                  <label>
                    Site web
                    <input
                      type="text"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      value={form.website}
                      onChange={(e) => setForm({ ...form, website: e.target.value })}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#3A3A3A] mb-1.5">
                      Votre nom complet *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Ex: Jean-Marc Yao"
                      className="w-full text-xs sm:text-sm bg-[#FAF9F7] px-3.5 py-2.5 border border-[#002141]/15 text-[#002141] focus:outline-hidden focus:border-[#AC854B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#3A3A3A] mb-1.5">
                      Numéro WhatsApp ou Téléphone *
                    </label>
                    <input
                      type="tel"
                      required
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+225 07 00 00 00 00"
                      className="w-full text-xs sm:text-sm bg-[#FAF9F7] px-3.5 py-2.5 border border-[#002141]/15 text-[#002141] focus:outline-hidden focus:border-[#AC854B]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#3A3A3A] mb-1.5">
                    Adresse e-mail *
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="votre-email@domaine.ci"
                    className="w-full text-xs sm:text-sm bg-[#FAF9F7] px-3.5 py-2.5 border border-[#002141]/15 text-[#002141] focus:outline-hidden focus:border-[#AC854B]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#3A3A3A] mb-1.5">
                    Objet de votre demande
                  </label>
                  <select
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full text-xs sm:text-sm bg-[#FAF9F7] px-3.5 py-2.5 border border-[#002141]/15 text-[#002141] focus:outline-hidden focus:border-[#AC854B]"
                  >
                    <option value="Renseignement sur une montre">Renseignement sur une montre</option>
                    <option value="Disponibilité d'un modèle">Disponibilité d'un modèle</option>
                    <option value="Prise de rendez-vous à Yopougon">Prise de rendez-vous à Yopougon</option>
                    <option value="Suivi de commande">Suivi de commande</option>
                    <option value="Autre demande">Autre demande</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#3A3A3A] mb-1.5">
                    Votre message *
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="Précisez la référence souhaitée ou toute question horlogère..."
                    className="w-full text-xs sm:text-sm bg-[#FAF9F7] px-3.5 py-2.5 border border-[#002141]/15 text-[#002141] focus:outline-hidden focus:border-[#AC854B]"
                  />
                </div>

                <button
                  type="submit"
                  className="premium-cta w-full py-4 px-6 bg-[#002141] hover:bg-[#AC854B] text-[#FAF9F7] text-xs font-bold uppercase tracking-[0.18em] flex items-center justify-center gap-3 cursor-pointer shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  <span>TRANSMETTRE MON MESSAGE</span>
                </button>
                {submissionError && <p role="alert" className="text-xs text-red-800">{submissionError}</p>}
              </form>
            )}
          </div>
        </div>
        <PublicFeedbackSections placement="contact" />
      </div>
    </div>
  );
};
