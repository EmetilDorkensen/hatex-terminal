"use client";

import React from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import MfaSettings from '@/app/components/MfaSettings';

interface Props {
  supabase: SupabaseClient;
}

export default function AdminMfaSettings({ supabase }: Props) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <MfaSettings
        supabase={supabase}
        title="Sekirite Kont Admin (MFA)"
        subtitle="Otantifikasyon 2 Etap (TOTP)"
        emptyMessage="Kont admin sa a PA gen MFA aktive. Nou rekòmande FÒTMAN ou aktive l pou pwoteje aksè admin la."
      />
    </div>
  );
}
