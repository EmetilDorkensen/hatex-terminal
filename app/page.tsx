"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
    };
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  const cardTiltX = (mousePos.y - 0.5) * 14;
  const cardTiltY = (mousePos.x - 0.5) * -14;

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#08020a" }}>

      {/* ═══ ARRIÈRE-PLAN ATMOSPHÉRIQUE ROUGE/NOIR ═══ */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 120% 80% at 50% -10%, #3d0008 0%, #1a0003 40%, #08020a 100%)" }} />
        <div className="absolute" style={{ top: "5%", left: "50%", transform: "translateX(-50%)", width: "900px", height: "600px", background: "radial-gradient(ellipse, rgba(180,0,30,0.25) 0%, rgba(100,0,15,0.1) 50%, transparent 75%)", filter: "blur(60px)" }} />
        <div className="absolute" style={{ top: "20%", right: "-10%", width: "500px", height: "500px", background: "radial-gradient(ellipse, rgba(220,20,40,0.12) 0%, transparent 70%)", filter: "blur(80px)" }} />
        <div className="absolute" style={{ top: "30%", left: "-10%", width: "400px", height: "400px", background: "radial-gradient(ellipse, rgba(150,0,20,0.1) 0%, transparent 70%)", filter: "blur(70px)" }} />
        <div className="absolute bottom-0 left-0 right-0" style={{ height: "45%", background: "linear-gradient(to top, rgba(180,0,25,0.08) 0%, rgba(100,0,15,0.04) 40%, transparent 100%)" }} />
        {/* Liy orizon luminèz */}
        <div className="absolute left-1/2" style={{ top: "60%", transform: "translateX(-50%)", width: "700px", height: "2px", background: "linear-gradient(90deg, transparent, rgba(230,46,4,0.4), rgba(255,80,40,0.7), rgba(230,46,4,0.4), transparent)", filter: "blur(3px)" }} />
        {/* Patikil */}
        {Array.from({ length: 45 }).map((_, i) => (
          <div key={i} className="absolute rounded-full" style={{ width: (Math.sin(i * 7.3) * 1 + 1.5) + "px", height: (Math.sin(i * 7.3) * 1 + 1.5) + "px", top: (Math.sin(i * 3.7) * 30 + 35) + "%", left: (i / 45 * 100) + "%", background: `rgba(255,${Math.floor(Math.sin(i)*40+40)},${Math.floor(Math.cos(i)*20+20)},${Math.sin(i*2)*0.3+0.3})`, animationName: "htx-twinkle", animationDuration: (Math.sin(i) * 1.5 + 2.5) + "s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", animationDelay: (Math.cos(i) * 1.5) + "s" }} />
        ))}
      </div>

      <style>{`
        @keyframes htx-twinkle { 0%,100%{opacity:0.2} 50%{opacity:0.9} }
        @keyframes htx-float { 0%,100%{transform:perspective(1200px) rotateX(var(--tx,0deg)) rotateY(var(--ty,0deg)) translateY(0px)} 50%{transform:perspective(1200px) rotateX(var(--tx,0deg)) rotateY(var(--ty,0deg)) translateY(-14px)} }
        @keyframes htx-glow { 0%,100%{opacity:0.5} 50%{opacity:1} }
        @keyframes htx-up { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
        @keyframes htx-fade { from{opacity:0} to{opacity:1} }
        .htx-card-float { animation: htx-float 5s ease-in-out infinite; }
        .a1 { animation: htx-up 0.9s cubic-bezier(0.16,1,0.3,1) both; }
        .a2 { animation: htx-up 0.9s 0.12s cubic-bezier(0.16,1,0.3,1) both; }
        .a3 { animation: htx-up 0.9s 0.24s cubic-bezier(0.16,1,0.3,1) both; }
        .a4 { animation: htx-up 0.9s 0.36s cubic-bezier(0.16,1,0.3,1) both; }
        .a5 { animation: htx-fade 1.2s 0.5s both; }
        .phone-anim { animation: htx-up 1s 0.2s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>

      {/* ═══ NAVBAR ═══ */}
      <nav className="relative z-50 flex justify-between items-center px-8 py-5 max-w-7xl mx-auto" style={{ animation: "htx-fade 0.7s both" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#e62e04,#8a1c02)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
          </div>
          <span style={{ fontWeight: 900, fontSize: "18px", letterSpacing: "-0.03em" }}>HATEX<span style={{ color: "#e62e04" }}>CARD</span></span>
        </div>
        <div className="hidden lg:flex gap-8" style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>
          {["Pwodwi", "Pri", "Konpayi", "Resous"].map(l => <a key={l} href="#" className="hover:text-white transition-colors duration-200">{l}</a>)}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hover:text-white transition-colors hidden sm:block" style={{ fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>Konekte</Link>
          <Link href="/signup" className="flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-all hover:scale-105" style={{ fontSize: "13px", background: "linear-gradient(135deg,#e62e04,#b02000)", boxShadow: "0 4px 20px rgba(230,46,4,0.35)" }}>
            <span>+</span> Enskri
          </Link>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="relative z-10 pt-8 px-6">
        <div className="max-w-5xl mx-auto text-center">

          {/* Badge */}
          <div className="a1 inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8" style={{ background: "rgba(230,46,4,0.1)", border: "1px solid rgba(230,46,4,0.25)", fontSize: "12px", fontWeight: 700, color: "rgba(255,200,180,0.9)" }}>
            <span style={{ color: "#e62e04" }}>+</span> Pèsonèl
          </div>

          {/* Titre */}
          <h1 className="a2" style={{ fontSize: "clamp(46px,8vw,86px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.04em", marginBottom: "22px" }}>
            <span style={{ color: "#fff" }}>Fason </span>
            <span style={{ color: "#e84040", fontStyle: "italic" }}>Rapid</span>
            <span style={{ color: "#fff" }}> ak </span>
            <span style={{ color: "#ff9060", fontStyle: "italic" }}>Sekirize</span>
            <br />
            <span style={{ color: "#fff" }}>pou voye lajan</span>
          </h1>

          {/* Sous-titre */}
          <p className="a3" style={{ fontSize: "15px", color: "rgba(255,255,255,0.48)", maxWidth: "400px", margin: "0 auto 34px", lineHeight: 1.7, fontWeight: 500 }}>
            Rejwenn plis pase 12,000 Ayisyen k ap jere lajan yo pi fasil ak HatexCard. San frè kache.
          </p>

          {/* Email CTA */}
          <div className="a4 flex items-center justify-center gap-3 flex-wrap" style={{ marginBottom: "60px" }}>
            <div className="flex items-center rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(10px)" }}>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Adrès imèl ou" style={{ background: "transparent", border: "none", outline: "none", padding: "13px 20px", fontSize: "14px", color: "#fff", width: "220px" }} />
              <button className="flex items-center gap-2 rounded-full transition-all hover:scale-105" style={{ margin: "5px", padding: "10px 20px", background: "linear-gradient(135deg,#e62e04,#b02000)", color: "#fff", fontWeight: 700, fontSize: "13px", border: "none", cursor: "pointer", boxShadow: "0 4px 16px rgba(230,46,4,0.4)" }}>
                <span>+</span> Kòmanse
              </button>
            </div>
          </div>
        </div>

        {/* ═══ KAT + TELEFÒN ═══ */}
        <div className="relative max-w-6xl mx-auto flex items-end justify-center" style={{ minHeight: "520px", gap: "0" }}>

          {/* ── TELEFÒN DASHBOARD (gòch) ── */}
          <div className="phone-anim hidden lg:block" style={{ position: "relative", zIndex: 15, marginRight: "-24px", marginBottom: "0", flexShrink: 0 }}>
            <div style={{ width: "216px", background: "#0d0208", borderRadius: "36px", border: "6px solid #180410", boxShadow: "0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(230,46,4,0.15), inset 0 0 0 1px rgba(255,255,255,0.04)", overflow: "hidden", transform: "perspective(800px) rotateY(8deg) rotateX(3deg)" }}>

              {/* Notch */}
              <div style={{ height: "20px", background: "#0d0208", display: "flex", justifyContent: "center", alignItems: "flex-end", paddingBottom: "4px" }}>
                <div style={{ width: "60px", height: "8px", background: "#150310", borderRadius: "4px" }} />
              </div>

              {/* Header */}
              <div style={{ padding: "10px 14px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "7px", color: "rgba(255,255,255,0.35)", fontWeight: 700, letterSpacing: "0.1em" }}>BYENVINI 🔥</div>
                  <div style={{ fontSize: "11px", color: "#fff", fontWeight: 900, letterSpacing: "0.02em" }}>HatexCard</div>
                </div>
                <div style={{ width: "24px", height: "24px", background: "rgba(230,46,4,0.2)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,100,70,0.8)" strokeWidth="2.5"><path d="M18 20a6 6 0 00-12 0"/><circle cx="12" cy="10" r="4"/></svg>
                </div>
              </div>

              {/* Balans */}
              <div style={{ padding: "4px 14px 10px" }}>
                <div style={{ fontSize: "7px", color: "rgba(255,255,255,0.35)", fontWeight: 700, letterSpacing: "0.15em", marginBottom: "2px" }}>BALANS WALLET</div>
                <div style={{ fontSize: "24px", fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1 }}>3,200<span style={{ fontSize: "10px", color: "#e62e04", marginLeft: "3px" }}>GOUD</span></div>
              </div>

              {/* Aksyon */}
              <div style={{ padding: "0 12px 12px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "5px" }}>
                {[{ l: "DEPO", bg: "#e62e04" }, { l: "RETRÈ", bg: "#e62e04" }, { l: "TRANSFÈ", bg: "#fff", c: "#000" }].map(b => (
                  <div key={b.l} style={{ background: b.bg, color: b.c || "#fff", borderRadius: "10px", padding: "7px 4px", textAlign: "center", fontSize: "7px", fontWeight: 900, letterSpacing: "0.02em" }}>{b.l}</div>
                ))}
              </div>

              {/* Kat vityèl */}
              <div style={{ padding: "0 12px 10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "7px", fontWeight: 900, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>KAT VITYÈL</span>
                  <span style={{ fontSize: "6px", color: "#e62e04", fontWeight: 800 }}>KLIKE POU VIRE</span>
                </div>
                <div style={{ background: "linear-gradient(135deg,#c00015,#8a0010,#3d0008)", borderRadius: "14px", padding: "12px", position: "relative", overflow: "hidden", boxShadow: "0 8px 24px rgba(180,0,20,0.5)", aspectRatio: "1.58/1" }}>
                  <div style={{ position: "absolute", top: "-20%", right: "-10%", width: "70px", height: "70px", borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
                  <div style={{ width: "20px", height: "20px", background: "rgba(0,0,0,0.3)", borderRadius: "5px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "8px" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "10px" }}>
                    <span style={{ fontSize: "7px", fontWeight: 900, color: "rgba(255,255,255,0.65)", letterSpacing: "0.12em" }}>HATEXCARD</span>
                  </div>
                  <div style={{ fontSize: "11px", fontFamily: "monospace", color: "#fff", letterSpacing: "0.1em", marginBottom: "8px", fontWeight: 700 }}>4550 **** **** 8273</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <div>
                      <div style={{ fontSize: "5px", color: "rgba(255,255,255,0.35)", fontWeight: 700, letterSpacing: "0.1em" }}>PWOPRIYETÈ</div>
                      <div style={{ fontSize: "7px", color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>HATEX USER</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "5px", color: "rgba(255,255,255,0.35)", fontWeight: 700 }}>EXP &nbsp;CVV</div>
                      <div style={{ fontSize: "7px", color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>01/30 &nbsp;•••</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Aktivite */}
              <div style={{ padding: "0 12px 10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "7px", fontWeight: 900, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em" }}>DÈNYE AKTIVITE</span>
                  <span style={{ fontSize: "6px", color: "#e62e04", fontWeight: 800 }}>WÈ TOUT</span>
                </div>
                {[{ ic: "📄", lb: "HAT... - HATEX INVOICE", am: "+1 000 HTG" }, { ic: "📄", lb: "HATEXCARD@GMAIL.COM", am: "+5 HTG" }].map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", background: "rgba(255,255,255,0.04)", borderRadius: "8px", marginBottom: "4px", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div style={{ width: "18px", height: "18px", background: "rgba(255,255,255,0.07)", borderRadius: "5px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px" }}>{item.ic}</div>
                      <span style={{ fontSize: "6px", color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>{item.lb}</span>
                    </div>
                    <span style={{ fontSize: "7px", fontWeight: 900, color: "#22c55e" }}>{item.am}</span>
                  </div>
                ))}
              </div>

              {/* Nav bar anba */}
              <div style={{ display: "flex", justifyContent: "space-around", padding: "8px 0 10px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                {["AKEY", "KAT", "", "ISTORIK", "SOTI"].map((lbl, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: "2px" }}>
                    {i === 2 ? (
                      <div style={{ width: "28px", height: "28px", background: "#e62e04", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginTop: "-14px", boxShadow: "0 4px 12px rgba(230,46,4,0.5)" }}>
                        <span style={{ color: "#fff", fontWeight: 900, fontSize: "13px" }}>T</span>
                      </div>
                    ) : (
                      <>
                        <div style={{ width: "3px", height: "3px", borderRadius: "50%", background: i === 0 ? "#e62e04" : "rgba(255,255,255,0.15)" }} />
                        <span style={{ fontSize: "5px", color: i === 0 ? "#e62e04" : "rgba(255,255,255,0.25)", fontWeight: 800 }}>{lbl}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── KAT PRINSIPAL FLOTTAN (sant) ── */}
          <div className="a4" style={{ position: "relative", zIndex: 20, display: "flex", flexDirection: "column" as const, alignItems: "center" }}>
            {/* Luè refleksyon anba */}
            <div style={{ position: "absolute", bottom: "-30px", left: "50%", transform: "translateX(-50%)", width: "400px", height: "80px", background: "radial-gradient(ellipse, rgba(230,46,4,0.3) 0%, transparent 70%)", filter: "blur(20px)", animationName: "htx-glow", animationDuration: "3s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite" }} />
            {/* Rayon limyè anwo */}
            <div style={{ position: "absolute", top: "-100px", left: "50%", transform: "translateX(-50%)", width: "200px", height: "200px", background: "radial-gradient(ellipse, rgba(255,100,50,0.18) 0%, transparent 70%)", filter: "blur(30px)", animationName: "htx-glow", animationDuration: "2.5s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite" }} />

            {/* KAT LA */}
            <div
              className="htx-card-float"
              style={{
                "--tx": `${cardTiltX}deg`,
                "--ty": `${cardTiltY}deg`,
                width: "370px",
                aspectRatio: "1.586/1",
                borderRadius: "24px",
                background: "linear-gradient(135deg, #c8001a 0%, #7a0010 40%, #2d0006 80%, #180003 100%)",
                boxShadow: "0 40px 80px rgba(0,0,0,0.7), 0 0 60px rgba(180,0,20,0.3), 0 0 120px rgba(180,0,20,0.12), inset 0 1px 0 rgba(255,255,255,0.12)",
                padding: "28px 32px",
                position: "relative",
                overflow: "hidden",
                transformStyle: "preserve-3d",
              } as React.CSSProperties}
            >
              {/* Sèk dekoratif */}
              <div style={{ position: "absolute", top: "-30%", right: "-15%", width: "280px", height: "280px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.05)" }} />
              <div style={{ position: "absolute", top: "-20%", right: "-5%", width: "200px", height: "200px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.04)" }} />
              <div style={{ position: "absolute", bottom: "-20%", left: "-10%", width: "160px", height: "160px", borderRadius: "50%", background: "rgba(255,255,255,0.025)" }} />

              {/* Chip */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
                <div style={{ width: "44px", height: "34px", background: "linear-gradient(135deg,rgba(255,210,100,0.4),rgba(200,160,60,0.25))", borderRadius: "6px", border: "1px solid rgba(255,200,80,0.2)" }} />
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "11px", fontWeight: 900, color: "rgba(255,255,255,0.65)", letterSpacing: "0.2em" }}>HATEXCARD</div>
                  <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.28)", fontWeight: 600, marginTop: "2px" }}>PREMIUM</div>
                </div>
              </div>

              {/* Nimewo */}
              <div style={{ fontSize: "21px", fontFamily: "monospace", color: "rgba(255,255,255,0.88)", letterSpacing: "0.18em", marginBottom: "24px", fontWeight: 600, textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
                4550 **** **** 8273
              </div>

              {/* Enfò anba */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.32)", fontWeight: 700, letterSpacing: "0.15em", marginBottom: "4px" }}>PWOPRIYETÈ</div>
                  <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.78)", fontWeight: 700, letterSpacing: "0.06em" }}>HATEX USER</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.32)", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "4px" }}>EXP DATE</div>
                  <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.78)", fontWeight: 700 }}>01/30</div>
                </div>
              </div>

              {/* Reflet sou kat la */}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%, rgba(255,255,255,0.02) 100%)", borderRadius: "24px", pointerEvents: "none" }} />
            </div>

            {/* Refleksyon "dlo" */}
            <div style={{ width: "370px", aspectRatio: "1.586/1", borderRadius: "24px", background: "linear-gradient(to bottom, rgba(180,0,20,0.12) 0%, transparent 100%)", transform: "scaleY(-0.3) translateY(-8px)", transformOrigin: "top center", filter: "blur(4px)", maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.35), transparent)", WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.35), transparent)" }} />
          </div>

          {/* Stats flottan — adwat */}
          <div className="hidden xl:flex flex-col gap-4 phone-anim" style={{ marginLeft: "40px", marginBottom: "80px" }}>
            {[{ i: "⚡", l: "Transfè Rapid", v: "< 10 sek" }, { i: "🔒", l: "Sekirite SSL", v: "256-bit" }, { i: "🇭🇹", l: "100% Ayisyen", v: "Fè an Ayiti" }].map(s => (
              <div key={s.l} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "14px 18px", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", gap: "12px", minWidth: "175px" }}>
                <span style={{ fontSize: "20px" }}>{s.i}</span>
                <div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>{s.l}</div>
                  <div style={{ fontSize: "14px", color: "#fff", fontWeight: 800 }}>{s.v}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Patènè */}
        <div className="a5" style={{ paddingTop: "44px", paddingBottom: "44px", textAlign: "center" }}>
          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.22)", fontWeight: 700, letterSpacing: "0.2em", marginBottom: "18px", textTransform: "uppercase" }}>Fè konfyans pa</p>
          <div className="flex flex-wrap items-center justify-center gap-8" style={{ opacity: 0.3 }}>
            {["MonCash", "NatCash", "Unibank", "BNC", "BRH", "Sogebank"].map(n => (
              <span key={n} style={{ fontSize: "14px", fontWeight: 800, color: "#fff", letterSpacing: "0.05em" }}>{n}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section style={{ padding: "80px 24px", position: "relative", zIndex: 10 }}>
        <div className="max-w-5xl mx-auto">
          <div style={{ textAlign: "center", marginBottom: "52px" }}>
            <h2 style={{ fontSize: "clamp(30px,5vw,50px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.1, marginBottom: "14px", color: "#fff" }}>
              Tout sa ou bezwen pou{" "}
              <span style={{ color: "#e62e04", fontStyle: "italic" }}>jere lajan ou</span>
            </h2>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.42)", maxWidth: "380px", margin: "0 auto", lineHeight: 1.7 }}>
              Yon sèl platfòm — rapid, sekirize, san tèt chake.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { ic: "💳", ti: "Kat Vityèl Imediyan", ds: "Resevwa kat ou imedyatman apre KYC. Peye online nenpòt kote nan mond lan.", tg: "GRATIS", ft: false },
              { ic: "⚡", ti: "Transfè Enstan", ds: "Voye lajan bay nenpòt moun an Ayiti an mwens ke 10 segond. 24/7, menm jou fèt.", tg: "RAPID", ft: true },
              { ic: "🏪", ti: "SDK pou Biznis", ds: "Entegre pèman HTG sou sit ou an 5 minit. WooCommerce, Shopify, nenpòt platfòm.", tg: "API", ft: false },
            ].map(f => (
              <div key={f.ti} style={{ background: f.ft ? "linear-gradient(135deg,rgba(180,0,20,0.18),rgba(80,0,10,0.12))" : "rgba(255,255,255,0.03)", border: f.ft ? "1px solid rgba(230,46,4,0.28)" : "1px solid rgba(255,255,255,0.07)", borderRadius: "24px", padding: "32px", transition: "transform 0.3s" }} onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)"; }} onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
                  <span style={{ fontSize: "26px" }}>{f.ic}</span>
                  <span style={{ fontSize: "9px", fontWeight: 800, padding: "3px 10px", borderRadius: "20px", background: f.ft ? "rgba(230,46,4,0.28)" : "rgba(255,255,255,0.07)", color: f.ft ? "#ff8060" : "rgba(255,255,255,0.35)", letterSpacing: "0.12em" }}>{f.tg}</span>
                </div>
                <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#fff", marginBottom: "10px", letterSpacing: "-0.02em" }}>{f.ti}</h3>
                <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.42)", lineHeight: 1.7 }}>{f.ds}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA FINAL ═══ */}
      <section style={{ padding: "60px 24px 100px", position: "relative", zIndex: 10 }}>
        <div className="max-w-2xl mx-auto text-center" style={{ background: "linear-gradient(135deg,rgba(180,0,20,0.14),rgba(80,0,10,0.1))", border: "1px solid rgba(230,46,4,0.18)", borderRadius: "32px", padding: "60px 40px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "300px", height: "2px", background: "linear-gradient(90deg,transparent,rgba(230,46,4,0.6),transparent)" }} />
          <div style={{ position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)", width: "400px", height: "200px", background: "radial-gradient(ellipse, rgba(180,0,20,0.12) 0%, transparent 70%)", filter: "blur(30px)" }} />
          <div className="inline-flex items-center gap-2 rounded-full mb-6" style={{ background: "rgba(230,46,4,0.1)", border: "1px solid rgba(230,46,4,0.2)", padding: "6px 16px" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", animationName: "htx-twinkle", animationDuration: "2s", animationIterationCount: "infinite" }} />
            <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,180,150,0.8)", letterSpacing: "0.15em" }}>KONT GRATIS — TOUJOU</span>
          </div>
          <h2 style={{ fontSize: "clamp(30px,5vw,50px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.1, marginBottom: "14px", color: "#fff", position: "relative" }}>
            Kòmanse <span style={{ color: "#e62e04", fontStyle: "italic" }}>jodi a.</span>
          </h2>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.42)", marginBottom: "34px", lineHeight: 1.7, position: "relative" }}>
            Plis pase 12,000 Ayisyen déjà ladan. San frè kache, san surpriz.
          </p>
          <div className="flex flex-wrap justify-center gap-3" style={{ position: "relative" }}>
            <Link href="/signup" className="flex items-center gap-2 rounded-full font-bold transition-all hover:scale-105" style={{ padding: "14px 28px", fontSize: "14px", background: "linear-gradient(135deg,#e62e04,#b02000)", color: "#fff", boxShadow: "0 8px 30px rgba(230,46,4,0.4)" }}>
              <span>+</span> Ouvri Kont Gratis
            </Link>
            <Link href="/login" className="flex items-center rounded-full font-bold transition-all" style={{ padding: "14px 28px", fontSize: "14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)" }}>
              Konekte nan Kont Ou
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "36px 24px", position: "relative", zIndex: 10 }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "#e62e04" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
            </div>
            <span style={{ fontWeight: 900, fontSize: "15px", letterSpacing: "-0.03em" }}>HATEX<span style={{ color: "#e62e04" }}>CARD</span></span>
          </div>
          <div className="flex gap-6" style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.32)" }}>
            {["Sou Nou", "Kontakte", "Konfidansyalite", "Kondisyon"].map(l => <a key={l} href="#" className="hover:text-white transition-colors">{l}</a>)}
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e" }} />
            <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.22)", letterSpacing: "0.1em" }}>© 2026 HATEXCARD · SISTÈM OPERASYONÈL</span>
          </div>
        </div>
      </footer>
    </div>
  );
}