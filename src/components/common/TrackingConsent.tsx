import { useEffect, useState } from 'react';
import { publicRequest } from '../../lib/public-content';

type TrackingItem = { provider: string; pixel_id: string | null };
const key = 'heritage_tracking_consent';

/** Presents an explicit choice before any advertising or analytics tag is loaded. */
export const TrackingConsent = () => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (window.localStorage.getItem(key)) return;
    void publicRequest<TrackingItem[]>('/tracking').then((items) => setVisible(items.some((item) => item.pixel_id))).catch(() => undefined);
  }, []);
  if (!visible) return null;
  const decide = (value: 'granted' | 'denied') => {
    window.localStorage.setItem(key, value);
    window.dispatchEvent(new Event('heritage-consent-changed'));
    setVisible(false);
  };
  return <section role="dialog" aria-label="Préférences de mesure" className="fixed bottom-4 left-4 right-4 z-50 max-w-xl border border-[#D6BB8F] bg-[#002141] p-4 text-[#FAF9F7] shadow-2xl sm:left-auto"><p className="text-sm font-semibold">Mesure d’audience et publicité</p><p className="mt-2 text-xs leading-relaxed text-[#FAF9F7]/80">HERITAGE vous demande votre accord avant d’activer les outils Meta ou Google configurés par la boutique.</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => decide('denied')} className="border border-[#FAF9F7]/40 px-3 py-2 text-xs font-semibold">Refuser</button><button type="button" onClick={() => decide('granted')} className="bg-[#AC854B] px-3 py-2 text-xs font-bold text-[#002141]">Accepter</button></div></section>;
};
