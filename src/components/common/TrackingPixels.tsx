import { useEffect, useState } from 'react';
import { publicRequest } from '../../lib/public-content';

type Pixel = { provider: 'meta' | 'google_ads' | 'google_analytics'; pixel_id: string | null; requires_consent: boolean };

const hasConsent = () => window.localStorage.getItem('heritage_tracking_consent') === 'granted';

export const TrackingPixels = () => {
  const [consentGranted, setConsentGranted] = useState(hasConsent());
  useEffect(() => {
    const syncConsent = () => setConsentGranted(hasConsent());
    window.addEventListener('heritage-consent-changed', syncConsent);
    return () => window.removeEventListener('heritage-consent-changed', syncConsent);
  }, []);
  useEffect(() => {
    if (!consentGranted) return;
    let active = true;
    void publicRequest<Pixel[]>('/tracking').then((pixels) => {
      if (!active) return;
      pixels.filter((pixel) => pixel.pixel_id && (!pixel.requires_consent || hasConsent())).forEach((pixel) => {
        const id = pixel.pixel_id as string;
        if (document.getElementById(`heritage-pixel-${pixel.provider}-${id}`)) return;
        if (pixel.provider === 'meta') {
          const script = document.createElement('script');
          script.id = `heritage-pixel-meta-${id}`;
          script.text = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');`;
          document.head.appendChild(script);
        }
        if (pixel.provider === 'google_analytics' || pixel.provider === 'google_ads') {
          const script = document.createElement('script');
          script.id = `heritage-pixel-${pixel.provider}-${id}`;
          script.async = true;
          script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
          document.head.appendChild(script);
          const config = document.createElement('script');
          config.id = `heritage-pixel-config-${pixel.provider}-${id}`;
          config.text = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config','${id}');`;
          document.head.appendChild(config);
        }
      });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [consentGranted]);
  return null;
};
