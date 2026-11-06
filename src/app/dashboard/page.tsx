'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users, MessageSquare, Eye, Radio, ArrowRight, Code2, PlusCircle, Sparkles,
  ExternalLink, ShoppingCart, Rocket, BookOpen, PenTool, BookMarked,
  Globe, Activity, Layers, Trash2, AlertTriangle, X
} from 'lucide-react';
import { useLiveSync } from '@/context/LiveSyncContext';
import { getAllWebsites, WEBSITES } from '@/lib/websites-config';
import { EmbedCodeModal } from '@/components/EmbedCodeModal';

export default function OverviewDashboard() {
  const {
    liveVisitors,
    conversations,
    websites: contextWebsites,
    liveCount,
    todayCount,
    totalUniqueCount,
    chatCount,
    websiteStats,
    isWebsitePermitted,
    removeWebsite,
  } = useLiveSync();

  const [embedModalOpen, setEmbedModalOpen] = useState(false);
  const [selectedEmbedSlug, setSelectedEmbedSlug] = useState<string>('amz-solutions-hub');
  const [siteToRemove, setSiteToRemove] = useState<{ slug: string; name: string; domain: string } | null>(null);
  const [removingSite, setRemovingSite] = useState(false);

  const [currentAgent, setCurrentAgent] = useState<{
    id: string;
    email: string;
    full_name: string;
    role: string;
  } | null>(null);

  useEffect(() => {
    try {
      const rawSession = localStorage.getItem('teals_agent_session');
      if (rawSession) {
        const parsed = JSON.parse(rawSession);
        setCurrentAgent(parsed);
      }
    } catch {}
  }, []);

  const adminEmails = ['garryamelia6265@gmail.com', 'tzafar04@gmail.com', 'annusraees@gmail.com'];
  const isAdmin = !currentAgent || currentAgent.role === 'admin' || (currentAgent.email && adminEmails.includes(currentAgent.email.toLowerCase()));

  // Full visibility: Working agents and Admins see ALL conversations across all websites
  const isConvVisibleToAgent = (_c?: any) => true;

  const getTodayDayName = () => {
    try {
      return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Karachi' }).format(new Date());
    } catch {
      return 'Today';
    }
  };

  const dayName = getTodayDayName();

  const websites = React.useMemo(() => {
    const list = contextWebsites && contextWebsites.length > 0 ? contextWebsites : getAllWebsites();
    return list.filter(w => isWebsitePermitted(w.slug));
  }, [contextWebsites, isWebsitePermitted, currentAgent, websiteStats, liveVisitors]);

  const getWebsiteIcon = (slug: string) => {
    switch (slug) {
      case 'amz-solutions-hub': return ShoppingCart;
      case 'amz-innovators': return Rocket;
      case 'authors-breeze': return BookOpen;
      case 'pro-book-publishing': return PenTool;
      case 'amz-writers-hub': return BookMarked;
      case 'patch-and-promos': return Sparkles;
      default: return Globe;
    }
  };

  const getWebsiteTheme = (slug: string) => {
    switch (slug) {
      case 'amz-solutions-hub':
        return {
          accent: 'border-amber-500/30 hover:border-amber-500/70 hover:shadow-amber-500/10',
          iconBg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
          badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          btn: 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40'
        };
      case 'amz-innovators':
        return {
          accent: 'border-emerald-500/30 hover:border-emerald-500/70 hover:shadow-emerald-500/10',
          iconBg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          btn: 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/40'
        };
      case 'authors-breeze':
        return {
          accent: 'border-purple-500/30 hover:border-purple-500/70 hover:shadow-purple-500/10',
          iconBg: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
          badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
          btn: 'bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border-purple-500/40'
        };
      case 'pro-book-publishing':
        return {
          accent: 'border-blue-500/30 hover:border-blue-500/70 hover:shadow-blue-500/10',
          iconBg: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
          badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
          btn: 'bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border-blue-500/40'
        };
      case 'amz-writers-hub':
        return {
          accent: 'border-rose-500/30 hover:border-rose-500/70 hover:shadow-rose-500/10',
          iconBg: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
          badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
          btn: 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/40'
        };
      case 'patch-and-promos':
        return {
          accent: 'border-cyan-500/30 hover:border-cyan-500/70 hover:shadow-cyan-500/10',
          iconBg: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
          badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
          btn: 'bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border-cyan-500/40'
        };
      default:
        return {
          accent: 'border-indigo-500/30 hover:border-indigo-500/70 hover:shadow-indigo-500/10',
          iconBg: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
          badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
          btn: 'bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border-indigo-500/40'
        };
    }
  };

  const getSiteMetrics = (slug: string) => {
    const stored = websiteStats?.[slug];
    const cfg = WEBSITES[slug];

    const liveForSite = liveVisitors.filter(v => {
      const p = (v.property_slug || '').toLowerCase();
      const page = (v.current_page || '').toLowerCase();
      const ref = (v.referrer || '').toLowerCase();
      return p === slug || (cfg && (p === cfg.domain || cfg.hostnames.some(h => p.includes(h)))) ||
        (cfg && (page.includes(cfg.domain) || ref.includes(cfg.domain)));
    });

    const chatsForSite = conversations.filter(c => {
      const p = (c.property_slug || '').toLowerCase();
      const matchesSite = p === slug || (cfg && (p === cfg.domain || cfg.hostnames.some(h => p.includes(h))));
      if (!matchesSite) return false;
      return isConvVisibleToAgent(c);
    });

    return {
      liveCount: stored?.liveCount ?? liveForSite.length,
      todayCount: stored?.todayCount ?? 0,
      totalUniqueCount: stored?.totalUniqueCount ?? 0,
      chatCount: stored?.chatCount ?? chatsForSite.length,
    };
  };

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h2 className="text-xl font-bold text-white tracking-tight">Overview Dashboard</h2>
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-brand-primary/15 text-brand-secondary border border-brand-primary/30 flex items-center space-x-1">
              <Layers className="w-3 h-3" />
              <span>{websites.length} {websites.length === 1 ? 'Website' : 'Websites'} Connected</span>
            </span>
          </div>
          <p className="text-xs text-dark-muted mt-1">
            Real-time multi-website live traffic, today&apos;s visitors & chat analytics
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <Link
            href="/dashboard/monitoring"
            className="px-4 py-2 rounded-xl bg-brand-primary/15 hover:bg-brand-primary/25 border border-brand-primary/30 text-brand-secondary text-xs font-bold transition-all flex items-center space-x-2 w-fit shadow-sm"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse text-brand-emerald" />
            <span>Open Live Monitoring</span>
          </Link>
        </div>
      </div>

      {/* Connect New Website / Custom Entity Banner (Top Placement) */}
      <div className="bg-[#0b101d] border border-dashed border-purple-500/30 hover:border-purple-500/60 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all">
        <div className="flex items-center space-x-3 text-left">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 flex-shrink-0">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Need to connect another website or custom entity?</h4>
            <p className="text-[11px] text-dark-muted mt-0.5">
              Generate a dedicated embed snippet for any 6th website or external domain with dedicated AI routing.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelectedEmbedSlug('custom-new-entity');
            setEmbedModalOpen(true);
          }}
          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-600/20 flex items-center space-x-2 flex-shrink-0 cursor-pointer hover:scale-105 active:scale-95"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>+ Generate Custom Website Code</span>
        </button>
      </div>

      {/* 5 Distinct Dedicated Website Analytics Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-brand-secondary" />
            <h3 className="text-sm font-bold text-white tracking-tight">
              Website Analytics & Live Inboxes
            </h3>
          </div>
          <span className="text-[11px] text-dark-muted">
            Independent live metrics per website
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {websites.map((site) => {
            const IconComponent = getWebsiteIcon(site.slug);
            const theme = getWebsiteTheme(site.slug);
            const stats = getSiteMetrics(site.slug);

            return (
              <div
                key={site.slug}
                className={`bg-[#0e1628] border ${theme.accent} rounded-2xl p-5 transition-all duration-200 hover:shadow-xl flex flex-col justify-between space-y-4`}
              >
                {/* Website Header & Link */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className={`w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 ${theme.iconBg}`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white truncate tracking-tight">
                        {site.name}
                      </h4>
                      <a
                        href={site.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-brand-secondary hover:text-white hover:underline flex items-center space-x-1 mt-0.5 truncate transition-colors"
                      >
                        <span className="truncate">{site.domain}</span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    </div>
                  </div>

                  {/* Category badge */}
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${theme.badge}`}>
                    {site.category === 'ecommerce' ? 'E-Commerce' : 'Publishing'}
                  </span>
                </div>

                {/* 4 Stats Grid in this Card */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  {/* Stat 1: Live Traffic */}
                  <div className="bg-[#0b101d] border border-dark-border/80 rounded-xl p-3">
                    <div className="flex items-center justify-between text-[11px] text-dark-muted font-semibold">
                      <span>Live Traffic</span>
                      <span className={`w-2 h-2 rounded-full ${stats.liveCount > 0 ? 'bg-brand-emerald animate-ping' : 'bg-gray-600'}`} />
                    </div>
                    <div className="text-xl font-black text-white mt-1">
                      {stats.liveCount}
                    </div>
                    <p className="text-[10px] text-brand-emerald font-medium mt-0.5">Active Now</p>
                  </div>

                  {/* Stat 2: Today's Visitors */}
                  <div className="bg-[#0b101d] border border-dark-border/80 rounded-xl p-3">
                    <div className="flex items-center justify-between text-[11px] text-dark-muted font-semibold">
                      <span>Today&apos;s Visitors</span>
                      <Users className="w-3.5 h-3.5 text-brand-secondary" />
                    </div>
                    <div className="text-xl font-black text-white mt-1">
                      {stats.todayCount}
                    </div>
                    <p className="text-[10px] text-brand-secondary font-medium mt-0.5">Today ({dayName})</p>
                  </div>

                  {/* Stat 3: Total Unique */}
                  <div className="bg-[#0b101d] border border-dark-border/80 rounded-xl p-3">
                    <div className="flex items-center justify-between text-[11px] text-dark-muted font-semibold">
                      <span>Total Unique</span>
                      <Eye className="w-3.5 h-3.5 text-brand-secondary" />
                    </div>
                    <div className="text-xl font-black text-white mt-1">
                      {stats.totalUniqueCount}
                    </div>
                    <p className="text-[10px] text-brand-emerald font-medium mt-0.5">Unique IPs</p>
                  </div>

                  {/* Stat 4: Active Chats */}
                  <div className="bg-[#0b101d] border border-dark-border/80 rounded-xl p-3">
                    <div className="flex items-center justify-between text-[11px] text-dark-muted font-semibold">
                      <span>Active Chats</span>
                      <MessageSquare className="w-3.5 h-3.5 text-brand-primary" />
                    </div>
                    <div className="text-xl font-black text-white mt-1">
                      {stats.chatCount}
                    </div>
                    <p className="text-[10px] text-dark-muted font-medium mt-0.5">Live Handled</p>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="pt-3 border-t border-dark-border/60 flex items-center gap-2">
                  <Link
                    href={`/dashboard/chats?website=${site.slug}`}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-sm ${theme.btn}`}
                  >
                    <span>Open Live Inbox</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEmbedSlug(site.slug);
                      setEmbedModalOpen(true);
                    }}
                    title={`Get dedicated embed script for ${site.name}`}
                    className="py-2 px-3 rounded-xl bg-[#0b101d] hover:bg-[#152038] border border-dark-border hover:border-gray-600 text-gray-300 hover:text-white text-xs font-semibold transition-all flex items-center space-x-1.5 shadow-sm flex-shrink-0 cursor-pointer"
                  >
                    <Code2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Get Code</span>
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setSiteToRemove({ slug: site.slug, name: site.name, domain: site.domain })}
                      title={`Remove ${site.name} from entire system`}
                      className="p-2 rounded-xl bg-[#0b101d] hover:bg-rose-500/20 border border-dark-border hover:border-rose-500/50 text-gray-400 hover:text-rose-400 transition-all shadow-sm flex-shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmation Modal for Removing a Website */}
      {siteToRemove && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#0b101d] border border-rose-500/40 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 flex-shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Remove Website from System?</h3>
                  <p className="text-xs text-rose-300 font-semibold mt-0.5">
                    {siteToRemove.name} ({siteToRemove.domain})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSiteToRemove(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-dark-card transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Are you sure you want to remove <strong className="text-white">{siteToRemove.name}</strong>? This will completely remove this brand&apos;s website box, live traffic tabs, and chat filters from the entire system (Overview Dashboard, Live Monitoring, Active Chats &amp; All Chats).
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-dark-border/80">
              <button
                type="button"
                disabled={removingSite}
                onClick={() => setSiteToRemove(null)}
                className="px-4 py-2 rounded-xl bg-dark-card hover:bg-dark-surface border border-dark-border text-xs font-bold text-gray-300 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removingSite}
                onClick={async () => {
                  setRemovingSite(true);
                  try {
                    await removeWebsite(siteToRemove.slug);
                    setSiteToRemove(null);
                  } finally {
                    setRemovingSite(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-xs font-bold text-white shadow-md shadow-rose-600/20 flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{removingSite ? 'Removing...' : 'Yes, Remove Website'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <EmbedCodeModal
        isOpen={embedModalOpen}
        onClose={() => setEmbedModalOpen(false)}
        initialWebsiteSlug={selectedEmbedSlug}
      />
    </div>
  );
}
