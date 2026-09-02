'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Radio, MessageSquare, Shield } from 'lucide-react';

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
  pendingAgentsCount,
  isAdmin = false,
  unreadCount = 0,
}) => {
  const pathname = usePathname();

  const hasUnread = unreadCount > 0;

  const navItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      badge: null,
      exact: true,
      adminOnly: false
    },
    {
      name: 'Monitoring',
      href: '/dashboard/monitoring',
      icon: Radio,
      badge: liveCount > 0 ? liveCount : null,
      badgeColor: 'bg-brand-emerald text-dark-bg',
      adminOnly: false
    },
    {
      name: 'Active Chats',
      href: '/dashboard/chats',
      icon: MessageSquare,
      badge: chatCount > 0 ? chatCount : null,
      badgeColor: 'bg-rose-500 text-white shadow-md shadow-rose-500/30 font-bold animate-pulse',
      adminOnly: false
    },
    {
      name: 'Administration',
      href: '/dashboard/admin',
      icon: Shield,
      badge: pendingAgentsCount > 0 ? pendingAgentsCount : null,
      badgeColor: 'bg-brand-amber text-dark-bg animate-pulse',
      adminOnly: true
    }
  ];

  const visibleItems = navItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <aside className="w-60 bg-[#0a0f1d] border-r border-dark-border flex flex-col justify-between select-none">
      <div>
        {/* Brand */}
        <div className="h-16 flex items-center space-x-3 px-5 border-b border-dark-border">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-primary to-brand-secondary flex items-center justify-center shadow-lg shadow-brand-primary/25">
            <span className="text-white font-black text-lg">T</span>
          </div>
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
                href={item.href}
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
  );
};
