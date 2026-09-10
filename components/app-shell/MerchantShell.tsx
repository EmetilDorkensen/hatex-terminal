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

function NavLinks({
  pathname,
  onNavigate,
  compact = false,
}: {
  pathname: string;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  return (
    <>
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg font-medium transition-colors ${
              compact ? 'px-3 py-2.5 text-[13px]' : 'px-4 py-3.5 text-sm'
            } ${
              active
                ? 'text-[#1d4ed8] bg-[#eff6ff] font-semibold'
                : 'text-slate-600 hover:text-[#1d4ed8] hover:bg-slate-50'
            }`}
          >
            <span className={active ? 'text-[#1d4ed8]' : 'text-slate-400'}>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </>
  );
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
  hideTopChrome?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || '/dashboard';
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const sidebarExtras = (
    <>
      {Boolean(staffRecord) && (
        <button
          type="button"
          onClick={() => {
            onOpenWorkspace?.();
            setIsMenuOpen(false);
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#1d4ed8] bg-[#eff6ff] hover:bg-blue-100 text-[12px] font-semibold mt-3"
        >
          <Lock size={16} /> Espas Travay
        </button>
      )}
      {isAdmin && (
        <button
          type="button"
          onClick={onOpenAdmin}
          disabled={isLoggingAdmin}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 text-[12px] font-semibold mt-2 disabled:opacity-50"
        >
          {isLoggingAdmin ? <Loader2 size={16} className="animate-spin" /> : <Briefcase size={16} />}
          Admin
        </button>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-900 font-sans">
      {/* Mobile drawer */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[300] flex lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Fèmen meni"
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="relative w-[280px] bg-white h-full shadow-2xl flex flex-col border-r border-gray-200 z-10">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <Link href="/dashboard" className="flex items-center gap-2.5" onClick={() => setIsMenuOpen(false)}>
                <img
                  src="https://i.imgur.com/xDk58Xk.png"
                  alt="Hatexcard"
                  className="w-8 h-8 rounded-lg object-cover"
                />
                <span className="font-bold text-lg tracking-tight">Hatexcard</span>
              </Link>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-4 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 bg-[#1d4ed8] text-white rounded-full flex items-center justify-center font-bold overflow-hidden">
                {user?.avatar_url ? (
                  <SafeImg src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  user?.full_name?.charAt(0).toUpperCase() || 'U'
                )}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{user?.full_name || 'Machann'}</p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-3">Meni</p>
              <NavLinks pathname={pathname} onNavigate={() => setIsMenuOpen(false)} compact />
              {sidebarExtras}
            </nav>
          </div>
        </div>
      )}

      {/* Desktop left sidebar — Authorize.net style */}
      {hideTopChrome && (
        <aside className="hidden lg:flex fixed inset-y-0 left-0 z-[100] w-[232px] xl:w-[248px] bg-white border-r border-gray-200 flex-col">
          <div className="h-14 px-5 flex items-center border-b border-gray-100">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <img
                src="https://i.imgur.com/xDk58Xk.png"
                alt="Hatexcard"
                className="w-8 h-8 rounded-lg object-cover"
              />
              <span className="font-bold text-[17px] tracking-tight text-slate-900">Hatexcard</span>
            </Link>
          </div>
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-3">Espas travay</p>
            <NavLinks pathname={pathname} compact />
            {sidebarExtras}
          </nav>
          <div className="p-4 border-t border-gray-100 flex items-center gap-3">
            <div className="w-9 h-9 bg-[#1d4ed8] text-white rounded-full flex items-center justify-center font-bold text-sm overflow-hidden shrink-0">
              {user?.avatar_url ? (
                <SafeImg src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                user?.full_name?.charAt(0).toUpperCase() || 'U'
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold truncate">{user?.full_name || 'Machann'}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
        </aside>
      )}

      {!hideTopChrome && (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-[100]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-14 gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(true)}
                  className="lg:hidden text-slate-500 hover:text-[#1d4ed8] p-1"
                  aria-label="Ouvri meni"
                >
                  <Menu size={22} />
                </button>
                <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
                  <img
                    src="https://i.imgur.com/xDk58Xk.png"
                    alt="Hatexcard"
                    className="w-8 h-8 rounded-lg object-cover"
                  />
                  <span className="font-bold text-lg tracking-tight hidden sm:block">Hatexcard</span>
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
                          ? 'text-[#1d4ed8] bg-[#eff6ff]'
                          : 'text-slate-600 hover:text-[#1d4ed8] hover:bg-slate-50'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="w-9 h-9 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center text-slate-600 font-bold shrink-0">
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

      <div className={hideTopChrome ? 'lg:pl-[232px] xl:pl-[248px] min-h-screen flex flex-col' : 'min-h-screen flex flex-col'}>
        {hideTopChrome && (
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            className="fixed top-3 left-3 z-[120] w-10 h-10 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center text-slate-600 hover:text-[#1d4ed8] lg:hidden"
            aria-label="Meni"
          >
            <Menu size={20} />
          </button>
        )}

        {children}

        {hideTopChrome && (
          <nav className="fixed bottom-0 inset-x-0 z-[100] bg-white/95 backdrop-blur border-t border-gray-200 safe-pb lg:hidden">
            <div className="max-w-lg mx-auto grid grid-cols-4 px-2 py-1.5">
              {BOTTOM.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex flex-col items-center gap-0.5 py-1.5 rounded-xl text-[10px] font-semibold ${
                      active ? 'text-[#1d4ed8]' : 'text-slate-400'
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
    </div>
  );
}
