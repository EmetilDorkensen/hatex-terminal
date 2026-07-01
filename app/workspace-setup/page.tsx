"use client";

import React, { useState, Suspense } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, ShieldCheck, Loader2, CheckCircle2, Briefcase } from 'lucide-react';

function SetupForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const emailStr = searchParams.get('email') || '';
    
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const handleCreatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 6) return alert("Modpas la dwe genyen omwen 6 karaktè.");
        setLoading(true);

        try {
            // Anrejistre modpas la nan tab staff_users la (ki asire l sove sou baz done a/Vercel)
            const { error } = await supabase
                .from('staff_users')
                .update({ workspace_password: password, status: 'active' })
                .eq('email', emailStr.trim().toLowerCase());

            if (error) throw error;
            setSuccess(true);
        } catch (err: any) {
            alert("Erè: Nou pa jwenn imèl sa a nan lis anplwaye yo. " + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="text-center animate-in zoom-in-95 duration-500">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 size={40} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Modpas Kreye!</h2>
                <p className="text-sm text-slate-500 mb-8">Espas travay ou a pare nèt. Ou ka konekte kounye a.</p>
                <button 
                    onClick={() => router.push('/workspace-login')}
                    className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-md"
                >
                    Ale nan paj Koneksyon an
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={handleCreatePassword} className="animate-in slide-in-from-bottom-4 duration-500 space-y-5">
            <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Konfigirasyon Espas Travay</h2>
                <p className="text-xs font-bold text-slate-500 mt-2 uppercase tracking-wider">{emailStr}</p>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Kreye Modpas Espas Travay ou</label>
                <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••" 
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-gray-200 rounded-xl focus:border-indigo-500 outline-none text-slate-900"
                        required 
                    />
                </div>
                <p className="text-[10px] text-slate-400 ml-1">Modpas sa a pap afekte kont kliyan nòmal ou a.</p>
            </div>

            <button 
                type="submit" 
                disabled={loading || !emailStr}
                className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-md flex justify-center items-center gap-2 mt-4"
            >
                {loading ? <Loader2 size={18} className="animate-spin" /> : 'Anrejistre Modpas la'}
            </button>
        </form>
    );
}

export default function WorkspaceSetupPage() {
    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white p-8 sm:p-10 rounded-3xl shadow-xl border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5"><Briefcase size={100} /></div>
                <div className="relative z-10">
                    <Suspense fallback={<div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-600" /></div>}>
                        <SetupForm />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}