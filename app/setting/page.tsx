"use client";

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, User, ShieldCheck, Mail, MessageCircle, 
  Lock, Bell, Globe, Info, LogOut, 
  ChevronRight, CreditCard, Loader2, AlertTriangle, Key, Edit2
} from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  // States pou sekirite ak PIN
  const [pinEnabled, setPinEnabled] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  
  const [notifications, setNotifications] = useState(true);
  const [selectedLang, setSelectedLang] = useState('HT'); // HT, EN, ES

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
        setPinEnabled(userProfile.pin_enabled || false);
        setHasPin(!!userProfile.pin_code);
      }
      setLoading(false);
    }
    loadSettings();
  }, [supabase, router]);

  const handleSavePin = async () => {
    if (newPin.length !== 4) {
      alert("PIN lan dwe gen egzakteman 4 chif!");
      return;
    }
    setIsSavingPin(true);
    const { error } = await supabase
      .from('profiles')
      .update({ pin_code: newPin, pin_enabled: true })
      .eq('id', user.id);

    setIsSavingPin(false);

    if (error) {
      alert("Erè: " + error.message);
    } else {
      setHasPin(true);
      setPinEnabled(true);
      setNewPin('');
      alert("PIN ou an anrejistre avèk siksè!");
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    
    const isConfirmed = window.confirm("Èske w vle nou voye yon lyen sou imèl ou pou w chanje modpas ou a?");
    if (!isConfirmed) return;

    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `https://hatexcard.com/update-password`,
    });

    if (error) {
      alert("Erè lè n ap voye imèl la: " + error.message);
    } else {
      alert(`✅ Nou voye yon imèl bay ${user.email} pou w ka chanje modpas ou. Tanpri tcheke bwat lèt ou a.`);
    }
  };

  // ==========================================
  // FONKSYON POU VOYE IMÈL POU CHANJE PIN NAN
  // ==========================================
  const handleResetPin = async () => {
    if (!user?.email) return;
    
    const isConfirmed = window.confirm("Èske w vle nou voye yon lyen sekirize sou imèl ou pou w ka chanje PIN ou a?");
    if (!isConfirmed) return;

    setIsSendingEmail(true);

    // Mwen mete vrè adrès sit ou a isit la pito
    const updateUrl = `https://hatexcard.com/update-pin`;
    
    // Mesaj la byen klè ak yon gwo bouton wouj
    const messageHtml = `
      <h3>Bonjou ${profile?.full_name || 'Kliyan'},</h3>
      <p>Sa se yon mesaj sekirite pou kòd PIN 4 chif ou a.</p>
      <p>Klike sou gwo bouton wouj ki anba a pou w kreye yon nouvo PIN:</p>
      <br>
      <a href="${updateUrl}" style="background-color: #dc2626; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">CHANJE KÒD PIN MWEN AN</a>
      <br><br>
      <p>⚠️ <b>TRÈ ENPÒTAN:</b> Pou sa mache san pwoblèm, tanpri <b>KOPYE adrès ki anba a epi KOLE L nan menm navigatè kote ou te gentan konekte sou kont ou an</b>:</p>
      <p style="background-color: #f3f4f6; padding: 10px; border-radius: 5px; color: #000; font-family: monospace; word-break: break-all;">
        ${updateUrl}
      </p>
      <br>
      <p><i>Si ou pa t mande chanjman sa a, tanpri inyore imèl sa a.</i></p>
    `;

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          to: user.email, 
          subject: "🚨 KÒD PIN: Chanje PIN HatexCard ou a", 
          non: profile?.full_name || 'Kliyan', 
          mesaj: messageHtml 
        }),
      });

      if (response.ok) {
        alert(`✅ Nou voye lyen PIN nan sou imèl ou (${user.email}). Tanpri kopye lyen an epi kole l nan menm navigatè a.`);
      } else {
        alert("Te gen yon pwoblèm nan voye imèl la. Eseye ankò pita.");
      }
    } catch (error) {
      console.error("Erè:", error);
      alert("Erè nan sistèm nan. Tanpri kontakte sipò a.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const togglePin = async () => {
    if (!hasPin) {
      alert("Ou dwe kreye yon PIN anvan w ka aktive fonksyon sa a.");
      return;
    }
    const newState = !pinEnabled;
    setPinEnabled(newState);
    await supabase.from('profiles').update({ pin_enabled: newState }).eq('id', user?.id);
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
            
            {/* ZÒN POU METE/KREYE PIN NAN */}
            {!hasPin ? (
              <div className="p-5 md:p-6 border-b border-white/5 bg-red-600/5">
                <h4 className="text-sm font-black uppercase tracking-wider mb-2 text-red-500">Kreye PIN 4 Chif ou</h4>
                <p className="text-[10px] text-zinc-400 font-bold mb-4">Ou dwe kreye yon PIN pou w ka konekte rapid e pwoteje kòb ou.</p>
                <div className="flex gap-3">
                  <input 
                    type="password" 
                    maxLength={4}
                    placeholder="••••"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    className="bg-black border border-white/10 rounded-xl px-4 py-3 text-center tracking-[0.5em] font-black w-32 outline-none focus:border-red-600 transition-all"
                  />
                  <button 
                    onClick={handleSavePin}
                    disabled={isSavingPin || newPin.length !== 4}
                    className="bg-red-600 text-white px-6 rounded-xl font-black uppercase text-[10px] tracking-widest disabled:opacity-50 hover:bg-red-700 transition-all"
                  >
                    {isSavingPin ? 'Ap Sove...' : 'Sove PIN'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Toggle pou limen/fèmen PIN nan */}
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

                {/* Bouton Modifye PIN k ap voye imèl la */}
                <div 
                  onClick={handleResetPin}
                  className="flex items-center justify-between p-5 md:p-6 border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-zinc-900 rounded-xl text-zinc-400"><Edit2 className="w-5 h-5" /></div>
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-wider">Modifye PIN nan</h4>
                      <p className="text-[9px] md:text-[10px] text-zinc-500 font-bold mt-0.5">Klike pou n voye lyen an sou imèl ou</p>
                    </div>
                  </div>
                  {isSendingEmail ? <Loader2 className="w-5 h-5 animate-spin text-zinc-600" /> : <ChevronRight className="w-5 h-5 text-zinc-600" />}
                </div>
              </>
            )}

            {/* Modifye Modpas (Voye Imèl otomatikman) */}
            <div onClick={handleResetPassword} className="flex items-center justify-between p-5 md:p-6 hover:bg-white/[0.02] transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-zinc-900 rounded-xl text-zinc-400"><Key className="w-5 h-5" /></div>
                <div>
                  <h4 className="text-sm font-black uppercase tracking-wider">Modifye Modpas</h4>
                  <p className="text-[9px] md:text-[10px] text-zinc-500 font-bold mt-0.5">Klike pou n voye lyen an sou imèl ou</p>
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

            {/* Opsyon Lang */}
            <div className="p-5 md:p-6 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-zinc-900 rounded-xl text-zinc-400"><Globe className="w-5 h-5" /></div>
                <div>
                  <h4 className="text-sm font-black uppercase tracking-wider">Lang Aplikasyon an</h4>
                  <p className="text-[9px] md:text-[10px] text-zinc-500 font-bold mt-0.5">Chwazi lang ki pi bon pou ou a</p>
                </div>
              </div>
              
              <div className="flex gap-2 bg-black p-1 rounded-xl border border-white/5">
                <button 
                  onClick={() => setSelectedLang('HT')}
                  className={`flex-1 py-2 text-[10px] font-black tracking-widest rounded-lg transition-all ${selectedLang === 'HT' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-white'}`}
                >Kreyòl</button>
                <button 
                  onClick={() => setSelectedLang('EN')}
                  className={`flex-1 py-2 text-[10px] font-black tracking-widest rounded-lg transition-all ${selectedLang === 'EN' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-white'}`}
                >English</button>
                <button 
                  onClick={() => setSelectedLang('ES')}
                  className={`flex-1 py-2 text-[10px] font-black tracking-widest rounded-lg transition-all ${selectedLang === 'ES' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-white'}`}
                >Español</button>
              </div>
            </div>

          </div>
        </div>

        {/* 3. SIPÒ AK KONTAK HATEX */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.3em] ml-4">Sipò Kliyan</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <a 
              href="https://wa.me/50937201241?text=Bonjou%20ekip%20H-Pay%2C%20mwen%20bezwen%20%C3%A8d%20ak%20kont%20mwen%20an."
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#0d0e1a] hover:bg-[#111322] border border-white/5 p-6 rounded-[2rem] flex flex-col items-center justify-center gap-3 transition-all group cursor-pointer"
            >
              <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <MessageCircle className="w-6 h-6 text-green-500" />
              </div>
              <div className="text-center">
                <span className="block text-sm font-black uppercase tracking-wider">WhatsApp</span>
                <span className="block text-[10px] text-zinc-500 font-bold mt-1">+509 3720-1241</span>
              </div>
            </a>

            <a 
              href="mailto:contact@hatexcard.com?subject=Demann%20Sipò%20H-Pay"
              className="bg-[#0d0e1a] hover:bg-[#111322] border border-white/5 p-6 rounded-[2rem] flex flex-col items-center justify-center gap-3 transition-all group cursor-pointer"
            >
              <div className="w-12 h-12 bg-red-600/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <Mail className="w-6 h-6 text-red-500" />
              </div>
              <div className="text-center">
                <span className="block text-sm font-black uppercase tracking-wider">Imèl Sipò</span>
                <span className="block text-[10px] text-zinc-500 font-bold mt-1">contact@hatexcard.com</span>
              </div>
            </a>

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