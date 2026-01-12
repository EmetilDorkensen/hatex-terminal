"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const router = useRouter();

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    // Nou mete nouvo modpas la nan baz done a
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      setMessage({ type: 'error', text: "Erè: " + error.message });
    } else {
      setMessage({ type: 'success', text: "Modpas ou chanje ak siksè! W'ap redireksyone..." });
      // Tann 2 segonn epi voye l nan login
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] flex flex-col items-center justify-center p-6 text-white italic font-sans">
      <div className="w-full max-w-md bg-zinc-900/50 p-10 rounded-[3rem] border border-white/5 backdrop-blur-xl shadow-2xl">
        <h1 className="text-2xl font-black uppercase mb-2 text-center text-red-600 tracking-tighter italic">HATEXCARD</h1>
        <p className="text-[10px] text-zinc-500 text-center uppercase font-black mb-8 tracking-widest italic opacity-60">
          Kreye yon nouvo modpas
        </p>

        {message.text && (
          <div className={`p-4 rounded-2xl mb-6 text-[10px] font-black uppercase text-center border ${
            message.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-green-500/10 border-green-500/20 text-green-500'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <input 
            type="password" 
            placeholder="TAPE NOUVO MODPAS LA" 
            required
            minLength={6}
            className="w-full bg-zinc-800/40 p-5 rounded-2xl outline-none border border-white/5 focus:border-red-600 font-bold transition-all text-center"
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-white text-black py-5 rounded-2xl font-black uppercase shadow-lg active:scale-95 transition-all text-sm italic"
          >
            {loading ? "Ap anrejistre..." : "Anrejistre Modpas"}
          </button>
        </form>
      </div>
    </div>
  );
}