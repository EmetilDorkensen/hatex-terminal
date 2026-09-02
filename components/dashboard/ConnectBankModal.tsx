'use client';

import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Loader2, Smartphone, Trash2, X } from 'lucide-react';

type Account = {
  id: string;
  kind: 'moncash' | 'natcash' | 'bank' | 'bank_us';
  label: string | null;
  phone: string | null;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  routing_number: string | null;
  is_default: boolean;
  is_verified: boolean;
};

type Kind = 'moncash' | 'natcash' | 'bank' | 'bank_us';

function accountTitle(a: Account): string {
  if (a.kind === 'moncash' || a.kind === 'natcash') return `+${a.phone}`;
  const last4 = a.account_number?.slice(-4) || '????';
  return `${a.bank_name || 'Bank'} · ••••${last4}`;
}

function kindLabel(kind: string): string {
  if (kind === 'moncash') return 'MonCash';
  if (kind === 'natcash') return 'Natcash';
  if (kind === 'bank_us') return 'Bank USA';
  return 'Bank Ayiti';
}

export function ConnectBankModal({ onClose }: { onClose: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<Kind>('moncash');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [phone, setPhone] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [swift, setSwift] = useState('');
  const [makeDefault, setMakeDefault] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v2/bank-accounts');
      const data = await res.json();
      setAccounts(data.accounts || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const reset = () => {
    setPhone('');
    setBankName('');
    setAccountName('');
    setAccountNumber('');
    setRoutingNumber('');
    setSwift('');
    setMakeDefault(true);
    setError(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        kind,
        is_default: makeDefault,
        label:
          kind === 'moncash'
            ? 'MonCash'
            : kind === 'bank_us'
              ? `${bankName || 'Bank'} (USA)`
              : bankName,
      };
      if (kind === 'moncash') {
        body.phone = phone;
      } else {
        body.bank_name = bankName;
        body.account_name = accountName;
        body.account_number = accountNumber;
        if (kind === 'bank_us') {
          body.routing_number = routingNumber;
        }
        body.swift_code = swift;
      }

      const res = await fetch('/api/v2/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || 'Yon erè pase.');
        return;
      }
      reset();
      setSuccess('Kont sove.');
      await load();
    } catch {
      setError('Pwoblèm rezo.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Retire kont sa a?')) return;
    const res = await fetch(`/api/v2/bank-accounts?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) await load();
  };

  const kindOptions: { value: Kind; label: string; icon: React.ReactNode; note: string }[] = [
    {
      value: 'moncash',
      label: 'MonCash',
      icon: <Smartphone size={18} />,
      note: 'Peman rive nan kèk segonn',
    },
    {
      value: 'bank',
      label: 'Bank HT',
      icon: <Building2 size={18} />,
      note: 'Sogebank, Unibank, BNC…',
    },
  ];

  const isMobile = kind === 'moncash';

  return (
    <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl relative max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-bold text-slate-900">Konekte kont bank ou</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 rounded-full w-8 h-8 flex items-center justify-center hover:bg-slate-100"
            aria-label="Fèmen"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {accounts.length > 0 && (
            <section>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                Kont ou yo
              </p>
              <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
                Ou ka mete plizyè nimewo MonCash. Si youn plen, sistèm nan eseye lòt yo
                otomatikman.
              </p>
              <div className="space-y-2">
                {accounts.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 border border-gray-200 rounded-2xl px-4 py-3"
                  >
                    <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
                      {a.kind === 'moncash' || a.kind === 'natcash' ? (
                        <Smartphone size={16} />
                      ) : (
                        <Building2 size={16} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {accountTitle(a)}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        {kindLabel(a.kind)}
                        {a.account_name ? ` · ${a.account_name}` : a.label ? ` · ${a.label}` : ''}
                        {a.kind === 'bank_us' && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                            Endisponib
                          </span>
                        )}
                        {a.is_default && a.kind !== 'bank_us' && ' · default'}
                      </p>
                    </div>
                    {a.is_default && a.kind !== 'bank_us' && (
                      <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    )}
                    <button
                      type="button"
                      onClick={() => remove(a.id)}
                      className="text-slate-400 hover:text-rose-600 shrink-0"
                      aria-label="Retire"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {loading ? (
            <div className="flex justify-center py-4 text-slate-400">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : (
            <section>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
                Ajoute yon kont
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {kindOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setKind(opt.value)}
                    className={`p-3 rounded-2xl border text-center transition-colors ${
                      kind === opt.value
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 hover:border-indigo-300 text-slate-600'
                    }`}
                  >
                    <div className="mx-auto w-8 h-8 rounded-full bg-white flex items-center justify-center mb-1.5 border border-gray-100">
                      {opt.icon}
                    </div>
                    <p className="text-[11px] font-bold">{opt.label}</p>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 mb-4 leading-relaxed">
                Bank USA pa disponib pou kounya a — nou ap travay sou li. Kliyan ou yo ka
                peye ak MonCash, lajan an rive sou MonCash oswa yon bank Ayiti ou chwazi.
              </p>

              <form onSubmit={save} className="space-y-3">
                {isMobile ? (
                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                      Nimewo {kind === 'moncash' ? 'MonCash' : 'Natcash'}
                    </span>
                    <div className="flex gap-2">
                      <span className="flex items-center px-3 border border-gray-200 rounded-xl bg-slate-50 text-sm font-bold text-slate-500">
                        +509
                      </span>
                      <input
                        type="tel"
                        required
                        inputMode="numeric"
                        pattern="[0-9]{8}"
                        maxLength={8}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder="3720 1241"
                        className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500"
                      />
                    </div>
                  </label>
                ) : (
                  <>
                    <label className="block">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                        Non bank la
                      </span>
                      <input
                        type="text"
                        required
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder={
                          kind === 'bank_us'
                            ? 'Chase, Bank of America, Wells Fargo…'
                            : 'Sogebank, Unibank, BNC...'
                        }
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                        Non sou kont la
                      </span>
                      <input
                        type="text"
                        required
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        placeholder="Non konplè kòm li parèt sou kont la"
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500"
                      />
                    </label>
                    {kind === 'bank_us' && (
                      <label className="block">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                          Routing number (9 chif)
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]{9}"
                          maxLength={9}
                          value={routingNumber}
                          onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, ''))}
                          placeholder="011000015"
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500"
                        />
                      </label>
                    )}
                    <label className="block">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                        {kind === 'bank_us' ? 'Nimewo kont' : 'Nimewo kont / routing'}
                      </span>
                      <input
                        type="text"
                        required
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        placeholder={kind === 'bank_us' ? '000123456789' : '0000000000'}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                        {kind === 'bank_us' ? 'ABA / SWIFT (fakiltatif)' : 'Kòd SWIFT (fakiltatif)'}
                      </span>
                      <input
                        type="text"
                        value={swift}
                        onChange={(e) => setSwift(e.target.value)}
                        placeholder={kind === 'bank_us' ? 'ABA oswa SWIFT' : 'Pou peman entènasyonal'}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500"
                      />
                    </label>
                  </>
                )}

                <label className="flex items-center gap-2.5 py-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={makeDefault}
                    onChange={(e) => setMakeDefault(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-slate-700 font-medium">
                    Sèvi ak kont sa a pou resevwa peman
                  </span>
                </label>

                {error && (
                  <p className="text-xs text-rose-600 font-medium bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
                    {error}
                  </p>
                )}
                {success && (
                  <p className="text-xs text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                    {success}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-3.5 rounded-xl font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : 'Sove kont lan'}
                </button>
              </form>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
