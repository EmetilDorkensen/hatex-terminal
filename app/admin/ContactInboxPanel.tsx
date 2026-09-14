"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Mail,
  MessageSquare,
  Send,
  X,
  Clock,
  CheckCircle2,
} from "lucide-react";

type InboxItem = {
  id: string;
  channel: "support" | "business" | "contact";
  from_name: string | null;
  from_email: string;
  subject: string;
  body: string;
  status: "open" | "answered" | "closed";
  source: string;
  created_at: string;
  attachment_paths?: string[];
  attachment_urls?: { path: string; url: string }[];
};

type Reply = {
  id: string;
  body: string;
  emailed: boolean;
  created_at: string;
};

const CHANNEL_LABEL: Record<string, string> = {
  support: "Sipò",
  business: "Biznis",
  contact: "Kontak",
};

/**
 * Bwat mesaj pataje — /admin ak /workspace.
 * Mesaj ki soti nan fòm /kontakte (support@ / business@ / contact@).
 */
export default function ContactInboxPanel({
  compact = false,
}: Readonly<{ compact?: boolean }>) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<InboxItem | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "answered" | "closed">("open");
  const [error, setError] = useState("");

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = filter === "all" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/contact/inbox${qs}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "Erè chajman.");
      setItems(data.items || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erè");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const openItem = async (item: InboxItem) => {
    setSelected(item);
    setReplyText("");
    try {
      const res = await fetch(`/api/contact/inbox?id=${encodeURIComponent(item.id)}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSelected(data.item);
        setReplies(data.replies || []);
      }
    } catch {
      /* ignore */
    }
  };

  const sendReply = async (closeAfter = false) => {
    if (!selected || !replyText.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/contact/inbox", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inbox_id: selected.id,
          message: replyText.trim(),
          close: closeAfter,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "Erè");
      alert(data.message);
      setReplyText("");
      await openItem(selected);
      await loadList();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erè");
    } finally {
      setBusy(false);
    }
  };

  const closeOnly = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch("/api/contact/inbox", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inbox_id: selected.id, close: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "Erè");
      setSelected(null);
      await loadList();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erè");
    } finally {
      setBusy(false);
    }
  };

  const openCount = items.filter((i) => i.status === "open").length;

  return (
    <div className={compact ? "" : "space-y-4"}>
      {!compact && (
        <div className="mb-2">
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Mail className="text-[#1d4ed8]" size={20} />
            Bwat mesaj (Kontak)
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Mesaj ki soti nan fòm /kontakte <strong>ak</strong> imèl
            (support@ / business@ / contact@). Ou reponn isit la — kliyan an
            resevwa pa imèl. Foto yo parèt anba mesaj la.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {(["open", "answered", "closed", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${
              filter === f
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-slate-500 border-gray-200 hover:bg-slate-50"
            }`}
          >
            {f === "open"
              ? `Nouvo${filter === "open" ? ` (${openCount})` : ""}`
              : f === "answered"
                ? "Reponn"
                : f === "closed"
                  ? "Fèmen"
                  : "Tout"}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 mb-4">
          {error}
          <span className="block text-xs mt-1 text-rose-500">
            Si tablo a poko egziste: aplike migrasyon{" "}
            <code className="font-mono">20260914_contact_inbox.sql</code>.
          </span>
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[420px]">
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Lis mesaj
            </span>
            <button
              type="button"
              onClick={() => void loadList()}
              className="text-[10px] font-bold text-indigo-600 uppercase"
            >
              Rafrechi
            </button>
          </div>
          <div className="max-h-[520px] overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <div className="p-10 flex justify-center">
                <Loader2 className="animate-spin text-indigo-500" />
              </div>
            ) : items.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400">Pa gen mesaj.</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void openItem(item)}
                  className={`w-full text-left px-4 py-3.5 hover:bg-indigo-50/50 transition-colors ${
                    selected?.id === item.id ? "bg-indigo-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                      {CHANNEL_LABEL[item.channel] || item.channel}
                    </span>
                    <span
                      className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${
                        item.status === "open"
                          ? "bg-rose-50 text-rose-600 border-rose-200"
                          : item.status === "answered"
                            ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {item.status === "open" ? "Nouvo" : item.status}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 truncate">{item.subject}</p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {item.from_name || "—"} · {item.from_email}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(item.created_at).toLocaleString("fr-HT")}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col min-h-[420px]">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
              <MessageSquare size={36} className="mb-3 opacity-40" />
              <p className="text-sm font-medium">Chwazi yon mesaj pou li ak reponn</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-gray-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-extrabold text-slate-900 leading-snug">
                      {selected.subject}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {selected.from_name} &lt;{selected.from_email}&gt;
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="p-2 text-slate-400 hover:text-slate-700 shrink-0"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[360px]">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {selected.body}
                </div>
                {Array.isArray(selected.attachment_urls) && selected.attachment_urls.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selected.attachment_urls.map((att) => {
                      const isPdf = att.path.toLowerCase().endsWith('.pdf');
                      return isPdf ? (
                        <a
                          key={att.path}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-bold text-indigo-600 hover:bg-indigo-50"
                        >
                          Louvri PDF
                        </a>
                      ) : (
                        <a
                          key={att.path}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={att.url}
                            alt="Aneks"
                            className="w-28 h-28 object-cover rounded-xl border border-slate-200 hover:opacity-90"
                          />
                        </a>
                      );
                    })}
                  </div>
                )}
                {replies.map((r) => (
                  <div
                    key={r.id}
                    className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 ml-4"
                  >
                    <div className="flex items-center gap-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                      <CheckCircle2 size={12} />
                      Repons ekip {r.emailed ? "· imèl voye" : "· imèl echwe"}
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{r.body}</p>
                    <p className="text-[10px] text-slate-400 mt-2">
                      {new Date(r.created_at).toLocaleString("fr-HT")}
                    </p>
                  </div>
                ))}
              </div>
              {selected.status !== "closed" && (
                <div className="p-4 border-t border-gray-100 space-y-3">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={3}
                    placeholder="Ekri repons ou… (ap voye pa imèl bay moun nan)"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                    disabled={busy}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void sendReply(false)}
                      disabled={busy || !replyText.trim()}
                      className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl disabled:opacity-50"
                    >
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      Voye repons
                    </button>
                    <button
                      type="button"
                      onClick={() => void sendReply(true)}
                      disabled={busy || !replyText.trim()}
                      className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl disabled:opacity-50"
                    >
                      Voye &amp; fèmen
                    </button>
                    <button
                      type="button"
                      onClick={() => void closeOnly()}
                      disabled={busy}
                      className="inline-flex items-center gap-2 bg-white border border-gray-200 text-slate-600 text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl hover:bg-slate-50 disabled:opacity-50"
                    >
                      Fèmen san repons
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
