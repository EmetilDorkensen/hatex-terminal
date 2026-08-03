export const RESERVATION_CATEGORIES = [
  'hotel_room',
  'restaurant_dish',
  'bar',
  'car_rental',
  'subscription',
] as const;

export type ReservationCategory = (typeof RESERVATION_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ReservationCategory, string> = {
  hotel_room: 'Chanm otèl',
  restaurant_dish: 'Restoran',
  bar: 'Bar',
  car_rental: 'Lokasyon machin',
  subscription: 'Abònman',
};

export const HAITI_ZONES = [
  'Port-au-Prince',
  'Pétion-Ville',
  'Delmas',
  'Carrefour',
  'Tabarre',
  'Croix-des-Bouquets',
  'Cap-Haïtien',
  'Jacmel',
  'Les Cayes',
  'Gonaïves',
  'Saint-Marc',
  'Jérémie',
  'Hinche',
  'Fort-Liberté',
  'Miragoâne',
  'Lòt',
] as const;

export type ListingMeta = {
  house_number?: string;
  capacity?: number;
  nights_pricing?: boolean;
  opens_at?: string;
  closes_at?: string;
  delivery_enabled?: boolean;
  delivery_fee?: number;
  conditions?: string;
  billing_interval_days?: number;
  duration_days?: number;
  /** Lokasyon machin */
  car_make?: string;
  car_year?: string | number;
};

export function minPhotosForCategory(category: ReservationCategory): number {
  switch (category) {
    case 'hotel_room':
      return 4;
    case 'car_rental':
      return 5;
    case 'subscription':
      return 1;
    case 'restaurant_dish':
    case 'bar':
      return 0;
    default:
      return 0;
  }
}

export function maxPhotosForCategory(category: ReservationCategory): number {
  switch (category) {
    case 'hotel_room':
      return 4;
    case 'car_rental':
      return 5;
    case 'bar':
      return 5;
    case 'subscription':
      return 1;
    case 'restaurant_dish':
      return 2;
    default:
      return 6;
  }
}

export function validateListingInput(input: {
  category: ReservationCategory;
  title: string;
  price: number;
  address?: string;
  phone?: string;
  photos: string[];
  whatsapp?: string;
  meta?: ListingMeta;
}): { ok: true } | { ok: false; message: string } {
  if (!input.title?.trim()) return { ok: false, message: 'Tit / non obligatwa.' };
  if (!Number.isFinite(input.price) || input.price <= 0) {
    return { ok: false, message: 'Pri pa valab.' };
  }
  if (!input.whatsapp?.trim()) {
    return { ok: false, message: 'Nimewo WhatsApp obligatwa (nan pwofil).' };
  }

  const isSub = input.category === 'subscription';

  if (!isSub) {
    if (!input.address?.trim()) {
      return { ok: false, message: 'Adrès konplè obligatwa.' };
    }
    if (!input.phone?.trim()) {
      return { ok: false, message: 'Nimewo telefòn obligatwa.' };
    }
  }

  const minP = minPhotosForCategory(input.category);
  const maxP = maxPhotosForCategory(input.category);
  if (input.photos.length < minP) {
    return { ok: false, message: `Ou bezwen omwen ${minP} foto.` };
  }
  if (input.photos.length > maxP) {
    return { ok: false, message: `Maksimòm ${maxP} foto pou kategori sa a.` };
  }

  if (input.category === 'hotel_room' && !input.meta?.house_number?.trim()) {
    return { ok: false, message: 'Nimewo kay otèl la obligatwa.' };
  }

  if (input.category === 'restaurant_dish') {
    if (!input.meta?.opens_at || !input.meta?.closes_at) {
      return { ok: false, message: 'Orè ouvèti / fèmen obligatwa pou restoran.' };
    }
    if (input.meta.delivery_enabled && (input.meta.delivery_fee == null || input.meta.delivery_fee < 0)) {
      return { ok: false, message: 'Mete frais livrezon (oswa 0).' };
    }
  }

  if (input.category === 'car_rental') {
    if (!input.meta?.car_make?.trim()) {
      return { ok: false, message: 'Mak machin nan obligatwa.' };
    }
    if (!String(input.meta?.car_year || '').trim()) {
      return { ok: false, message: 'Ane machin nan obligatwa.' };
    }
    if (!input.meta?.conditions?.trim()) {
      return { ok: false, message: 'Dekri kondisyon machin nan pou kliyan yo.' };
    }
  }

  if (isSub) {
    const days = Number(input.meta?.billing_interval_days || input.meta?.duration_days || 0);
    if (!Number.isFinite(days) || days < 1) {
      return { ok: false, message: 'Kantite jou abònman obligatwa.' };
    }
  }

  return { ok: true };
}

/** Normalize phone to digits for wa.me */
export function whatsappDigits(phone: string): string {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 8) d = '509' + d;
  return d;
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = whatsappDigits(phone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildClientWhatsAppMessage(snapshot: {
  category?: string;
  listing_title?: string;
  amount?: number;
  buyer_name?: string;
  business_name?: string;
  description?: string;
  billing_interval_days?: number;
  car_make?: string;
  car_year?: string | number;
  scheduled_at?: string;
  scheduled_end?: string;
  customer_note?: string;
  delivery_requested?: boolean;
  delivery_address?: string;
  quantity?: number;
}): string {
  const isSub = snapshot.category === 'subscription';
  const title = snapshot.listing_title || (isSub ? 'abònman' : 'sèvis');
  const amount = Number(snapshot.amount || 0).toLocaleString();
  const buyer = snapshot.buyer_name || 'Kliyan';
  const note = String(snapshot.customer_note || '').trim();

  const formatWhen = (iso?: string) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('fr-HT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  if (isSub) {
    const days = snapshot.billing_interval_days || '';
    const lines = [
      `Bonjou, mwen se ${buyer}.`,
      `Mwen peye abònman « ${title} » sou HatexCard (${amount} HTG).`,
      days ? `Dire / debit: chak ${days} jou.` : '',
      snapshot.description ? `Detay: ${snapshot.description}` : '',
      note ? `Nòt mwen: ${note}` : '',
      'Tanpri aktive abònman an pou mwen. Mèsi.',
    ].filter(Boolean);
    return lines.join('\n');
  }

  return [
    `Bonjou, mwen se ${buyer}.`,
    `Mwen peye rezèvasyon « ${title} » sou HatexCard (${amount} HTG).`,
    snapshot.scheduled_at ? `Dat / lè: ${formatWhen(snapshot.scheduled_at)}` : '',
    snapshot.scheduled_end ? `Jiska: ${formatWhen(snapshot.scheduled_end)}` : '',
    snapshot.quantity && Number(snapshot.quantity) > 1 ? `Kantite: ${snapshot.quantity}` : '',
    snapshot.car_make
      ? `Machin: ${snapshot.car_make}${snapshot.car_year ? ` (${snapshot.car_year})` : ''}`
      : '',
    snapshot.delivery_requested
      ? `Livrezon: ${snapshot.delivery_address || 'Wi'}`
      : '',
    note ? `Nòt mwen / sa m ta renmen anplis: ${note}` : '',
    'Mwen ap vin jan m te rezève a. Mèsi.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function computeBookingAmount(opts: {
  unitPrice: number;
  nightsOrDays?: number;
  quantity?: number;
  deliveryFee?: number;
  deliveryRequested?: boolean;
}): number {
  const units = Math.max(1, opts.nightsOrDays || 1);
  const qty = Math.max(1, opts.quantity || 1);
  const base = opts.unitPrice * units * qty;
  const delivery =
    opts.deliveryRequested && opts.deliveryFee && opts.deliveryFee > 0 ? opts.deliveryFee : 0;
  return Math.round((base + delivery) * 100) / 100;
}
