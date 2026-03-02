"use client";

import { Suspense } from 'react';
import WooCommerceOAuthContent from './WooCommerceOAuthContent';

export default function WooCommerceOAuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#0a0b14] to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-400">Chajman...</p>
        </div>
      </div>
    }>
      <WooCommerceOAuthContent />
    </Suspense>
  );
}