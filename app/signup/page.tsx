"use client";
import React from 'react';
import Link from 'next/link';

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[#0a0b14] text-white flex flex-col justify-center items-center p-6 uppercase italic">
      <div className="w-full max-w-md bg-zinc-900/50 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
        <h1 className="text-3xl font-black text-red-600 mb-2 tracking-tighter">KREYE KONT</h1>
        <p className="text-zinc-500 text-[10px] mb-8 font-bold italic">Antre enfòmasyon ou pou w kòmanse ak HatexCard.</p>
        
        <form className="space-y-4">
          <input type="text" placeholder="NON KONPLÈ" className="w-full bg-black border border-white/10 p-4 rounded-xl text-xs font-bold outline-none focus:border-red-600" />
          <input type="email" placeholder="IMÈL" className="w-full bg-black border border-white/10 p-4 rounded-xl text-xs font-bold outline-none focus:border-red-600" />
          <input type="password" placeholder="MODPAS" className="w-full bg-black border border-white/10 p-4 rounded-xl text-xs font-bold outline-none focus:border-red-600" />
          
          <button className="w-full bg-red-600 py-4 rounded-xl font-black text-xs shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all mt-4">
            ENSRI KOUNYE A
          </button>
        </form>

        <p className="text-center mt-6 text-[9px] font-bold text-zinc-500">
          OU GEN KONT DEJA? <Link href="/login" className="text-red-600 ml-1">KONEKTE</Link>
        </p>
      </div>
    </div>
  );
}