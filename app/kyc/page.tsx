"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import imageCompression from 'browser-image-compression'; 

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

  // NOUVO: Fonksyon pou voye done yo bay Admin nan san peye
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
      
      // 1. Konprese foto yo pou yo pa twò lou sou baz done a
      const compressedId = await imageCompression(files.idFront, compressionOptions);
      
      // 2. Upload foto devan an nan Storage
      const { data: frontData, error: frontErr } = await supabase.storage
        .from('kyc-documents')
        .upload(`${userData.id}/id_front_${timestamp}.jpg`, compressedId);
      
      if (frontErr) throw frontErr;

      // Pran lyen piblik foto a pou Admin nan ka wè l
      const { data: publicUrlData } = supabase.storage
        .from('kyc-documents')
        .getPublicUrl(`${userData.id}/id_front_${timestamp}.jpg`);
        
      const kycDocUrl = publicUrlData.publicUrl;

      // (Ou ka upload selfie a ak idBack la tou si w vle, men kycDocUrl la se li n ap bay admin nan wè dirèk la)

      // 3. Mete pwofil la a jou (kyc_status: pending) POU ADMIN KA JWENN LI
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          kyc_status: 'pending',
          full_name: `${extractedData.firstName} ${extractedData.lastName}`.trim(),
          kyc_document: kycDocUrl // Sove lyen foto a pou bouton "GADE PYÈS LA" nan Admin
        })
        .eq('id', userData.id);

      if (updateError) throw updateError;
      
      // Pase nan dènye etap la (Siksè)
      setStep(3);
      
    } catch (err: any) {
      setErrorMsg("Erè nan voye dokiman yo: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 italic font-sans">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => { if(step > 1 && step < 3) setStep(step - 1); else router.push('/dashboard'); }} className="text-zinc-500 text-2xl">←</button>
        <h1 className="text-xl font-black uppercase text-red-600 italic">Verifikasyon ID</h1>
      </div>

      {errorMsg && <div className="bg-red-600/20 border border-red-600 p-4 rounded-2xl text-red-500 text-[10px] font-bold mb-6 text-center uppercase">{errorMsg}</div>}
      {successMsg && <div className="bg-green-600/20 border border-green-600 p-4 rounded-2xl text-green-500 text-[10px] font-bold mb-6 text-center uppercase">{successMsg}</div>}

      {step === 1 && (
        <div className="space-y-4 animate-in fade-in duration-300">
           <h2 className="text-2xl font-black uppercase italic mb-2">Chwazi Dokiman</h2>
           <p className="text-[10px] text-zinc-400 font-bold tracking-widest uppercase mb-6">Pwosesis sa a gratis epi li pran 2 minit.</p>
           
           {['CIN / KAT ELEKTORAL', 'PASPÒ', 'PÈMI KONDWI'].map((item) => (
             <button key={item} onClick={() => { setDocType(item); setStep(2); }} className="w-full bg-zinc-900/50 p-6 rounded-[2rem] border border-white/5 text-left font-bold italic flex justify-between items-center active:scale-95 transition-all">
               {item} <span className="text-red-600">→</span>
             </button>
           ))}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 animate-in slide-in-from-right duration-300">
          <h2 className="text-2xl font-black uppercase italic leading-tight">Enfòmasyon w</h2>
          
          {/* Chan pou Non ak Siyati manyèl */}
          <div className="grid grid-cols-2 gap-4 mb-2">
            <input 
              type="text" 
              placeholder="NON" 
              className="bg-zinc-900 p-4 rounded-2xl border border-zinc-700 text-[10px] font-black uppercase italic focus:border-red-600 outline-none"
              value={extractedData.firstName}
              onChange={(e) => setExtractedData(prev => ({ ...prev, firstName: e.target.value.toUpperCase() }))}
            />
            <input 
              type="text" 
              placeholder="SIYATI" 
              className="bg-zinc-900 p-4 rounded-2xl border border-zinc-700 text-[10px] font-black uppercase italic focus:border-red-600 outline-none"
              value={extractedData.lastName}
              onChange={(e) => setExtractedData(prev => ({ ...prev, lastName: e.target.value.toUpperCase() }))}
            />
          </div>

          <div className="space-y-4">
            <label className={`block bg-zinc-900 p-6 rounded-[2rem] border-2 border-dashed text-center transition-all ${files.idFront ? 'border-red-600' : 'border-zinc-700'}`}>
              <span className="text-3xl block mb-1">📸</span>
              <p className="text-[9px] font-black uppercase italic">{files.idFront ? files.idFront.name : "Foto DEVAN Dokiman an"}</p>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileChange(e, 'idFront')} />
            </label>

            {docType === 'CIN / KAT ELEKTORAL' && (
              <label className={`block bg-zinc-900 p-6 rounded-[2rem] border-2 border-dashed text-center transition-all ${files.idBack ? 'border-red-600' : 'border-zinc-700'}`}>
                <span className="text-3xl block mb-1">📸</span>
                <p className="text-[9px] font-black uppercase italic">{files.idBack ? files.idBack.name : "Foto DÈYÈ Dokiman an"}</p>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileChange(e, 'idBack')} />
              </label>
            )}

            <label className={`block bg-zinc-900 p-6 rounded-[2rem] border-2 border-dashed text-center transition-all ${files.selfie ? 'border-red-600' : 'border-zinc-700'}`}>
              <span className="text-3xl block mb-1">👤</span>
              <p className="text-[9px] font-black uppercase italic">{files.selfie ? files.selfie.name : "Pran yon Selfie klè ak figi w"}</p>
              <input type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => handleFileChange(e, 'selfie')} />
            </label>
          </div>

          <button disabled={loading} onClick={soumetKycBayAdmin} className="w-full bg-red-600 py-6 rounded-[2rem] font-black uppercase italic active:scale-95 transition-all">
            {loading ? "Ap Soumèt Dokiman yo..." : "Soumèt pou Verifikasyon"}
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="text-center space-y-8 animate-in zoom-in duration-500 mt-10">
          <div className="py-10">
            <div className="w-24 h-24 bg-yellow-500/10 text-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl border border-yellow-500/30">
              ⏳
            </div>
            <h2 className="text-2xl font-black uppercase italic text-white mb-3">Dokiman yo Soumèt!</h2>
            <p className="text-zinc-400 text-[11px] uppercase font-bold leading-relaxed px-4">
              Ekip nou an ap tcheke dokiman w yo kounye a.<br/> 
              Sa anjeneral pran mwens pase <span className="text-white">10 minit</span>.
            </p>
          </div>
          
          <button onClick={() => router.push('/dashboard')} className="w-full bg-zinc-800 text-white py-5 rounded-[2.5rem] font-black uppercase italic active:scale-95 transition-all border border-white/5">
            Tounen nan Dashboard
          </button>
        </div>
      )}
    </div>
  );
}