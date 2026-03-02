'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PayPage() {
  const { id } = useParams();
  const [payment, setPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [formData, setFormData] = useState({
    cardNumber: '',
    expiry: '',
    cvc: '',
    name: ''
  });

  useEffect(() => {
    loadPayment();
  }, [id]);

  const loadPayment = async () => {
    const { data, error } = await supabase
      .from('payments')
      .select('*, merchants(*)')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error loading payment:', error);
      return;
    }

    setPayment(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);

    try {
      // 1. Verifye peman an (simile - nan reyalite ou ta voye bay yon processeur)
      const response = await fetch('/api/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: id,
          cardData: formData // Nan reyalite, pa ta dwe voye sa dirèkteman!
        })
      });

      const data = await response.json();

      if (data.success) {
        // 2. Redireksyon an
        window.location.href = payment.return_url;
      } else {
        alert('Peman an echwe. Tanpri rekòmanse.');
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('Yon erè te rive. Tanpri rekòmanse.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="text-center p-8">Chajman...</div>;
  if (!payment) return <div className="text-center p-8">Peman pa jwenn</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-2">Peye ak HatexCard</h1>
        
        <div className="mb-6 p-4 bg-gray-50 rounded">
          <p className="text-sm text-gray-600">Machann:</p>
          <p className="font-bold">{payment.merchants?.business_name || 'Machann'}</p>
          <p className="text-2xl font-bold text-red-600 mt-2">
            {payment.amount.toLocaleString()} {payment.currency}
          </p>
          <p className="text-sm text-gray-600 mt-1">{payment.description}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Non sou kat la
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nimewo kat
            </label>
            <input
              type="text"
              required
              maxLength={19}
              placeholder="1234 5678 9012 3456"
              value={formData.cardNumber}
              onChange={(e) => setFormData({...formData, cardNumber: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ekspirasyon (MM/YY)
              </label>
              <input
                type="text"
                required
                placeholder="MM/YY"
                maxLength={5}
                value={formData.expiry}
                onChange={(e) => setFormData({...formData, expiry: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CVC
              </label>
              <input
                type="text"
                required
                maxLength={4}
                value={formData.cvc}
                onChange={(e) => setFormData({...formData, cvc: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={processing}
            className="w-full bg-red-600 text-white py-3 rounded font-bold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? 'Ap trete...' : 'Peye kounye a'}
          </button>

          <p className="text-xs text-gray-500 text-center mt-4">
            🔒 Peman an sekirize pa HatexCard. Nou pa janm estoke enfòmasyon kat ou.
          </p>
        </form>
      </div>
    </div>
  );
}