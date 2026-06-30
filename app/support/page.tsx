"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, MessageSquare, Plus, Loader2, CheckCircle2, Headset, Clock } from 'lucide-react';

export default function SupportClientPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [profile, setProfile] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  
  const [view, setView] = useState<'list' | 'new' | 'chat'>('list');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Fòm
  const [subject, setSubject] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [replyMessage, setReplyMessage] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchProfileAndTickets();
  }, [supabase]);

  useEffect(() => {
    if (view === 'chat') scrollToBottom();
  }, [messages, view]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchProfileAndTickets = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (prof) setProfile(prof);

    // Rale tout konvèsasyon kliyan an
    const { data: t } = await supabase.from('support_tickets').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (t) setTickets(t);
    setLoading(false);
  };

  const loadTicketChat = async (ticket: any) => {
    setSelectedTicket(ticket);
    setView('chat');
    setLoading(true);
    
    // Si anplwaye te reponn, kounye a kliyan an ap gade l, nou ka chanje l tounen 'open' oswa kite l 'answered'
    const { data: m } = await supabase.from('support_messages').select('*').eq('ticket_id', ticket.id).order('created_at', { ascending: true });
    if (m) setMessages(m);
    setLoading(false);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !initialMessage.trim()) return alert("Tanpri ranpli tout chan yo.");
    setSending(true);

    try {
      // 1. Kreye Ticket la (Tit la)
      const { data: newTicket, error: tErr } = await supabase.from('support_tickets').insert({
        user_id: profile.id,
        subject: subject.trim(),
        status: 'open'
      }).select().single();

      if (tErr) throw tErr;

      // 2. Ajoute premye mesaj la
      const { error: mErr } = await supabase.from('support_messages').insert({
        ticket_id: newTicket.id,
        sender_id: profile.id,
        message: initialMessage.trim(),
        is_staff_reply: false
      });

      if (mErr) throw mErr;

      setSubject(''); setInitialMessage('');
      await fetchProfileAndTickets();
      setView('list');
    } catch (err: any) {
      alert("Erè: " + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim() || !selectedTicket) return;
    setSending(true);

    try {
      // Mete mesaj la nan baz done a
      const { error } = await supabase.from('support_messages').insert({
        ticket_id: selectedTicket.id,
        sender_id: profile.id,
        message: replyMessage.trim(),
        is_staff_reply: false
      });

      if (error) throw error;

      // Fè anplwaye yo konnen kliyan an reponn nan mete estati a sou 'open' ankò
      await supabase.from('support_tickets').update({ status: 'open' }).eq('id', selectedTicket.id);

      // Mete l nan tchat la dirèk sou ekran an
      setMessages([...messages, { 
        id: Date.now().toString(), 
        ticket_id: selectedTicket.id, 
        sender_id: profile.id, 
        message: replyMessage.trim(), 
        is_staff_reply: false, 
        created_at: new Date().toISOString() 
      }]);

      setReplyMessage('');
    } catch (err: any) {
      alert("Erè nan voye mesaj la.");
    } finally {
      setSending(false);
    }
  };

  if (loading && view === 'list') {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600 w-10 h-10" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24 md:pb-6">
      
      {/* HEADER PAJ LA */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <button 
            onClick={() => {
              if (view === 'chat' || view === 'new') setView('list');
              else router.push('/dashboard');
            }} 
            className="w-10 h-10 bg-slate-50 border border-gray-200 rounded-full flex items-center justify-center text-slate-600 hover:text-indigo-600 transition-colors shadow-sm shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {view === 'list' ? 'Sèvis Kliyan' : view === 'new' ? 'Nouvo Pwoblèm' : 'Konvèsasyon'}
            </h1>
            <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest mt-0.5">Asistans 24/7</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 sm:p-6 mt-2">
        
        {/* VIEW 1: LIS TOUT KONVÈSASYON YO */}
        {view === 'list' && (
          <div className="animate-in fade-in duration-300">
            <button 
              onClick={() => setView('new')} 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-2xl font-bold uppercase text-xs tracking-wider transition-all shadow-sm flex items-center justify-center gap-2 mb-6"
            >
              <Plus size={18} /> Ouvri yon Nouvo Pwoblèm
            </button>

            {tickets.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200 shadow-sm">
                <Headset size={48} className="mx-auto text-slate-300 mb-4" />
                <h3 className="text-slate-500 font-bold mb-2">Ou pa gen okenn mesaj</h3>
                <p className="text-xs text-slate-400">Si w gen yon pwoblèm oswa yon kesyon, ekri nou.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map(ticket => (
                  <div 
                    key={ticket.id} 
                    onClick={() => loadTicketChat(ticket)}
                    className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md cursor-pointer transition-all flex items-start gap-4 group"
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border ${
                      ticket.status === 'answered' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                      ticket.status === 'closed' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                      'bg-emerald-50 text-emerald-600 border-emerald-100'
                    }`}>
                      <MessageSquare size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-slate-900 truncate pr-2 group-hover:text-indigo-600 transition-colors">{ticket.subject}</h3>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md shrink-0 border ${
                          ticket.status === 'answered' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
                          ticket.status === 'closed' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                          'bg-emerald-100 text-emerald-700 border-emerald-200'
                        }`}>
                          {ticket.status === 'answered' ? 'Reponn' : ticket.status === 'closed' ? 'Fèmen' : 'Ouvè'}
                        </span>
                      </div>
                      <p className="text-[10px] font-semibold text-slate-400 flex items-center gap-1.5 mt-2">
                        <Clock size={12} /> {new Date(ticket.created_at).toLocaleDateString('fr-HT', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: KREYE YON NOUVO PWOBLÈM */}
        {view === 'new' && (
          <form onSubmit={handleCreateTicket} className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm animate-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2"><MessageSquare className="text-indigo-600" /> Kijan nou ka ede w?</h2>
            
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Sijè Pwoblèm nan</label>
                <input 
                  type="text" 
                  value={subject} 
                  onChange={(e) => setSubject(e.target.value)} 
                  placeholder="Egz: Mwen fè yon depo ki poko monte..."
                  className="w-full bg-slate-50 border border-gray-200 py-3.5 px-4 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 transition-all text-slate-900" 
                  required 
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Eksplike Pwoblèm nan</label>
                <textarea 
                  value={initialMessage} 
                  onChange={(e) => setInitialMessage(e.target.value)} 
                  placeholder="Ekri tout detay yo isit la byen klè..."
                  className="w-full bg-slate-50 border border-gray-200 p-4 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 transition-all text-slate-900 min-h-[150px] resize-y" 
                  required 
                />
              </div>

              <button 
                type="submit" 
                disabled={sending} 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold uppercase text-xs tracking-wider transition-all shadow-sm flex justify-center items-center gap-2 disabled:opacity-70"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <><Send size={16} /> Voye Mesaj la</>}
              </button>
            </div>
          </form>
        )}

        {/* VIEW 3: TCHAT KONVÈSASYON AN (ENTÈFAS MESAJ LA) */}
        {view === 'chat' && selectedTicket && (
          <div className="flex flex-col bg-slate-100 rounded-3xl border border-gray-200 overflow-hidden shadow-sm h-[70vh] animate-in zoom-in-95 duration-200">
            
            {/* Header Tchat la */}
            <div className="bg-white p-4 border-b border-gray-200 flex justify-between items-center z-10 shadow-sm">
              <h3 className="font-bold text-slate-900 truncate pr-4">{selectedTicket.subject}</h3>
              {selectedTicket.status === 'closed' && <span className="bg-rose-50 text-rose-600 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border border-rose-100 shrink-0">Fèmen</span>}
            </div>

            {/* Bwat Mesaj yo */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-400" /></div>
              ) : (
                messages.map((msg, index) => {
                  // Si se anplwaye k ap pale (Support)
                  if (msg.is_staff_reply) {
                    return (
                      <div key={index} className="flex justify-start">
                        <div className="max-w-[85%] bg-white border border-gray-200 text-slate-800 p-4 rounded-2xl rounded-tl-sm shadow-sm">
                          <p className="text-xs font-bold text-indigo-600 mb-1">Sèvis Kliyan (Hatexcard)</p>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                          <p className="text-[9px] text-slate-400 text-right mt-2 font-medium">{new Date(msg.created_at).toLocaleTimeString('fr-HT', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    );
                  } 
                  // Si se Kliyan an k ap pale (Ou menm)
                  else {
                    return (
                      <div key={index} className="flex justify-end">
                        <div className="max-w-[85%] bg-indigo-600 text-white p-4 rounded-2xl rounded-tr-sm shadow-sm">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                          <p className="text-[9px] text-indigo-200 text-right mt-2 font-medium">{new Date(msg.created_at).toLocaleTimeString('fr-HT', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    );
                  }
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Bwat pou Tape Mesaj la */}
            {selectedTicket.status !== 'closed' ? (
              <div className="bg-white p-3 sm:p-4 border-t border-gray-200">
                <form onSubmit={handleReply} className="flex gap-2 relative">
                  <input 
                    type="text" 
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Ekri yon repons..."
                    className="flex-1 bg-slate-50 border border-gray-200 rounded-full py-3.5 pl-5 pr-14 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all text-slate-900"
                    required
                  />
                  <button 
                    type="submit" 
                    disabled={sending || !replyMessage.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="ml-1" />}
                  </button>
                </form>
              </div>
            ) : (
              <div className="bg-slate-100 p-4 border-t border-gray-200 text-center">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Ticket sa a fèmen, ou pa ka ekri ladan l ankò.</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}