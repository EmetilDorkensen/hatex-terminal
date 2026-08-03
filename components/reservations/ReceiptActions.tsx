'use client';

import jsPDF from 'jspdf';
import { Download, MessageCircle } from 'lucide-react';
import { buildClientWhatsAppMessage, buildWhatsAppLink } from '@/lib/reservations/types';

export type ReceiptSnapshot = {
  listing_title?: string;
  listing_photos?: string[];
  category?: string;
  unit_price?: number;
  delivery_fee?: number;
  delivery_requested?: boolean;
  amount?: number;
  scheduled_at?: string;
  buyer_name?: string;
  merchant_name?: string;
  business_name?: string;
  logo_url?: string;
  merchant_phone?: string;
  merchant_whatsapp?: string;
  merchant_address?: string;
  listing_phone?: string;
  listing_description?: string;
  billing_interval_days?: number;
  car_make?: string;
  car_year?: string | number;
};

export function ReservationReceiptActions({
  snapshot,
}: {
  snapshot: ReceiptSnapshot | null | undefined;
  /** @deprecated pa montre nan resi / WA — kenbe prop pou konpatibilite */
  bookingId?: string;
}) {
  const s = snapshot || {};
  const wa = s.merchant_whatsapp || s.merchant_phone || '';
  const isSub = s.category === 'subscription';

  const downloadPdf = () => {
    const doc = new jsPDF();
    let y = 18;
    doc.setFontSize(16);
    doc.text(isSub ? 'HatexCard — Resi Abònman' : 'HatexCard — Resi Rezèvasyon', 14, y);
    y += 10;
    doc.setFontSize(11);
    doc.text(`Biznis: ${s.business_name || s.merchant_name || 'N/A'}`, 14, y);
    y += 7;
    doc.text(`Machann: ${s.merchant_name || 'N/A'}`, 14, y);
    y += 7;
    if (!isSub) {
      doc.text(`Adrès: ${s.merchant_address || 'N/A'}`, 14, y);
      y += 7;
    }
    doc.text(`Telefòn: ${s.listing_phone || s.merchant_phone || 'N/A'}`, 14, y);
    y += 7;
    doc.text(`${isSub ? 'Abònman' : 'Pwodwi'}: ${s.listing_title || 'N/A'}`, 14, y);
    y += 7;
    if (s.listing_description) {
      const desc = String(s.listing_description).slice(0, 120);
      doc.text(`Detay: ${desc}`, 14, y);
      y += 7;
    }
    if (isSub && s.billing_interval_days) {
      doc.text(`Debit: chak ${s.billing_interval_days} jou`, 14, y);
      y += 7;
    }
    if (s.car_make) {
      doc.text(`Machin: ${s.car_make}${s.car_year ? ` (${s.car_year})` : ''}`, 14, y);
      y += 7;
    }
    doc.text(`Kliyan: ${s.buyer_name || 'N/A'}`, 14, y);
    y += 7;
    if (!isSub && s.scheduled_at) {
      doc.text(`Dat rezèvasyon: ${new Date(s.scheduled_at).toLocaleString('fr-HT')}`, 14, y);
      y += 7;
    }
    doc.text(`Pri: ${Number(s.unit_price || s.amount || 0).toLocaleString()} HTG`, 14, y);
    y += 7;
    if (s.delivery_requested) {
      doc.text(`Livrezon: ${Number(s.delivery_fee || 0).toLocaleString()} HTG`, 14, y);
      y += 7;
    }
    doc.setFontSize(13);
    doc.text(`Total: ${Number(s.amount || 0).toLocaleString()} HTG`, 14, y);
    doc.save(`hatex-${isSub ? 'abonnman' : 'resi'}-${Date.now()}.pdf`);
  };

  const waHref = wa
    ? buildWhatsAppLink(
        wa,
        buildClientWhatsAppMessage({
          category: s.category,
          listing_title: s.listing_title,
          amount: s.amount,
          buyer_name: s.buyer_name,
          business_name: s.business_name,
          description: s.listing_description,
          billing_interval_days: s.billing_interval_days,
          car_make: s.car_make,
          car_year: s.car_year,
        })
      )
    : null;

  return (
    <div className="flex flex-col gap-3 w-full max-w-sm mx-auto">
      <button
        type="button"
        onClick={downloadPdf}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700"
      >
        <Download size={18} />
        Telechaje resi PDF
      </button>
      {waHref && (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 border border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold py-3 rounded-xl hover:bg-emerald-100"
        >
          <MessageCircle size={18} />
          Kontak WhatsApp
        </a>
      )}
    </div>
  );
}
