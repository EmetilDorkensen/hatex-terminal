'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Calendar,
  Copy,
  CheckCircle2,
  Loader2,
  PlusCircle,
  Trash2,
  UploadCloud,
  Link2,
  ToggleLeft,
  ToggleRight,
  Pencil,
  RotateCcw,
} from 'lucide-react';
import SafeImg from '@/components/SafeImg';
import {
  CATEGORY_LABELS,
  HAITI_ZONES,
  RESERVATION_CATEGORIES,
  type ReservationCategory,
  type ListingMeta,
  maxPhotosForCategory,
  minPhotosForCategory,
} from '@/lib/reservations/types';

type Merchant = {
  business_name: string;
  whatsapp: string;
  phone?: string;
  address?: string;
  zone?: string;
  email?: string;
  logo_url?: string;
  share_token?: string;
};

type Listing = {
  id: string;
  category: ReservationCategory;
  title: string;
  description?: string;
  price: number;
  photos: string[];
  is_active: boolean;
  zone?: string;
  address?: string;
  phone?: string;
  meta?: ListingMeta;
  paid_count?: number;
  active_subscribers?: number;
  can_delete?: boolean;
  can_edit?: boolean;
};

type Booking = {
  id: string;
  amount: number;
  status: string;
  paid_at?: string;
  scheduled_at?: string;
  scheduled_end?: string | null;
  quantity?: number;
  nights_or_days?: number;
  delivery_requested?: boolean;
  delivery_address?: string | null;
  delivery_fee?: number;
  unit_price?: number;
  customer_note?: string | null;
  payment_method?: string | null;
  reference_id?: string | null;
  receipt_snapshot?: {
    customer_note?: string;
    buyer_name?: string;
    buyer_email?: string;
    listing_title?: string;
    listing_photos?: string[];
    category?: string;
    car_make?: string;
    car_year?: string;
  } | null;
  buyer?: { full_name?: string; email?: string; phone?: string } | null;
  listing?: {
    title?: string;
    category?: string;
    photos?: string[];
    address?: string;
    zone?: string;
    phone?: string;
  };
};

export default function ReservationPanel({ origin }: { origin: string }) {
  const [tab, setTab] = useState<'profile' | 'create' | 'listings' | 'sales' | 'subs'>('profile');
  const [merchant, setMerchant] = useState<(Merchant & { user_id?: string }) | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [profileForm, setProfileForm] = useState({
    business_name: '',
    whatsapp: '',
    phone: '',
    address: '',
    zone: 'Port-au-Prince',
    email: '',
  });

  const [category, setCategory] = useState<ReservationCategory>('hotel_room');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [zone, setZone] = useState('Port-au-Prince');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [meta, setMeta] = useState<ListingMeta>({
    house_number: '',
    capacity: 2,
    opens_at: '08:00',
    closes_at: '22:00',
    delivery_enabled: false,
    delivery_fee: 0,
    car_make: '',
    car_year: '',
    conditions: '',
    billing_interval_days: 30,
    duration_days: 30,
  });

  const deleteListing = async (id: string) => {
    if (!confirm('Efase ofri sa a nèt?')) return;
    setMsg(null);
    const res = await fetch('/api/reservations/listings', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const json = await res.json();
    if (!json.success) {
      setMsg(json.message || 'Pa t kapab efase.');
      return;
    }
    setMsg('Ofri efase.');
    await loadAll();
  };

  const refundSale = async (booking: Booking) => {
    if (booking.status !== 'paid') return;
    const reason = window.prompt('Rezon ranbousman (opsyonèl):', 'Machann ranbouse kliyan') || '';
    if (!confirm(`Ranbouse ${Number(booking.amount).toLocaleString()} HTG? Kob la soti nan wallet ou.`)) {
      return;
    }
    setMsg(null);
    const isSub = booking.listing?.category === 'subscription';
    // Pou abònman: si nou gen subscription id pi bon — isit booking id + source reservation
    // toujou travay (RPC anile sub ki last_booking_id)
    const res = await fetch('/api/refunds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'reservation',
        source_id: booking.id,
        reason: reason || 'Ranbousman machann',
      }),
    });
    const json = await res.json();
    if (!json.success) {
      setMsg(json.message || 'Ranbousman echwe.');
      return;
    }
    setMsg(
      isSub
        ? `Ranbousman abònman: ${Number(json.refunded).toLocaleString()} HTG.`
        : `Ranbousman: ${Number(json.refunded).toLocaleString()} HTG.`
    );
    await loadAll();
  };

  const refundSubscription = async (subId: string, amount: number) => {
    if (!confirm(`Ranbouse dènye debit (${Number(amount).toLocaleString()} HTG) epi anile abònman?`)) {
      return;
    }
    setMsg(null);
    const res = await fetch('/api/refunds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'subscription',
        source_id: subId,
        reason: 'Ranbousman + anile abònman',
      }),
    });
    const json = await res.json();
    if (!json.success) {
      setMsg(json.message || 'Ranbousman echwe.');
      return;
    }
    setMsg(`Abònman ranbouse: ${Number(json.refunded).toLocaleString()} HTG.`);
    await loadAll();
  };

  const [editingId, setEditingId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, lRes, bRes, sRes] = await Promise.all([
        fetch('/api/reservations/merchant'),
        fetch('/api/reservations/listings?mine=1'),
        fetch('/api/reservations/bookings?role=merchant'),
        fetch('/api/reservations/subscriptions'),
      ]);
      const mJson = await mRes.json();
      const lJson = await lRes.json();
      const bJson = await bRes.json();
      const sJson = await sRes.json();
      if (mJson.merchant) {
        setMerchant(mJson.merchant);
        setProfileForm({
          business_name: mJson.merchant.business_name || '',
          whatsapp: mJson.merchant.whatsapp || '',
          phone: mJson.merchant.phone || '',
          address: mJson.merchant.address || '',
          zone: mJson.merchant.zone || 'Port-au-Prince',
          email: mJson.merchant.email || '',
        });
      }
      setListings(lJson.listings || []);
      setBookings(bJson.bookings || []);
      setSubs((sJson.subscriptions || []).filter((s: any) => s.merchant_id));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const saveProfile = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/reservations/merchant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      });
      const json = await res.json();
      if (!json.success) {
        setMsg(json.message || 'Erè');
        return;
      }
      setMerchant(json.merchant);
      setMsg('Pwofil sove.');
      setTab('create');
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (file: File) => {
    const max = maxPhotosForCategory(category);
    if (photos.length >= max) {
      setMsg(`Maksimòm ${max} foto.`);
      return;
    }
    setUploading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/reservations/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!json.success) {
        setMsg(json.message || 'Upload echwe');
        return;
      }
      setPhotos((p) => [...p, json.url]);
    } finally {
      setUploading(false);
    }
  };

  const startEdit = (l: Listing) => {
    if (!l.can_edit) {
      setMsg('Ou pa ka modifye: gen moun aktif sou ofri sa a.');
      return;
    }
    setEditingId(l.id);
    setCategory(l.category);
    setTitle(l.title);
    setDescription(l.description || '');
    setPrice(String(l.price));
    setAddress(l.address || '');
    setPhone(l.phone || '');
    setZone(l.zone || 'Port-au-Prince');
    setPhotos(l.photos || []);
    setMeta({ ...(l.meta || {}), billing_interval_days: l.meta?.billing_interval_days || 30 });
    setTab('create');
    setMsg('Mod editasyon — modifye epi sove.');
  };

  const saveListing = async () => {
    setSaving(true);
    setMsg(null);
    try {
      if (editingId) {
        const res = await fetch('/api/reservations/listings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingId,
            title,
            description,
            price: Number(price),
            address: category === 'subscription' ? null : address,
            phone: category === 'subscription' ? undefined : phone || profileForm.phone || profileForm.whatsapp,
            zone: category === 'subscription' ? null : zone,
            photos,
            meta,
          }),
        });
        const json = await res.json();
        if (!json.success) {
          setMsg(json.message || 'Erè');
          return;
        }
        setMsg('Ofri modifye!');
        setEditingId(null);
      } else {
        const res = await fetch('/api/reservations/listings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category,
            title,
            description,
            price: Number(price),
            address,
            phone: phone || profileForm.phone || profileForm.whatsapp,
            zone,
            photos,
            meta,
          }),
        });
        const json = await res.json();
        if (!json.success) {
          setMsg(json.message || 'Erè');
          return;
        }
        setMsg('Ofri kreye!');
      }
      setTitle('');
      setDescription('');
      setPrice('');
      setPhotos([]);
      await loadAll();
      setTab('listings');
    } finally {
      setSaving(false);
    }
  };

  const createListing = async () => {
    await saveListing();
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    await fetch('/api/reservations/listings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !is_active }),
    });
    await loadAll();
  };

  const shareUrl = merchant?.share_token ? `${origin}/r/${merchant.share_token}` : '';

  const copyShare = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-slate-500">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['profile', 'Pwofil'],
            ['create', 'Kreye'],
            ['listings', 'Ofri m yo'],
            ['sales', 'Lavant'],
            ['subs', 'Abònman'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-3 py-2 rounded-lg text-xs font-bold uppercase border ${
              tab === k
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-600 border-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {msg && (
        <div className="bg-indigo-50 border border-indigo-100 text-indigo-800 text-sm px-4 py-3 rounded-xl">
          {msg}
        </div>
      )}

      {tab === 'profile' && (
        <div className="bg-white border border-gray-200 rounded-3xl p-6 space-y-4 shadow-sm">
          <h3 className="font-bold text-slate-900 text-lg">Pwofil rezèvasyon</h3>
          <p className="text-xs text-slate-500">WhatsApp obligatwa — li parèt sou resi kliyan yo.</p>
          {(
            [
              ['business_name', 'Non biznis'],
              ['whatsapp', 'WhatsApp'],
              ['phone', 'Telefòn'],
              ['address', 'Adrès'],
              ['email', 'Email'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-xs font-semibold text-slate-600">
              {label}
              <input
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                value={profileForm[key]}
                onChange={(e) => setProfileForm({ ...profileForm, [key]: e.target.value })}
              />
            </label>
          ))}
          <label className="block text-xs font-semibold text-slate-600">
            Zòn
            <select
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              value={profileForm.zone}
              onChange={(e) => setProfileForm({ ...profileForm, zone: e.target.value })}
            >
              {HAITI_ZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveProfile()}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl disabled:opacity-60"
          >
            {saving ? 'Ap sove…' : 'Sove pwofil'}
          </button>
          {shareUrl && (
            <div className="border border-dashed border-indigo-200 rounded-xl p-4 bg-indigo-50/50">
              <p className="text-xs font-bold text-indigo-800 mb-2 flex items-center gap-2">
                <Link2 size={14} /> Lyèn pataje (kripto)
              </p>
              <code className="text-[11px] break-all text-slate-700">{shareUrl}</code>
              <button
                type="button"
                onClick={() => void copyShare()}
                className="mt-3 flex items-center gap-2 text-xs font-bold text-indigo-700"
              >
                {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                {copied ? 'Kopi!' : 'Kopie lyèn'}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'create' && (
        <div className="bg-white border border-gray-200 rounded-3xl p-6 space-y-4 shadow-sm">
          {!merchant && (
            <p className="text-amber-700 text-sm bg-amber-50 border border-amber-100 rounded-xl p-3">
              Sove pwofil (ak WhatsApp) anvan ou kreye ofri.
            </p>
          )}
          <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
            {editingId ? <Pencil size={18} /> : <PlusCircle size={18} />}
            {editingId ? 'Modifye ofri' : 'Nouvo ofri'}
          </h3>
          {editingId && (
            <button
              type="button"
              className="text-xs font-semibold text-slate-500 hover:text-indigo-600"
              onClick={() => {
                setEditingId(null);
                setTitle('');
                setDescription('');
                setPrice('');
                setPhotos([]);
                setMsg(null);
              }}
            >
              Anile editasyon / kreye nouvo
            </button>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {RESERVATION_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                disabled={!!editingId}
                onClick={() => {
                  setCategory(c);
                  setPhotos([]);
                }}
                className={`text-xs font-bold py-2 rounded-lg border disabled:opacity-50 ${
                  category === c
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white border-gray-200 text-slate-600'
                }`}
              >
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>

          <input
            placeholder={category === 'subscription' ? 'Non abònman an' : 'Tit / non'}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            placeholder="Deskripsyon"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm min-h-[80px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <input
            type="number"
            placeholder="Pri (HTG)"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          {category !== 'subscription' && (
            <>
              <input
                placeholder="Adrès konplè"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <input
                placeholder="Telefòn sou ofri a"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <select
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
              >
                {HAITI_ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </>
          )}

          {category === 'hotel_room' && (
            <>
              <input
                placeholder="Nimewo kay otèl"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                value={meta.house_number || ''}
                onChange={(e) => setMeta({ ...meta, house_number: e.target.value })}
              />
              <input
                type="number"
                placeholder="Kapasite (moun)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                value={meta.capacity || ''}
                onChange={(e) => setMeta({ ...meta, capacity: Number(e.target.value) })}
              />
              <p className="text-xs text-slate-500">4 foto diferan obligatwa pou chanm lan.</p>
            </>
          )}

          {(category === 'restaurant_dish' || category === 'bar') && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold text-slate-600">
                  Ouvè
                  <input
                    type="time"
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                    value={meta.opens_at || ''}
                    onChange={(e) => setMeta({ ...meta, opens_at: e.target.value })}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Fèmen
                  <input
                    type="time"
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                    value={meta.closes_at || ''}
                    onChange={(e) => setMeta({ ...meta, closes_at: e.target.value })}
                  />
                </label>
              </div>
              {category === 'restaurant_dish' && (
                <div className="space-y-2 border border-gray-100 rounded-xl p-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={!!meta.delivery_enabled}
                      onChange={(e) => setMeta({ ...meta, delivery_enabled: e.target.checked })}
                    />
                    Aktive livrezon (resto sèlman)
                  </label>
                  {meta.delivery_enabled && (
                    <input
                      type="number"
                      placeholder="Frais livrezon (HTG)"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                      value={meta.delivery_fee ?? ''}
                      onChange={(e) => setMeta({ ...meta, delivery_fee: Number(e.target.value) })}
                    />
                  )}
                </div>
              )}
              <p className="text-xs text-slate-500">
                {category === 'bar' ? 'Jiska 5 foto (opsyonèl).' : 'Jiska 2 foto (opsyonèl).'}
              </p>
            </>
          )}

          {category === 'car_rental' && (
            <>
              <input
                placeholder="Mak machin nan (eg. Toyota)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                value={meta.car_make || ''}
                onChange={(e) => setMeta({ ...meta, car_make: e.target.value })}
              />
              <input
                placeholder="Ane machin nan (eg. 2019)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                value={meta.car_year || ''}
                onChange={(e) => setMeta({ ...meta, car_year: e.target.value })}
              />
              <textarea
                placeholder="Sa kliyan dwe konnen sou machin nan…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm min-h-[90px]"
                value={meta.conditions || ''}
                onChange={(e) => setMeta({ ...meta, conditions: e.target.value })}
              />
              <p className="text-xs text-slate-500">5 foto (andan + deyò) obligatwa. Pri = pa jou.</p>
            </>
          )}

          {category === 'subscription' && (
            <>
              <input
                type="number"
                placeholder="Konbyen jou (eg. 30)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                value={meta.billing_interval_days || ''}
                onChange={(e) =>
                  setMeta({
                    ...meta,
                    billing_interval_days: Number(e.target.value),
                    duration_days: Number(e.target.value),
                  })
                }
              />
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">
                Abònman: 1 foto, non, deskripsyon, pri, jou. Pa bezwen adrès. Peman kat + debit otomatik.
              </p>
            </>
          )}

          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">
              Foto ({photos.length}/{maxPhotosForCategory(category)}) — min {minPhotosForCategory(category)}
            </p>
            <div className="flex flex-wrap gap-2 mb-2">
              {photos.map((url) => (
                <div key={url} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                  <SafeImg src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    className="absolute top-0 right-0 bg-black/60 text-white p-0.5"
                    onClick={() => setPhotos((p) => p.filter((x) => x !== url))}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-bold text-indigo-700 cursor-pointer">
              <UploadCloud size={14} />
              {uploading ? 'Ap upload…' : 'Ajoute foto'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadPhoto(f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          <button
            type="button"
            disabled={saving || !merchant}
            onClick={() => void createListing()}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl disabled:opacity-60"
          >
            {saving ? 'Ap sove…' : editingId ? 'Sove modifikasyon' : 'Pibliye ofri'}
          </button>
        </div>
      )}

      {tab === 'listings' && (
        <div className="space-y-4">
          <div className="overflow-x-auto bg-white border border-gray-200 rounded-2xl shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-3 font-bold">Ofri</th>
                  <th className="px-3 py-3 font-bold">Kalite</th>
                  <th className="px-3 py-3 font-bold">Achte</th>
                  <th className="px-3 py-3 font-bold">Abòne aktif</th>
                  <th className="px-3 py-3 font-bold">Aksyon</th>
                </tr>
              </thead>
              <tbody>
                {listings.map((l) => (
                  <tr key={l.id} className="border-t border-gray-100">
                    <td className="px-3 py-3 font-semibold text-slate-800">{l.title}</td>
                    <td className="px-3 py-3 text-slate-500">{CATEGORY_LABELS[l.category]}</td>
                    <td className="px-3 py-3">{l.paid_count ?? 0}</td>
                    <td className="px-3 py-3">{l.active_subscribers ?? 0}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!l.can_edit}
                          onClick={() => startEdit(l)}
                          className="text-slate-600 disabled:opacity-30"
                          title={
                            l.can_edit
                              ? 'Modifye'
                              : 'Pa ka modifye: gen abòne aktif'
                          }
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleActive(l.id, l.is_active)}
                          className="text-indigo-600"
                          title={l.is_active ? 'Dezaktive' : 'Aktive'}
                        >
                          {l.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                        </button>
                        <button
                          type="button"
                          disabled={!l.can_delete}
                          onClick={() => void deleteListing(l.id)}
                          className="text-red-600 disabled:opacity-30"
                          title={
                            l.can_delete
                              ? 'Efase'
                              : 'Pa ka efase: gen achte oswa abòne aktif'
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {listings.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-10">Pa gen ofri ankò.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'sales' && (
        <div className="space-y-4">
          <div className="bg-indigo-600 text-white rounded-2xl p-5">
            <p className="text-xs uppercase opacity-80 font-bold">Total lavant peye (san ranbouse)</p>
            <p className="text-2xl font-bold mt-1">
              {bookings
                .filter((b) => b.status === 'paid')
                .reduce((s, b) => s + Number(b.amount || 0), 0)
                .toLocaleString()}{' '}
              HTG
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-slate-900">Tablo detay rezèvasyon</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Tout enfò kliyan chwazi (non, sèvis, dat, kantite, foto, livrezon, nòt…)
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5 font-bold">Foto</th>
                    <th className="px-3 py-2.5 font-bold">Kliyan</th>
                    <th className="px-3 py-2.5 font-bold">Sèvis</th>
                    <th className="px-3 py-2.5 font-bold">Dat / lè</th>
                    <th className="px-3 py-2.5 font-bold">Kantite</th>
                    <th className="px-3 py-2.5 font-bold">Livrezon</th>
                    <th className="px-3 py-2.5 font-bold">Nòt kliyan</th>
                    <th className="px-3 py-2.5 font-bold">Montan</th>
                    <th className="px-3 py-2.5 font-bold">Estati</th>
                    <th className="px-3 py-2.5 font-bold">Aksyon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bookings
                    .filter((b) => b.status === 'paid' || b.status === 'refunded')
                    .map((b) => {
                      const snap = b.receipt_snapshot || {};
                      const photo =
                        b.listing?.photos?.[0] ||
                        (Array.isArray(snap.listing_photos) ? snap.listing_photos[0] : null);
                      const clientName =
                        b.buyer?.full_name || snap.buyer_name || 'Kliyan';
                      const clientEmail = b.buyer?.email || snap.buyer_email || '';
                      const clientPhone = b.buyer?.phone || '';
                      const title = b.listing?.title || snap.listing_title || 'Sèvis';
                      const cat = b.listing?.category || snap.category || '';
                      const note = b.customer_note || snap.customer_note || '';
                      const when = b.scheduled_at
                        ? new Date(b.scheduled_at).toLocaleString('fr-HT', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—';
                      const until = b.scheduled_end
                        ? new Date(b.scheduled_end).toLocaleString('fr-HT', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : null;
                      return (
                        <tr key={b.id} className="align-top hover:bg-slate-50/80">
                          <td className="px-3 py-3">
                            <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-100 border border-gray-100">
                              {photo ? (
                                <SafeImg src={photo} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[9px] text-slate-400">
                                  Pa gen
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-bold text-slate-900">{clientName}</p>
                            {clientEmail && (
                              <p className="text-[10px] text-slate-500 mt-0.5 break-all">{clientEmail}</p>
                            )}
                            {clientPhone && (
                              <p className="text-[10px] text-slate-500">{clientPhone}</p>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-semibold text-slate-800">{title}</p>
                            <p className="text-[10px] uppercase text-slate-400 font-bold mt-0.5">
                              {cat || '—'}
                            </p>
                            {(snap.car_make || b.listing?.address) && (
                              <p className="text-[10px] text-slate-500 mt-1">
                                {snap.car_make
                                  ? `${snap.car_make}${snap.car_year ? ` (${snap.car_year})` : ''}`
                                  : b.listing?.address}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <p className="font-medium text-slate-800">{when}</p>
                            {until && <p className="text-[10px] text-slate-500">Jiska {until}</p>}
                            {b.nights_or_days && Number(b.nights_or_days) > 1 && (
                              <p className="text-[10px] text-slate-500">
                                {b.nights_or_days} jou/nuit
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-3 font-semibold text-slate-800">
                            {Number(b.quantity || 1)}
                          </td>
                          <td className="px-3 py-3 max-w-[160px]">
                            {b.delivery_requested ? (
                              <div>
                                <p className="font-bold text-emerald-700 text-[10px] uppercase">Wi</p>
                                <p className="text-[11px] text-slate-600 mt-0.5 break-words">
                                  {b.delivery_address || '—'}
                                </p>
                                {Number(b.delivery_fee || 0) > 0 && (
                                  <p className="text-[10px] text-slate-400">
                                    +{Number(b.delivery_fee).toLocaleString()} HTG
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">Non</span>
                            )}
                          </td>
                          <td className="px-3 py-3 max-w-[200px]">
                            {note ? (
                              <p className="text-[11px] text-slate-700 whitespace-pre-wrap break-words bg-indigo-50/50 border border-indigo-100 rounded-lg p-2">
                                {note}
                              </p>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <p
                              className={`font-bold ${b.status === 'refunded' ? 'text-slate-400 line-through' : 'text-emerald-700'}`}
                            >
                              {Number(b.amount).toLocaleString()} HTG
                            </p>
                            <p className="text-[10px] text-slate-400 uppercase">
                              {b.payment_method || '—'}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${
                                b.status === 'paid'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                  : 'bg-slate-100 text-slate-500 border border-slate-200'
                              }`}
                            >
                              {b.status === 'refunded' ? 'Ranbouse' : 'Peye'}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            {b.status === 'paid' && (
                              <button
                                type="button"
                                onClick={() => void refundSale(b)}
                                className="text-xs font-bold text-amber-700 flex items-center gap-1 hover:underline"
                              >
                                <RotateCcw size={12} /> Ranbouse
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {bookings.filter((b) => b.status === 'paid' || b.status === 'refunded').length === 0 && (
                <p className="text-center text-slate-500 text-sm py-10">Pa gen lavant ankò.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'subs' && (
        <div className="space-y-3">
          {subs
            .filter((s) => s.merchant_id === merchant?.user_id)
            .map((s) => (
              <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-4 text-sm">
                <p className="font-semibold">{s.listing?.title || 'Abònman'}</p>
                <p className="text-xs text-slate-500">
                  {s.status} · {Number(s.amount).toLocaleString()} HTG / {s.billing_interval_days} jou
                </p>
                <p className="text-xs text-slate-400">
                  Pwochen debit: {new Date(s.next_billing_date).toLocaleDateString('fr-HT')}
                </p>
                {(s.status === 'active' || s.status === 'past_due') && (
                  <button
                    type="button"
                    onClick={() => void refundSubscription(s.id, Number(s.amount))}
                    className="mt-2 text-xs font-bold text-amber-700 flex items-center gap-1 hover:underline"
                  >
                    <RotateCcw size={12} /> Ranbouse + anile
                  </button>
                )}
              </div>
            ))}
          {subs.filter((s) => s.merchant_id === merchant?.user_id).length === 0 && (
            <p className="text-center text-slate-500 text-sm py-8">Pa gen abònman aktif.</p>
          )}
        </div>
      )}
    </div>
  );
}
