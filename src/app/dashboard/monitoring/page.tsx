'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Globe, Layers, ShoppingCart, Rocket, BookOpen, PenTool, BookMarked,
  Activity, Users, Radio
} from 'lucide-react';
import { LiveVisitorTable } from '@/components/LiveVisitorTable';
import { useLiveSync } from '@/context/LiveSyncContext';
import { getAllWebsites, WEBSITES } from '@/lib/websites-config';

export default function MonitoringPage() {
  const router = useRouter();
  const { liveVisitors } = useLiveSync();
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

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
          activeBg: 'bg-amber-500/15 border-amber-500 shadow-lg shadow-amber-500/10 text-white',
          hoverBg: 'hover:border-amber-500/50',
          iconColor: 'text-amber-400',
          countBadge: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
        };
      case 'amz-innovators':
        return {
          activeBg: 'bg-emerald-500/15 border-emerald-500 shadow-lg shadow-emerald-500/10 text-white',
          hoverBg: 'hover:border-emerald-500/50',
          iconColor: 'text-emerald-400',
          countBadge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
        };
      case 'authors-breeze':
        return {
          activeBg: 'bg-purple-500/15 border-purple-500 shadow-lg shadow-purple-500/10 text-white',
          hoverBg: 'hover:border-purple-500/50',
          iconColor: 'text-purple-400',
          countBadge: 'bg-purple-500/20 text-purple-300 border-purple-500/40'
        };
      case 'pro-book-publishing':
        return {
          activeBg: 'bg-blue-500/15 border-blue-500 shadow-lg shadow-blue-500/10 text-white',
          hoverBg: 'hover:border-blue-500/50',
          iconColor: 'text-blue-400',
          countBadge: 'bg-blue-500/20 text-blue-300 border-blue-500/40'
        };
      case 'amz-writers-hub':
        return {
          activeBg: 'bg-rose-500/15 border-rose-500 shadow-lg shadow-rose-500/10 text-white',
          hoverBg: 'hover:border-rose-500/50',
          iconColor: 'text-rose-400',
          countBadge: 'bg-rose-500/20 text-rose-300 border-rose-500/40'
        };
      default:
        return {
          activeBg: 'bg-blue-500/15 border-blue-500 shadow-lg shadow-blue-500/10 text-white',
          hoverBg: 'hover:border-blue-500/50',
          iconColor: 'text-blue-400',
          countBadge: 'bg-blue-500/20 text-blue-300 border-blue-500/40'
        };
    }
  };

  const getSiteLiveCount = (slug: string) => {
    const cfg = WEBSITES[slug];
    return liveVisitors.filter(v => {
      const p = (v.property_slug || '').toLowerCase();
      const page = (v.current_page || '').toLowerCase();
      const ref = (v.referrer || '').toLowerCase();
      return p === slug || (cfg && (p === cfg.domain || cfg.hostnames.some(h => p.includes(h)))) ||
        (cfg && (page.includes(cfg.domain) || ref.includes(cfg.domain)));
    }).length;
  };

  const filteredVisitors = useMemo(() => {
    if (!selectedFilter || selectedFilter === 'all') {
      return liveVisitors;
    }
    const cfg = WEBSITES[selectedFilter];
    return liveVisitors.filter(v => {
      const p = (v.property_slug || '').toLowerCase();
      const page = (v.current_page || '').toLowerCase();
      const ref = (v.referrer || '').toLowerCase();
      return p === selectedFilter || (cfg && (p === cfg.domain || cfg.hostnames.some(h => p.includes(h)))) ||
        (cfg && (page.includes(cfg.domain) || ref.includes(cfg.domain)));
    });
  }, [liveVisitors, selectedFilter]);

  const selectedSiteName = useMemo(() => {
    if (!selectedFilter || selectedFilter === 'all') return 'All Websites';
    return WEBSITES[selectedFilter]?.name || 'Selected Website';
  }, [selectedFilter]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-xl font-bold text-white tracking-tight">Live Visitor & IP Monitoring</h1>
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-brand-emerald/15 text-brand-emerald border border-brand-emerald/30 flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-emerald animate-ping" />
              <span>Real-Time WebSockets</span>
            </span>
          </div>
          <p className="text-xs text-dark-muted mt-1">
            Real-time multi-website session tracking, geolocation flags & active IP analytics
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs text-dark-muted bg-dark-card border border-dark-border px-3.5 py-2 rounded-xl">
          <Users className="w-4 h-4 text-brand-secondary" />
          <span>Total Live Online: <strong className="text-white font-bold">{liveVisitors.length}</strong></span>
        </div>
      </div>

      {/* 6 Interactive Filter Cards (All Websites + 5 Individual Websites) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-dark-muted font-medium px-0.5">
          <span>Filter Traffic by Website:</span>
          <span>Click any card to filter live visitor table</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: All Websites */}
          <button
            type="button"
            onClick={() => setSelectedFilter('all')}
            className={`p-3.5 rounded-2xl text-left transition-all border flex flex-col justify-between space-y-2.5 ${
              selectedFilter === 'all'
                ? 'bg-[#15223e] border-blue-500 shadow-lg shadow-blue-500/20 text-white ring-1 ring-blue-500/50'
                : 'bg-dark-card/90 border-dark-border hover:border-blue-500/40 text-dark-muted hover:text-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Layers className="w-4 h-4" />
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                liveVisitors.length > 0
                  ? 'bg-brand-emerald/20 text-brand-emerald border-brand-emerald/40 animate-pulse'
                  : 'bg-white/5 text-gray-400 border-white/10'
              }`}>
                {liveVisitors.length} Live
              </span>
            </div>
            <div>
              <div className="font-bold text-xs text-white">All Websites</div>
              <div className="text-[10px] text-dark-muted truncate">5 Connected Sites</div>
            </div>
          </button>

          {/* Cards 2-6: The 5 Individual Websites */}
          {websites.map((site) => {
            const IconComponent = getWebsiteIcon(site.slug);
            const theme = getWebsiteTheme(site.slug);
            const isSelected = selectedFilter === site.slug;
            const siteCount = getSiteLiveCount(site.slug);

            return (
              <button
                key={site.slug}
                type="button"
                onClick={() => setSelectedFilter(site.slug)}
                className={`p-3.5 rounded-2xl text-left transition-all border flex flex-col justify-between space-y-2.5 ${
                  isSelected
                    ? `${theme.activeBg} ring-1 ring-white/20`
                    : `bg-dark-card/90 border-dark-border ${theme.hoverBg} text-dark-muted hover:text-white`
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${theme.countBadge}`}>
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    siteCount > 0
                      ? 'bg-brand-emerald/20 text-brand-emerald border-brand-emerald/40 animate-pulse'
                      : 'bg-white/5 text-gray-400 border-white/10'
                  }`}>
                    {siteCount} Live
                  </span>
                </div>
                <div>
                  <div className="font-bold text-xs text-white truncate">{site.shortName}</div>
                  <div className="text-[10px] text-dark-muted truncate">{site.domain}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Visitor Table with filtered data */}
      <LiveVisitorTable
        visitors={filteredVisitors}
        selectedWebsiteName={selectedSiteName}
        onInitiateChat={(visitor) => {
          const slug = visitor.property_slug || 'amz-solutions-hub';
          router.push(`/dashboard/chats?website=${encodeURIComponent(slug)}&visitor=${encodeURIComponent(visitor.id)}`);
        }}
      />
    </div>
  );
}
