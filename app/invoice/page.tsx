"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Loader2, Receipt, Send, Copy, CheckCircle2,
  AlertTriangle, Building2, Clock, XCircle, Trash2, ShieldCheck, Link as LinkIcon
} from 'lucide-react';
import { checkSpendingLimit, INDIVIDUAL_INVOICE_DAILY_LIMIT, isEnterpriseAccount } from '@/lib/security/spending-limits';

export default function InvoicePage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [clientEmail, setClientEmail] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [description, setDescription] = useState('');

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [todayInvoiced, setTodayInvoiced] = useState(0);

  const enterprise = isEnterpriseAccount(profile?.account_type);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(prof);

    const { data: inv } = await supabase
      .from('invoices')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });
    setInvoices(inv || []);

    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const totalToday = (inv || [])
      .filter(i => i.status !== 'cancelled' && new Date(i.created_at) >= startToday)
      .reduce((acc, i) => acc + Number(i.amount || 0), 0);
    setTodayInvoiced(totalToday);

    setLoading(false);
  }, [supabase, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSendInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setMessage({ type: 'error', text: 'Tanpri antre yon montan valid.' });
      return;
    }
    if (!clientEmail || !clientEmail.includes('@')) {
      setMessage({ type: 'error', text: 'Tanpri antre yon imel valid pou kliyan an.' });
      return;
    }

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Ou dwe konekte.');

      const { data: freshProfile } = await supabase
        .from('profiles')
        .select('kyc_status, business_name, full_name, account_type')
        .eq('id', user.id)
        .single();

      if (freshProfile?.kyc_status !== 'approved') {
        setMessage({ type: 'error', text: "Ou dwe pase verifikasyon KYC anvan ou ka voye fakti." });
        setSending(false);
        return;
      }

      // Sekirite anti-fwod: kont endividyèl kanpe a 85,000 HTG/jou, Antrepriz ilimite.
      const limitCheck = await checkSpendingLimit(supabase, user.id, freshProfile?.account_type, numAmount, 'invoice');
      if (!limitCheck.allowed) {
        setMessage({ type: 'error', text: limitCheck.message || 'Ou depase limit jounalye fakti a.' });
        setSending(false);
        return;
      }

      const { data: inv, error: invErr } = await supabase
        .from('invoices')
        .insert({
          owner_id: user.id,
          amount: numAmount,
          client_email: clientEmail.toLowerCase().trim(),
          description: description.trim() || null,
          status: 'pending',
        })
        .select()
        .single();

      if (invErr) throw invErr;

      const payLink = `${window.location.origin}/checkout-invoice/${inv.id}`;

      try {
        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/resend-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            table: 'invoices',
            record: {
              id: inv.id,
              amount: inv.amount,
              client_email: inv.client_email,
              business_name: freshProfile.business_name || freshProfile.full_name || 'HatexCard',
              pay_url: payLink,
            },
          }),
        });
      } catch {
        // Si notifikasyon imel echwe, sa pa dwe bloke kreyasyon fakti a — lyen an toujou valid.
      }

      try {
        await navigator.clipboard.writeText(payLink);
        setMessage({ type: 'success', text: 'Fakti a kreye! Lyen peman an kopye nan clipboard ou.' });
      } catch {
        setMessage({ type: 'success', text: `Fakti a kreye! Lyen: ${payLink}` });
      }

      setClientEmail('');
      setAmount('');
      setDescription('');
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Yon erè pase pandan kreyasyon fakti a.' });
    } finally {
      setSending(false);
    }
  };

  const handleCopyLink = async (invId: string) => {
    const payLink = `${window.location.origin}/checkout-invoice/${invId}`;
    try {
      await navigator.clipboard.writeText(payLink);
      setCopiedId(invId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  const handleCancelInvoice = async (invId: string) => {
    if (!confirm('Èske ou sèten ou vle anile fakti sa a?')) return;
    await supabase.from('invoices').update({ status: 'cancelled' }).eq('id', invId);
    loadData();
  };

  const statusBadge = (status: string) => {
    if (status === 'paid') {
      return (
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-lg">
          <CheckCircle2 size={12} /> Peye
        </span>
      );
    }
    if (status === 'cancelled') {
      return (
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-1 rounded-lg">
          <XCircle size={12} /> Anile
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-1 rounded-lg">
        <Clock size={12} /> Annatant
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={36} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-6"
        >
          <ArrowLeft size={18} /> Retounen nan Dashboard
        </button>

        <div className="flex items-center gap-4 mb-8">
          <span className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 border border-indigo-100">
            <Receipt size={28} />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Voye Fakti (Invoice)</h1>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Kreye yon fakti pou mande lajan nan men yon kliyan — li ka peye avèk kat li.
            </p>
          </div>
        </div>

        {/* Limit info */}
        <div className={`p-4 rounded-2xl border mb-6 flex items-start gap-3 ${enterprise ? 'bg-emerald-50 border-emerald-100' : 'bg-indigo-50 border-indigo-100'}`}>
          {enterprise ? <Building2 size={18} className="text-emerald-600 shrink-0 mt-0.5" /> : <ShieldCheck size={18} className="text-indigo-600 shrink-0 mt-0.5" />}
          <div>
            {enterprise ? (
              <p className="text-xs font-bold text-emerald-700">
                Kont Antrepriz: ou ka voye fakti san limit jounalye.
              </p>
            ) : (
              <p className="text-xs font-bold text-indigo-700">
                Kont Endividyèl: limit jounalye pou fakti se {INDIVIDUAL_INVOICE_DAILY_LIMIT.toLocaleString()} HTG.
                {' '}Ou gentan kreye {todayInvoiced.toLocaleString()} HTG jodi a.
              </p>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSendInvoice} className="bg-white border border-gray-200 rounded-3xl shadow-sm p-6 sm:p-8 mb-8 space-y-5">
          <div>
            <label className="block text-xs text-slate-600 font-bold uppercase mb-2 tracking-wider">Imel Kliyan</label>
            <input
              type="email"
              required
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="kliyan@egzanp.com"
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3.5 text-base font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-400 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-600 font-bold uppercase mb-2 tracking-wider">Montan (HTG)</label>
            <input
              type="number"
              required
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0.00"
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3.5 text-base font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-400 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-600 font-bold uppercase mb-2 tracking-wider">Deskripsyon (opsyonèl)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Egzanp: Peman pou sèvis konsiltasyon..."
              rows={3}
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-400 shadow-sm resize-none"
            />
          </div>

          {message.text && (
            <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-3 ${message.type === 'error' ? 'bg-rose-50 border border-rose-200 text-rose-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
              {message.type === 'error' ? <AlertTriangle size={18} className="shrink-0" /> : <CheckCircle2 size={18} className="shrink-0" />}
              <span className="leading-tight">{message.text}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={sending}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
          >
            {sending ? <Loader2 className="animate-spin" size={20} /> : (<><Send size={16} /> Voye Fakti</>)}
          </button>
        </form>

        {/* History */}
        <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-bold text-slate-900">Istorik Fakti Mwen</h2>
            <p className="text-xs text-slate-500 mt-1">Tout fakti ou te voye yo parèt isit la.</p>
          </div>
          <div className="max-h-[480px] overflow-y-auto divide-y divide-gray-100">
            {invoices.length === 0 ? (
              <p className="text-center text-slate-400 text-xs font-bold uppercase py-10">Ou poko voye okenn fakti.</p>
            ) : (
              invoices.map((inv) => (
                <div key={inv.id} className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                      <Receipt size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{inv.client_email}</p>
                      <p className="text-xs text-slate-500 truncate">{inv.description || 'Pa gen deskripsyon'}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{new Date(inv.created_at).toLocaleString('fr-HT')}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <p className="text-sm font-bold text-slate-900">{Number(inv.amount).toLocaleString()} HTG</p>
                    {statusBadge(inv.status)}
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => handleCopyLink(inv.id)}
                        title="Kopye lyen"
                        className="text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        {copiedId === inv.id ? <CheckCircle2 size={16} className="text-emerald-500" /> : <LinkIcon size={16} />}
                      </button>
                      {inv.status === 'pending' && (
                        <button
                          onClick={() => handleCancelInvoice(inv.id)}
                          title="Anile fakti"
                          className="text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
