"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, QrCode, Code2, Repeat, Navigation, ArrowRightLeft, BarChart3, ChevronDown, CheckCircle2, ShieldCheck, Download, Smartphone, Globe, Lock, Mail, AlertTriangle, User } from 'lucide-react';

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeNav, setActiveNav] = useState("");

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
    };
    const handleScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("mousemove", handleMouse);
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("mousemove", handleMouse);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const cardTiltX = (mousePos.y - 0.5) * 12;
  const cardTiltY = (mousePos.x - 0.5) * -12;

  const navLinks = [
    {
      label: "Pwodwi", href: "#pwodwi",
      sub: [
        { label: "Kat Vityèl", desc: "Peye entènasyonal an Goud" },
        { label: "Smart Invoice", desc: "Voye fakti pwofesyonèl" },
        { label: "Peman QR Kòd", desc: "Resevwa peman an segonn" },
        { label: "Abònman Otomatik", desc: "Kolekte peman regilye" },
        { label: "Sèvis Taksi & Livrezon", desc: "Peman sou wout" },
      ]
    },
    {
      label: "Devlopè", href: "#api",
      sub: [
        { label: "API Referans", desc: "Dokimantasyon konplè" },
        { label: "Plugin WooCommerce", desc: "Entegrasyon 5 minit" },
        { label: "Plugin Hostinger", desc: "Horizon v2.0" },
        { label: "Sandbox & Tès", desc: "Teste anvan lanse" },
      ]
    },
    {
      label: "Sekirite", href: "#sekirite",
      sub: [
        { label: "KYC & Verifikasyon", desc: "Platfòm san fwòd" },
        { label: "Ankripsyon 256-bit", desc: "Done ou an sekirite" },
        { label: "Kontwòl Tranzaksyon", desc: "Istwa konplè an tan reyèl" },
      ]
    },
    { label: "Pri", href: "#pri", sub: [] },
    { label: "Sou Nou", href: "#sou-nou", sub: [] },
  ];

  const faqs = [
    {
      q: "Kòman m entegre API Hatexcard nan sit entènèt oswa app mwen?",
      a: "Nou gen yon API RESTful konplè ak dokimantasyon detaye. Pou WooCommerce ak Hostinger, nou gen yon plugin ki pran mwens pase 5 minit pou enstale. Kliyan w yo ap ka peye an Goud dirèkteman sou sit ou san yo pa kite paj la."
    },
    {
      q: "Kòman fonksyon Smart Invoice la mache pou moun ki pa gen sit entènèt?",
      a: "Nan terminal Hatexcard ou, ou kreye yon fakti an kèk segonn. Sistèm nan jenere yon lyen peman sekirize epi voye l dirèkteman nan imèl kliyan ou. Kliyan an klike, li peye, ou resevwa notifikasyon imedyatman ak yon prèv tranzaksyon."
    },
    {
      q: "Kòman m ka depoze oswa retire lajan nan kont Hatexcard mwen?",
      a: "Ou ka rechaje kont ou via MonCash, NatCash, oswa transfè labank dirèk (Unibank, BNC, ak lòt bank lokal). Tranzaksyon yo trete an kèk minit. Pou retrè, frè a se 25 HTG sèlman pou nenpòt montan 500 HTG ak plis."
    },
    {
      q: "Èske tranzaksyon ant de itilizatè Hatexcard gen frè?",
      a: "Non. Tout transfè P2P — swa ant de patikilye, swa ant kliyan ak machann — totalman gratis. Nou pa pran okenn komisyon sou tranzaksyon entèn yo."
    },
  ];

  const stats = [
    { val: "0 HTG", label: "Frè pou tranzaksyon P2P" },
    { val: "< 10s", label: "Vitès mwayèn peman" },
    { val: "256-bit", label: "Nivo ankripsyon done" },
    { val: "24/7", label: "Siveyans tranzaksyon" },
  ];

  const features = [
    {
      icon: <FileText size={22} className="text-indigo-600" />,
      ti: "Smart Invoice",
      ds: "Jenere yon fakti pwofesyonèl ak yon lyen peman sekirize. Voye l bay kliyan pa imèl. Li peye, ou resevwa notifikasyon imedyatman ak prèv.",
      tg: "MACHANN"
    },
    {
      icon: <QrCode size={22} className="text-indigo-600" />,
      ti: "Peman QR Kòd",
      ds: "Kliyan skan QR kòd biznis ou ak telefòn yo epi peye montan egzak la nan yon segonn. Yon sèl aksyon — pa gen echanj, pa gen erè.",
      tg: "RAPID"
    },
    {
      icon: <Code2 size={22} className="text-indigo-600" />,
      ti: "API & Plugin",
      ds: "Intègre Hatexcard nan nenpòt sit wèb oswa app an mwens pase 5 minit. Plugin WooCommerce ak Hostinger v2.0 disponib. Kliyan peye an Goud dirèkteman.",
      tg: "DEVLOPÈ"
    },
    {
      icon: <Repeat size={22} className="text-indigo-600" />,
      ti: "Abònman Otomatik",
      ds: "Konfigire peman regilye pou kliyan fidèl ou yo. Sistèm nan kolekte chak mwa otomatikman — ou pa bezwen raple oswa swiv pèsonn.",
      tg: "SÈVIS"
    },
    {
      icon: <Navigation size={22} className="text-indigo-600" />,
      ti: "Sèvis Taksi & Livrezon",
      ds: "Chauffeur ak livrè resevwa peman dirèkteman sou telefòn yo. Pa gen pwoblèm chanj egzak — kliyan mete montan la, ou resevwa nan segonn.",
      tg: "MOBILITE"
    },
    {
      icon: <ArrowRightLeft size={22} className="text-indigo-600" />,
      ti: "Transfè Sekirize",
      ds: "Voye lajan bay nenpòt itilizatè Hatexcard gratis ak imedyatman. Istwa konplè chak tranzaksyon disponib nan kont ou an tout tan.",
      tg: "GRATIS"
    },
    {
      icon: <BarChart3 size={22} className="text-indigo-600" />,
      ti: "Kontwòl Lajan Konplè",
      ds: "Tableau de bò an tan reyèl pou wè tout antre ak soti. Rapò detaye, filtre pa dat ak tip tranzaksyon — ou konnen egzakteman kote lajan w ale.",
      tg: "BIZNIS"
    },
  ];

  return (
    <div
      className="min-h-screen text-slate-900 overflow-x-hidden font-sans bg-slate-50"
      style={{ WebkitFontSmoothing: "antialiased" }}
    >
      {/* ═══ BACKGROUND (Light Version) ═══ */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-slate-50">
        <div className="absolute inset-0 bg-white" />
        <div className="absolute" style={{ top: "0%", left: "50%", transform: "translateX(-50%)", width: "1000px", height: "500px", background: "radial-gradient(ellipse, rgba(79, 70, 229, 0.08) 0%, transparent 75%)", filter: "blur(80px)" }} />
        <div className="absolute" style={{ top: "25%", right: "-8%", width: "450px", height: "450px", background: "radial-gradient(ellipse, rgba(59, 130, 246, 0.05) 0%, transparent 70%)", filter: "blur(90px)" }} />
        <div className="absolute" style={{ top: "35%", left: "-8%", width: "380px", height: "380px", background: "radial-gradient(ellipse, rgba(99, 102, 241, 0.05) 0%, transparent 70%)", filter: "blur(80px)" }} />
        
        {/* Subtle grid */}
        <div className="absolute inset-0" style={{
          backgroundImage: "linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 0%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 0%, transparent 100%)"
        }} />
      </div>

      <style>{`
        @keyframes htx-float {
          0%,100%{transform:perspective(1200px) rotateX(var(--tx,0deg)) rotateY(var(--ty,0deg)) translateY(0px)}
          50%{transform:perspective(1200px) rotateX(var(--tx,0deg)) rotateY(var(--ty,0deg)) translateY(-12px)}
        }
        @keyframes htx-glow { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
        @keyframes htx-up { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes htx-fade { from{opacity:0} to{opacity:1} }
        @keyframes htx-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.95)} }
        @keyframes htx-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        
        .htx-card-float { animation: htx-float 6s ease-in-out infinite; }
        .a1{animation:htx-up 0.8s cubic-bezier(0.16,1,0.3,1) both}
        .a2{animation:htx-up 0.8s 0.1s cubic-bezier(0.16,1,0.3,1) both}
        .a3{animation:htx-up 0.8s 0.2s cubic-bezier(0.16,1,0.3,1) both}
        .a4{animation:htx-up 0.8s 0.3s cubic-bezier(0.16,1,0.3,1) both}
        .a5{animation:htx-fade 1s 0.5s both}
        .phone-anim{animation:htx-up 1s 0.15s cubic-bezier(0.16,1,0.3,1) both}
        
        .htx-nav-link { position:relative; color:#475569; font-size:13px; font-weight:600; transition:color 0.2s; cursor:pointer; padding:8px 0; }
        .htx-nav-link:hover { color:#111827; }
        .htx-nav-link:hover .htx-dropdown { opacity:1; pointer-events:auto; transform:translateY(0); }
        
        .htx-dropdown { position:absolute; top:calc(100% + 12px); left:50%; transform:translateX(-50%) translateY(8px); background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:8px; min-width:220px; opacity:0; pointer-events:none; transition:all 0.2s cubic-bezier(0.16,1,0.3,1); z-index:100; box-shadow:0 20px 40px rgba(0,0,0,0.08); }
        .htx-dropdown-item { display:block; padding:10px 12px; border-radius:10px; transition:background 0.15s; cursor:pointer; }
        .htx-dropdown-item:hover { background:#f8fafc; }
        
        .htx-feat-card { background:#ffffff; border:1px solid #e2e8f0; border-radius:20px; padding:28px 24px; transition:all 0.3s cubic-bezier(0.16,1,0.3,1); box-shadow:0 4px 6px rgba(0,0,0,0.02); }
        .htx-feat-card:hover { border-color:#a5b4fc; transform:translateY(-3px); box-shadow:0 12px 24px rgba(79,70,229,0.08); }
        
        .htx-stat { border-right:1px solid #e2e8f0; }
        .htx-stat:last-child { border-right:none; }
        
        .htx-faq { background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:22px 26px; cursor:pointer; transition:all 0.25s ease; box-shadow:0 2px 4px rgba(0,0,0,0.02); }
        .htx-faq:hover { border-color:#a5b4fc; }
        .htx-faq.open { background:#f8fafc; border-color:#818cf8; }
        
        .htx-partner { font-size:13px; font-weight:700; color:#94a3b8; letter-spacing:0.08em; transition:color 0.2s; }
        .htx-partner:hover { color:#475569; }
        
        .htx-btn-primary { display:inline-flex; align-items:center; gap:8px; padding:13px 26px; border-radius:10px; font-size:14px; font-weight:700; background:#4f46e5; color:#fff; border:none; cursor:pointer; transition:all 0.2s; box-shadow:0 4px 12px rgba(79,70,229,0.25); text-decoration: none;}
        .htx-btn-primary:hover { transform:translateY(-1px); background:#4338ca; box-shadow:0 6px 16px rgba(79,70,229,0.35); }
        
        .htx-btn-secondary { display:inline-flex; align-items:center; gap:8px; padding:13px 26px; border-radius:10px; font-size:14px; font-weight:700; background:#ffffff; color:#334155; border:1px solid #cbd5e1; cursor:pointer; transition:all 0.2s; box-shadow:0 2px 4px rgba(0,0,0,0.02); text-decoration: none;}
        .htx-btn-secondary:hover { background:#f8fafc; border-color:#94a3b8; color:#0f172a; }
        
        .price-row { display:flex; justify-content:space-between; align-items:center; padding:16px 0; border-bottom:1px solid #f1f5f9; }
        .price-row:last-child { border-bottom:none; }
        
        @media(max-width:768px){
          .htx-mobile-hide { display:none!important; }
          .htx-mobile-menu { display:flex!important; }
        }
      `}</style>

      {/* ═══ NAVBAR ═══ */}
      <nav
        className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(255,255,255,0.95)" : "transparent",
          borderBottom: scrolled ? "1px solid #e2e8f0" : "1px solid transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-0 flex items-center" style={{ height: "68px" }}>
          {/* LOGO ZONE */}
          <div className="flex items-center gap-2 flex-shrink-0" style={{ marginRight: "48px" }}>
            <div style={{
              width: "32px", height: "32px", borderRadius: "8px",
              overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0", background: "#fff"
            }}>
              <img src="https://i.imgur.com/xDk58Xk.png" alt="Hatexcard Logo" style={{ width: "100%", height: "100%", objectFit: "cover", padding: "2px" }} />
            </div>
            <span style={{ fontWeight: 800, fontSize: "18px", letterSpacing: "-0.02em", color: "#0f172a" }}>
              Hatex<span style={{ color: "#4f46e5" }}>card</span>
            </span>
          </div>

          {/* Desktop nav links */}
          <div className="htx-mobile-hide flex items-center gap-1 flex-1">
            {navLinks.map(link => (
              <div key={link.label} className="htx-nav-link relative" style={{ padding: "8px 14px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  {link.label}
                  {link.sub.length > 0 && <ChevronDown size={12} />}
                </span>
                {link.sub.length > 0 && (
                  <div className="htx-dropdown" style={{ transform: "translateX(-50%) translateY(8px)" }}>
                    {link.sub.map(s => (
                      <a key={s.label} href={s.label.includes('API') || s.label.includes('WooCommerce') || s.label.includes('Hostinger') ? '/developer/docs' : '/login'} className="htx-dropdown-item" style={{textDecoration: 'none'}}>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "2px" }}>{s.label}</div>
                        <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>{s.desc}</div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Right side */}
          <div className="htx-mobile-hide flex items-center gap-3 ml-auto">
            <Link href="/login" style={{ fontSize: "13px", fontWeight: 700, color: "#475569", padding: "8px 14px", transition: "color 0.2s", textDecoration: 'none' }} className="hover:text-indigo-600">
              Konekte
            </Link>
            <Link href="/signup" className="htx-btn-primary" style={{ padding: "10px 20px", fontSize: "13px", borderRadius: "8px" }}>
              Ouvri Kont Gratis
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="ml-auto flex flex-col gap-1.5 p-2"
            style={{ display: "none" }}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
          >
            <span style={{ width: "22px", height: "2px", background: "#0f172a", borderRadius: "2px", transition: "all 0.2s", transform: menuOpen ? "rotate(45deg) translate(3px,3px)" : "none" }}/>
            <span style={{ width: "22px", height: "2px", background: "#0f172a", borderRadius: "2px", transition: "all 0.2s", opacity: menuOpen ? 0 : 1 }}/>
            <span style={{ width: "22px", height: "2px", background: "#0f172a", borderRadius: "2px", transition: "all 0.2s", transform: menuOpen ? "rotate(-45deg) translate(3px,-3px)" : "none" }}/>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div style={{ background: "#ffffff", borderTop: "1px solid #e2e8f0", padding: "16px 24px 24px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)" }}>
            {navLinks.map(link => (
              <a key={link.label} href={link.href} style={{ display: "block", padding: "12px 0", fontSize: "15px", fontWeight: 700, color: "#334155", borderBottom: "1px solid #f1f5f9", textDecoration: "none" }}>
                {link.label}
              </a>
            ))}
            <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <Link href="/login" className="htx-btn-secondary" style={{ justifyContent: "center" }}>Konekte</Link>
              <Link href="/signup" className="htx-btn-primary" style={{ justifyContent: "center" }}>Ouvri Kont Gratis</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="relative z-10" style={{ paddingTop: "140px", paddingBottom: "0", paddingLeft: "24px", paddingRight: "24px" }}>
        <div className="max-w-5xl mx-auto text-center">

          {/* Status badge */}
          <div className="a1" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 14px 6px 8px", borderRadius: "100px", background: "#eff6ff", border: "1px solid #bfdbfe", marginBottom: "32px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "#dbeafe", padding: "3px 10px", borderRadius: "100px", fontSize: "10px", fontWeight: 800, color: "#4f46e5", letterSpacing: "0.1em" }}>
              NOUVOTE
            </span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e40af" }}>
              Plugin WooCommerce v3.0 disponib kounye a
            </span>
          </div>

          {/* Heading */}
          <h1 className="a2" style={{ fontSize: "clamp(40px,7.5vw,76px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.04em", marginBottom: "24px", color: "#0f172a" }}>
            Sistèm Peman
            <br />
            <span style={{ color: "#4f46e5" }}>100% an Goud</span>
            <br />
            pou Ayiti.
          </h1>

          {/* Subtitle */}
          <p className="a3" style={{ fontSize: "16px", color: "#64748b", maxWidth: "560px", margin: "0 auto 40px", lineHeight: 1.7, fontWeight: 500 }}>
            Yon platfòm konplè pou machann, antreprenè, ak devlopè ki vle resevwa, voye, ak jere lajan an Goud — san frè kache, ak sekirite nivo bankè.
          </p>

          {/* CTA row */}
          <div className="a4" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", flexWrap: "wrap", marginBottom: "64px" }}>
            <div style={{
              display: "flex", alignItems: "center",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "12px",
              overflow: "hidden",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)"
            }}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Adrès imèl ou..."
                style={{ background: "transparent", border: "none", outline: "none", padding: "14px 18px", fontSize: "14px", color: "#0f172a", width: "240px" }}
              />
              <Link href="/signup" className="htx-btn-primary" style={{ margin: "5px", borderRadius: "8px", fontSize: "13px", padding: "10px 18px", boxShadow: "none" }}>
                Kòmanse
              </Link>
            </div>
          </div>

          {/* Trust line */}
          <p className="a5" style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600, marginBottom: "60px", letterSpacing: "0.02em" }}>
            Gratis pou kòmanse · Pa gen frè P2P · Kont pare nan 2 minit
          </p>
        </div>

        {/* ═══ HERO VISUAL: CARD + PHONE ═══ */}
        <div style={{ position: "relative", maxWidth: "1100px", margin: "0 auto", display: "flex", alignItems: "flex-end", justifyContent: "center", minHeight: "500px", gap: "0" }}>

          {/* Phone left */}
          <div className="phone-anim" style={{ position: "relative", zIndex: 15, marginRight: "-28px", marginBottom: "0", flexShrink: 0 }}>
            <div style={{
              width: "210px",
              background: "#ffffff",
              borderRadius: "36px",
              border: "6px solid #f1f5f9",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.15), 0 0 0 1px #e2e8f0",
              overflow: "hidden",
              transform: "perspective(900px) rotateY(10deg) rotateX(2deg)"
            }}>
              <div style={{ height: "20px", background: "#ffffff", display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: "4px" }}>
                <div style={{ width: "60px", height: "6px", background: "#e2e8f0", borderRadius: "4px" }}/>
              </div>
              <div style={{ padding: "10px 14px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "7px", color: "#94a3b8", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>Dashboard</div>
                  <div style={{ fontSize: "12px", color: "#0f172a", fontWeight: 800, letterSpacing: "-0.02em" }}>Hatexcard</div>
                </div>
                <div style={{ width: "26px", height: "26px", background: "#e0e7ff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <User size={12} className="text-indigo-600" />
                </div>
              </div>
              <div style={{ padding: "6px 14px 12px" }}>
                <div style={{ fontSize: "7px", color: "#94a3b8", fontWeight: 800, letterSpacing: "0.1em", marginBottom: "4px" }}>BALANS TOTAL</div>
                <div style={{ fontSize: "26px", fontWeight: 900, color: "#0f172a", letterSpacing: "-0.03em", lineHeight: 1 }}>
                  3,200
                  <span style={{ fontSize: "11px", color: "#64748b", marginLeft: "4px", fontWeight: 700 }}>HTG</span>
                </div>
                <div style={{ fontSize: "9px", color: "#059669", fontWeight: 700, marginTop: "4px" }}>+1,500 HTG jodi a</div>
              </div>
              <div style={{ padding: "0 12px 12px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "5px" }}>
                {[{ l: "Depo", bg: "#4f46e5", c: "#fff" }, { l: "Retrè", bg: "#f1f5f9", c: "#475569" }, { l: "QR Scan", bg: "#f1f5f9", c: "#475569" }].map(b => (
                  <div key={b.l} style={{ background: b.bg, color: b.c, borderRadius: "8px", padding: "7px 4px", textAlign: "center", fontSize: "7px", fontWeight: 800, letterSpacing: "0.02em" }}>{b.l}</div>
                ))}
              </div>
              <div style={{ padding: "0 12px 12px" }}>
                <div style={{ background: "linear-gradient(135deg, #312e81, #4f46e5)", borderRadius: "12px", padding: "12px", position: "relative", overflow: "hidden", aspectRatio: "1.58/1", boxShadow: "0 4px 12px rgba(79,70,229,0.3)" }}>
                  <div style={{ position: "absolute", top: "-20%", right: "-10%", width: "70px", height: "70px", borderRadius: "50%", background: "rgba(255,255,255,0.1)" }}/>
                  <div style={{ fontSize: "7px", color: "rgba(255,255,255,0.6)", fontWeight: 800, letterSpacing: "0.1em", marginBottom: "12px" }}>KAT VITYÈL</div>
                  <div style={{ fontSize: "10px", fontFamily: "monospace", color: "#fff", letterSpacing: "0.1em", fontWeight: 700 }}>4550 **** **** 8273</div>
                </div>
              </div>
              <div style={{ padding: "0 12px 14px", background: "#f8fafc", borderTop: "1px solid #f1f5f9", height: "100%" }}>
                <div style={{ fontSize: "7px", fontWeight: 800, color: "#94a3b8", letterSpacing: "0.1em", marginBottom: "8px", paddingTop: "8px" }}>DÈNYE AKTIVITE</div>
                {[{ lb: "SMART INVOICE", am: "+1 500 HTG", c: "#059669", t: "Jodi a, 11:32" }, { lb: "NETFLIX ABÒNMAN", am: "−850 HTG", c: "#0f172a", t: "Yè, 9:15" }].map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px", background: "#ffffff", borderRadius: "8px", marginBottom: "6px", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                    <div>
                      <div style={{ fontSize: "7px", color: "#475569", fontWeight: 800, marginBottom: "2px" }}>{item.lb}</div>
                      <div style={{ fontSize: "6px", color: "#94a3b8", fontWeight: 600 }}>{item.t}</div>
                    </div>
                    <span style={{ fontSize: "8px", fontWeight: 800, color: item.c }}>{item.am}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Card center */}
          <div className="a4" style={{ position: "relative", zIndex: 20, display: "flex", flexDirection: "column" as const, alignItems: "center" }}>
            <div style={{ position: "absolute", bottom: "-40px", left: "50%", transform: "translateX(-50%)", width: "420px", height: "80px", background: "radial-gradient(ellipse, rgba(79,70,229,0.3) 0%, transparent 70%)", filter: "blur(24px)", animation: "htx-glow 4s ease-in-out infinite" }}/>
            <div
              className="htx-card-float"
              style={{
                "--tx": `${cardTiltX}deg`,
                "--ty": `${cardTiltY}deg`,
                width: "360px",
                aspectRatio: "1.586/1",
                borderRadius: "22px",
                background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 42%, #4338ca 80%, #4f46e5 100%)",
                boxShadow: "0 25px 50px -12px rgba(49,46,129,0.5), inset 0 1px 0 rgba(255,255,255,0.2)",
                padding: "26px 30px",
                position: "relative",
                overflow: "hidden",
                transformStyle: "preserve-3d",
                border: "1px solid rgba(255,255,255,0.1)"
              } as React.CSSProperties}
            >
              <div style={{ position: "absolute", top: "-35%", right: "-15%", width: "300px", height: "300px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)" }}/>
              <div style={{ position: "absolute", top: "-20%", right: "-5%", width: "200px", height: "200px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.08)" }}/>
              <div style={{ position: "absolute", bottom: "-20%", left: "-10%", width: "180px", height: "180px", borderRadius: "50%", background: "rgba(255,255,255,0.03)" }}/>
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "30px", position: "relative", zIndex: 2 }}>
                {/* Chip */}
                <div style={{ width: "44px", height: "34px", background: "linear-gradient(135deg, #fbbf24, #d97706)", borderRadius: "6px", boxShadow: "inset 0 1px 2px rgba(255,255,255,0.5)" }}/>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "#fff", letterSpacing: "0.15em" }}>HATEXCARD</div>
                  <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.7)", fontWeight: 600, marginTop: "2px", letterSpacing: "0.1em" }}>BUSINESS</div>
                </div>
              </div>
              <div style={{ fontSize: "21px", fontFamily: "monospace", color: "#fff", letterSpacing: "0.2em", marginBottom: "26px", fontWeight: 500, textShadow: "0 2px 4px rgba(0,0,0,0.2)", position: "relative", zIndex: 2 }}>
                4550 &nbsp;****&nbsp; **** &nbsp;8273
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", position: "relative", zIndex: 2 }}>
                <div>
                  <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.5)", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "4px" }}>TITILÈ</div>
                  <div style={{ fontSize: "13px", color: "#fff", fontWeight: 600, letterSpacing: "0.05em" }}>HATEX USER</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.5)", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "4px" }}>EXP</div>
                  <div style={{ fontSize: "13px", color: "#fff", fontWeight: 600 }}>01/30</div>
                </div>
              </div>
            </div>
            
            {/* Reflection shadow */}
            <div style={{ width: "340px", aspectRatio: "1.586/1", borderRadius: "22px", background: "linear-gradient(to bottom, rgba(79,70,229,0.15) 0%, transparent 100%)", transform: "scaleY(-0.2) translateY(-20px)", transformOrigin: "top center", filter: "blur(8px)" }}/>
          </div>

          {/* Stats right */}
          <div className="phone-anim" style={{ marginLeft: "36px", marginBottom: "80px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { label: "Frè Tranzaksyon P2P", val: "Gratis", sub: "Peman ant moun" },
              { label: "Vitès Peman", val: "< 10 sek", sub: "Konfirmasyon imedyat" },
            
            ].map(s => (
              <div key={s.label} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "16px 20px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", minWidth: "190px" }}>
                <div style={{ fontSize: "10px", color: "#64748b", fontWeight: 700, letterSpacing: "0.05em", marginBottom: "6px", textTransform: "uppercase" }}>{s.label}</div>
                <div style={{ fontSize: "18px", color: "#0f172a", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 500, marginTop: "4px" }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PARTNERS BAR ═══ */}
      <div className="a5" style={{ paddingTop: "48px", paddingBottom: "48px", textAlign: "center", position: "relative", zIndex: 10, background: "#ffffff", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
        <p style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, letterSpacing: "0.15em", marginBottom: "24px", textTransform: "uppercase" }}>
          Intègre ak platfòm sa yo
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "48px" }}>
          {["MonCash", "NatCash", "Unibank", "BNC", "Hostinger", "WooCommerce"].map(n => (
            <span key={n} className="htx-partner" style={{ fontSize: "15px", fontWeight: 800, color: "#cbd5e1" }}>{n}</span>
          ))}
        </div>
      </div>

      {/* ═══ STATS BAND ═══ */}
      <div style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", position: "relative", zIndex: 10 }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          {stats.map((s) => (
            <div key={s.label} className="htx-stat" style={{ padding: "40px 24px", textAlign: "center" }}>
              <div style={{ fontSize: "clamp(24px,3.5vw,36px)", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em", lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, marginTop: "8px", lineHeight: 1.4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ FEATURES ═══ */}
      <section id="pwodwi" style={{ padding: "100px 24px", position: "relative", zIndex: 10, background: "#ffffff" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "64px" }}>
            <div style={{ display: "inline-block", fontSize: "11px", fontWeight: 700, letterSpacing: "0.15em", color: "#4f46e5", textTransform: "uppercase", marginBottom: "16px", background: "#e0e7ff", padding: "6px 16px", borderRadius: "100px" }}>
              Sèvis ak Fonksyon
            </div>
            <h2 style={{ fontSize: "clamp(32px,5vw,48px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, color: "#0f172a", marginBottom: "16px" }}>
              Tout sa yon biznis modèn<br />bezwen pou kòmanse.
            </h2>
            <p style={{ fontSize: "16px", color: "#64748b", maxWidth: "540px", margin: "0 auto", lineHeight: 1.6, fontWeight: 500 }}>
              De yon machann solitè ak yon QR kòd jis yon devlopè k ap intègre yon API konplè — Hatexcard gen zouti w bezwen.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: "24px" }}>
            {features.map(f => (
              <div key={f.ti} className="htx-feat-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "#eef2ff", border: "1px solid #e0e7ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {f.icon}
                  </div>
                  <span style={{ fontSize: "10px", fontWeight: 700, padding: "4px 10px", borderRadius: "100px", background: "#f1f5f9", color: "#64748b", letterSpacing: "0.05em" }}>{f.tg}</span>
                </div>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", marginBottom: "10px", letterSpacing: "-0.01em" }}>{f.ti}</h3>
                <p style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.6, margin: 0, fontWeight: 500 }}>{f.ds}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECURITY SECTION ═══ */}
      <section id="sekirite" style={{ padding: "100px 24px", position: "relative", zIndex: 10, background: "#f8fafc" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "24px", overflow: "hidden", boxShadow: "0 20px 40px -15px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {/* Left content */}
            <div style={{ flex: "1 1 360px", padding: "64px 48px" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 14px", borderRadius: "100px", background: "#ecfdf5", border: "1px solid #d1fae5", color: "#059669", fontSize: "12px", fontWeight: 700, marginBottom: "24px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", animation: "htx-pulse 2s ease-in-out infinite" }}/>
                Sekirite Aktif
              </div>
              <h2 style={{ fontSize: "clamp(28px,4vw,42px)", fontWeight: 800, lineHeight: 1.1, marginBottom: "20px", letterSpacing: "-0.03em", color: "#0f172a" }}>
                Nou pa konpwomèt<br />sou <span style={{ color: "#4f46e5" }}>sekirite lajan w.</span>
              </h2>
              <p style={{ fontSize: "15px", color: "#64748b", lineHeight: 1.6, marginBottom: "40px", fontWeight: 500 }}>
                Sistèm Hatexcard konstwi avèk menm nivo pwoteksyon ak enstitisyon finansyè entènasyonal yo. Chak tranzaksyon siveyé an tan reyèl.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                {[
                  { t: "Verifikasyon KYC Obligatwa", d: "Chak itilizatè dwe verifye idantite yo anvan yo ka resevwa peman. Sa elimine risk koken ak fwòd sou platfòm nan." },
                  { t: "Ankripsyon SSL 256-bit", d: "Tout done bankè ak pèsonèl ou yo pase nan yon tiyo ankripte nivo bankè. Okenn enfòmasyon sansib pa janm transmèt an klè." },
                  { t: "Siveyans Tranzaksyon 24/7", d: "Sistèm nou an monitoré chak mouvman lajan an tan reyèl. Aktivite etranj deklanche yon alèt imedyat epi blokaj otomatik." },
                ].map(item => (
                  <div key={item.t} style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                    <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#e0e7ff", border: "1px solid #c7d2fe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "2px" }}>
                      <CheckCircle2 size={14} className="text-indigo-600" />
                    </div>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b", marginBottom: "4px" }}>{item.t}</div>
                      <div style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.5, fontWeight: 500 }}>{item.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Right visual */}
            <div style={{ flex: "0 0 380px", background: "#f8fafc", borderLeft: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", padding: "48px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "300px", height: "300px", background: "radial-gradient(circle, rgba(79,70,229,0.05) 0%, transparent 70%)" }} />
              <div style={{ position: "relative", width: "220px", height: "220px" }}>
                <div style={{ position: "absolute", inset: "12px", border: "2px solid #e2e8f0", borderRadius: "50%", animation: "htx-spin 25s linear infinite" }}/>
                <div style={{ position: "absolute", inset: "32px", border: "2px dashed #cbd5e1", borderRadius: "50%", animation: "htx-spin 18s linear infinite reverse" }}/>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff", borderRadius: "50%", width: "100px", height: "100px", margin: "auto", boxShadow: "0 10px 25px rgba(0,0,0,0.05)" }}>
                  <ShieldCheck size={40} className="text-indigo-600" />
                </div>
                {/* Floating badges */}
                {[
                  { label: "KYC", top: "5%", left: "75%", delay: "0s" },
                  { label: "SSL", top: "80%", left: "70%", delay: "0.3s" },
                  { label: "2FA", top: "45%", left: "-15%", delay: "0.6s" },
                ].map(b => (
                  <div key={b.label} style={{ position: "absolute", top: b.top, left: b.left, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "8px 14px", fontSize: "11px", fontWeight: 700, color: "#334155", letterSpacing: "0.05em", boxShadow: "0 4px 6px rgba(0,0,0,0.02)", animation: `htx-float ${3 + parseFloat(b.delay)}s ease-in-out infinite`, animationDelay: b.delay }}>
                    {b.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section id="pri" style={{ padding: "100px 24px", position: "relative", zIndex: 10, background: "#ffffff" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "64px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.15em", color: "#4f46e5", textTransform: "uppercase", marginBottom: "16px", background: "#e0e7ff", padding: "6px 16px", borderRadius: "100px", display: "inline-block" }}>Transparent & San Sipriz</div>
            <h2 style={{ fontSize: "clamp(30px,4.5vw,46px)", fontWeight: 800, letterSpacing: "-0.03em", color: "#0f172a", marginBottom: "16px", lineHeight: 1.1 }}>
              Frè ki klè, pri ki jis.
            </h2>
            <p style={{ fontSize: "16px", color: "#64748b", lineHeight: 1.6, maxWidth: "480px", margin: "0 auto", fontWeight: 500 }}>
              Majòrite fonksyon yo gratis. Nou fè lajan sèlman lè sèvis la kreye valè reyèl pou biznis ou.
            </p>
          </div>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "24px", overflow: "hidden", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.05)" }}>
            <div style={{ padding: "10px 40px" }}>
              {[
                { op: "Tranzaksyon P2P (ant itilizatè)", val: "Gratis", hi: true },
                { op: "Peman bay machann ak kat", val: "Gratis", hi: true },
                { op: "Rechaj kat vityèl", val: "Gratis", hi: true },
                { op: "Depo", val: "5%", hi: false },
                { op: "Retrè", val: "5%", hi: false },
                { op: "Kreye kont ak verifikasyon KYC", val: "Gratis", hi: true },
                { op: "Smart Invoice & QR Kòd", val: "Gratis", hi: true },
                { op: "Aksè API & Plugin", val: "Gratis", hi: true },
              ].map(row => (
                <div key={row.op} className="price-row">
                  <span style={{ fontSize: "15px", color: "#475569", fontWeight: 600 }}>{row.op}</span>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: row.hi ? "#059669" : "#0f172a" }}>{row.val}</span>
                </div>
              ))}
            </div>
            <div style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", padding: "24px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
              <span style={{ fontSize: "14px", color: "#475569", fontWeight: 600 }}>Kont gratis. Pare nan 2 minit. Pa gen frè kache.</span>
              <Link href="/signup" className="htx-btn-primary" style={{ fontSize: "14px", padding: "12px 24px", borderRadius: "10px", textDecoration: "none" }}>
                Kòmanse Gratis
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section style={{ padding: "100px 24px", position: "relative", zIndex: 10, background: "#f8fafc" }}>
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "56px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.15em", color: "#4f46e5", textTransform: "uppercase", marginBottom: "16px", background: "#e0e7ff", padding: "6px 16px", borderRadius: "100px", display: "inline-block" }}>Support</div>
            <h2 style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.03em", color: "#0f172a", marginBottom: "16px" }}>
              Kesyon yo poze souvan.
            </h2>
            <p style={{ fontSize: "16px", color: "#64748b", fontWeight: 500 }}>Pa jwenn repons ou a? Kontakte ekip nou dirèkteman.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {faqs.map((faq, index) => (
              <div
                key={index}
                className={`htx-faq${activeFaq === index ? " open" : ""}`}
                onClick={() => setActiveFaq(activeFaq === index ? null : index)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
                  <h4 style={{ fontSize: "15px", fontWeight: 700, color: activeFaq === index ? "#3b82f6" : "#1e293b", margin: 0, lineHeight: 1.4 }}>{faq.q}</h4>
                  <div style={{ transform: activeFaq === index ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s", flexShrink: 0 }}>
                    <ChevronDown size={20} className={activeFaq === index ? "text-indigo-500" : "text-slate-400"} />
                  </div>
                </div>
                <div style={{ maxHeight: activeFaq === index ? "300px" : "0", overflow: "hidden", transition: "max-height 0.3s ease", opacity: activeFaq === index ? 1 : 0 }}>
                  <p style={{ paddingTop: "16px", margin: 0, fontSize: "14px", color: "#64748b", lineHeight: 1.6, fontWeight: 500 }}>
                    {faq.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA FINAL ═══ */}
      <section style={{ padding: "80px 24px 100px", position: "relative", zIndex: 10, background: "#ffffff" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", background: "linear-gradient(135deg, #e0e7ff, #f8fafc)", border: "1px solid #c7d2fe", borderRadius: "32px", padding: "80px 48px", textAlign: "center", position: "relative", overflow: "hidden", boxShadow: "0 20px 40px -15px rgba(79,70,229,0.15)" }}>
          <div style={{ position: "relative", zIndex: 2 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 16px", borderRadius: "100px", background: "#ffffff", border: "1px solid #e2e8f0", marginBottom: "24px", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", animation: "htx-pulse 2s ease-in-out infinite" }}/>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#10b981", letterSpacing: "0.1em" }}>PLATFÒM OPERASYONÈL</span>
            </div>
            <h2 style={{ fontSize: "clamp(32px,5vw,56px)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: "20px", color: "#0f172a" }}>
              Kòmanse resevwa<br />lajan <span style={{ color: "#4f46e5" }}>jodi a menm.</span>
            </h2>
            <p style={{ fontSize: "16px", color: "#475569", marginBottom: "40px", lineHeight: 1.6, maxWidth: "520px", margin: "0 auto 40px", fontWeight: 500 }}>
              Kont gratis. Konfirmasyon KYC nan 2 a 60 minit. Premye tranzaksyon ou pare imedyatman apre verifikasyon.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "16px" }}>
              <Link href="/signup" className="htx-btn-primary" style={{ fontSize: "15px", padding: "16px 32px", borderRadius: "12px", textDecoration: "none" }}>
                Ouvri Kont Gratis
              </Link>
              <Link href="/login" className="htx-btn-secondary" style={{ fontSize: "15px", padding: "16px 32px", borderRadius: "12px", background: "#ffffff", borderColor: "#cbd5e1", textDecoration: "none" }}>
                Konekte nan Kont Ou
              </Link>
              <a href="/HatexCard.apk" download="HatexCard_v1.0.apk" className="htx-btn-secondary" style={{ fontSize: "15px", padding: "16px 32px", borderRadius: "12px", background: "#ffffff", borderColor: "#cbd5e1", textDecoration: "none" }}>
                <Smartphone size={18} className="text-indigo-600" /> Telechaje App Android
              </a>
            </div>
          </div>
          <div style={{ position: "absolute", top: "0%", left: "50%", transform: "translateX(-50%)", width: "600px", height: "200px", background: "radial-gradient(ellipse, rgba(79,70,229,0.1) 0%, transparent 70%)", filter: "blur(40px)", zIndex: 1 }}/>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{ background: "#ffffff", borderTop: "1px solid #e2e8f0", position: "relative", zIndex: 10 }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "80px 24px 40px" }}>
          
          {/* Top row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "60px", marginBottom: "60px" }}>
            
            {/* Brand col */}
            <div style={{ flex: "0 0 280px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "8px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e8f0", background: "#fff" }}>
                  <img src="https://i.imgur.com/xDk58Xk.png" alt="Hatexcard Logo" style={{ width: "100%", height: "100%", objectFit: "cover", padding: "2px" }} />
                </div>
                <span style={{ fontWeight: 800, fontSize: "18px", letterSpacing: "-0.02em", color: "#0f172a" }}>Hatex<span style={{ color: "#4f46e5" }}>card</span></span>
              </div>
              <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.6, margin: "0 0 24px", fontWeight: 500 }}>
                Platfòm peman digital 100% an Goud. Fèt pou Ayiti, konstwi pou rès la.
              </p>
              <div style={{ display: "flex", gap: "12px" }}>
                <a href="https://twitter.com/hatexcard" target="_blank" rel="noopener noreferrer" style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", transition: "all 0.2s" }} className="hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.766l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href="https://facebook.com/hatexcard" target="_blank" rel="noopener noreferrer" style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", transition: "all 0.2s" }} className="hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                <a href="https://wa.me/50937201241" target="_blank" rel="noopener noreferrer" style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", transition: "all 0.2s" }} className="hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </a>
                <a href="https://tiktok.com/@hatexcard" target="_blank" rel="noopener noreferrer" style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", transition: "all 0.2s" }} className="hover:text-black hover:border-gray-300 hover:bg-gray-100">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 2.23-.9 4.45-2.35 6.15-1.46 1.7-3.64 2.8-5.91 3.01-2.26.22-4.63-.15-6.55-1.42-1.91-1.27-3.23-3.32-3.62-5.55-.38-2.23.01-4.61 1.25-6.54 1.25-1.92 3.32-3.27 5.56-3.66.45-.07.9-.11 1.35-.11v4.02c-1.39.02-2.73.54-3.79 1.45-1.07.92-1.74 2.3-1.85 3.73-.12 1.43.32 2.87 1.21 4.02.89 1.15 2.24 1.9 3.71 2.06 1.47.15 2.96-.13 4.22-.84 1.26-.71 2.22-1.92 2.65-3.31.25-.83.33-1.71.32-2.58V.02h-3.41z"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* Pwodwi */}
            <div style={{ flex: "1 1 140px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "18px" }}>Pwodwi</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
                <li><a href="/login" style={{ fontSize: "14px", color: "#64748b", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-indigo-600">Kat Vityèl</a></li>
                <li><a href="/login" style={{ fontSize: "14px", color: "#64748b", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-indigo-600">Smart Invoice</a></li>
                <li><a href="/login" style={{ fontSize: "14px", color: "#64748b", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-indigo-600">Peman QR Kòd</a></li>
                <li><a href="/login" style={{ fontSize: "14px", color: "#64748b", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-indigo-600">Abònman Otomatik</a></li>
                <li><a href="/login" style={{ fontSize: "14px", color: "#64748b", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-indigo-600">Transfè Sekirize</a></li>
              </ul>
            </div>

            {/* Devlopè */}
            <div style={{ flex: "1 1 140px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "18px" }}>Devlopè</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
                <li><a href="/api-docs" style={{ fontSize: "14px", color: "#64748b", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-indigo-600">API Referans</a></li>
                <li><a href="https://github.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: "14px", color: "#64748b", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-indigo-600">Plugin WooCommerce</a></li>
                <li><a href="https://github.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: "14px", color: "#64748b", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-indigo-600">Plugin Hostinger</a></li>
                <li><a href="/sandbox" style={{ fontSize: "14px", color: "#64748b", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-indigo-600">Sandbox & Tès</a></li>
              </ul>
            </div>

            {/* Konpayi */}
            <div style={{ flex: "1 1 140px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "18px" }}>Konpayi</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
                <li><a href="/sou-nou" style={{ fontSize: "14px", color: "#64748b", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-indigo-600">Sou Nou</a></li>
                <li><a href="/blog" style={{ fontSize: "14px", color: "#64748b", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-indigo-600">Blog</a></li>
                <li><a href="mailto:support@hatexcard.com" style={{ fontSize: "14px", color: "#64748b", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-indigo-600">Kontakte Nou</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div style={{ flex: "1 1 140px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "18px" }}>Legal</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
                <li><a href="/politik" style={{ fontSize: "14px", color: "#64748b", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-indigo-600">Kondisyon Itilizasyon</a></li>
                <li><a href="/politik" style={{ fontSize: "14px", color: "#64748b", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-indigo-600">Konfidansyalite</a></li>
                <li><a href="/politik" style={{ fontSize: "14px", color: "#64748b", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-indigo-600">Politik KYC & AML</a></li>
                <li><a href="/politik" style={{ fontSize: "14px", color: "#64748b", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-indigo-600">Sekirite</a></li>
              </ul>
            </div>

          </div>

          {/* Bottom bar */}
          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "24px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
            <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 500 }}>
              © {new Date().getFullYear()} Hatexcard. Tout dwa rezève. Platfòm peman an Goud pou Ayiti.
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#f8fafc", padding: "6px 14px", borderRadius: "100px", border: "1px solid #e2e8f0" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", animation: "htx-pulse 2.5s ease-in-out infinite" }}/>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569", letterSpacing: "0.05em", textTransform: "uppercase" }}>Tout sistèm operasyonèl</span>
            </div>
          </div>

        </div>
      </footer>
    </div>
  );
}