"use client";
import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export default function AdminSuperPage() {
    const router = useRouter();
    const [deposits, setDeposits] = useState<any[]>([]);
    const [withdrawals, setWithdrawals] = useState<any[]>([]);
    const [view, setView] = useState<'depo' | 'retre'>('depo');
    const [loading, setLoading] = useState(true);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const BOT_TOKEN = '8395029585:AAEZKtLVQhuwk8drzziAIJeDtHuhjl77bPY';
    const CHAT_ID = '8392894841';

    const voyeNotifikasyon = async (mesaj: string) => {
        try {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: CHAT_ID, text: mesaj, parse_mode: 'Markdown' })
            });
        } catch (e) { console.error(e); }
    };

    const raleDone = async () => {
        setLoading(true);
        const { data: d } = await supabase.from('deposits').select('*, profiles(full_name, wallet_balance)').order('created_at', { ascending: false });
        const { data: w } = await supabase.from('withdrawals').select('*, profiles(full_name, wallet_balance)').order('created_at', { ascending: false });
        if (d) setDeposits(d);
        if (w) setWithdrawals(w);
        setLoading(false);
    };

    useEffect(() => { raleDone(); }, []);

    // 1. SUPRIME YON SÈL
    const suprimeTranzaksyon = async (id: string, table: 'deposits' | 'withdrawals') => {
        if (!confirm("Efase tranzaksyon sa a?")) return;
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (!error) raleDone();
    };

    // 2. SUPRIME TOUT SA KI VALIDE YO NÈT
    const suprimeToutValide = async () => {
        const table = view === 'depo' ? 'deposits' : 'withdrawals';
        const msg = view === 'depo' ? "tout DEPO ki apwouve oswa anile" : "tout RETRÈ ki fin peye";
        
        if (!confirm(`Èske w sèten ou vle netwaye ${msg}?`)) return;

        const { error } = await supabase
            .from(table)
            .delete()
            .neq('status', 'pending'); // Li p'ap efase sa ki pending yo

        if (!error) {
            alert("Lis la netwaye!");
            raleDone();
        } else {
            alert("Erè: " + error.message);
        }
    };

    const modifyeDepo = async (d: any) => {
        const nouvoMontan = prompt(`Modifye montan pou ${d.profiles?.full_name}:`, d.amount);
        if (nouvoMontan !== null && !isNaN(Number(nouvoMontan))) {
            const { error } = await supabase.from('deposits').update({ amount: Number(nouvoMontan) }).eq('id', d.id);
            if (!error) { alert("Montan modifye!"); raleDone(); }
        }
    };

    const apwouveDepo = async (d: any) => {
        if (!confirm(`Apwouve ${d.amount} HTG pou ${d.profiles?.full_name}?`)) return;
        const nouvoBalans = Number(d.profiles.wallet_balance || 0) + Number(d.amount);
        const { error: err1 } = await supabase.from('profiles').update({ wallet_balance: nouvoBalans }).eq('id', d.user_id);
        const { error: err2 } = await supabase.from('deposits').update({ status: 'approved' }).eq('id', d.id);

        if (!err1 && !err2) {
            await supabase.from('transactions').insert({
                user_id: d.user_id, amount: Number(d.amount), type: 'DEPOSIT',
                description: 'Depo HTG konfime', status: 'success', method: 'SISTÈM'
            });
            await voyeNotifikasyon(`✅ *DEPO APWOUVE*\n👤 ${d.profiles?.full_name}\n💰 +${d.amount} HTG\n📈 Balans: ${nouvoBalans} HTG`);
            raleDone();
        }
    };

    const anileDepo = async (d: any) => {
        const rezon = prompt("Rezon anilasyon an?");
        if (rezon) {
            const { error } = await supabase.from('deposits').update({ status: 'rejected', admin_notes: rezon }).eq('id', d.id);
            if (!error) {
                await supabase.from('transactions').insert({
                    user_id: d.user_id, amount: Number(d.amount), type: 'DEPOSIT',
                    description: 'Depo anile', status: 'rejected', admin_notes: rezon, method: 'SISTÈM'
                });
                await voyeNotifikasyon(`❌ *DEPO ANILE*\n👤 ${d.profiles?.full_name}\n📝 Rezon: ${rezon}`);
                raleDone();
            }
        }
    };

    const finPeyeRetre = async (w: any) => {
        if (!confirm(`Èske ou fin voye kòb la bay ${w.profiles?.full_name}?`)) return;
        const { error } = await supabase.from('withdrawals').update({ status: 'completed' }).eq('id', w.id);
        if (!error) {
            await supabase.from('transactions').insert({
                user_id: w.user_id, amount: -Number(w.amount), type: 'WITHDRAWAL',
                description: 'Retrè konfime', status: 'success', method: 'SISTÈM'
            });
            await voyeNotifikasyon(`💸 *RETRÈ FIN PEYE*\n👤 ${w.profiles?.full_name}\n💵 ${w.amount} HTG`);
            raleDone();
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0b14] text-white p-4 italic font-sans pb-24 uppercase">
            <div className="max-w-md mx-auto flex justify-between items-center mb-6">
                <h1 className="text-xl font-black text-red-600 tracking-tighter">Admin Hatex</h1>
                <button 
                    onClick={suprimeToutValide}
                    className="bg-red-600/10 text-red-600 border border-red-600/20 px-4 py-2 rounded-xl text-[8px] font-black hover:bg-red-600 hover:text-white transition-all"
                >
                    EFASE TOUT SA K FIN VALIDE
                </button>
            </div>
            
            <div className="flex gap-2 mb-6 max-w-md mx-auto font-black">
                <button onClick={() => setView('depo')} className={`flex-1 py-4 rounded-2xl text-xs transition-all ${view === 'depo' ? 'bg-red-600 shadow-lg shadow-red-600/20' : 'bg-zinc-900 text-zinc-500'}`}>DEPO</button>
                <button onClick={() => setView('retre')} className={`flex-1 py-4 rounded-2xl text-xs transition-all ${view === 'retre' ? 'bg-red-600 shadow-lg shadow-red-600/20' : 'bg-zinc-900 text-zinc-500'}`}>RETRÈ</button>
            </div>

            {loading ? <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div></div> : (
                <div className="space-y-4 max-w-md mx-auto">
                    {(view === 'depo' ? deposits : withdrawals).map((item) => (
                        <div key={item.id} className="bg-zinc-900 p-5 rounded-[2.5rem] border border-white/5 relative">
                            {item.status !== 'pending' && (
                                <button onClick={() => suprimeTranzaksyon(item.id, view === 'depo' ? 'deposits' : 'withdrawals')} className="absolute top-5 right-5 text-zinc-600 hover:text-red-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5 v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                                </button>
                            )}

                            <div className="flex justify-between mb-2 pr-8">
                                <p className="font-bold text-[9px] text-zinc-500 tracking-widest truncate max-w-[150px]">{item.profiles?.full_name}</p>
                                <span className={`text-[8px] px-3 py-1 rounded-full font-black ${item.status === 'approved' || item.status === 'completed' ? 'bg-green-500' : item.status === 'rejected' ? 'bg-red-600' : 'bg-yellow-500 text-black'}`}>
                                    {item.status}
                                </span>
                            </div>

                            <p className="text-3xl font-black mb-4">{item.amount} <span className="text-xs text-red-600">HTG</span></p>

                            {view === 'depo' ? (
                                <>
                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                        <a href={item.proof_img_1} target="_blank" className="bg-zinc-800 py-3 rounded-xl text-center text-[10px] font-black border border-white/5">GADE PRÈV</a>
                                        {item.status === 'pending' && <button onClick={() => modifyeDepo(item)} className="bg-zinc-700 py-3 rounded-xl text-[10px] font-black uppercase">Modifye</button>}
                                    </div>
                                    {item.status === 'pending' && (
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            <button onClick={() => apwouveDepo(item)} className="bg-white text-black py-4 rounded-xl text-[10px] font-black uppercase shadow-lg">Apwouve</button>
                                            <button onClick={() => anileDepo(item)} className="bg-red-600 text-white py-4 rounded-xl text-[10px] font-black uppercase">Anile</button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="bg-black/40 p-4 rounded-2xl border border-white/5 mb-4">
                                        <p className="text-[9px] text-red-600 font-black mb-1">{item.method}</p>
                                        <p className="text-xs font-black tracking-tighter">{item.phone || item.account_number}</p>
                                    </div>
                                    {item.status === 'pending' && <button onClick={() => finPeyeRetre(item)} className="w-full bg-white text-black py-4 rounded-xl text-[10px] font-black uppercase">Konfime Pèman</button>}
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <button onClick={() => router.push('/dashboard')} className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur-xl px-8 py-4 rounded-full text-[9px] font-black border border-white/10 tracking-widest shadow-2xl">
                Tounen nan Dashboard
            </button>
        </div>
    );
}