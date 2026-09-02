"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Loader2, Receipt, Send, CheckCircle2,
  AlertTriangle, Building2, Clock, XCircle, Trash2, ShieldCheck, Link as LinkIcon,
  RefreshCw, Smartphone
} from 'lucide-react';
import { checkSpendingLimit, INDIVIDUAL_INVOICE_DAILY_LIMIT, isEnterpriseAccount } from '@/lib/security/spending-limits';

type BankAccount = {
  id: string;
  kind: 'moncash' | 'natcash' | 'bank' | 'bank_us';
  label: string | null;
  phone: string | null;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  is_default: boolean;
};

function formatAccountOption(a: BankAccount): string {
  if (a.kind === 'moncash') return `MonCash · +${a.phone}`;
  if (a.kind === 'natcash') return `Natcash · +${a.phone}`;
  if (a.kind === 'bank_us') {
    return `Bank USA · ${a.bank_name || 'Bank'} · ••••${a.account_number?.slice(-4) || ''}`;
  }
  return `Bank HT · ${a.bank_name || 'Bank'} · ••••${a.account_number?.slice(-4) || ''}`;
}

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
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [hiddenBankUsCount, setHiddenBankUsCount] = useState(0);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [clientEmail, setClientEmail] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [currency, setCurrency] = useState<'HTG' | 'USD'>('HTG');
  const [payoutAccountId, setPayoutAccountId] = useState('');
  const [description, setDescription] = useState('');

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resyncingId, setResyncingId] = useState<string | null>(null);
  const [todayInvoiced, setTodayInvoiced] = useState(0);

  const enterprise = isEnterpriseAccount(profile?.account_type);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/bank-accounts');
      const data = await res.json();
      const all = (data.accounts || []) as BankAccount[];
      // Bank USA endisponib pou kounya a — pa ka resevwa peman fakti.
      const list = all.filter((a) => a.kind !== 'bank_us');
      setHiddenBankUsCount(all.length - list.length);
      setAccounts(list);
      setPayoutAccountId((prev) => {
        if (prev && list.some((a) => a.id === prev)) return prev;
        const def = list.find((a) => a.is_default) || list[0];
        return def?.id || '';
      });
    } catch {
      setAccounts([]);
    }
  }, []);

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

    await loadAccounts();
    setLoading(false);
  }, [supabase, router, loadAccounts]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Voye imèl fakti a atravè /api/invoices/notify.
   * Retounen yon mesaj erè si imèl la pa t ale, sinon null.
   */
  const notifyInvoiceEmail = async (invoiceId: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/invoices/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      let body: { success?: boolean; message?: string } | null = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      if (!res.ok || !body || body.success !== true) {
        return (body && body.message) || 'Imèl la pa t ka voye.';
      }
      return null;
    } catch {
      return 'Imèl la pa t ka voye (erè koneksyon).';
    }
  };

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
    if (!payoutAccountId) {
      setMessage({
        type: 'error',
        text: 'Chwazi ki kont ou vle resevwa kob la. Ale nan Dashboard → Konekte kont bank ou.',
      });
      return;
    }

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Ou dwe konekte.');

      const { data: freshProfile } = await supabase
        .from('profiles')
        .select('kyc_status, is_card_activated, features_unlock_paid, business_name, full_name, account_type, plan')
        .eq('id', user.id)
        .single();

      if (freshProfile?.kyc_status !== 'approved' && !freshProfile?.plan) {
        setMessage({ type: 'error', text: 'Chwazi yon plan sou paj Plan anvan ou voye fakti.' });
        setSending(false);
        return;
      }

      const limitAmount = currency === 'USD' ? numAmount * 132 : numAmount;
      const limitCheck = await checkSpendingLimit(
        supabase,
        user.id,
        freshProfile?.account_type,
        limitAmount,
        'invoice'
      );
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
          currency,
          payout_account_id: payoutAccountId,
          client_email: clientEmail.toLowerCase().trim(),
          description: description.trim() || null,
          status: 'pending',
        })
        .select()
        .single();

      if (invErr) throw invErr;

      const payLink = `${window.location.origin}/checkout-invoice/${
        inv.share_token || inv.id
      }`;

      let copied = false;
      try {
        await navigator.clipboard.writeText(payLink);
        copied = true;
      } catch {
        copied = false;
      }

      // Imèl la se yon pati enpòtan — men si li echwe, fakti a toujou kreye.
      const emailIssue = await notifyInvoiceEmail(inv.id);

      if (emailIssue) {
        setMessage({
          type: 'warning',
          text: `Fakti a kreye. Men ${emailIssue}${copied ? '' : ` Lyen: ${payLink}`}`,
        });
      } else {
        setMessage({
          type: 'success',
          text: copied
            ? 'Fakti a kreye! Lyen peman an kopye nan clipboard ou.'
            : `Fakti a kreye! Lyen: ${payLink}`,
        });
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

  const handleCopyLink = async (inv: { id: string; share_token?: string | null }) => {
    const payLink = `${window.location.origin}/checkout-invoice/${
      inv.share_token || inv.id
    }`;
    try {
      await navigator.clipboard.writeText(payLink);
      setCopiedId(inv.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  const handleCancelInvoice = async (invId: string) => {
    if (!confirm('Èske ou sèten ou vle anile fakti sa a?')) return;
    await supabase.from('invoices').update({ status: 'cancelled' }).eq('id', invId);
    loadData();
  };

  /** Renvoye imèl la bay kliyan an pou yon fakti ki deja egziste. */
  const handleResendInvoice = async (invId: string) => {
    setResendingId(invId);
    try {
      const issue = await notifyInvoiceEmail(invId);
      if (issue) {
        setMessage({ type: 'warning', text: `Imèl la pa t ale: ${issue}` });
      } else {
        setMessage({ type: 'success', text: 'Imèl la re-voye bay kliyan an.' });
      }
    } finally {
      setResendingId(null);
    }
  };

  /**
   * Verifye peman an dirèkteman sou MonCash — si kliyan an peye men fakti a
   * rete "an atant" (webhook pa rive), sa ka regle li imedyatman.
   */
  const handleResyncInvoice = async (invId: string) => {
    setResyncingId(invId);
    try {
      const res = await fetch(`/api/invoices/${invId}/resync`, { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body || body.ok !== true) {
        setMessage({
          type: 'warning',
          text: (body && body.message) || 'Pa t kapab verifye peman an.',
        });
        return;
      }
      await loadData();
      if (body.invoice_status === 'paid') {
        setMessage({
          type: 'success',
          text: `Kob la konfime sou MonCash — fakti a makè peye! Payout la ap fèt.`,
        });
      } else if (body.checked === 0) {
        setMessage({
          type: 'warning',
          text: 'Pa gen sesyon peman aktif pou fakti sa a. Kliyan an poko peye.',
        });
      } else {
        const reason = body.results?.[0]?.message;
        setMessage({
          type: 'warning',
          text: reason
            ? `MonCash poko konfime peman an: ${reason}`
            : 'MonCash poko konfime peman an. Tcheke (1) sesyon an poko fin peye, oswa (2) Alert URL sou kont MonCash HatexCard a: https://hatexcard.com/api/moncash/alert',
        });
      }
    } catch {
      setMessage({ type: 'error', text: 'Yon erè pase pandan verifyasyon peman an.' });
    } finally {
      setResyncingId(null);
    }
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

  const invoiceUnlocked = Boolean(profile?.plan) || profile?.kyc_status === 'approved';

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
              Chwazi kote ou vle resevwa kob la — kliyan an peye avèk MonCash (Visa / Natcash talè).
            </p>
          </div>
        </div>

        {profile?.kyc_status !== 'approved' && (profile?.intended_plan === 'capacity' || profile?.intended_plan === 'premium') && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-sm text-amber-800">
            Plan peye a mande KYC. Ou ka voye fakti kounye a ak limit plan Gratis.{' '}
            <button type="button" className="font-bold underline" onClick={() => router.push('/kyc/v2')}>
              Ale nan KYC
            </button>
          </div>
        )}

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

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-slate-600 font-bold uppercase mb-2 tracking-wider">Montan</label>
              <input
                type="number"
                required
                min={1}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0.00"
                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3.5 text-base font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-400 shadow-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 font-bold uppercase mb-2 tracking-wider">Lajan</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as 'HTG' | 'USD')}
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-3.5 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500"
              >
                <option value="HTG">HTG</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-600 font-bold uppercase mb-2 tracking-wider">
              Resevwa kob la sou
            </label>
            {accounts.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 space-y-2">
                {hiddenBankUsCount > 0 ? (
                  <>
                    <p>
                      Kont Bank USA ou yo pa ka resevwa peman pou kounya a. Konekte yon
                      kont MonCash oswa yon bank Ayiti.
                    </p>
                    <button
                      type="button"
                      className="font-bold underline"
                      onClick={() => router.push('/dashboard')}
                    >
                      Ale konekte MonCash / Bank Ayiti
                    </button>
                  </>
                ) : (
                  <p>
                    Ou poko konekte okenn kont.{' '}
                    <button
                      type="button"
                      className="font-bold underline"
                      onClick={() => router.push('/dashboard')}
                    >
                      Ale konekte MonCash / Natcash / Bank
                    </button>
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {accounts.map((a) => (
                  <label
                    key={a.id}
                    className={`flex items-center gap-3 border rounded-xl px-4 py-3 cursor-pointer transition-colors ${
                      payoutAccountId === a.id
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payout"
                      checked={payoutAccountId === a.id}
                      onChange={() => setPayoutAccountId(a.id)}
                      className="text-indigo-600"
                    />
                    <span className="w-8 h-8 rounded-full bg-white border border-gray-100 flex items-center justify-center text-indigo-600 shrink-0">
                      {a.kind === 'moncash' || a.kind === 'natcash' ? (
                        <Smartphone size={14} />
                      ) : (
                        <Building2 size={14} />
                      )}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">{formatAccountOption(a)}</span>
                  </label>
                ))}
              </div>
            )}
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
            <div
              className={`p-4 rounded-xl text-sm font-medium flex items-center gap-3 ${
                message.type === 'error'
                  ? 'bg-rose-50 border border-rose-200 text-rose-700'
                  : message.type === 'warning'
                    ? 'bg-amber-50 border border-amber-200 text-amber-700'
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 size={18} className="shrink-0" />
              ) : (
                <AlertTriangle size={18} className="shrink-0" />
              )}
              <span className="leading-tight">{message.text}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={sending || !invoiceUnlocked || accounts.length === 0}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
          >
            {sending ? <Loader2 className="animate-spin" size={20} /> : (<><Send size={16} /> Voye Fakti</>)}
          </button>
        </form>

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
                    <p className="text-sm font-bold text-slate-900">
                      {Number(inv.amount).toLocaleString()} {inv.currency || 'HTG'}
                    </p>
                    {statusBadge(inv.status)}
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => handleCopyLink(inv)}
                        title="Kopye lyen"
                        className="text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        {copiedId === inv.id ? <CheckCircle2 size={16} className="text-emerald-500" /> : <LinkIcon size={16} />}
                      </button>
                      {inv.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleResendInvoice(inv.id)}
                            disabled={resendingId === inv.id}
                            title="Renvoye imèl bay kliyan an"
                            className="text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
                          >
                            {resendingId === inv.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Send size={16} />
                            )}
                          </button>
                          <button
                            onClick={() => handleResyncInvoice(inv.id)}
                            disabled={resyncingId === inv.id}
                            title="Verifye peman sou MonCash (si kliyan an peye men fakti a rete an atant)"
                            className="text-slate-400 hover:text-emerald-600 transition-colors disabled:opacity-50"
                          >
                            {resyncingId === inv.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <RefreshCw size={16} />
                            )}
                          </button>
                          <button
                            onClick={() => handleCancelInvoice(inv.id)}
                            title="Anile fakti"
                            className="text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
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
