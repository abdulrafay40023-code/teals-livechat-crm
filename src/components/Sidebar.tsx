'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Radio, MessageSquare, Archive } from 'lucide-react';

interface SidebarProps {
  liveCount: number;
  chatCount: number;
  pendingAgentsCount: number;
  isAdmin?: boolean;
  unreadCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  liveCount,
  chatCount,
  isAdmin = false,
}) => {
  const pathname = usePathname();
  const [searchStr, setSearchStr] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search) {
      setSearchStr(window.location.search);
    }
  }, []);

  const navItems = [
    {
      name: 'Dashboard',
      shortName: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      badge: null,
      exact: true,
      adminOnly: false
    },
    {
      name: 'Monitoring',
      shortName: 'Live',
      href: '/dashboard/monitoring',
      icon: Radio,
      badge: liveCount > 0 ? liveCount : null,
      badgeColor: 'bg-brand-emerald text-dark-bg',
      adminOnly: false
    },
    {
      name: 'Active Chats',
      shortName: 'Chats',
      href: '/dashboard/chats',
      icon: MessageSquare,
      badge: chatCount > 0 ? chatCount : null,
      badgeColor: 'bg-rose-500 text-white shadow-md shadow-rose-500/30 font-bold animate-pulse',
      adminOnly: false
    },
    {
      name: 'All Chats Save Page',
      shortName: 'Saved',
      href: '/dashboard/saved-chats',
      icon: Archive,
      badge: null,
      adminOnly: false
    }
  ];

  const visibleItems = navItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <>
      {/* Desktop Sidebar (md and up) */}
      <aside className="hidden md:flex w-60 bg-[#0a0f1d] border-r border-dark-border flex-col justify-between select-none shrink-0">
        <div>
          {/* Brand */}
          <div className="h-16 flex items-center space-x-3 px-5 border-b border-dark-border">
            <img
              src="/icon-192.png"
              alt="Teals Logo"
              className="w-9 h-9 rounded-xl object-cover shadow-lg border border-dark-border shrink-0"
            />
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Teals LiveChat</h2>
              <p className="text-[10px] text-dark-muted">CRM AI Sales Hub</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1.5 mt-2">
            {visibleItems.map((item) => {
              const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={`${item.href}${searchStr}`}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/25'
                      : 'text-dark-muted hover:text-white hover:bg-dark-cardHover'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-dark-muted'}`} />
                    <span>{item.name}</span>
                  </div>
                  {item.badge !== null && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer System Status */}
        <div className="p-4 border-t border-dark-border/80">
          <div className="bg-dark-card/60 border border-dark-border/60 rounded-xl p-3 flex items-center space-x-2.5">
            <span className="w-2 h-2 rounded-full bg-brand-emerald animate-ping" />
            <div>
              <div className="text-[11px] font-bold text-white">System 100% Live</div>
              <div className="text-[10px] text-dark-muted">Real-Time WebSockets</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar (< md) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#080d1a]/95 backdrop-blur-xl border-t border-dark-border px-2 py-1.5 grid grid-cols-4 gap-1 select-none">
        {visibleItems.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={`${item.href}${searchStr}`}
              className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[10px] font-bold transition-all ${
                isActive
                  ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30'
                  : 'text-dark-muted hover:text-white'
              }`}
            >
              <div className="relative">
                <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'text-brand-primary' : 'text-dark-muted'}`} />
                {item.badge !== null && (
                  <span className={`absolute -top-1.5 -right-3 text-[9px] font-black px-1.5 py-0.2 rounded-full ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="truncate max-w-full">{item.shortName}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
};
