"use client";

import React, { useEffect, useState } from 'react';
import { ScrollText, Loader2, RefreshCw } from 'lucide-react';

interface AuditEntry {
  id: string;
  admin_email: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export default function AdminAuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLog = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/audit-log');
      const data = await res.json();
      setEntries(data.entries || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLog();
  }, []);

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ScrollText className="text-indigo-600" size={20} />
          <h3 className="text-lg font-bold text-slate-900">Jounal Odit Admin (100 dènye)</h3>
        </div>
        <button onClick={loadLog} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-all">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-600" size={24} /></div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">Pa gen okenn aksyon ki jounalize toujou.</p>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-start justify-between gap-4 bg-slate-50 border border-gray-100 rounded-xl p-4">
              <div>
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">{entry.action}</p>
                <p className="text-[10px] text-slate-500 mt-1">
                  {entry.admin_email}
                  {entry.target_type && ` · ${entry.target_type}`}
                  {entry.target_id && ` #${entry.target_id.slice(0, 8)}`}
                </p>
                {entry.details && (
                  <p className="text-[10px] text-slate-400 mt-1 font-mono truncate max-w-md">
                    {JSON.stringify(entry.details)}
                  </p>
                )}
              </div>
              <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">
                {new Date(entry.created_at).toLocaleString('fr-HT')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
