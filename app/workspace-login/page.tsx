"use client";

import React, { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Loader2, Briefcase, ShieldCheck, AlertCircle } from 'lucide-react';

export default function WorkspaceLogin() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');

        try {
            // Tcheke nan tab izole a si anplwaye a egziste epi modpas la bon
            const { data: staff, error } = await supabase
                .from('staff_users')
                .select('*')
                .eq('email', email.trim().toLowerCase())
                .eq('workspace_password', password)
                .maybeSingle();

            if (error || !staff) {
                setErrorMsg("Enfòmasyon yo pa bon oswa ou pa yon anplwaye.");
                setLoading(false);
                return;
            }

            if (staff.status === 'pending') {
                setErrorMsg("Ou dwe konfigire modpas ou nan lyen envitasyon an anvan.");
                setLoading(false);
                return;
            }

            // Anrejistre sesyon an nan navigatè a an kachèt epi voye l nan workspace la
            localStorage.setItem('staff_session', JSON.stringify(staff));
            router.push('/workspace');

        } catch (err) {
            setErrorMsg("Gen yon erè rezo. Tanpri eseye ankò.");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
            <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-3xl shadow-2xl relative overflow-hidden">
                <div className="absolute -top-10 -right-10 text-slate-100"><Briefcase size={150} /></div>
                
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg">
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900">Pòtay Anplwaye</h1>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Hatexcard Workspace</p>
                        </div>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ml-1">Imèl Pwofesyonèl</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                <input 
                                    type="email" 
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="anplwaye@imel.com" 
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-gray-200 rounded-xl focus:border-indigo-500 outline-none text-slate-900 text-sm font-medium"
                                    required 
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ml-1">Modpas Espas Travay</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                <input 
                                    type="password" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••" 
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-gray-200 rounded-xl focus:border-indigo-500 outline-none text-slate-900 text-sm tracking-widest"
                                    required 
                                />
                            </div>
                        </div>

                        {errorMsg && (
                            <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3">
                                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                <p className="text-rose-700 text-xs font-bold">{errorMsg}</p>
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-xl font-bold uppercase tracking-wider transition-all shadow-md flex justify-center items-center gap-2 mt-4 text-xs"
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Konekte Nan Espas Mwen'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}