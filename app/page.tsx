"use client";
import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";

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
        { label: "Escrow 24h", desc: "Pwoteksyon achè & machann" },
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
    { val: "24h", label: "Garanti Escrow machann" },
  ];

  const features = [
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e62e04" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      ),
      ti: "Smart Invoice",
      ds: "Jenere yon fakti pwofesyonèl ak yon lyen peman sekirize. Voye l bay kliyan pa imèl. Li peye, ou resevwa notifikasyon imedyatman ak prèv.",
      tg: "MACHANN"
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e62e04" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M3 9h6M3 15h6M15 3v6M15 15v6M15 9h6M15 15h6"/></svg>
      ),
      ti: "Peman QR Kòd",
      ds: "Kliyan skan QR kòd biznis ou ak telefòn yo epi peye montan egzak la nan yon segonn. Yon sèl aksyon — pa gen echanj, pa gen erè.",
      tg: "RAPID"
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e62e04" strokeWidth="1.8"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><line x1="12" y1="2" x2="12" y2="22"/></svg>
      ),
      ti: "API & Plugin",
      ds: "Intègre Hatexcard nan nenpòt sit wèb oswa app an mwens pase 5 minit. Plugin WooCommerce ak Hostinger v2.0 disponib. Kliyan peye an Goud dirèkteman.",
      tg: "DEVLOPÈ"
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e62e04" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      ),
      ti: "Abònman Otomatik",
      ds: "Konfigire peman regilye pou kliyan fidèl ou yo. Sistèm nan kolekte chak mwa otomatikman — ou pa bezwen raple oswa swiv pèsonn.",
      tg: "SÈVIS"
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e62e04" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
      ),
      ti: "Sèvis Taksi & Livrezon",
      ds: "Chauffeur ak livrè resevwa peman dirèkteman sou telefòn yo. Pa gen pwoblèm chanj egzak — kliyan mete montan la, ou resevwa nan segonn.",
      tg: "MOBILITE"
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e62e04" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      ),
      ti: "Transfè Sekirize",
      ds: "Voye lajan bay nenpòt itilizatè Hatexcard gratis ak imedyatman. Istwa konplè chak tranzaksyon disponib nan kont ou an tout tan.",
      tg: "GRATIS"
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e62e04" strokeWidth="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      ),
      ti: "Kontwòl Lajan Konplè",
      ds: "Tableau de bò an tan reyèl pou wè tout antre ak soti. Rapò detaye, filtre pa dat ak tip tranzaksyon — ou konnen egzakteman kote lajan w ale.",
      tg: "BIZNIS"
    },
  ];

  return (
    <div
      className="min-h-screen text-white overflow-x-hidden"
      style={{
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        background: "#08020a",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/* ═══ BACKGROUND ═══ */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 130% 70% at 50% -5%, #3a0008 0%, #180003 45%, #08020a 100%)" }} />
        <div className="absolute" style={{ top: "0%", left: "50%", transform: "translateX(-50%)", width: "1000px", height: "500px", background: "radial-gradient(ellipse, rgba(180,0,30,0.2) 0%, rgba(100,0,15,0.08) 55%, transparent 75%)", filter: "blur(80px)" }} />
        <div className="absolute" style={{ top: "25%", right: "-8%", width: "450px", height: "450px", background: "radial-gradient(ellipse, rgba(200,20,40,0.09) 0%, transparent 70%)", filter: "blur(90px)" }} />
        <div className="absolute" style={{ top: "35%", left: "-8%", width: "380px", height: "380px", background: "radial-gradient(ellipse, rgba(140,0,20,0.08) 0%, transparent 70%)", filter: "blur(80px)" }} />
        <div className="absolute bottom-0 inset-x-0" style={{ height: "40%", background: "linear-gradient(to top, rgba(160,0,25,0.06), transparent)" }} />
        {/* Subtle grid */}
        <div className="absolute inset-0" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 0%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 0%, transparent 100%)"
        }} />
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes htx-float {
          0%,100%{transform:perspective(1200px) rotateX(var(--tx,0deg)) rotateY(var(--ty,0deg)) translateY(0px)}
          50%{transform:perspective(1200px) rotateX(var(--tx,0deg)) rotateY(var(--ty,0deg)) translateY(-12px)}
        }
        @keyframes htx-glow { 0%,100%{opacity:0.4} 50%{opacity:0.9} }
        @keyframes htx-up { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes htx-fade { from{opacity:0} to{opacity:1} }
        @keyframes htx-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.95)} }
        @keyframes htx-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes htx-counter { from{transform:translateY(8px);opacity:0} to{transform:translateY(0);opacity:1} }
        .htx-card-float { animation: htx-float 6s ease-in-out infinite; }
        .a1{animation:htx-up 0.8s cubic-bezier(0.16,1,0.3,1) both}
        .a2{animation:htx-up 0.8s 0.1s cubic-bezier(0.16,1,0.3,1) both}
        .a3{animation:htx-up 0.8s 0.2s cubic-bezier(0.16,1,0.3,1) both}
        .a4{animation:htx-up 0.8s 0.3s cubic-bezier(0.16,1,0.3,1) both}
        .a5{animation:htx-fade 1s 0.5s both}
        .phone-anim{animation:htx-up 1s 0.15s cubic-bezier(0.16,1,0.3,1) both}
        .htx-nav-link{position:relative;color:rgba(255,255,255,0.5);font-size:13px;font-weight:600;transition:color 0.2s;cursor:pointer;padding:8px 0;}
        .htx-nav-link:hover{color:#fff}
        .htx-nav-link:hover .htx-dropdown{opacity:1;pointer-events:auto;transform:translateY(0)}
        .htx-dropdown{position:absolute;top:calc(100% + 12px);left:50%;transform:translateX(-50%) translateY(8px);background:rgba(14,3,8,0.97);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:8px;min-width:220px;opacity:0;pointer-events:none;transition:all 0.2s cubic-bezier(0.16,1,0.3,1);z-index:100;backdrop-filter:blur(20px);box-shadow:0 20px 60px rgba(0,0,0,0.6)}
        .htx-dropdown-item{display:block;padding:10px 12px;border-radius:10px;transition:background 0.15s;cursor:pointer;}
        .htx-dropdown-item:hover{background:rgba(230,46,4,0.08)}
        .htx-feat-card{background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:20px;padding:28px 24px;transition:all 0.3s cubic-bezier(0.16,1,0.3,1);}
        .htx-feat-card:hover{background:rgba(230,46,4,0.04);border-color:rgba(230,46,4,0.2);transform:translateY(-3px);}
        .htx-stat{border-right:1px solid rgba(255,255,255,0.06);}
        .htx-stat:last-child{border-right:none;}
        .htx-faq{background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.05);border-radius:14px;padding:22px 26px;cursor:pointer;transition:all 0.25s ease;}
        .htx-faq:hover{border-color:rgba(230,46,4,0.2);}
        .htx-faq.open{background:rgba(230,46,4,0.04);border-color:rgba(230,46,4,0.25);}
        .htx-partner{font-size:13px;font-weight:700;color:rgba(255,255,255,0.3);letter-spacing:0.08em;transition:color 0.2s;}
        .htx-partner:hover{color:rgba(255,255,255,0.6)}
        .htx-btn-primary{display:inline-flex;align-items:center;gap:8px;padding:13px 26px;border-radius:10px;font-size:14px;font-weight:700;background:linear-gradient(135deg,#e62e04,#b52000);color:#fff;border:none;cursor:pointer;transition:all 0.2s;box-shadow:0 4px 20px rgba(230,46,4,0.3);}
        .htx-btn-primary:hover{transform:translateY(-1px);box-shadow:0 8px 30px rgba(230,46,4,0.45);}
        .htx-btn-secondary{display:inline-flex;align-items:center;gap:8px;padding:13px 26px;border-radius:10px;font-size:14px;font-weight:700;background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.1);cursor:pointer;transition:all 0.2s;}
        .htx-btn-secondary:hover{background:rgba(255,255,255,0.08);color:#fff;}
        .price-row{display:flex;justify-content:space-between;align-items:center;padding:16px 0;border-bottom:1px solid rgba(255,255,255,0.05);}
        .price-row:last-child{border-bottom:none;}
        @media(max-width:768px){
          .htx-mobile-hide{display:none!important}
          .htx-mobile-menu{display:flex!important}
        }
      `}</style>

      {/* ═══ NAVBAR ═══ */}
      <nav
        className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(8,2,10,0.92)" : "transparent",
          borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
          backdropFilter: scrolled ? "blur(20px)" : "none",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-0 flex items-center" style={{ height: "68px" }}>
          {/* LOGO ZONE — remplace img src pa logo reyèl ou */}
          <div className="flex items-center gap-3 flex-shrink-0" style={{ marginRight: "48px" }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "linear-gradient(135deg,#e62e04,#8a1c02)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(230,46,4,0.35)"
            }}>
              {/* ↓↓↓ REMPLACE SA A AK: <img src="/logo.png" alt="Hatexcard" width={20} height={20} /> */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2">
                <rect x="2" y="5" width="20" height="14" rx="2.5"/>
                <path d="M2 10h20"/>
                <circle cx="7" cy="15" r="1" fill="white"/>
              </svg>
            </div>
            <span style={{ fontWeight: 900, fontSize: "17px", letterSpacing: "-0.04em", color: "#fff" }}>
              HATEX<span style={{ color: "#e62e04" }}>CARD</span>
            </span>
          </div>

          {/* Desktop nav links */}
          <div className="htx-mobile-hide flex items-center gap-1 flex-1">
            {navLinks.map(link => (
              <div key={link.label} className="htx-nav-link relative" style={{ padding: "8px 14px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  {link.label}
                  {link.sub.length > 0 && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                  )}
                </span>
                {link.sub.length > 0 && (
                  <div className="htx-dropdown" style={{ transform: "translateX(-50%) translateY(8px)" }}>
                    {link.sub.map(s => (
                      <a key={s.label} href="#" className="htx-dropdown-item">
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff", marginBottom: "2px" }}>{s.label}</div>
                        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>{s.desc}</div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Right side */}
          <div className="htx-mobile-hide flex items-center gap-3 ml-auto">
            <Link href="/login" style={{ fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.5)", padding: "8px 14px", transition: "color 0.2s" }} className="hover:text-white">
              Konekte
            </Link>
            <Link href="/signup" className="htx-btn-primary" style={{ padding: "10px 20px", fontSize: "13px", borderRadius: "8px" }}>
              Ouvri Kont Gratis
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="ml-auto flex flex-col gap-1.5 p-2"
            style={{ display: "none" }}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
          >
            <span style={{ width: "22px", height: "2px", background: "#fff", borderRadius: "2px", transition: "all 0.2s", transform: menuOpen ? "rotate(45deg) translate(3px,3px)" : "none" }}/>
            <span style={{ width: "22px", height: "2px", background: "#fff", borderRadius: "2px", transition: "all 0.2s", opacity: menuOpen ? 0 : 1 }}/>
            <span style={{ width: "22px", height: "2px", background: "#fff", borderRadius: "2px", transition: "all 0.2s", transform: menuOpen ? "rotate(-45deg) translate(3px,-3px)" : "none" }}/>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div style={{ background: "rgba(8,2,10,0.98)", borderTop: "1px solid rgba(255,255,255,0.07)", padding: "16px 24px 24px" }}>
            {navLinks.map(link => (
              <a key={link.label} href={link.href} style={{ display: "block", padding: "12px 0", fontSize: "15px", fontWeight: 700, color: "rgba(255,255,255,0.7)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
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
          <div className="a1" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 14px 6px 8px", borderRadius: "100px", background: "rgba(230,46,4,0.08)", border: "1px solid rgba(230,46,4,0.2)", marginBottom: "32px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "rgba(230,46,4,0.15)", padding: "3px 10px", borderRadius: "100px", fontSize: "10px", fontWeight: 800, color: "#e62e04", letterSpacing: "0.12em" }}>
              NOUVOTE
            </span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,220,200,0.75)" }}>
              Plugin WooCommerce v2.0 disponib kounye a
            </span>
          </div>

          {/* Heading */}
          <h1 className="a2" style={{ fontSize: "clamp(44px,7.5vw,84px)", fontWeight: 900, lineHeight: 1.04, letterSpacing: "-0.045em", marginBottom: "24px", color: "#fff" }}>
            Sistèm Peman
            <br />
            <span style={{ color: "#e62e04" }}>100% an Goud</span>
            <br />
            pou Ayiti.
          </h1>

          {/* Subtitle */}
          <p className="a3" style={{ fontSize: "16px", color: "rgba(255,255,255,0.45)", maxWidth: "520px", margin: "0 auto 40px", lineHeight: 1.75, fontWeight: 500 }}>
            Yon platfòm konplè pou machann, antreprenè, ak devlopè ki vle resevwa, voye, ak jere lajan an Goud — san frè kache, ak sekirite nivo enstitisyon finansyè.
          </p>

          {/* CTA row */}
          <div className="a4" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", flexWrap: "wrap", marginBottom: "64px" }}>
            <div style={{
              display: "flex", alignItems: "center",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px",
              overflow: "hidden",
              backdropFilter: "blur(10px)"
            }}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Adrès imèl ou..."
                style={{ background: "transparent", border: "none", outline: "none", padding: "13px 18px", fontSize: "14px", color: "#fff", width: "220px" }}
              />
              <Link href="/signup" className="htx-btn-primary" style={{ margin: "5px", borderRadius: "7px", fontSize: "13px", padding: "10px 18px" }}>
                Kòmanse
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
            </div>
            <a
              href="/HatexCard.apk"
              download="HatexCard_v1.0.apk"
              className="htx-btn-secondary"
              style={{ borderRadius: "10px" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(230,46,4,0.8)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Telechaje App Android
            </a>
          </div>

          {/* Trust line */}
          <p className="a5" style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)", fontWeight: 600, marginBottom: "60px", letterSpacing: "0.05em" }}>
            Gratis pou kòmanse · Pa gen frè P2P · Kont pare nan 2 minit
          </p>
        </div>

        {/* ═══ HERO VISUAL: CARD + PHONE ═══ */}
        <div style={{ position: "relative", maxWidth: "1100px", margin: "0 auto", display: "flex", alignItems: "flex-end", justifyContent: "center", minHeight: "500px", gap: "0" }}>

          {/* Phone left */}
          <div className="phone-anim" style={{ position: "relative", zIndex: 15, marginRight: "-28px", marginBottom: "0", flexShrink: 0 }}>
            <div style={{
              width: "210px",
              background: "#0c0210",
              borderRadius: "36px",
              border: "5px solid #160310",
              boxShadow: "0 40px 80px rgba(0,0,0,0.85), 0 0 0 1px rgba(230,46,4,0.12), inset 0 0 0 1px rgba(255,255,255,0.03)",
              overflow: "hidden",
              transform: "perspective(900px) rotateY(10deg) rotateX(2deg)"
            }}>
              <div style={{ height: "18px", background: "#0c0210", display: "flex", justifyContent: "center", alignItems: "flex-end", paddingBottom: "4px" }}>
                <div style={{ width: "55px", height: "6px", background: "#130210", borderRadius: "4px" }}/>
              </div>
              <div style={{ padding: "10px 14px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "7px", color: "rgba(255,255,255,0.3)", fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase" }}>Dashboard</div>
                  <div style={{ fontSize: "12px", color: "#fff", fontWeight: 900, letterSpacing: "-0.02em" }}>HatexCard</div>
                </div>
                <div style={{ width: "26px", height: "26px", background: "rgba(230,46,4,0.15)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,100,70,0.8)" strokeWidth="2.2"><path d="M18 20a6 6 0 00-12 0"/><circle cx="12" cy="10" r="4"/></svg>
                </div>
              </div>
              <div style={{ padding: "6px 14px 12px" }}>
                <div style={{ fontSize: "7px", color: "rgba(255,255,255,0.3)", fontWeight: 800, letterSpacing: "0.15em", marginBottom: "4px" }}>BALANS TOTAL</div>
                <div style={{ fontSize: "26px", fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1 }}>
                  3,200
                  <span style={{ fontSize: "11px", color: "#e62e04", marginLeft: "4px", fontWeight: 700 }}>HTG</span>
                </div>
                <div style={{ fontSize: "9px", color: "#22c55e", fontWeight: 700, marginTop: "4px" }}>+1,500 HTG jodi a</div>
              </div>
              <div style={{ padding: "0 12px 12px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "5px" }}>
                {[{ l: "Depo", bg: "#e62e04" }, { l: "Retrè", bg: "rgba(255,255,255,0.08)" }, { l: "QR Scan", bg: "rgba(255,255,255,0.08)" }].map(b => (
                  <div key={b.l} style={{ background: b.bg, color: "#fff", borderRadius: "8px", padding: "7px 4px", textAlign: "center", fontSize: "7px", fontWeight: 800, letterSpacing: "0.05em" }}>{b.l}</div>
                ))}
              </div>
              <div style={{ padding: "0 12px 12px" }}>
                <div style={{ background: "linear-gradient(135deg,#c00015,#7a000e,#3a0008)", borderRadius: "12px", padding: "12px", position: "relative", overflow: "hidden", aspectRatio: "1.58/1", boxShadow: "0 8px 24px rgba(180,0,20,0.5)" }}>
                  <div style={{ position: "absolute", top: "-20%", right: "-10%", width: "70px", height: "70px", borderRadius: "50%", background: "rgba(255,255,255,0.05)" }}/>
                  <div style={{ fontSize: "7px", color: "rgba(255,255,255,0.4)", fontWeight: 800, letterSpacing: "0.1em", marginBottom: "12px" }}>KAT VITYÈL</div>
                  <div style={{ fontSize: "10px", fontFamily: "monospace", color: "#fff", letterSpacing: "0.1em", fontWeight: 700 }}>4550 **** **** 8273</div>
                </div>
              </div>
              <div style={{ padding: "0 12px 14px" }}>
                <div style={{ fontSize: "7px", fontWeight: 800, color: "rgba(255,255,255,0.3)", letterSpacing: "0.15em", marginBottom: "6px" }}>DÈNYE AKTIVITE</div>
                {[{ lb: "SMART INVOICE PAYE", am: "+1 500 HTG", c: "#22c55e", t: "Jodi a, 11:32" }, { lb: "NETFLIX ABÒNMAN", am: "−850 HTG", c: "#ef4444", t: "Yè, 9:15" }].map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 8px", background: "rgba(255,255,255,0.03)", borderRadius: "8px", marginBottom: "4px", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <div>
                      <div style={{ fontSize: "6px", color: "rgba(255,255,255,0.5)", fontWeight: 700, marginBottom: "2px" }}>{item.lb}</div>
                      <div style={{ fontSize: "6px", color: "rgba(255,255,255,0.25)" }}>{item.t}</div>
                    </div>
                    <span style={{ fontSize: "7px", fontWeight: 900, color: item.c }}>{item.am}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Card center */}
          <div className="a4" style={{ position: "relative", zIndex: 20, display: "flex", flexDirection: "column" as const, alignItems: "center" }}>
            <div style={{ position: "absolute", bottom: "-40px", left: "50%", transform: "translateX(-50%)", width: "420px", height: "80px", background: "radial-gradient(ellipse, rgba(230,46,4,0.25) 0%, transparent 70%)", filter: "blur(24px)", animation: "htx-glow 3s ease-in-out infinite" }}/>
            <div
              className="htx-card-float"
              style={{
                "--tx": `${cardTiltX}deg`,
                "--ty": `${cardTiltY}deg`,
                width: "360px",
                aspectRatio: "1.586/1",
                borderRadius: "22px",
                background: "linear-gradient(135deg, #cc001b 0%, #7a0010 42%, #2c0006 80%, #160003 100%)",
                boxShadow: "0 40px 80px rgba(0,0,0,0.75), 0 0 50px rgba(180,0,20,0.25), 0 0 100px rgba(180,0,20,0.1), inset 0 1px 0 rgba(255,255,255,0.1)",
                padding: "26px 30px",
                position: "relative",
                overflow: "hidden",
                transformStyle: "preserve-3d",
              } as React.CSSProperties}
            >
              <div style={{ position: "absolute", top: "-35%", right: "-15%", width: "300px", height: "300px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.04)" }}/>
              <div style={{ position: "absolute", top: "-20%", right: "-5%", width: "200px", height: "200px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.03)" }}/>
              <div style={{ position: "absolute", bottom: "-20%", left: "-10%", width: "180px", height: "180px", borderRadius: "50%", background: "rgba(255,255,255,0.02)" }}/>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "30px" }}>
                {/* Chip */}
                <div style={{ width: "42px", height: "32px", background: "linear-gradient(135deg,rgba(255,210,90,0.35),rgba(200,155,50,0.2))", borderRadius: "6px", border: "1px solid rgba(255,195,70,0.18)" }}/>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "11px", fontWeight: 900, color: "rgba(255,255,255,0.6)", letterSpacing: "0.22em" }}>HATEXCARD</div>
                  <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)", fontWeight: 700, marginTop: "2px", letterSpacing: "0.1em" }}>PREMIUM</div>
                </div>
              </div>
              <div style={{ fontSize: "20px", fontFamily: "monospace", color: "rgba(255,255,255,0.85)", letterSpacing: "0.2em", marginBottom: "26px", fontWeight: 600, textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
                4550 &nbsp;****&nbsp; **** &nbsp;8273
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.28)", fontWeight: 700, letterSpacing: "0.15em", marginBottom: "4px" }}>PWOPRIYETÈ</div>
                  <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.75)", fontWeight: 700, letterSpacing: "0.07em" }}>HATEX USER</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.28)", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "4px" }}>EXP</div>
                  <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>01/30</div>
                </div>
              </div>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 55%, rgba(255,255,255,0.015) 100%)", borderRadius: "22px", pointerEvents: "none" }}/>
            </div>
            <div style={{ width: "360px", aspectRatio: "1.586/1", borderRadius: "22px", background: "linear-gradient(to bottom, rgba(180,0,20,0.1) 0%, transparent 100%)", transform: "scaleY(-0.28) translateY(-6px)", transformOrigin: "top center", filter: "blur(5px)", WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.3), transparent)", maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.3), transparent)" }}/>
          </div>

          {/* Stats right */}
          <div className="phone-anim" style={{ marginLeft: "36px", marginBottom: "80px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { label: "Frè Tranzaksyon P2P", val: "Gratis", sub: "Peman ant moun" },
              { label: "Vitès Peman", val: "< 10 sek", sub: "Konfirmasyon imedyat" },
              { label: "Garanti Escrow", val: "24h", sub: "Pwoteksyon achè" },
            ].map(s => (
              <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "14px 18px", backdropFilter: "blur(10px)", minWidth: "180px" }}>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", fontWeight: 700, letterSpacing: "0.08em", marginBottom: "4px", textTransform: "uppercase" }}>{s.label}</div>
                <div style={{ fontSize: "18px", color: "#fff", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontWeight: 600, marginTop: "3px" }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PARTNERS BAR ═══ */}
      <div className="a5" style={{ paddingTop: "48px", paddingBottom: "48px", textAlign: "center", position: "relative", zIndex: 10 }}>
        <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", fontWeight: 800, letterSpacing: "0.25em", marginBottom: "20px", textTransform: "uppercase" }}>
          Intègre ak platfòm sa yo
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "40px" }}>
          {["MonCash", "NatCash", "Unibank", "BNC", "Hostinger", "WooCommerce"].map(n => (
            <span key={n} className="htx-partner">{n}</span>
          ))}
        </div>
      </div>

      {/* ═══ STATS BAND ═══ */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", position: "relative", zIndex: 10 }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          {stats.map((s, i) => (
            <div key={s.label} className="htx-stat" style={{ padding: "32px 24px", textAlign: "center" }}>
              <div style={{ fontSize: "clamp(22px,3.5vw,34px)", fontWeight: 900, color: "#fff", letterSpacing: "-0.04em", lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", fontWeight: 600, marginTop: "6px", lineHeight: 1.4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ FEATURES ═══ */}
      <section id="pwodwi" style={{ padding: "100px 24px", position: "relative", zIndex: 10 }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "60px" }}>
            <div style={{ display: "inline-block", fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", color: "#e62e04", textTransform: "uppercase", marginBottom: "16px" }}>
              Sèvis ak Fonksyon
            </div>
            <h2 style={{ fontSize: "clamp(30px,5vw,52px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.08, color: "#fff", marginBottom: "16px" }}>
              Tout sa yon biznis modèn<br />bezwen pou kòmanse.
            </h2>
            <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.4)", maxWidth: "480px", margin: "0 auto", lineHeight: 1.7 }}>
              De yon machann solitè ak yon QR kòd jis yon devlopè k ap intègre yon API konplè — Hatexcard gen zouti w bezwen.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: "16px" }}>
            {features.map(f => (
              <div key={f.ti} className="htx-feat-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                  <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(230,46,4,0.08)", border: "1px solid rgba(230,46,4,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {f.icon}
                  </div>
                  <span style={{ fontSize: "9px", fontWeight: 800, padding: "3px 8px", borderRadius: "100px", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em" }}>{f.tg}</span>
                </div>
                <h3 style={{ fontSize: "14px", fontWeight: 800, color: "#fff", marginBottom: "8px", letterSpacing: "-0.02em" }}>{f.ti}</h3>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", lineHeight: 1.65, margin: 0 }}>{f.ds}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECURITY SECTION ═══ */}
      <section id="sekirite" style={{ padding: "0 24px 100px", position: "relative", zIndex: 10 }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", background: "rgba(12,2,6,0.7)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "24px", overflow: "hidden", backdropFilter: "blur(16px)" }}>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {/* Left content */}
            <div style={{ flex: "1 1 360px", padding: "60px 48px" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "5px 12px", borderRadius: "100px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.18)", color: "#22c55e", fontSize: "11px", fontWeight: 700, marginBottom: "24px" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", animation: "htx-pulse 2s ease-in-out infinite" }}/>
                Sekirite Aktif
              </div>
              <h2 style={{ fontSize: "clamp(26px,4vw,40px)", fontWeight: 900, lineHeight: 1.1, marginBottom: "18px", letterSpacing: "-0.035em", color: "#fff" }}>
                Nou pa konpwomèt<br />sou <span style={{ color: "#e62e04" }}>sekirite lajan w.</span>
              </h2>
              <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", lineHeight: 1.75, marginBottom: "36px" }}>
                Sistèm Hatexcard konstwi avèk menm nivo pwoteksyon ak enstitisyon finansyè entènasyonal yo. Chak tranzaksyon siveyé an tan reyèl.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {[
                  { t: "Garanti Escrow 24 Èdtan", d: "Peman sot nan kliyan bloke nan sistèm nou pou 24h anvan li lage bay machann. Si gen yon pwoblèm, achè a gen yon fenèt pou ouvri yon diferan." },
                  { t: "Verifikasyon KYC Obligatwa", d: "Chak itilizatè dwe verifye idantite yo anvan yo ka resevwa peman. Sa elimine risk koken ak fwòd sou platfòm nan." },
                  { t: "Ankripsyon SSL 256-bit", d: "Tout done bankè ak pèsonèl ou yo pase nan yon tiyo ank ripte nivo militè. Okenn enfòmasyon sansib pa janm transmèt an klè." },
                  { t: "Siveyans Tranzaksyon 24/7", d: "Sistèm nou an monitoré chak mouvman lajan an tan reyèl. Aktivite etranj deklanche yon alèt imedyat epi blokaj otomatik." },
                ].map(item => (
                  <div key={item.t} style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                    <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "rgba(230,46,4,0.12)", border: "1px solid rgba(230,46,4,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px" }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#e62e04" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 800, color: "#fff", marginBottom: "3px" }}>{item.t}</div>
                      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.38)", lineHeight: 1.6 }}>{item.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Right visual */}
            <div style={{ flex: "0 0 320px", background: "rgba(230,46,4,0.03)", borderLeft: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", padding: "48px" }}>
              <div style={{ position: "relative", width: "200px", height: "200px" }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle, rgba(230,46,4,0.12) 0%, transparent 70%)" }}/>
                <div style={{ position: "absolute", inset: "12px", border: "1px solid rgba(230,46,4,0.2)", borderRadius: "50%", animation: "htx-spin 25s linear infinite" }}/>
                <div style={{ position: "absolute", inset: "28px", border: "1px dashed rgba(230,46,4,0.12)", borderRadius: "50%", animation: "htx-spin 18s linear infinite reverse" }}/>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#e62e04" strokeWidth="1.2" opacity="0.8">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="M9 12l2 2 4-4"/>
                  </svg>
                </div>
                {/* Floating badges */}
                {[
                  { label: "KYC", top: "0%", left: "70%", delay: "0s" },
                  { label: "SSL", top: "75%", left: "70%", delay: "0.3s" },
                  { label: "2FA", top: "40%", left: "-20%", delay: "0.6s" },
                ].map(b => (
                  <div key={b.label} style={{ position: "absolute", top: b.top, left: b.left, background: "rgba(12,2,6,0.9)", border: "1px solid rgba(230,46,4,0.25)", borderRadius: "8px", padding: "6px 10px", fontSize: "10px", fontWeight: 800, color: "#fff", letterSpacing: "0.1em", animation: `htx-float ${3 + parseFloat(b.delay)}s ease-in-out infinite`, animationDelay: b.delay }}>
                    {b.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section id="pri" style={{ padding: "0 24px 100px", position: "relative", zIndex: 10 }}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "52px" }}>
            <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", color: "#e62e04", textTransform: "uppercase", marginBottom: "16px" }}>Transparent & San Sipriz</div>
            <h2 style={{ fontSize: "clamp(28px,4.5vw,46px)", fontWeight: 900, letterSpacing: "-0.04em", color: "#fff", marginBottom: "14px" }}>
              Frè ki klè, pri ki jis.
            </h2>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", lineHeight: 1.7 }}>
              Majòrite fonksyon yo gratis. Nou fè lajan lè sèvis la kreye valè reyèl pou biznis ou.
            </p>
          </div>
          <div style={{ background: "rgba(12,2,6,0.7)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "20px", overflow: "hidden", backdropFilter: "blur(16px)" }}>
            <div style={{ padding: "0 32px" }}>
              {[
                { op: "Tranzaksyon P2P (ant itilizatè)", val: "Gratis", hi: true },
                { op: "Peman bay machann ak kat", val: "Gratis", hi: true },
                { op: "Rechaj kat vityèl", val: "Gratis", hi: true },
                { op: "Depo ", val: "5%", hi: false },
                { op: "Retrè", val: "5%", hi: false },
                { op: "Kreye kont ak verifikasyon KYC", val: "Gratis", hi: true },
                { op: "Smart Invoice & QR Kòd", val: "Gratis", hi: true },
                { op: "Accès API & Plugin", val: "Gratis", hi: true },
              ].map(row => (
                <div key={row.op} className="price-row">
                  <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>{row.op}</span>
                  <span style={{ fontSize: "14px", fontWeight: 800, color: row.hi ? "#22c55e" : "#fff", letterSpacing: "-0.01em" }}>{row.val}</span>
                </div>
              ))}
            </div>
            <div style={{ background: "rgba(230,46,4,0.05)", borderTop: "1px solid rgba(230,46,4,0.15)", padding: "20px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>Kont gratis. Pare nan 2 minit. Pa gen frè kache.</span>
              <Link href="/signup" className="htx-btn-primary" style={{ fontSize: "13px", padding: "10px 20px", borderRadius: "8px" }}>
                Kòmanse Gratis
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section style={{ padding: "0 24px 100px", position: "relative", zIndex: 10 }}>
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", color: "#e62e04", textTransform: "uppercase", marginBottom: "16px" }}>Support</div>
            <h2 style={{ fontSize: "clamp(26px,4vw,42px)", fontWeight: 900, letterSpacing: "-0.04em", color: "#fff", marginBottom: "12px" }}>
              Kesyon yo poze souvan.
            </h2>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)" }}>Pa jwenn repons ou a? Kontakte ekip nou dirèkteman.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {faqs.map((faq, index) => (
              <div
                key={index}
                className={`htx-faq${activeFaq === index ? " open" : ""}`}
                onClick={() => setActiveFaq(activeFaq === index ? null : index)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
                  <h4 style={{ fontSize: "14px", fontWeight: 700, color: activeFaq === index ? "#fff" : "rgba(255,255,255,0.75)", margin: 0, lineHeight: 1.4 }}>{faq.q}</h4>
                  <div style={{ transform: activeFaq === index ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s", flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={activeFaq === index ? "#e62e04" : "rgba(255,255,255,0.3)"} strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </div>
                <div style={{ maxHeight: activeFaq === index ? "300px" : "0", overflow: "hidden", transition: "max-height 0.3s ease", opacity: activeFaq === index ? 1 : 0 }}>
                  <p style={{ paddingTop: "14px", margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>
                    {faq.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA FINAL ═══ */}
      <section style={{ padding: "0 24px 100px", position: "relative", zIndex: 10 }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", background: "linear-gradient(135deg, rgba(180,0,20,0.12), rgba(60,0,8,0.08))", border: "1px solid rgba(230,46,4,0.16)", borderRadius: "28px", padding: "72px 48px", textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "400px", height: "2px", background: "linear-gradient(90deg,transparent,rgba(230,46,4,0.5),transparent)" }}/>
          <div style={{ position: "absolute", top: "0%", left: "50%", transform: "translateX(-50%)", width: "600px", height: "200px", background: "radial-gradient(ellipse, rgba(180,0,20,0.1) 0%, transparent 70%)", filter: "blur(40px)" }}/>
          <div style={{ position: "relative" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 14px", borderRadius: "100px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.18)", marginBottom: "24px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", animation: "htx-pulse 2s ease-in-out infinite" }}/>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(100,220,140,0.8)", letterSpacing: "0.15em" }}>PLATFÒM OPERASYONÈL</span>
            </div>
            <h2 style={{ fontSize: "clamp(32px,5vw,56px)", fontWeight: 900, letterSpacing: "-0.045em", lineHeight: 1.05, marginBottom: "18px", color: "#fff" }}>
              Kòmanse resevwa<br />lajan <span style={{ color: "#e62e04" }}>jodi a menm.</span>
            </h2>
            <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.4)", marginBottom: "40px", lineHeight: 1.7, maxWidth: "480px", margin: "0 auto 40px" }}>
              Kont gratis. Konfirmasyon KYC nan 2 a 60 minit. Premye tranzaksyon ou pare imedyatman apre verifikasyon.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "12px" }}>
              <Link href="/signup" className="htx-btn-primary" style={{ fontSize: "15px", padding: "14px 32px", borderRadius: "10px" }}>
                Ouvri Kont Gratis
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
              <Link href="/login" className="htx-btn-secondary" style={{ fontSize: "15px", padding: "14px 32px", borderRadius: "10px" }}>
                Konekte nan Kont Ou
              </Link>
              <a href="/HatexCard.apk" download="HatexCard_v1.0.apk" className="htx-btn-secondary" style={{ fontSize: "15px", padding: "14px 32px", borderRadius: "10px" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(230,46,4,0.8)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Telechaje App Android
              </a>
            </div>
          </div>
        </div>
      </section>

 {/* ═══ FOOTER ═══ */}
 <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", position: "relative", zIndex: 10 }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "60px 24px 40px" }}>
          
          {/* Top row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "48px", marginBottom: "56px" }}>
            
            {/* Brand col */}
            <div style={{ flex: "0 0 260px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "9px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {/* LOGO HATEXCARD LA */}
                  <img src="https://i.imgur.com/xDk58Xk.png" alt="HatexCard Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <span style={{ fontWeight: 900, fontSize: "16px", letterSpacing: "-0.04em" }}>HATEX<span style={{ color: "#e62e04" }}>CARD</span></span>
              </div>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", lineHeight: 1.7, margin: "0 0 20px" }}>
                Platfòm peman digital 100% an Goud. Fèt pou Ayiti, konstwi pou rès la.
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                
                {/* Social icons - Ak lyen ofisyèl yo */}
                <a href="https://twitter.com/hatexcard" target="_blank" rel="noopener noreferrer" style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)", transition: "all 0.2s" }} className="hover:text-white hover:border-white/20">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.766l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href="https://facebook.com/hatexcard" target="_blank" rel="noopener noreferrer" style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)", transition: "all 0.2s" }} className="hover:text-blue-500 hover:border-blue-500/20">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                <a href="https://wa.me/50937201241" target="_blank" rel="noopener noreferrer" style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)", transition: "all 0.2s" }} className="hover:text-green-500 hover:border-green-500/20">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </a>
              </div>
            </div>

            {/* Pwodwi */}
            <div style={{ flex: "1 1 140px" }}>
              <div style={{ fontSize: "11px", fontWeight: 800, color: "rgba(255,255,255,0.6)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "16px" }}>Pwodwi</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                <li><a href="/login" style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-white">Kat Vityèl</a></li>
                <li><a href="/login" style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-white">Smart Invoice</a></li>
                <li><a href="/login" style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-white">Peman QR Kòd</a></li>
                <li><a href="/login" style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-white">Abònman Otomatik</a></li>
                <li><a href="/login" style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-white">Sèvis Taksi & Livrezon</a></li>
                <li><a href="/login" style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-white">Transfè Sekirize</a></li>
              </ul>
            </div>

            {/* Devlopè */}
            <div style={{ flex: "1 1 140px" }}>
              <div style={{ fontSize: "11px", fontWeight: 800, color: "rgba(255,255,255,0.6)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "16px" }}>Devlopè</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                <li><a href="/api-docs" style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-white">API Referans</a></li>
                <li><a href="https://github.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-white">Plugin WooCommerce</a></li>
                <li><a href="https://github.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-white">Plugin Hostinger</a></li>
                <li><a href="/sandbox" style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-white">Sandbox & Tès</a></li>
                <li><a href="/changelog" style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-white">Changelog</a></li>
              </ul>
            </div>

            {/* Konpayi */}
            <div style={{ flex: "1 1 140px" }}>
              <div style={{ fontSize: "11px", fontWeight: 800, color: "rgba(255,255,255,0.6)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "16px" }}>Konpayi</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                <li><a href="/sou-nou" style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-white">Sou Nou</a></li>
                <li><a href="/blog" style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-white">Blog</a></li>
                <li><a href="/pres" style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-white">Pres & Medya</a></li>
                <li><a href="/travay" style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-white">Travay ak Nou</a></li>
                <li><a href="mailto:support@hatexcard.com" style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-white">Kontakte</a></li>
              </ul>
            </div>

            {/* Legal - TOUT KONEKTE SOU PAJ POLITIK LA */}
            <div style={{ flex: "1 1 140px" }}>
              <div style={{ fontSize: "11px", fontWeight: 800, color: "rgba(255,255,255,0.6)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "16px" }}>Legal</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                <li><a href="/politik" style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-white">Kondisyon Itilizasyon</a></li>
                <li><a href="/politik" style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-white">Konfidansyalite</a></li>
                <li><a href="/politik" style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-white">Politik Retrè</a></li>
                <li><a href="/politik" style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-white">Politik KYC & AML</a></li>
                <li><a href="/politik" style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", fontWeight: 500, transition: "color 0.15s", textDecoration: "none" }} className="hover:text-white">Sekirite</a></li>
              </ul>
            </div>

          </div>

{/* Bottom bar */}
<div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "24px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)", fontWeight: 600 }}>
              © 2026 Hatexcard. Tout dwa rezève. Platfòm peman an Goud pou Ayiti.
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", animation: "htx-pulse 2.5s ease-in-out infinite" }}/>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em" }}>Tout sistèm operasyonèl</span>
            </div>
          </div>

        </div>
      </footer>
    </div>
  );
}