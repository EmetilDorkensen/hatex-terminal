"use client";
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export default function AutoLogout() {
  const router = useRouter();
  const pathname = usePathname();
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    // Nou chwazi ki paj ki bezwen gadyen sa a (paj kote lajan ye yo)
    const protectedRoutes = ['/dashboard', '/transfert', '/withdraw', '/kat', '/setting'];
    
    // Si l pa sou paj sa yo (tankou login oswa signup), pa fè anyen
    if (!protectedRoutes.includes(pathname)) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      
      // 15 Minit san fè anyen = 900000 milisegonn (Ou ka met 5 minit si w vle: 300000)
      timeoutId = setTimeout(async () => {
        await supabase.auth.signOut();
        alert("🔒 Sistèm nan fèmen otomatikman paske w fè twòp tan san w pa fè okenn aktivite. Pou pwoteje lajan w, tanpri konekte ankò.");
        router.push('/login');
      }, 900000); 
    };

    // Aktivite n ap veye yo pou nou konnen moun nan la
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    
    // Chak fwa l fè youn nan bagay sa yo, nou remete revèy la a zewo
    events.forEach(event => window.addEventListener(event, resetTimer));
    
    // Demare revèy la premye fwa a
    resetTimer(); 

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [pathname, router, supabase]);

  // Konpozan sa a pa afiche anyen sou ekran an, li travay nan fènwa
  return null; 
}