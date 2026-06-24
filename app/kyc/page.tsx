"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import imageCompression from 'browser-image-compression'; 
import { ArrowLeft, AlertTriangle, CheckCircle2, ChevronRight, Camera, User, Clock, ShieldCheck, FileText, Loader2 } from 'lucide-react';

export default function KYCPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [docType, setDocType] = useState(""); 
  const [userData, setUserData] = useState<any>(null);
  
  const [extractedData, setExtractedData] = useState({ firstName: "", lastName: "" });
  const [files, setFiles] = useState({ 
    idFront: null as File | null, 
    idBack: null as File | null, 
    selfie: null as File | null 
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        setUserData(prof);
        
        // Si l ap tann deja, voye l nan dènye etap la otomatikman
        if (prof?.kyc_status === 'pending') {
          setStep(3);
        }
      } else {
        router.push('/login');
      }
    };
    loadData();
  }, [supabase, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: keyof typeof files) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFiles(prev => ({ ...prev, [type]: file }));
    }
  };

  const soumetKycBayAdmin = async () => {
    if (!extractedData.firstName || !extractedData.lastName) {
      setErrorMsg("TANPRI ANTRE NON AK SIYATI OU AVAN.");
      return;
    }

    const isCIN = docType === 'CIN / KAT ELEKTORAL';
    if (!files.idFront || !files.selfie || (isCIN && !files.idBack)) {
      setErrorMsg("Tanpri pran tout foto yo mande yo.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
  
    try {
      const timestamp = Date.now();
      const compressionOptions = { maxSizeMB: 1, maxWidthOrHeight: 1280, useWebWorker: true };
      
      // 1. Upload FOTO DEVAN
      const compressedFront = await imageCompression(files.idFront, compressionOptions);
      const { error: frontErr } = await supabase.storage.from('kyc-documents').upload(`${userData.id}/front_${timestamp}.jpg`, compressedFront);
      if (frontErr) throw frontErr;
      const frontUrl = supabase.storage.from('kyc-documents').getPublicUrl(`${userData.id}/front_${timestamp}.jpg`).data.publicUrl;

      // 2. Upload FOTO DÈYÈ (Si l se CIN)
      let backUrl = null;
      if (files.idBack) {
        const compressedBack = await imageCompression(files.idBack, compressionOptions);
        const { error: backErr } = await supabase.storage.from('kyc-documents').upload(`${userData.id}/back_${timestamp}.jpg`, compressedBack);
        if (backErr) throw backErr;
        backUrl = supabase.storage.from('kyc-documents').getPublicUrl(`${userData.id}/back_${timestamp}.jpg`).data.publicUrl;
      }

      // 3. Upload SELFIE
      const compressedSelfie = await imageCompression(files.selfie, compressionOptions);
      const { error: selfieErr } = await supabase.storage.from('kyc-documents').upload(`${userData.id}/selfie_${timestamp}.jpg`, compressedSelfie);
      if (selfieErr) throw selfieErr;
      const selfieUrl = supabase.storage.from('kyc-documents').getPublicUrl(`${userData.id}/selfie_${timestamp}.jpg`).data.publicUrl;

      // 4. SOVE TOUT BAGAY NAN BAZ DONE A POU ADMIN
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          kyc_status: 'pending',
          full_name: `${extractedData.firstName} ${extractedData.lastName}`.trim(),
          kyc_front: frontUrl,
          kyc_back: backUrl,
          kyc_selfie: selfieUrl,
          kyc_rejection_reason: null // Nou efase ansyen rezon an paske l fèk soumèt yon nouvo
        })
        .eq('id', userData.id);

      if (updateError) throw updateError;
      
      setStep(3); // Siksè
      
    } catch (err: any) {
      setErrorMsg("Erè nan voye dokiman yo: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 font-sans flex flex-col items-center">
      <div className="w-full max-w-md">
        
        {/* HEADER */}
        <div className="flex items-center gap-4 mb-8 mt-2">
          <button 
            onClick={() => { if(step > 1 && step < 3) setStep(step - 1); else router.push('/dashboard'); }} 
            className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-colors shadow-sm shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Verifikasyon ID</h1>
            <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest mt-1">Konfòmite KYC</p>
          </div>
        </div>

        {/* MESSAGES (Erè / Siksè) */}
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-700 text-xs font-bold mb-6 flex items-center gap-2 shadow-sm">
            <AlertTriangle size={18} className="shrink-0" /> 
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-700 text-xs font-bold mb-6 flex items-center gap-2 shadow-sm">
            <CheckCircle2 size={18} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* NOUVO NOTIFIKASYON REJÈ A */}
        {userData?.kyc_status === 'rejected' && step === 1 && (
          <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl mb-8 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-amber-100 p-2 rounded-full text-amber-600">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-amber-800 font-bold uppercase tracking-wider text-xs">Demann ou an te Rejte</h3>
            </div>
            <div className="bg-white/60 p-3 rounded-lg border border-amber-100 mb-4">
              <p className="text-amber-900 text-sm font-medium leading-relaxed">
                <span className="text-amber-700/70 text-xs uppercase font-bold block mb-1">Rezon an se:</span> 
                {userData.kyc_rejection_reason || 'Dokiman w yo pa t klè ase.'}
              </p>
            </div>
            <p className="text-amber-700 text-[10px] font-bold uppercase tracking-widest">
              Tanpri reprann pwosesis la epi asire w foto yo parèt trè klè.
            </p>
          </div>
        )}

        {/* STEP 1: CHWAZI DOKIMAN */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="mb-8">
              <h2 className="text-xl font-bold text-slate-900 mb-2">Chwazi Dokiman</h2>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Pwosesis sa a gratis epi li pran mwens pase 2 minit. Chwazi yon pyès idantite valab pou n kòmanse.
              </p>
            </div>
             
             <div className="space-y-3">
               {['CIN / KAT ELEKTORAL', 'PASPÒ', 'PÈMI KONDWI'].map((item) => (
                 <button 
                   key={item} 
                   onClick={() => { setDocType(item); setStep(2); }} 
                   className="w-full bg-white p-5 rounded-2xl border border-gray-200 text-left font-bold text-sm text-slate-700 flex justify-between items-center transition-all hover:border-indigo-300 hover:shadow-sm group"
                 >
                   <span className="flex items-center gap-3">
                     <FileText size={18} className="text-indigo-500 group-hover:text-indigo-600 transition-colors" />
                     {item}
                   </span>
                   <ChevronRight size={18} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                 </button>
               ))}
             </div>
             
             <div className="mt-8 flex items-center justify-center gap-2 text-slate-400">
               <ShieldCheck size={16} />
               <span className="text-[10px] font-bold uppercase tracking-widest">Done ou yo ankripte epi an sekirite</span>
             </div>
          </div>
        )}

        {/* STEP 2: FÒMILÈ AK UPLOAD */}
        {step === 2 && (
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900 mb-1">Enfòmasyon w</h2>
              <p className="text-xs text-slate-500 font-medium">Tanpri antre non w jan l ekri sou dokiman an.</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-2">Non</label>
                <input 
                  type="text" 
                  placeholder="EG: JEAN" 
                  className="w-full bg-white p-4 rounded-xl border border-gray-300 text-sm font-bold uppercase text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-400 shadow-sm"
                  value={extractedData.firstName}
                  onChange={(e) => setExtractedData(prev => ({ ...prev, firstName: e.target.value.toUpperCase() }))}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-2">Siyati</label>
                <input 
                  type="text" 
                  placeholder="EG: JACQUES" 
                  className="w-full bg-white p-4 rounded-xl border border-gray-300 text-sm font-bold uppercase text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-400 shadow-sm"
                  value={extractedData.lastName}
                  onChange={(e) => setExtractedData(prev => ({ ...prev, lastName: e.target.value.toUpperCase() }))}
                />
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 border-b border-gray-200 pb-2">Foto Dokiman yo</p>
              
              <label className={`block bg-slate-50 p-6 rounded-2xl border-2 border-dashed text-center transition-all cursor-pointer ${files.idFront ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 hover:border-indigo-400'}`}>
                <Camera size={32} className={`mx-auto mb-3 ${files.idFront ? 'text-emerald-500' : 'text-slate-400'}`} />
                <p className={`text-xs font-bold uppercase tracking-wider ${files.idFront ? 'text-emerald-700' : 'text-slate-600'}`}>
                  {files.idFront ? '✅ ' + files.idFront.name : "Foto DEVAN Dokiman an"}
                </p>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileChange(e, 'idFront')} />
              </label>

              {docType === 'CIN / KAT ELEKTORAL' && (
                <label className={`block bg-slate-50 p-6 rounded-2xl border-2 border-dashed text-center transition-all cursor-pointer ${files.idBack ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 hover:border-indigo-400'}`}>
                  <Camera size={32} className={`mx-auto mb-3 ${files.idBack ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <p className={`text-xs font-bold uppercase tracking-wider ${files.idBack ? 'text-emerald-700' : 'text-slate-600'}`}>
                    {files.idBack ? '✅ ' + files.idBack.name : "Foto DÈYÈ Dokiman an"}
                  </p>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileChange(e, 'idBack')} />
                </label>
              )}

              <label className={`block bg-slate-50 p-6 rounded-2xl border-2 border-dashed text-center transition-all cursor-pointer ${files.selfie ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 hover:border-indigo-400'}`}>
                <User size={32} className={`mx-auto mb-3 ${files.selfie ? 'text-emerald-500' : 'text-slate-400'}`} />
                <p className={`text-xs font-bold uppercase tracking-wider ${files.selfie ? 'text-emerald-700' : 'text-slate-600'}`}>
                  {files.selfie ? '✅ ' + files.selfie.name : "Pran yon Selfie klè ak figi w"}
                </p>
                <input type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => handleFileChange(e, 'selfie')} />
              </label>
            </div>

            <button 
              disabled={loading} 
              onClick={soumetKycBayAdmin} 
              className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-sm flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Ap Soumèt...</>
              ) : "Soumèt pou Verifikasyon"}
            </button>
          </div>
        )}

        {/* STEP 3: Siksè / Tann */}
        {step === 3 && (
          <div className="text-center space-y-8 animate-in zoom-in duration-500 mt-10 bg-white border border-gray-200 p-8 rounded-3xl shadow-sm">
            <div className="py-6">
              <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 border border-indigo-100 shadow-sm">
                <Clock size={36} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-3 tracking-tight">Dokiman yo Soumèt!</h2>
              <p className="text-slate-500 text-sm font-medium leading-relaxed px-2">
                Ekip nou an ap tcheke dokiman w yo kounye a.<br/> 
                Sa anjeneral pran mwens pase <span className="text-slate-900 font-bold">10 minit</span>.
              </p>
            </div>
            
            <button 
              onClick={() => router.push('/dashboard')} 
              className="w-full bg-white border border-gray-300 text-slate-700 py-4 rounded-xl font-bold uppercase text-xs tracking-wider hover:bg-gray-50 transition-all shadow-sm"
            >
              Tounen nan Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}