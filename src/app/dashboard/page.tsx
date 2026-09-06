'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Users, MessageSquare, Eye, Radio, ArrowRight, RotateCcw,
  ExternalLink, ShoppingCart, Rocket, BookOpen, PenTool, BookMarked,
  Globe, Activity, Layers
} from 'lucide-react';
import { useLiveSync } from '@/context/LiveSyncContext';
import { getAllWebsites, WEBSITES } from '@/lib/websites-config';

export default function OverviewDashboard() {
  const {
    liveVisitors,
    conversations,
    liveCount,
    todayCount,
    totalUniqueCount,
    chatCount,
    websiteStats,
    resetAll
  } = useLiveSync();

  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetAll();
    } finally {
      setResetting(false);
    }
  };

  const websites = getAllWebsites();

  const getWebsiteIcon = (slug: string) => {
    switch (slug) {
      case 'amz-solutions-hub': return ShoppingCart;
      case 'amz-innovators': return Rocket;
      case 'authors-breeze': return BookOpen;
      case 'pro-book-publishing': return PenTool;
      case 'amz-writers-hub': return BookMarked;
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
      default:
        return {
          accent: 'border-blue-500/30 hover:border-blue-500/70 hover:shadow-blue-500/10',
          iconBg: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
          badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
          btn: 'bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border-blue-500/40'
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
      return p === slug || (cfg && (p === cfg.domain || cfg.hostnames.some(h => p.includes(h))));
    });

    return {
      liveCount: Math.max(liveForSite.length, stored?.liveCount || 0),
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
              <span>5 Websites Connected</span>
            </span>
          </div>
          <p className="text-xs text-dark-muted mt-1">
            Real-time multi-website live traffic, 24-hour visitors & chat analytics
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleReset}
            disabled={resetting}
            title="Reset all counters to 0"
            className="px-3.5 py-2 rounded-xl bg-dark-card hover:bg-dark-cardHover border border-dark-border text-dark-muted hover:text-white text-xs font-semibold transition-all flex items-center space-x-1.5 shadow-sm"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin text-brand-secondary' : ''}`} />
            <span>Reset to 0</span>
          </button>
          <Link
            href="/dashboard/monitoring"
            className="px-4 py-2 rounded-xl bg-brand-primary/15 hover:bg-brand-primary/25 border border-brand-primary/30 text-brand-secondary text-xs font-bold transition-all flex items-center space-x-2 w-fit shadow-sm"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse text-brand-emerald" />
            <span>Open Live Monitoring</span>
          </Link>
        </div>
      </div>

      {/* Global Aggregate KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: All Live Traffic */}
        <div className="bg-dark-card/90 border border-dark-border rounded-2xl p-4 hover:border-brand-emerald/40 transition-all">
          <div className="flex items-center justify-between text-xs text-dark-muted font-semibold">
            <span>Total Live Traffic</span>
            <span className="w-2.5 h-2.5 rounded-full bg-brand-emerald animate-ping" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1.5 flex items-baseline space-x-2">
            <span>{liveCount}</span>
          </div>
          <p className="text-[11px] text-brand-emerald font-semibold mt-1">Active across all sites</p>
        </div>

        {/* Card 2: Today's Total Visitors */}
        <div className="bg-dark-card/90 border border-dark-border rounded-2xl p-4 hover:border-brand-primary/40 transition-all">
          <div className="flex items-center justify-between text-xs text-dark-muted font-semibold">
            <span>Today's Total Visitors</span>
            <Users className="w-4 h-4 text-brand-secondary" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1.5">
            {todayCount}
          </div>
          <p className="text-[11px] text-dark-muted mt-1">Resets every 24 hours</p>
        </div>

        {/* Card 3: Active Conversations */}
        <div className="bg-dark-card/90 border border-dark-border rounded-2xl p-4 hover:border-brand-primary/40 transition-all">
          <div className="flex items-center justify-between text-xs text-dark-muted font-semibold">
            <span>Active Conversations</span>
            <MessageSquare className="w-4 h-4 text-brand-primary" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1.5">
            {chatCount}
          </div>
          <p className="text-[11px] text-dark-muted mt-1">AI & Human Handled</p>
        </div>

        {/* Card 4: Total Unique Visitors */}
        <div className="bg-dark-card/90 border border-dark-border rounded-2xl p-4 hover:border-brand-secondary/40 transition-all">
          <div className="flex items-center justify-between text-xs text-dark-muted font-semibold">
            <span>Total Unique Visitors</span>
            <Eye className="w-4 h-4 text-brand-secondary" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1.5">
            {totalUniqueCount}
          </div>
          <p className="text-[11px] text-brand-emerald font-semibold mt-1">Unique IP Analytics</p>
        </div>
      </div>

      {/* 5 Distinct Dedicated Website Analytics Cards */}
      <div className="space-y-3">
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
                      <span>Today's Visitors</span>
                      <Users className="w-3.5 h-3.5 text-brand-secondary" />
                    </div>
                    <div className="text-xl font-black text-white mt-1">
                      {stats.todayCount}
                    </div>
                    <p className="text-[10px] text-dark-muted font-medium mt-0.5">Resets 24h</p>
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
                <div className="pt-3 border-t border-dark-border/60 flex items-center justify-between gap-2">
                  <Link
                    href={`/dashboard/chats?website=${site.slug}`}
                    className={`w-full py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-sm ${theme.btn}`}
                  >
                    <span>Open Live Inbox</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
