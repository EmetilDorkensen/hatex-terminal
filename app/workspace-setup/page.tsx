"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Briefcase, ArrowRight } from 'lucide-react';

// 🔒 PAJ SA A DEPREKE: konfigirasyon modpas espas travay la fèt kounye a
// dirèkteman sou Dashboard la, lè yon anplwaye klike premye fwa sou
// bouton "Aksè Espas Travay" — pa gen okenn lyen ki soti nan imel ankò.
export default function WorkspaceSetupDeprecated() {
    const router = useRouter();

    useEffect(() => {
        const t = setTimeout(() => router.push('/dashboard'), 4000);
        return () => clearTimeout(t);
    }, [router]);

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white p-8 sm:p-10 rounded-3xl shadow-xl text-center">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Briefcase size={28} />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Konfigirasyon Chanje</h2>
                <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                    Pou plis sekirite, ou pa kreye modpas espas travay ou nan paj sa a ankò.
                    Konekte sou Dashboard kont kliyan ou a, epi klike sou bouton
                    <span className="font-bold text-slate-700"> &ldquo;Aksè Espas Travay&rdquo;</span> pou kreye l.
                </p>
                <button
                    onClick={() => router.push('/dashboard')}
                    className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-md flex items-center justify-center gap-2"
                >
                    Ale nan Dashboard <ArrowRight size={16} />
                </button>
                <p className="text-[10px] text-slate-400 mt-6 flex items-center justify-center gap-1.5">
                    <Loader2 size={12} className="animate-spin" /> Redireksyon otomatik nan kèk segond...
                </p>
            </div>
        </div>
    );
}
