'use client';

import { useParams } from 'next/navigation';
import { CheckoutWithToken } from '@/app/checkout/page';

/**
 * QR checkout — URL opake: /q/[token-kriple]
 * Pa ekspoze ?token=hex nan navigatè a.
 */
export default function EncryptedQrCheckoutPage() {
  const { token } = useParams<{ token: string }>();
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <p className="text-sm font-semibold text-slate-600">QR pa valab.</p>
      </div>
    );
  }
  return <CheckoutWithToken token={decodeURIComponent(token)} />;
}
