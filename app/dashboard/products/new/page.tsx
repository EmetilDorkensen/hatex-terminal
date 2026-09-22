"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import SafeImg from '@/components/SafeImg';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Package,
  X,
} from 'lucide-react';

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
  return `Bank HT · ${a.bank_name || 'Bank'} · ••••${a.account_number?.slice(-4) || ''}`;
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export default function NewProductPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [profile, setProfile] = useState<any>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [hiddenBankUsCount, setHiddenBankUsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [name, setName] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [payoutAccountId, setPayoutAccountId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: prof } = await supabase
      .from('profiles')
      .select('kyc_status, plan, account_type')
      .eq('id', user.id)
      .single();
    setProfile(prof);

    try {
      const res = await fetch('/api/v2/bank-accounts');
      const data = await res.json();
      const all = (data.accounts || []) as BankAccount[];
      // Bank USA endisponib pou kounya a — pa ka resevwa peman pwodwi.
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

    setLoading(false);
  }, [supabase, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Tanpri chwazi yon fichye imaj (JPG, PNG...).' });
      return;
    }
    if (f.size > 4 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Imaj la twò gwo. Maksimòm 4 MB.' });
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setMessage({ type: '', text: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    const numPrice = Number(price);
    if (!name.trim() || name.trim().length > 120) {
      setMessage({ type: 'error', text: 'Tanpri antre yon non pwodwi (maksimòm 120 karaktè).' });
      return;
    }
    if (!numPrice || numPrice < 10) {
      setMessage({ type: 'error', text: 'Pri a dwe omwen 10 HTG.' });
      return;
    }
    if (!payoutAccountId) {
      setMessage({
        type: 'error',
        text: 'Chwazi ki kont ou vle resevwa lajan an. Ale nan Dashboard → Konekte kont bank ou.',
      });
      return;
    }

    setSaving(true);
    try {
      let imageUrl: string | null = null;
      if (file) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Ou dwe konekte.');
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('product-images')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (!upErr) {
          const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path);
          imageUrl = pub?.publicUrl || null;
        }
      }

      const res = await fetch('/api/products/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          price: numPrice,
          description: description.trim() || null,
          payout_account_id: payoutAccountId,
          ...(imageUrl ? { image_url: imageUrl } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Yon erè pase pandan kreyasyon pwodwi a.');
      }

      if (file && !imageUrl) {
        setMessage({ type: 'success', text: 'Pwodwi kreye men foto a pa t ka voye.' });
      }
      router.push('/dashboard/products');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Yon erè pase pandan kreyasyon pwodwi a.' });
      setSaving(false);
    }
  };


  const unlocked = profile?.kyc_status === 'approved';

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
          onClick={() => router.push('/dashboard/products')}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-6"
        >
          <ArrowLeft size={18} /> Retounen nan Pwodwi Mwen
        </button>

        <div className="flex items-center gap-4 mb-8">
          <span className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 border border-indigo-100">
            <Package size={28} />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Kreye yon pwodwi</h1>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Lè w fin kreye l, HatexCard ap ba ou yon lyen peman piblik pou voye kliyan ou yo.
            </p>
          </div>
        </div>

        {!unlocked && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-sm text-amber-800">
            Ou bezwen konplete KYC ou (apwouve) anvan ou kreye pwodwi.{' '}
            <button type="button" className="font-bold underline" onClick={() => router.push('/kyc/v2')}>
              Ale nan KYC
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-3xl shadow-sm p-6 sm:p-8 mb-8 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-600 font-bold uppercase mb-2 tracking-wider">
                Non pwodwi *
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Egzanp: Sèvis konsiltasyon / Sak diri 50lb"
                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3.5 text-base font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-400 shadow-sm"
              />
              {name && (
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Lyen ou pral jwenn nan: /p/{slugify(name) || 'pwodwi'}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs text-slate-600 font-bold uppercase mb-2 tracking-wider">
                Pri (HTG) *
              </label>
              <input
                type="number"
                required
                min={10}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0.00"
                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3.5 text-base font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-400 shadow-sm"
              />
              <p className="text-[10px] text-slate-400 mt-1.5">
                Ou resevwa pri a — kliyan an peye plis frè sèvis la sou MonCash.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-600 font-bold uppercase mb-2 tracking-wider">
              Deskripsyon (opsyonèl)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={600}
              rows={3}
              placeholder="Egzanp: Ou ap resevwa livrezon nan menm jou a nan Pòtoprens..."
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-400 shadow-sm resize-none"
            />
            <p className="text-[10px] text-slate-400 mt-1.5 text-right">{description.length}/600</p>
          </div>


          {/* Foto pwodwi */}
          <div>
            <label className="block text-xs text-slate-600 font-bold uppercase mb-2 tracking-wider">
              Foto pwodwi (opsyonèl)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={pickFile}
            />
            {previewUrl && file ? (
              <div className="relative w-48 h-48 rounded-2xl overflow-hidden border border-gray-200">
                <SafeImg src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40 rounded-2xl px-6 py-8 flex flex-col items-center gap-2 text-slate-400 hover:text-indigo-600 transition-colors"
              >
                <ImagePlus size={26} />
                <span className="text-xs font-bold">Chwazi yon imaj (JPG/PNG, maks. 4 MB)</span>
              </button>
            )}
          </div>

          {/* Kont pou resevwa lajan */}
          <div>
            <label className="block text-xs text-slate-600 font-bold uppercase mb-2 tracking-wider">
              Resevwa lajan an sou
            </label>
            {accounts.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 space-y-2">
                {hiddenBankUsCount > 0 ? (
                  <>
                    <p>
                      Kont Bank USA ou yo pa ka resevwa peman pou kounya a. Konekte yon kont
                      MonCash oswa yon bank Ayiti.
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
              <select
                value={payoutAccountId}
                onChange={(e) => setPayoutAccountId(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {formatAccountOption(a)}
                  </option>
                ))}
              </select>
            )}
            {accounts.length > 0 && (
              <p className="text-[10px] text-slate-400 mt-1.5">
                Lè kliyan an peye, lajan an ale sou kont sa a — ou ka chanje li nenpòt lè.
              </p>
            )}
          </div>

          {message.text && (
            <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-3 ${message.type === 'error' ? 'bg-rose-50 border border-rose-200 text-rose-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
              {message.type === 'error' ? <AlertTriangle size={18} className="shrink-0" /> : <CheckCircle2 size={18} className="shrink-0" />}
              <span className="leading-tight">{message.text}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !unlocked || accounts.length === 0}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
          >
            {saving ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <Package size={16} /> Kreye pwodwi
              </>
            )}
          </button>
        </form>

        <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-5 text-xs text-indigo-900 space-y-2">
          <p className="font-bold uppercase tracking-wider text-indigo-700">Kijan sa ap mache</p>
          <p>1. Ou kreye pwodwi a epi HatexCard ba ou yon lyen peman piblik (/p/non-pwodwi).</p>
          <p>2. Ou voye lyen an sou WhatsApp, Messenger, Instagram oswa imel.</p>
          <p>3. Kliyan an ouvri lyen an, peye ak MonCash, epi lajan an ale sou kont ou chwazi a.</p>
        </div>
      </div>
    </div>
  );
}

