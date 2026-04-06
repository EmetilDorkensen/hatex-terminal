"use client";

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, User, ShieldCheck, Mail, MessageCircle, 
  Smartphone, Lock, Bell, Globe, Info, LogOut, 
  ChevronRight, CreditCard, Loader2, AlertTriangle, Key
} from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  // States pou opsyon sekirite ak preferans yo
  const [pinEnabled, setPinEnabled] = useState(false);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [notifications, setNotifications] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function loadSettings() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        router.push('/login');
        return;
      }
      setUser(currentUser);

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
        
      if (userProfile) {
        setProfile(userProfile);
        // Sipoze ou gen kolòn sa yo nan baz done a pou kenbe estati a
        setPinEnabled(userProfile.pin_enabled || false);
        setTwoFaEnabled(userProfile.two_fa_enabled || false);
      }
      setLoading(false);
    }
    loadSettings();
  }, [supabase, router]);

  // ==========================================
  // FONKSYON POU TOGGLE (Aktive/Dezaktive)
  // ==========================================
  const togglePin = async () => {
    // La a ou ta ka louvri yon modal pou mande l tape 4 chif la anvan w aktive l
    const newState = !pinEnabled;
    setPinEnabled(newState);
    await supabase.from('profiles').update({ pin_enabled: newState }).eq('id', user?.id);
    if (newState) alert("Sekirite PIN 4 chif aktive!");
  };

  const toggle2FA = async () => {
    // La a ou ta dwe kòmanse pwosesis pou l skane QR kòd Google Authenticator la
    const newState = !twoFaEnabled;
    setTwoFaEnabled(newState);
    await supabase.from('profiles').update({ two_fa_enabled: newState }).eq('id', user?.id);
    if (newState) alert("Google Authenticator ap chaje...");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) return (
    <div className="min-h-screen bg-[#06070d] flex flex-col items-center justify-center">
      <Loader2 className="animate-spin text-red-600 mb-4 w-12 h-12" />
      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600 animate-pulse">Chaje Paramèt...</p>
    </div>
  );

  const fullName = profile?.full_name || user?.user_metadata?.full_name || "Itilizatè";
  const email = profile?.email || user?.email || "Pa gen imèl";
  const initials = fullName.substring(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#06070d] text-white p-4 sm:p-6 md:p-10 font-medium selection:bg-red-600 pb-24">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex items-center gap-4 border-b border-white/5 pb-6">
          <button onClick={() => router.back()} className="p-3 bg-zinc-900/50 rounded-2xl hover:bg-red-600 transition-all text-zinc-400 hover:text-white shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tighter italic">Paramèt <span className="text-red-600">Kont</span></h1>
            <p className="text-[9px] md:text-[10px] text-zinc-500 font-black uppercase tracking-[0.3em] mt-1">Jere pwofil ak sekirite w</p>
          </div>
        </div>

        {/* KAT PWOfil KLIYAN AN */}
        <div className="bg-[#0d0e1a] border border-white/5 p-6 rounded-[2rem] flex items-center gap-5 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 blur-[50px] rounded-full" />
          <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-red-600 to-black rounded-full flex items-center justify-center font-black text-xl border-2 border-white/10 shrink-0 z-10 shadow-[0_0_20px_rgba(220,38,38,0.3)]">
            {initials}
          </div>
          <div className="z-10 flex-1 min-w-0">
            <h2 className="text-xl md:text-2xl font-black uppercase truncate">{fullName}</h2>
            <p className="text-[10px] md:text-xs text-zinc-400 font-bold tracking-widest truncate">{email}</p>
            <div className="mt-2 inline-flex items-center gap-1.5 bg-green-500/10 text-green-500 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border border-green-500/20">
              <ShieldCheck className="w-3 h-3" /> Kont Verifye
            </div>
          </div>
        </div>

        {/* 1. SEKIRITE AK AKSÈ */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.3em] ml-4">Sekirite</h3>
          <div className="bg-[#0d0e1a] border border-white/5 rounded-[2rem] overflow-hidden shadow-lg">
            
            {/* PIN Code Toggle */}
            <div className="flex items-center justify-between p-5 md:p-6 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-zinc-900 rounded-xl text-zinc-400"><Lock className="w-5 h-5" /></div>
                <div>
                  <h4 className="text-sm font-black uppercase tracking-wider">Modpas PIN (4 chif)</h4>
                  <p className="text-[9px] md:text-[10px] text-zinc-500 font-bold mt-0.5">Mande PIN lè w ap louvri aplikasyon an</p>
                </div>
              </div>
              <button 
                onClick={togglePin}
                className={`w-12 h-6 rounded-full transition-colors relative flex items-center shrink-0 ${pinEnabled ? 'bg-red-600' : 'bg-zinc-800'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute transition-transform ${pinEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Google Authenticator Toggle */}
            <div className="flex items-center justify-between p-5 md:p-6 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-zinc-900 rounded-xl text-zinc-400"><Smartphone className="w-5 h-5" /></div>
                <div>
                  <h4 className="text-sm font-black uppercase tracking-wider">Google Authenticator</h4>
                  <p className="text-[9px] md:text-[10px] text-zinc-500 font-bold mt-0.5">Sekirite 2FA pou pwoteje kòb ou</p>
                </div>
              </div>
              <button 
                onClick={toggle2FA}
                className={`w-12 h-6 rounded-full transition-colors relative flex items-center shrink-0 ${twoFaEnabled ? 'bg-red-600' : 'bg-zinc-800'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute transition-transform ${twoFaEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Modifye Modpas */}
            <div className="flex items-center justify-between p-5 md:p-6 hover:bg-white/[0.02] transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-zinc-900 rounded-xl text-zinc-400"><Key className="w-5 h-5" /></div>
                <div>
                  <h4 className="text-sm font-black uppercase tracking-wider">Modifye Modpas</h4>
                  <p className="text-[9px] md:text-[10px] text-zinc-500 font-bold mt-0.5">Chanje modpas prensipal ou an</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-600" />
            </div>
          </div>
        </div>

        {/* 2. E-WALLET PREFERANS (Karakteristik Siplemantè) */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.3em] ml-4">Preferans E-Wallet</h3>
          <div className="bg-[#0d0e1a] border border-white/5 rounded-[2rem] overflow-hidden shadow-lg">
            <div className="flex items-center justify-between p-5 md:p-6 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-zinc-900 rounded-xl text-zinc-400"><Bell className="w-5 h-5" /></div>
                <div>
                  <h4 className="text-sm font-black uppercase tracking-wider">Notifikasyon</h4>
                  <p className="text-[9px] md:text-[10px] text-zinc-500 font-bold mt-0.5">Resevwa alèt pou chak tranzaksyon</p>
                </div>
              </div>
              <button 
                onClick={() => setNotifications(!notifications)}
                className={`w-12 h-6 rounded-full transition-colors relative flex items-center shrink-0 ${notifications ? 'bg-red-600' : 'bg-zinc-800'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute transition-transform ${notifications ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-5 md:p-6 border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-zinc-900 rounded-xl text-zinc-400"><CreditCard className="w-5 h-5" /></div>
                <div>
                  <h4 className="text-sm font-black uppercase tracking-wider">Limit Tranzaksyon</h4>
                  <p className="text-[9px] md:text-[10px] text-zinc-500 font-bold mt-0.5">Gere limit kòb ou ka depanse</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-600" />
            </div>

            <div className="flex items-center justify-between p-5 md:p-6 hover:bg-white/[0.02] transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-zinc-900 rounded-xl text-zinc-400"><Globe className="w-5 h-5" /></div>
                <div>
                  <h4 className="text-sm font-black uppercase tracking-wider">Lang</h4>
                  <p className="text-[9px] md:text-[10px] text-zinc-500 font-bold mt-0.5">Kreyòl Ayisyen (HT)</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-600" />
            </div>
          </div>
        </div>

        {/* 3. SIPÒ AK KONTAK HATEX */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.3em] ml-4">Sipò Kliyan</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Bouton WhatsApp */}
            <button 
              onClick={() => window.open('https://wa.me/50937201241?text=Bonjou%20ekip%20H-Pay%2C%20mwen%20bezwen%20%C3%A8d%20ak%20kont%20mwen%20an.', '_blank')}
              className="bg-[#0d0e1a] hover:bg-[#111322] border border-white/5 p-6 rounded-[2rem] flex flex-col items-center justify-center gap-3 transition-all group"
            >
              <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <MessageCircle className="w-6 h-6 text-green-500" />
              </div>
              <div className="text-center">
                <span className="block text-sm font-black uppercase tracking-wider">WhatsApp</span>
                <span className="block text-[10px] text-zinc-500 font-bold mt-1">+509 3720-1241</span>
              </div>
            </button>

            {/* Bouton Imèl */}
            <button 
              onClick={() => window.location.href = 'mailto:contact@hatexcard.com'}
              className="bg-[#0d0e1a] hover:bg-[#111322] border border-white/5 p-6 rounded-[2rem] flex flex-col items-center justify-center gap-3 transition-all group"
            >
              <div className="w-12 h-12 bg-red-600/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <Mail className="w-6 h-6 text-red-500" />
              </div>
              <div className="text-center">
                <span className="block text-sm font-black uppercase tracking-wider">Imèl Sipò</span>
                <span className="block text-[10px] text-zinc-500 font-bold mt-1">contact@hatexcard.com</span>
              </div>
            </button>

          </div>
        </div>

        {/* 4. À PROPOS DE HATEXCARD */}
        <div className="bg-zinc-900/40 border border-white/5 rounded-[2rem] p-6 md:p-8 text-center italic relative overflow-hidden">
          <Info className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
          <h3 className="text-base font-black uppercase tracking-widest text-zinc-300">À propos de HatexCard / H-Pay</h3>
          <p className="text-[10px] md:text-xs text-zinc-500 mt-3 leading-relaxed max-w-lg mx-auto font-bold">
            H-Pay se premye bous dijital ak sistèm peman anliy (E-wallet) serye nan peyi a. 
            Li fasilite tranzaksyon ant machann ak kliyan an tout sekirite gras ak teknoloji Escrow nou an ak kat entèlijan HatexCard la.
          </p>
          <div className="mt-6 flex justify-center gap-4 text-[9px] font-black uppercase tracking-widest text-zinc-600">
            <span className="hover:text-zinc-400 cursor-pointer transition-colors">Tèm ak Kondisyon</span>
            <span>•</span>
            <span>Vèsyon 2.1.0</span>
          </div>
        </div>

        {/* 5. ZÒN DANJE (Dekonekte) */}
        <div className="pt-6">
          <button 
            onClick={handleLogout}
            className="w-full bg-red-600/10 hover:bg-red-600 border border-red-600/20 hover:border-red-600 text-red-500 hover:text-white py-5 rounded-[2rem] font-black uppercase text-[11px] tracking-widest transition-all flex items-center justify-center gap-3"
          >
            <LogOut className="w-5 h-5" /> Dekonekte Kont Mwen
          </button>
        </div>

      </div>
    </div>
  );
}