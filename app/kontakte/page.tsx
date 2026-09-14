"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Mail,
  MessageCircle,
  Briefcase,
  Code2,
  Clock,
  ShieldCheck,
  ArrowRight,
  HelpCircle,
  Loader2,
  CheckCircle2,
  Send,
  ImagePlus,
} from 'lucide-react';

/**
 * Paj Kontak — fòm ki voye mesaj nan bwat app la
 * (Admin → Mesaj / Workspace → Kontak Email).
 * Pa bezwen Gmail pou support@ / business@ / contact@.
 */

type Channel = 'support' | 'business' | 'contact';

const CHANNELS: {
  id: Channel;
  icon: typeof MessageCircle;
  color: string;
  title: string;
  desc: string;
  whatsapp?: string;
}[] = [
  {
    id: 'support',
    icon: MessageCircle,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    title: 'Sipò Kliyan',
    desc: 'Kesyon sou kont ou, peman, payout, oswa KYC.',
    whatsapp: 'https://wa.me/50937201241',
  },
  {
    id: 'business',
    icon: Briefcase,
    color: 'text-[#1d4ed8] bg-blue-50 border-blue-100',
    title: 'Biznis & Patenarya',
    desc: 'Gwo antrepriz, entegrasyon espesyal, ak patenarya.',
  },
  {
    id: 'support',
    icon: Code2,
    color: 'text-violet-600 bg-violet-50 border-violet-100',
    title: 'Devlopè & API',
    desc: 'Kesyon teknik sou API, webhooks, ak plugin WooCommerce.',
  },
  {
    id: 'contact',
    icon: ShieldCheck,
    color: 'text-rose-600 bg-rose-50 border-rose-100',
    title: 'Sekirite',
    desc: 'Rapòte yon fay sekirite, yon fwod, oswa yon aktivite sispèk.',
  },
];

function ContactForm({
  channel,
  title,
}: Readonly<{ channel: Channel; title: string }>) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const onPickPhotos = (files: FileList | null) => {
    if (!files) return;
    const next = [...photos, ...Array.from(files)].slice(0, 3);
    setPhotos(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  };

  const removePhoto = (idx: number) => {
    const next = photos.filter((_, i) => i !== idx);
    setPhotos(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const fd = new FormData();
      fd.set('channel', channel);
      fd.set('name', name);
      fd.set('email', email);
      fd.set('subject', subject);
      fd.set('message', message);
      fd.set('website', website);
      for (const file of photos) {
        fd.append('photos', file);
      }
      const res = await fetch('/api/contact', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || 'Erè');
      setDone(true);
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
      setPhotos([]);
      setPreviews([]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erè');
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
        <CheckCircle2 className="mx-auto text-emerald-500 mb-2" size={32} />
        <p className="text-sm font-bold text-emerald-800">Mesaj ou resevwa!</p>
        <p className="text-xs text-emerald-700 mt-1">
          Ekip {title} ap reponn ba ou pa imèl.
        </p>
        <button
          type="button"
          onClick={() => setDone(false)}
          className="mt-3 text-xs font-bold text-emerald-700 underline"
        >
          Voye yon lòt mesaj
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
      />
      <input
        type="text"
        required
        placeholder="Non ou"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#1d4ed8]/40"
      />
      <input
        type="email"
        required
        placeholder="Imèl ou (pou n ka reponn ou)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#1d4ed8]/40"
      />
      <input
        type="text"
        required
        placeholder="Sijè"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#1d4ed8]/40"
      />
      <textarea
        required
        rows={4}
        placeholder="Mesaj ou…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#1d4ed8]/40 resize-none"
      />

      <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4">
        <label className="flex flex-col items-center justify-center gap-2 cursor-pointer text-center">
          <ImagePlus className="text-[#1d4ed8]" size={22} />
          <span className="text-sm font-bold text-slate-700">Ajoute foto (opsyonèl)</span>
          <span className="text-[11px] text-slate-500 font-medium">
            Jiska 3 fichye · JPG / PNG / WEBP / PDF · max 5 MB chak
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              onPickPhotos(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
        {previews.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 justify-center">
            {previews.map((src, i) => (
              <div key={`${photos[i]?.name}-${i}`} className="relative">
                {photos[i]?.type === 'application/pdf' ? (
                  <div className="w-16 h-16 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                    PDF
                  </div>
                ) : (
                  <img
                    src={src}
                    alt=""
                    className="w-16 h-16 rounded-lg object-cover border border-slate-200"
                  />
                )}
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white text-xs font-bold leading-none"
                  aria-label="Retire"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={sending}
        className="w-full inline-flex items-center justify-center gap-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-sm font-bold py-3 rounded-xl disabled:opacity-50 transition-colors"
      >
        {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        Voye mesaj
      </button>
    </form>
  );
}

export default function KontaktePage() {
  const router = useRouter();
  const [openForm, setOpenForm] = useState<string | null>('support');

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-slate-900 font-sans selection:bg-blue-100 pb-24">
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-5xl mx-auto p-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-600 hover:text-[#1d4ed8] hover:bg-slate-50 transition-colors shadow-sm"
            aria-label="Retounen"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2.5">
            <img
              src="/img/hatexcard-logo.png"
              alt=""
              className="w-8 h-8 rounded-lg border border-slate-200 object-cover"
            />
            <span className="font-extrabold text-[16px] tracking-tight">
              Hatex<span className="text-[#1d4ed8]">card</span>
            </span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 border-l border-slate-200 pl-3 ml-1">
              Kontak
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-5 md:p-8 mt-6">
        <p className="text-[#1d4ed8] text-xs font-extrabold uppercase tracking-[0.25em] mb-3">
          Kontakte nou
        </p>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 leading-[1.05]">
          Nou la pou <span className="text-[#1d4ed8]">ede w</span>
        </h1>
        <p className="text-slate-600 text-base md:text-lg font-medium max-w-2xl mb-4 leading-relaxed">
          Ranpli fòm lan — mesaj ou rive dirèk nan tablodbò HatexCard (Admin &amp;
          anplwaye sipò). Ou pa bezwen voye imèl nan Gmail.
        </p>

        <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-2 shadow-sm mb-10">
          <Clock size={15} className="text-[#1d4ed8]" />
          <span className="text-sm font-semibold text-slate-700">
            Lendi – Samdi · 8:00 AM – 6:00 PM
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-14">
          {CHANNELS.map((ch, idx) => {
            const formKey = `${ch.id}-${idx}`;
            const isOpen = openForm === formKey;
            return (
              <div
                key={formKey}
                className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm hover:border-[#1d4ed8]/40 transition-all"
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 border ${ch.color}`}
                >
                  <ch.icon size={22} />
                </div>
                <h2 className="text-lg font-extrabold text-slate-900 mb-1.5">{ch.title}</h2>
                <p className="text-slate-500 text-sm font-medium mb-4">{ch.desc}</p>

                {ch.whatsapp && (
                  <a
                    href={ch.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-sm font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 p-3.5 rounded-xl border border-emerald-100 mb-3"
                  >
                    <MessageCircle size={16} />
                    WhatsApp +509 3720 1241
                  </a>
                )}

                {!isOpen ? (
                  <button
                    type="button"
                    onClick={() => setOpenForm(formKey)}
                    className="w-full flex items-center justify-center gap-2 text-sm font-bold text-[#1d4ed8] bg-blue-50 hover:bg-blue-100 border border-blue-100 p-3.5 rounded-xl transition-colors"
                  >
                    <Mail size={16} />
                    Ekri yon mesaj
                  </button>
                ) : (
                  <ContactForm channel={ch.id} title={ch.title} />
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-7 md:p-8 mb-14">
          <div className="flex items-center gap-2 mb-5">
            <HelpCircle size={20} className="text-[#1d4ed8]" />
            <h2 className="text-lg font-extrabold text-slate-900">
              Anvan ou ekri nou — repons rapid
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/support"
              className="group p-5 rounded-xl border border-slate-200 hover:border-[#1d4ed8]/40 hover:bg-blue-50/40 transition-all"
            >
              <p className="font-bold text-slate-900 text-sm mb-1 group-hover:text-[#1d4ed8]">
                Sant Sipò (kont konekte)
              </p>
              <p className="text-xs text-slate-500 font-medium">
                Si ou gen yon kont, louvri yon ticket nan app la.
              </p>
            </Link>
            <Link
              href="/developer/docs"
              className="group p-5 rounded-xl border border-slate-200 hover:border-[#1d4ed8]/40 hover:bg-blue-50/40 transition-all"
            >
              <p className="font-bold text-slate-900 text-sm mb-1 group-hover:text-[#1d4ed8]">
                Dokiman API
              </p>
              <p className="text-xs text-slate-500 font-medium">
                Quick start, egzanp kòd, webhooks, ak kle test/live.
              </p>
            </Link>
            <Link
              href="/politik"
              className="group p-5 rounded-xl border border-slate-200 hover:border-[#1d4ed8]/40 hover:bg-blue-50/40 transition-all"
            >
              <p className="font-bold text-slate-900 text-sm mb-1 group-hover:text-[#1d4ed8]">
                Konfidansyalite
              </p>
              <p className="text-xs text-slate-500 font-medium">
                Kijan nou pwoteje done ou ak dwa ou genyen.
              </p>
            </Link>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-14">
          <p className="text-sm text-amber-800 font-medium leading-relaxed">
            <strong className="font-bold">Rapèl sekirite :</strong> HatexCard p ap janm
            mande w modpas ou, kòd MFA ou, ni PIN MonCash ou — ni pa imèl, ni pa
            telefòn, ni pa WhatsApp.
          </p>
        </div>

        <div className="bg-[#0b1220] rounded-3xl px-6 py-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(29,78,216,0.35),transparent_55%)]" />
          <div className="relative z-10">
            <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mb-3">
              Poko gen kont?
            </h2>
            <p className="text-slate-300 text-sm font-medium max-w-md mx-auto mb-7">
              Ouvri yon kont gratis, pase KYC, epi kòmanse resevwa peman MonCash.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-sm font-bold px-6 py-3.5 rounded-xl transition-colors"
            >
              Ouvri kont gratis
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
