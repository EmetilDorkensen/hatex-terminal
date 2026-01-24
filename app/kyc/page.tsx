"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import imageCompression from 'browser-image-compression'; 
import { verifyFaceAI } from './actions'; 

export default function KYCPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [docType, setDocType] = useState(""); 
  const [userData, setUserData] = useState<any>(null);
  
  const [extractedData, setExtractedData] = useState({ firstName: "", lastName: "" });
  const [fileStatus, setFileStatus] = useState({ idFront: 'none', idBack: 'none', selfie: 'none' });
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
      }
    };
    loadData();
  }, [supabase]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: keyof typeof files) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFiles(prev => ({ ...prev, [type]: file }));
      setFileStatus(prev => ({ ...prev, [type]: 'none' }));
    }
  };

  const runAIVerification = async () => {
    if (!extractedData.firstName || !extractedData.lastName) {
      setErrorMsg("TANPRI ANTRE NON AK SIYATI OU AVAN.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
  
    try {
      const isCIN = docType === 'CIN / KAT ELEKTORAL';
      if (!files.idFront || !files.selfie || (isCIN && !files.idBack)) {
        throw new Error("Tanpri pran tout foto yo mande yo.");
      }
  
      const compressionOptions = { maxSizeMB: 1, maxWidthOrHeight: 1280, useWebWorker: true };
      const compressedId = await imageCompression(files.idFront, compressionOptions);
      const compressedSelfie = await imageCompression(files.selfie, compressionOptions);
  
      const dataToSend = new FormData();
      dataToSend.append('idCard', compressedId);
      dataToSend.append('selfie', compressedSelfie);
  
      const result = await verifyFaceAI(dataToSend);

      if (result.error) throw new Error(result.error);

      // Si Face Comparison mache, nou pase nan Step 3
      setFileStatus({ idFront: 'success', idBack: isCIN ? 'success' : 'none', selfie: 'success' });
      setStep(3);
      
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalActivation = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      if (!userData || (userData.wallet_balance || 0) < 2000) {
        throw new Error("BALANS ENSIFIZAN. OU BEZWEN 2,000 HTG.");
      }

      const timestamp = Date.now();
      
      // 1. Upload foto yo nan Storage
      const { data: frontData, error: frontErr } = await supabase.storage
        .from('kyc-documents')
        .upload(`${userData.id}/id_front_${timestamp}.jpg`, files.idFront!);
      if (frontErr) throw frontErr;

      let backPath = null;
      if (files.idBack) {
        const { data: backData, error: backErr } = await supabase.storage
          .from('kyc-documents')
          .upload(`${userData.id}/id_back_${timestamp}.jpg`, files.idBack!);
        if (backErr) throw backErr;
        backPath = backData.path;
      }

      const { data: selfieData, error: selfieErr } = await supabase.storage
        .from('kyc-documents')
        .upload(`${userData.id}/selfie_${timestamp}.jpg`, files.selfie!);
      if (selfieErr) throw selfieErr;

      // 2. Mizajou pwofil la (Koupe kòb la epi aktive KYC)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          kyc_status: 'approved',
          full_name: `${extractedData.firstName} ${extractedData.lastName}`,
          wallet_balance: userData.wallet_balance - 2000 
        })
        .eq('id', userData.id);

      if (updateError) throw updateError;
      
      setSuccessMsg("KONT OU AKTIVE! KAT OU AP PREPARE...");
      
      // 3. Redireksyon ak "Hard Refresh" pou wè nouvo balans lan
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2500);

    } catch (err: any) {
      setErrorMsg("Erè nan sove done: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 italic font-sans">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setStep(1)} className="text-zinc-500 text-2xl">←</button>
        <h1 className="text-xl font-black uppercase text-red-600 italic">Hatex Security</h1>
      </div>

      {errorMsg && <div className="bg-red-600/20 border border-red-600 p-4 rounded-2xl text-red-500 text-[10px] font-bold mb-6 text-center uppercase">{errorMsg}</div>}
      {successMsg && <div className="bg-green-600/20 border border-green-600 p-4 rounded-2xl text-green-500 text-[10px] font-bold mb-6 text-center uppercase">{successMsg}</div>}

      {step === 1 && (
        <div className="space-y-4">
           <h2 className="text-2xl font-black uppercase italic mb-6">Chwazi Dokiman</h2>
           {['CIN / KAT ELEKTORAL', 'PASPÒ', 'PÈMI KONDWI'].map((item) => (
             <button key={item} onClick={() => { setDocType(item); setStep(2); }} className="w-full bg-zinc-900/50 p-6 rounded-[2rem] border border-white/5 text-left font-bold italic flex justify-between items-center active:scale-95 transition-all">
               {item} <span className="text-red-600">→</span>
             </button>
           ))}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-black uppercase italic leading-tight">Biometri ak IA</h2>
          
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
              <p className="text-[9px] font-black uppercase italic">{files.idFront ? files.idFront.name : "Foto DEVAN Dokiman"}</p>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileChange(e, 'idFront')} />
            </label>

            {docType === 'CIN / KAT ELEKTORAL' && (
              <label className={`block bg-zinc-900 p-6 rounded-[2rem] border-2 border-dashed text-center transition-all ${files.idBack ? 'border-red-600' : 'border-zinc-700'}`}>
                <span className="text-3xl block mb-1">📸</span>
                <p className="text-[9px] font-black uppercase italic">{files.idBack ? files.idBack.name : "Foto DÈYÈ Dokiman"}</p>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileChange(e, 'idBack')} />
              </label>
            )}

            <label className={`block bg-zinc-900 p-6 rounded-[2rem] border-2 border-dashed text-center transition-all ${files.selfie ? 'border-red-600' : 'border-zinc-700'}`}>
              <span className="text-3xl block mb-1">👤</span>
              <p className="text-[9px] font-black uppercase italic">{files.selfie ? files.selfie.name : "Pran yon Selfie klè"}</p>
              <input type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => handleFileChange(e, 'selfie')} />
            </label>
          </div>

          <button disabled={loading} onClick={runAIVerification} className="w-full bg-red-600 py-6 rounded-[2rem] font-black uppercase italic active:scale-95 transition-all">
            {loading ? "Verifikasyon an kous..." : "Verifye Idantite"}
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="text-center space-y-8 animate-in zoom-in duration-500">
          <div className="py-10">
            <div className="w-24 h-24 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl border border-green-500/30">✓</div>
            <h2 className="text-2xl font-black uppercase italic">Siksè!</h2>
            <p className="text-zinc-400 text-xs mt-2 uppercase font-bold">Non: {extractedData.firstName} {extractedData.lastName}</p>
          </div>
          <button onClick={handleFinalActivation} disabled={loading} className="w-full bg-red-600 py-6 rounded-[2.5rem] font-black uppercase italic active:scale-95 transition-all">
            {loading ? 'Aktivasyon...' : 'Peye Aktivasyon (0,0 HTG)'}
          </button>
        </div>
      )}
    </div>
  );
}