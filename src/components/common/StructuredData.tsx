import { useEffect } from 'react';
import { usePublicContent } from '../../lib/public-content';

/** JSON-LD is enabled only after the business validates its details in the portal. */
export const StructuredData = () => {
  const { siteSettings } = usePublicContent();

  useEffect(() => {
    if (!siteSettings?.structured_data_enabled) return;
    const id = 'heritage-organization-jsonld';
    document.getElementById(id)?.remove();
    const script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: siteSettings.business_name,
      email: siteSettings.email || undefined,
      telephone: siteSettings.phone || undefined,
      address: siteSettings.address ? { '@type': 'PostalAddress', streetAddress: siteSettings.address, addressLocality: 'Abidjan', addressCountry: 'CI' } : undefined,
      sameAs: Object.values(siteSettings.social_links || {})
    });
    document.head.appendChild(script);
    return () => { script.remove(); };
  }, [siteSettings]);

  return null;
};
