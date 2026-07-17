"use client";

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Bell, Globe, LogOut, ChevronRight, 
  Loader2, Key, Edit2, X, Lock, ShieldCheck
} from 'lucide-react';
import MfaSettings from '@/app/components/MfaSettings';

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  // States pou sekirite ak PIN
  const [pinEnabled, setPinEnabled] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  
  // States pou KREYE PIN la premye fwa
  const [newPin, setNewPin] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);
  
  // States pou MODIFYE PIN lan (Modal la)
  const [showUpdatePinModal, setShowUpdatePinModal] = useState(false);
  const [oldPinInput, setOldPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);
  const [updatePinError, setUpdatePinError] = useState('');
  const [updatePinSuccess, setUpdatePinSuccess] = useState('');

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
        setHasPin(!!(userProfile.pin_code_hash || userProfile.pin_code));
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
    const res = await fetch('/api/auth/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set', pin: newPin, type: 'wallet' }),
    });
    const data = await res.json();
    setIsSavingPin(false);

    if (!res.ok || !data.success) {
      alert("Erè: " + (data.message || 'Echèk'));
    } else {
      setHasPin(true);
      setPinEnabled(true);
      setNewPin('');
      alert("PIN ou an anrejistre avèk siksè!");
    }
  };

  const submitPinUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatePinError('');
    setUpdatePinSuccess('');

    if (oldPinInput.length !== 4 || newPinInput.length !== 4) {
      setUpdatePinError("Tanpri mete 4 chif pou tou de PIN yo.");
      return;
    }

    setIsUpdatingPin(true);

    try {
      const res = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', oldPin: oldPinInput, pin: newPinInput }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Ansyen PIN lan pa bon!");

      setUpdatePinSuccess("PIN ou an chanje avèk siksè!");
      
      setTimeout(() => {
        setShowUpdatePinModal(false);
        setOldPinInput('');
        setNewPinInput('');
        setUpdatePinSuccess('');
      }, 1500);

    } catch (err: any) {
      setUpdatePinError(err.message || "Te gen yon pwoblèm. Eseye ankò.");
    } finally {
      setIsUpdatingPin(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    
    const isConfirmed = window.confirm("Èske w vle nou voye yon lyen sou imèl ou pou w chanje modpas ou a?");
    if (!isConfirmed) return;

    try {
      const res = await fetch('/api/auth/send-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert("Erè lè n ap voye imèl la: " + (data?.message || "Eseye ankò."));
      } else {
        alert(`Nou voye yon imèl bay ${user.email} pou w ka chanje modpas ou. Tanpri tcheke bwat lèt ou a (ak spam).`);
      }
    } catch (err: any) {
      alert("Gen yon pwoblèm koneksyon. Eseye ankò.");
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 className="animate-spin text-indigo-600 w-10 h-10" />
    </div>
  );

  const fullName = profile?.full_name || user?.user_metadata?.full_name || "Itilizatè";
  const email = profile?.email || user?.email || "Pa gen imèl";
  const initials = fullName.substring(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 md:p-10 font-sans text-slate-900">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex items-center gap-4 pb-6">
          <button onClick={() => router.back()} className="p-2 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-all shadow-sm text-slate-600">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Paramèt Kont</h1>
            <p className="text-xs text-slate-500 font-medium">Jere pwofil ak sekirite w</p>
          </div>
        </div>

        {/* KAT PWOfil KLIYAN AN */}
        <div className="bg-white border border-gray-200 p-6 rounded-2xl flex items-center gap-5 shadow-sm">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-indigo-50 text-indigo-700 rounded-full flex items-center justify-center font-bold text-xl border border-indigo-100 shrink-0 overflow-hidden">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg md:text-xl font-bold truncate">{fullName}</h2>
            <p className="text-xs md:text-sm text-slate-500 font-medium truncate">{email}</p>
            <div className="mt-2 inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-emerald-100">
              <ShieldCheck size={12} /> Kont Verifye
            </div>
          </div>
        </div>

        {/* SEKIRITE AK AKSÈ */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-2">Sekirite</h3>
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            
            {!hasPin ? (
              <div className="p-6 border-b border-gray-100 bg-amber-50/50">
                <h4 className="text-sm font-bold text-slate-900 mb-2">Kreye PIN 4 Chif ou</h4>
                <p className="text-xs text-slate-600 mb-4">Ou dwe kreye yon PIN pou w ka konekte rapid e pwoteje kòb ou.</p>
                <div className="flex gap-3">
                  <input 
                    type="password" 
                    maxLength={4}
                    placeholder="••••"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    className="bg-white border border-gray-300 rounded-xl px-4 py-2 font-mono w-32 outline-none focus:border-indigo-500 text-center"
                  />
                  <button 
                    onClick={handleSavePin}
                    disabled={isSavingPin || newPin.length !== 4}
                    className="bg-indigo-600 text-white px-6 rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all disabled:opacity-50"
                  >
                    {isSavingPin ? 'Ap Sove...' : 'Sove PIN'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-6 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><Lock className="w-5 h-5" /></div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Modpas PIN (4 chif)</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Mande PIN lè w ap louvri aplikasyon an</p>
                    </div>
                  </div>
                  <button 
                    onClick={togglePin}
                    className={`w-12 h-6 rounded-full transition-colors relative flex items-center shrink-0 ${pinEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full absolute transition-transform ${pinEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div 
                  onClick={() => setShowUpdatePinModal(true)}
                  className="flex items-center justify-between p-6 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><Edit2 className="w-5 h-5" /></div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Modifye PIN nan</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Chanje kòd sekirite 4 chif ou a</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </>
            )}

            <div onClick={handleResetPassword} className="flex items-center justify-between p-6 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><Key className="w-5 h-5" /></div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Modifye Modpas</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Klike pou n voye lyen an sou imèl ou</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>

            <div className="p-6">
              <MfaSettings
                supabase={supabase}
                title="Otantifikasyon 2 Etap (MFA)"
                subtitle="Google Authenticator, Authy, elatriye"
                emptyMessage="Aktive MFA pou plis sekirite. Chak fwa ou konekte, ou ap bezwen yon kòd 6 chif soti nan app otantifikatè w la."
              />
            </div>
          </div>
        </div>

        {/* LÒT SEKSYON */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase text-slate-500 ml-2">Preferans</h3>
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><Bell className="w-5 h-5" /></div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Notifikasyon</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Resevwa alèt pou chak tranzaksyon</p>
                </div>
              </div>
              <button 
                onClick={() => setNotifications(!notifications)}
                className={`w-12 h-6 rounded-full transition-colors relative flex items-center shrink-0 ${notifications ? 'bg-indigo-600' : 'bg-gray-300'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute transition-transform ${notifications ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><Globe className="w-5 h-5" /></div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Lang</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Chwazi lang ki pi bon pou ou</p>
                </div>
              </div>
              
              <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
                {['HT', 'EN', 'ES'].map((lang) => (
                  <button 
                    key={lang}
                    onClick={() => setSelectedLang(lang)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${selectedLang === lang ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {lang === 'HT' ? 'Kreyòl' : lang === 'EN' ? 'English' : 'Español'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <button onClick={handleLogout} className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 border border-rose-100">
          <LogOut size={18} /> Dekonekte
        </button>

      </div>

      {/* MODAL POU CHANJE PIN NAN */}
      {showUpdatePinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-gray-200 w-full max-w-sm rounded-3xl p-8 relative shadow-xl">
            <button 
              onClick={() => {
                setShowUpdatePinModal(false);
                setOldPinInput('');
                setNewPinInput('');
              }} 
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-slate-900">Modifye PIN ou</h3>
            </div>

            <form onSubmit={submitPinUpdate} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Ansyen PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  value={oldPinInput}
                  onChange={(e) => setOldPinInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-50 border border-gray-200 p-3 rounded-xl text-center font-mono text-lg outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Nouvo PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-50 border border-gray-200 p-3 rounded-xl text-center font-mono text-lg outline-none focus:border-indigo-500"
                  required
                />
              </div>
              {updatePinError && <p className="text-rose-600 text-[10px] font-bold text-center">{updatePinError}</p>}
              {updatePinSuccess && <p className="text-emerald-600 text-[10px] font-bold text-center">{updatePinSuccess}</p>}
              <button
                type="submit"
                disabled={isUpdatingPin || oldPinInput.length !== 4 || newPinInput.length !== 4}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-indigo-700 transition-all disabled:opacity-50"
              >
                {isUpdatingPin ? 'Ap chanje...' : 'Konfime'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}