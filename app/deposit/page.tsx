"use client";
import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, UploadCloud, CheckCircle2, Image as ImageIcon, Wallet, ChevronRight } from 'lucide-react';

export default function DepositPage() {
    const router = useRouter();
    
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const [step, setStep] = useState(1);
    const [method, setMethod] = useState('MonCash');
    const [amount, setAmount] = useState<number>(0);
    const [txnId, setTxnId] = useState('');
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);
    const [files, setFiles] = useState<{ f1: File | null, f2: File | null }>({ f1: null, f2: null });
    const [depositFeePercent, setDepositFeePercent] = useState(5);

    const paymentInfo = {
        'MonCash': { number: '37201241', name: 'Emetil Dorkensen' },
        'NatCash': { number: '41242743', name: 'SEXE SEKS' }
    };

    useEffect(() => {
        const getProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            
            if (user) {
                const { data: profileData } = await supabase
                    .from('profiles')
                .select('id, full_name, email, wallet_balance, account_status, account_type, kyc_status')
                .eq('id', user.id)
                .single();
                
                // Nou mete email la nan profile la tou pou sekirite
                setProfile({ ...(profileData || {}), id: user.id, email: user.email });
                setCheckingAuth(false);
                try {
                  const feeRes = await fetch('/api/fees/mine');
                  const feeData = await feeRes.json().catch(() => ({}));
                  if (feeRes.ok && feeData.fees?.deposit_fee_percent != null) {
                    setDepositFeePercent(Number(feeData.fees.deposit_fee_percent));
                  }
                } catch { /* keep default 5 */ }
            } else {
                router.replace('/login');
            }
        };
        getProfile();
    }, [router, supabase]);

    const fee = amount * (depositFeePercent / 100);
    const total = amount + fee;

    const handleFileUpload = async (file: File) => {
        const body = new FormData();
        body.append('file', file);
        const res = await fetch('/api/deposit/upload-proof', {
            method: 'POST',
            credentials: 'include',
            body,
        });
        const data = await res.json();
        if (!res.ok || !data.storagePath) {
            throw new Error(data.error || 'Pa t kapab telechaje prèv la.');
        }
        return data.storagePath as string;
    };

    const handleSubmitManual = async () => {
        if (!txnId || !files.f1) return alert("Tanpri antre ID tranzaksyon an ak foto prèv la.");
        
        setLoading(true);
        
        try {
            // 1. Rekipere itilizatè a ki konekte a (Gid sekirite: Toujou verifye sesyon an anvan aksyon kritik)
            const { data: { user }, error: authError } = await supabase.auth.getUser();
    
            if (authError || !user) {
                alert("Sesyon ou ekspire. Tanpri rekonekte.");
                router.push('/login');
                return;
            }
    
            // 2. Telechaje foto yo
            const url1 = await handleFileUpload(files.f1!);
            const url2 = files.f2 ? await handleFileUpload(files.f2) : url1;
            
            // 3. Kreye depo via RPC (frè kalkile nan baz)
            const { data: rpcData, error } = await supabase.rpc('create_deposit_request', {
                p_amount: Number(amount),
                p_method: method,
                p_transaction_id: txnId,
                p_proof_img_1: url1,
                p_proof_img_2: url2,
            });

            if (error) throw error;
            const result = typeof rpcData === 'string' ? JSON.parse(rpcData) : rpcData;
            if (!result?.success) throw new Error(result?.message || 'Pa t kapab anrejistre depo a.');

            // 4. Notifikasyon Telegram (Opsyonèl men itil pou admin)
            const msg = `🔔 *DEPO HATEX NOUVO*\n👤: ${profile?.full_name || 'Kliyan'}\n📧: ${user.email}\n💰: ${amount} HTG\n🆔: ${txnId}`;
            
            await fetch('/api/notifications/telegram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channel: 'finance', message: msg, photoUrl: url1, parseMode: 'Markdown' }),
            });
    
            alert("Bravo! Depo w lan anrejistre. N ap verifye l talè.");
            router.push('/dashboard');
            
        } catch (err: any) {
            console.error("Erè depo:", err.message);
            alert("Erè: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (checkingAuth) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
                <div className="text-slate-600 font-semibold tracking-wide text-sm uppercase">
                    Verifye sekirite HatexCard...
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 font-sans">
            <div className="max-w-lg mx-auto">
                
                {/* Header Paj la */}
                <div className="flex items-center gap-4 mb-8">
                    <button 
                        onClick={() => step === 2 ? setStep(1) : router.back()} 
                        className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors text-slate-600 hover:text-indigo-600"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Depoze Fon</h1>
                </div>
                
                {step === 1 ? (
                    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                        
                        {/* Bouton Chwa Metòd yo */}
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={() => setMethod('MonCash')} 
                                className={`p-5 rounded-2xl border transition-all font-bold text-sm flex items-center justify-center gap-2 ${method === 'MonCash' ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-gray-200 bg-white text-slate-600 hover:border-indigo-300'}`}
                            >
                                <Wallet size={18} className={method === 'MonCash' ? "text-indigo-600" : "text-slate-400"} /> MonCash
                            </button>
                            <button 
                                onClick={() => setMethod('NatCash')} 
                                className={`p-5 rounded-2xl border transition-all font-bold text-sm flex items-center justify-center gap-2 ${method === 'NatCash' ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-gray-200 bg-white text-slate-600 hover:border-indigo-300'}`}
                            >
                                <Wallet size={18} className={method === 'NatCash' ? "text-indigo-600" : "text-slate-400"} /> NatCash
                            </button>
                        </div>

                        {/* Fòm Antre Montan an */}
                        <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm text-center">
                            <p className="text-xs mb-6 text-slate-500 font-bold uppercase tracking-wider">Konbyen ou vle depoze?</p>
                            
                            <input 
                                type="number" 
                                value={amount || ''} 
                                onChange={(e) => setAmount(Number(e.target.value))} 
                                className="w-full bg-transparent text-5xl font-bold text-center outline-none text-slate-900 placeholder:text-gray-300 focus:ring-0" 
                                placeholder="0" 
                            />
                            
                            <div className="mt-8 pt-6 border-t border-gray-100 space-y-3">
                                <div className="flex justify-between items-center text-slate-500">
                                    <span className="text-xs font-semibold">Frè sistèm ({depositFeePercent}%):</span>
                                    <span className="text-sm font-bold text-slate-700">{fee.toFixed(2)} HTG</span>
                                </div>
                                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-gray-100">
                                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Total pou voye a:</span>
                                    <span className="text-lg font-bold text-indigo-600">{total.toFixed(2)} HTG</span>
                                </div>
                            </div>
                        </div>

                        {/* Bouton Kontinye */}
                        <button 
                            onClick={() => amount >= 500 ? setStep(2) : alert("Minimòm depo se 500 HTG")} 
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2"
                        >
                            Kontinye <ChevronRight size={18} />
                        </button>
                        
                        <p className="text-center text-xs font-medium text-slate-500 mt-4">
                            Lajan an ap ajoute sou kont ou apre verifikasyon prèv la.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                        
                        {/* Enstriksyon Kote pou Voye Lajan an */}
                        <div className="bg-white p-8 rounded-3xl text-center shadow-xl border border-gray-200 relative overflow-hidden">
                            <div className="absolute top-0 left-0 right-0 h-1.5 bg-indigo-600"></div>
                            <p className="text-xs font-bold mb-2 text-slate-500 uppercase tracking-wider">Tanpri voye egzakteman <span className="text-indigo-600">{total.toFixed(2)} HTG</span> sou:</p>
                            <h2 className="text-4xl sm:text-5xl font-black mb-4 tracking-tight text-slate-900">{paymentInfo[method as keyof typeof paymentInfo].number}</h2>
                            <div className="inline-block bg-indigo-50 border border-indigo-100 px-5 py-2 rounded-full">
                                <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Non: {paymentInfo[method as keyof typeof paymentInfo].name}</p>
                            </div>
                        </div>

                        {/* Zòn Prèv ak ID Tranzaksyon an */}
                        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-5">
                            <div>
                                <label className="block text-xs text-slate-600 font-bold mb-2 uppercase tracking-wider">ID Tranzaksyon {method}</label>
                                <input 
                                    type="text" 
                                    placeholder="Antre ID tranzaksyon an la a..." 
                                    value={txnId} 
                                    onChange={(e) => setTxnId(e.target.value)} 
                                    className="w-full bg-white p-4 rounded-xl outline-none text-sm border border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium text-slate-900 transition-all placeholder:text-gray-400" 
                                />
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                <div>
                                    <input type="file" id="f1" hidden accept="image/*" onChange={(e) => setFiles({...files, f1: e.target.files![0]})} />
                                    <label htmlFor="f1" className={`h-32 rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all cursor-pointer ${files.f1 ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-gray-300 bg-slate-50 text-slate-500 hover:border-indigo-400 hover:bg-indigo-50'}`}>
                                        {files.f1 ? <CheckCircle2 size={32} className="mb-2" /> : <UploadCloud size={32} className="mb-2 text-slate-400" />}
                                        <span className="text-xs font-bold uppercase tracking-wider">{files.f1 ? 'Prèv 1 Chaje' : 'Mete Foto Prèv 1'}</span>
                                        {!files.f1 && <span className="text-[10px] text-slate-400 mt-1 font-medium">Obligatwa</span>}
                                    </label>
                                </div>
                                <div>
                                    <input type="file" id="f2" hidden accept="image/*" onChange={(e) => setFiles({...files, f2: e.target.files![0]})} />
                                    <label htmlFor="f2" className={`h-32 rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all cursor-pointer ${files.f2 ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-gray-300 bg-slate-50 text-slate-500 hover:border-indigo-400 hover:bg-indigo-50'}`}>
                                        {files.f2 ? <CheckCircle2 size={32} className="mb-2" /> : <ImageIcon size={32} className="mb-2 text-slate-400" />}
                                        <span className="text-xs font-bold uppercase tracking-wider">{files.f2 ? 'Prèv 2 Chaje' : 'Lòt Foto (Opsyon)'}</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={handleSubmitManual} 
                            disabled={loading || !txnId || !files.f1} 
                            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-sm shadow-sm hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase tracking-wider"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" /> Y ap anrejistre...
                                </>
                            ) : 'Mwen voye kòb la'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}