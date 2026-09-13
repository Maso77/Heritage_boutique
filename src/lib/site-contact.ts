export type SiteContactDetails = {
  phone?: string | null;
  whatsapp_phone?: string | null;
};

export const phoneDigits = (value?: string | null) => String(value || '').replace(/\D/g, '');

export const phoneHref = (value?: string | null) => {
  const digits = phoneDigits(value);
  return digits ? `tel:+${digits}` : undefined;
};

export const whatsappHref = (details: SiteContactDetails | null | undefined, message: string) => {
  const number = phoneDigits(details?.whatsapp_phone || details?.phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : undefined;
};
