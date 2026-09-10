"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Plug,
  History,
  Settings,
  Menu,
  Headset,
  Briefcase,
  Loader2,
  Lock,
  X,
  Receipt,
  Code2,
  Bell,
  Package,
} from 'lucide-react';
import SafeImg from '@/components/SafeImg';

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Akèy', icon: <Home size={18} /> },
  { href: '/notifikasyon', label: 'Notifikasyon', icon: <Bell size={18} /> },
  { href: '/dashboard/products', label: 'Pwodwi', icon: <Package size={18} /> },
  { href: '/plugin', label: 'Plugin', icon: <Plug size={18} /> },
  { href: '/invoice', label: 'Fakti', icon: <Receipt size={18} /> },
  { href: '/developer', label: 'API', icon: <Code2 size={18} /> },
  { href: '/transactions', label: 'Istorik', icon: <History size={18} /> },
  { href: '/support', label: 'Sipò', icon: <Headset size={18} /> },
  { href: '/setting', label: 'Paramèt', icon: <Settings size={18} /> },
];

const BOTTOM: NavItem[] = [
  { href: '/dashboard', label: 'Akèy', icon: <Home size={20} /> },
  { href: '/notifikasyon', label: 'Notif', icon: <Bell size={20} /> },
  { href: '/transactions', label: 'Istorik', icon: <History size={20} /> },
  { href: '/setting', label: 'Paramèt', icon: <Settings size={20} /> },
];

function isActive(path: string, href: string) {
  if (href === '/dashboard') return path === '/dashboard';
  return path === href || path.startsWith(`${href}/`);
}

export function MerchantShell({
  user,
  staffRecord,
  isAdmin,
  isLoggingAdmin,
  onOpenWorkspace,
  onOpenAdmin,
  hideTopChrome = false,
  children,
}: {
  user: { id?: string; full_name?: string; email?: string; avatar_url?: string } | null;
  staffRecord?: unknown;
  isAdmin?: boolean;
  isLoggingAdmin?: boolean;
  onOpenWorkspace?: () => void;
  onOpenAdmin?: () => void;
  /** Dashboard Meru-style: kache header anwo, kenbe meni + nav anba. */
  hideTopChrome?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || '/dashboard';
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-[#F5F6FA] text-slate-900 font-sans flex flex-col">
      {isMenuOpen && (
        <div className="fixed inset-0 z-[300] flex">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            aria-label="Fèmen meni"
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="relative w-72 bg-white h-full shadow-2xl flex flex-col border-r border-gray-200 z-10">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-slate-50">
              <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setIsMenuOpen(false)}>
                <img
                  src="https://i.imgur.com/xDk58Xk.png"
                  alt="Hatexcard"
                  className="w-9 h-9 rounded-lg object-cover border border-gray-200"
                />
                <span className="font-bold text-xl text-slate-900 tracking-tight">Hatexcard</span>
              </Link>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="text-slate-400 hover:text-slate-700 bg-white rounded-full p-1 border border-gray-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 border-b border-gray-100 flex items-center gap-3 bg-slate-50/50">
              <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-bold text-lg overflow-hidden">
                {user?.avatar_url ? (
                  <SafeImg src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  user?.full_name?.charAt(0).toUpperCase() || 'U'
                )}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm truncate w-36">
                  {user?.full_name || 'Machann'}
                </h3>
                <p className="text-[10px] text-slate-500 font-medium truncate w-36">{user?.email}</p>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">
                Pasèl peman
              </p>
              {NAV.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-medium transition-all ${
                      active
                        ? 'text-indigo-700 bg-indigo-50 border border-indigo-100 font-semibold'
                        : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
                    }`}
                  >
                    {item.icon} {item.label}
                  </Link>
                );
              })}

              {Boolean(staffRecord) && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenWorkspace?.();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-bold uppercase tracking-wider text-[10px] border border-indigo-100 mt-4"
                >
                  <Lock size={16} /> Aksè Espas Travay
                </button>
              )}

              {isAdmin && (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  disabled={isLoggingAdmin}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 font-bold uppercase tracking-wider text-[10px] border border-rose-100 mt-2 disabled:opacity-50"
                >
                  {isLoggingAdmin ? <Loader2 size={16} className="animate-spin" /> : <Briefcase size={16} />}
                  Admin
                </button>
              )}
            </nav>
          </div>
        </div>
      )}

      {!hideTopChrome && (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-[100] shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16 gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(true)}
                  className="lg:hidden text-slate-500 hover:text-indigo-600 p-1 rounded-md hover:bg-slate-100"
                  aria-label="Ouvri meni"
                >
                  <Menu size={24} />
                </button>
                <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
                  <img
                    src="https://i.imgur.com/xDk58Xk.png"
                    alt="Hatexcard"
                    className="w-8 h-8 rounded-lg object-cover border border-gray-200"
                  />
                  <span className="font-bold text-xl text-slate-900 tracking-tight hidden sm:block">
                    Hatexcard
                  </span>
                </Link>
              </div>

              <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
                {NAV.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        active
                          ? 'text-indigo-700 bg-indigo-50'
                          : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="w-9 h-9 rounded-full bg-slate-200 border border-slate-300 overflow-hidden flex items-center justify-center text-slate-600 font-bold shrink-0">
                {user?.avatar_url ? (
                  <SafeImg src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  user?.full_name?.charAt(0) || 'U'
                )}
              </div>
            </div>
          </div>
        </header>
      )}

      {hideTopChrome && (
        <>
          {/* Desktop: nav orizontal pwofesyonèl */}
          <header className="hidden lg:block bg-white/90 backdrop-blur border-b border-gray-200 sticky top-0 z-[100]">
            <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-14 gap-4">
              <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
                <img
                  src="https://i.imgur.com/xDk58Xk.png"
                  alt="Hatexcard"
                  className="w-8 h-8 rounded-lg object-cover border border-gray-200"
                />
                <span className="font-bold text-lg text-slate-900 tracking-tight">Hatexcard</span>
              </Link>
              <nav className="flex items-center gap-1 flex-1 justify-center">
                {NAV.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                        active
                          ? 'text-indigo-700 bg-indigo-50'
                          : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="w-9 h-9 rounded-full bg-slate-200 border border-slate-300 overflow-hidden flex items-center justify-center text-slate-600 font-bold shrink-0">
                {user?.avatar_url ? (
                  <SafeImg src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  user?.full_name?.charAt(0) || 'U'
                )}
              </div>
            </div>
          </header>

          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            className="fixed top-4 right-4 z-[120] w-10 h-10 rounded-full bg-white/90 border border-gray-200 shadow-sm flex items-center justify-center text-slate-600 hover:text-indigo-600 lg:hidden"
            aria-label="Meni"
          >
            <Menu size={20} />
          </button>
        </>
      )}

      {children}

      {hideTopChrome && (
        <nav className="fixed bottom-0 inset-x-0 z-[100] bg-white/95 backdrop-blur border-t border-gray-200 safe-pb lg:hidden">
          <div className="max-w-lg mx-auto grid grid-cols-4 px-2 py-2">
            {BOTTOM.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center gap-0.5 py-1.5 rounded-xl text-[10px] font-bold ${
                    active ? 'text-indigo-600' : 'text-slate-400'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
