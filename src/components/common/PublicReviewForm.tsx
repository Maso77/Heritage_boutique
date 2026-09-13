import React, { useState } from 'react';

interface PublicReviewFormProps {
  product?: { id: string; name: string };
}

const emptyForm = {
  author_name: '',
  author_email: '',
  rating: '5',
  title: '',
  body: '',
  website: ''
};

export const PublicReviewForm: React.FC<PublicReviewFormProps> = ({ product }) => {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const headingId = product ? `review-form-${product.id}` : 'site-review-form';

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const response = await fetch('/api/public/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, product_id: product?.id || null })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Votre avis ne peut pas être transmis pour le moment.');
      setSubmitted(true);
      setForm(emptyForm);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Votre avis ne peut pas être transmis pour le moment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-white border border-[#002141]/10 p-6 sm:p-8" aria-labelledby={headingId}>
      <div className="max-w-2xl">
        <h2 id={headingId} className="font-playfair text-2xl font-bold text-[#002141]">
          {product ? `Votre avis sur ${product.name}` : 'Votre avis sur HERITAGE'}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#3A3A3A]">
          Votre retour sera examiné avant toute publication. Votre adresse e-mail n’est pas affichée publiquement.
        </p>
      </div>

      {submitted ? (
        <div className="mt-6 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          Votre avis a été transmis pour modération.
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#3A3A3A] mb-1.5" htmlFor={`${headingId}-name`}>Nom affiché *</label>
            <input id={`${headingId}-name`} required minLength={2} maxLength={160} value={form.author_name} onChange={(event) => setForm((current) => ({ ...current, author_name: event.target.value }))} className="w-full bg-[#FAF9F7] px-3.5 py-2.5 text-sm text-[#002141] border border-[#002141]/15 focus:outline-hidden focus:border-[#AC854B]" autoComplete="name" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#3A3A3A] mb-1.5" htmlFor={`${headingId}-email`}>Adresse e-mail *</label>
            <input id={`${headingId}-email`} required type="email" maxLength={180} value={form.author_email} onChange={(event) => setForm((current) => ({ ...current, author_email: event.target.value }))} className="w-full bg-[#FAF9F7] px-3.5 py-2.5 text-sm text-[#002141] border border-[#002141]/15 focus:outline-hidden focus:border-[#AC854B]" autoComplete="email" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#3A3A3A] mb-1.5" htmlFor={`${headingId}-rating`}>Note *</label>
            <select id={`${headingId}-rating`} required value={form.rating} onChange={(event) => setForm((current) => ({ ...current, rating: event.target.value }))} className="w-full bg-[#FAF9F7] px-3.5 py-2.5 text-sm text-[#002141] border border-[#002141]/15 focus:outline-hidden focus:border-[#AC854B]">
              {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#3A3A3A] mb-1.5" htmlFor={`${headingId}-title`}>Titre <span className="normal-case font-normal">(facultatif)</span></label>
            <input id={`${headingId}-title`} maxLength={180} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="w-full bg-[#FAF9F7] px-3.5 py-2.5 text-sm text-[#002141] border border-[#002141]/15 focus:outline-hidden focus:border-[#AC854B]" />
          </div>
          <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
            <label htmlFor={`${headingId}-website`}>Site web</label>
            <input id={`${headingId}-website`} type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#3A3A3A] mb-1.5" htmlFor={`${headingId}-body`}>Votre avis *</label>
            <textarea id={`${headingId}-body`} required minLength={10} maxLength={3000} rows={5} value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} className="w-full resize-y bg-[#FAF9F7] px-3.5 py-2.5 text-sm text-[#002141] border border-[#002141]/15 focus:outline-hidden focus:border-[#AC854B]" />
          </div>
          {error && <p className="sm:col-span-2 text-sm text-red-800" role="alert">{error}</p>}
          <div className="sm:col-span-2">
            <button type="submit" disabled={submitting} className="premium-cta bg-[#002141] px-6 py-3.5 text-xs font-bold uppercase tracking-[0.16em] text-[#FAF9F7] hover:bg-[#AC854B] disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? 'Transmission…' : 'Transmettre mon avis'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
};
