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

    const raleDone = async () => {
        setLoading(true);
        const { data: d } = await supabase.from('deposits').select('*').order('created_at', { ascending: false });
        const { data: w } = await supabase.from('withdrawals').select('*').order('created_at', { ascending: false });
        setDeposits(d || []);
        setWithdrawals(w || []);
        setLoading(false);
    };

    useEffect(() => { raleDone(); }, []);

    const voyeEmailKliyan = async (email: string, non: string, mesaj: string) => {
        try {
            await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: email, subject: 'Mizajou Hatex Card', non, mesaj }),
            });
        } catch (error) { console.error("Erè imèl:", error); }
    };

    const voyeNotifikasyonTelegram = async (mesaj: string) => {
        try {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: CHAT_ID, text: mesaj, parse_mode: 'Markdown' })
            });
        } catch (e) { console.error(e); }
    };

    // --- 1. APWOUVE DEPO ---
    const apwouveDepo = async (d: any) => {
        if (!confirm(`Apwouve ${d.amount} HTG?`)) return;
        const { data: p } = await supabase.from('profiles').select('email, full_name, wallet_balance').eq('id', d.user_id).single();

        if (p) {
            const nouvoBalans = Number(p.wallet_balance || 0) + Number(d.amount);
            await supabase.from('profiles').update({ wallet_balance: nouvoBalans }).eq('id', d.user_id);
            await supabase.from('deposits').update({ status: 'approved' }).eq('id', d.id);
            await supabase.from('transactions').insert({
                user_id: d.user_id, amount: Number(d.amount), type: 'DEPOSIT',
                description: 'Depo konfime ak siksè', status: 'success', method: 'SISTÈM'
            });

            await voyeEmailKliyan(p.email, p.full_name, `Depo ${d.amount} HTG ou a apwouve. Balans ou se: ${nouvoBalans} HTG.`);
            await voyeNotifikasyonTelegram(`✅ *DEPO APWOUVE*\n👤 ${p.full_name}\n💰 +${d.amount} HTG`);
            alert("Depo apwouve!");
            raleDone();
        }
    };

    // --- 2. ANILE DEPO ---
    const anileDepo = async (d: any) => {
        const rezon = prompt("Poukisa w ap anile depo sa a?");
        if (!rezon) return;
        const { data: p } = await supabase.from('profiles').select('email, full_name').eq('id', d.user_id).single();

        if (p) {
            await supabase.from('deposits').update({ status: 'rejected', admin_notes: rezon }).eq('id', d.id);
            await supabase.from('transactions').insert({
                user_id: d.user_id, amount: Number(d.amount), type: 'DEPOSIT',
                description: `Depo anile: ${rezon}`, status: 'rejected', method: 'SISTÈM'
            });

            await voyeEmailKliyan(p.email, p.full_name, `Depo ${d.amount} HTG ou a anile. Rezon: ${rezon}`);
            await voyeNotifikasyonTelegram(`❌ *DEPO ANILE*\n👤 ${p.full_name}\n📝 Rezon: ${rezon}`);
            alert("Depo anile!");
            raleDone();
        }
    };

    // --- 3. KONFIME PÈMAN RETRÈ ---
    const finPeyeRetre = async (w: any) => {
        if (!confirm(`Èske ou fin peye ${w.amount} HTG?`)) return;
        const { data: p } = await supabase.from('profiles').select('email, full_name').eq('id', w.user_id).single();

        if (p) {
            await supabase.from('withdrawals').update({ status: 'completed' }).eq('id', w.id);
            await supabase.from('transactions').insert({
                user_id: w.user_id, amount: -Number(w.amount), type: 'WITHDRAWAL',
                description: `Retrè peye via ${w.method}`, status: 'success', method: w.method
            });

            await voyeEmailKliyan(p.email, p.full_name, `Retrè ${w.amount} HTG ou a fin pati sou kont ${w.method} ou.`);
            await voyeNotifikasyonTelegram(`💸 *RETRÈ PEYE*\n👤 ${p.full_name}\n💵 ${w.amount} HTG`);
            alert("Retrè konfime!");
            raleDone();
        }
    };

    const suprime = async (id: string, table: any) => {
        if (confirm("Efase nèt?")) {
            await supabase.from(table).delete().eq('id', id);
            raleDone();
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0b14] text-white p-4 font-sans uppercase italic pb-24">
            <div className="max-w-md mx-auto flex justify-between items-center mb-6">
                <h1 className="text-xl font-black text-red-600">Admin Hatex</h1>
                <button onClick={raleDone} className="bg-zinc-800 px-3 py-1 rounded-lg text-[10px]">Refresh</button>
            </div>

            <div className="flex gap-2 mb-6 max-w-md mx-auto">
                <button onClick={() => setView('depo')} className={`flex-1 py-4 rounded-2xl text-xs font-black ${view === 'depo' ? 'bg-red-600' : 'bg-zinc-900'}`}>DEPO</button>
                <button onClick={() => setView('retre')} className={`flex-1 py-4 rounded-2xl text-xs font-black ${view === 'retre' ? 'bg-red-600' : 'bg-zinc-900'}`}>RETRÈ</button>
            </div>

            {loading ? <div className="text-center py-20 animate-pulse">Chaje...</div> : (
                <div className="space-y-4 max-w-md mx-auto">
                    {(view === 'depo' ? deposits : withdrawals).map((item) => (
                        <div key={item.id} className="bg-zinc-900 p-5 rounded-[2.5rem] border border-white/5 relative">
                            <div className="flex justify-between mb-2 pr-8">
                                <span className="text-[9px] text-zinc-500">ID: {item.user_id?.slice(0,8)}</span>
                                <span className={`text-[8px] px-2 py-1 rounded-full font-black ${item.status === 'approved' || item.status === 'completed' ? 'bg-green-500' : item.status === 'rejected' ? 'bg-red-600' : 'bg-yellow-500 text-black'}`}>{item.status}</span>
                            </div>
                            <p className="text-3xl font-black mb-4">{item.amount} <span className="text-xs text-red-600">HTG</span></p>

                            {view === 'depo' ? (
                                <div className="grid grid-cols-2 gap-2">
                                    <a href={item.proof_img_1} target="_blank" className="bg-zinc-800 py-3 rounded-xl text-center text-[10px] font-black border border-white/5 uppercase">Foto Prèv</a>
                                    {item.status === 'pending' && (
                                        <>
                                            <button onClick={() => apwouveDepo(item)} className="bg-white text-black py-3 rounded-xl text-[10px] font-black">Apwouve</button>
                                            <button onClick={() => anileDepo(item)} className="bg-red-600 text-white py-3 rounded-xl text-[10px] font-black col-span-2">Anile Depo</button>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                                        <p className="text-[10px] text-red-600 font-black">{item.method}</p>
                                        <p className="text-sm font-black">{item.phone || item.account_number}</p>
                                    </div>
                                    {item.status === 'pending' && <button onClick={() => finPeyeRetre(item)} className="w-full bg-white text-black py-4 rounded-xl text-[10px] font-black uppercase shadow-lg">Konfime Pèman</button>}
                                </div>
                            )}
                            <button onClick={() => suprime(item.id, view === 'depo' ? 'deposits' : 'withdrawals')} className="absolute top-5 right-5 text-zinc-700 hover:text-red-600">X</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}