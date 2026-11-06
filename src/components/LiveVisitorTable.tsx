'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Globe, MessageSquare, Smartphone, Laptop, Clock, UserCheck, Filter, ChevronDown, Check } from 'lucide-react';
import { getCountryFlagUrl } from '@/lib/flags';
import { getWebsiteConfig } from '@/lib/websites-config';

export interface VisitorRecord {
  id: string;
  visitor_token?: string;
  property_slug?: string;
  ip_address: string;
  country: string;
  country_code: string;
  city: string;
  flag: string;
  referrer: string;
  current_page: string;
  page_title?: string;
  browser: string;
  os: string;
  device: string;
  is_online: boolean;
  visit_count?: number;
  last_active_at: string;
  created_at: string;
}

function formatActivePage(page?: string, pageTitle?: string): { title: string; path: string; full: string } {
  const p = (page || '/').trim();
  let path = p;
  try {
    if (p.startsWith('http')) {
      const u = new URL(p);
      path = u.pathname;
    }
  } catch {}

  const isHome = path === '/' || path === '';

  let displayTitle = '';
  if (pageTitle && pageTitle.trim()) {
    const cleanTitle = pageTitle.split('|')[0].split(' - ')[0].split(' — ')[0].trim();
    if (cleanTitle && cleanTitle.toLowerCase() !== 'home') {
      displayTitle = cleanTitle;
    }
  }

  if (!displayTitle) {
    if (isHome) {
      displayTitle = 'Home Page';
    } else {
      const parts = path.replace(/^\/+|\/+$/g, '').split('/');
      const lastPart = parts[parts.length - 1] || 'Page';
      displayTitle = lastPart
        .split(/[-_]/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
  }

  const formattedPath = isHome ? '/' : (path.startsWith('/') ? path : '/' + path);

  return {
    title: displayTitle,
    path: formattedPath,
    full: pageTitle ? `${pageTitle} (${formattedPath})` : `${displayTitle} (${formattedPath})`
  };
}

export interface FilterOption {
  slug: string;
  name: string;
  domain?: string;
  count: number;
}

interface LiveVisitorTableProps {
  visitors: VisitorRecord[];
  selectedWebsiteName?: string;
  onInitiateChat: (visitor: VisitorRecord) => void;
  selectedFilter?: string;
  onSelectFilter?: (slug: string) => void;
  filterOptions?: FilterOption[];
}

// Live ticking stopwatch component (like Tawk.to: 00:03:47, 03:54:45)
const VisitorDurationTimer: React.FC<{ createdAt: string }> = ({ createdAt }) => {
  const [elapsed, setElapsed] = useState<number>(() => {
    const start = new Date(createdAt || Date.now()).getTime();
    return Math.max(0, Math.floor((Date.now() - start) / 1000));
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const start = new Date(createdAt || Date.now()).getTime();
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  const hrs = Math.floor(elapsed / 3600);
  const mins = Math.floor((elapsed % 3600) / 60);
  const secs = elapsed % 60;

  return (
    <span className="font-mono text-[11px] font-bold text-brand-emerald bg-brand-emerald/10 border border-brand-emerald/25 px-2 py-0.5 rounded flex items-center space-x-1">
      <Clock className="w-2.5 h-2.5" />
      <span>{pad(hrs)}:{pad(mins)}:{pad(secs)}</span>
    </span>
  );
};

export const LiveVisitorTable: React.FC<LiveVisitorTableProps> = ({
  visitors,
  selectedWebsiteName = 'All Websites',
  onInitiateChat,
  selectedFilter = 'all',
  onSelectFilter,
  filterOptions,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getSiteBadge = (propertySlug?: string, currentPage?: string) => {
    const config = getWebsiteConfig(propertySlug, currentPage);
    switch (config.slug) {
      case 'amz-solutions-hub':
        return { label: 'AMZ Solutions', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
      case 'amz-innovators':
        return { label: 'AMZ Innovators', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
      case 'authors-breeze':
        return { label: 'Authors Breeze', badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30' };
      case 'pro-book-publishing':
        return { label: 'Pro Book', badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30' };
      case 'amz-writers-hub':
        return { label: 'AMZ Writers', badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
      case 'patch-and-promos':
        return { label: 'Patch & Promos', badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' };
      default:
        return { label: config.shortName || 'Website', badge: config.badgeColor || 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' };
    }
  };

  const currentOption = filterOptions?.find(o => o.slug === selectedFilter);

  return (
    <div className="relative bg-dark-card border border-dark-border rounded-2xl shadow-2xl z-20">
      <div className="p-4 px-6 border-b border-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-dark-surface/50 rounded-t-2xl relative z-30">
        <div className="flex items-center space-x-3 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-emerald animate-ping flex-shrink-0" />
          <h3 className="text-sm font-bold text-white tracking-tight truncate">
            {selectedWebsiteName} Live Visitors ({visitors.length} Active Now)
          </h3>
        </div>

        <div className="flex items-center space-x-3 flex-shrink-0">
          {/* Sleek Website Filter Dropdown (like CRM Leads status filter) */}
          {filterOptions && onSelectFilter && (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="px-3.5 py-1.5 rounded-xl bg-[#0b101d] hover:bg-[#152038] border border-dark-border hover:border-gray-500 text-xs font-semibold text-white flex items-center space-x-2 transition-all shadow-sm cursor-pointer"
              >
                <Filter className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <span className="truncate max-w-[140px] sm:max-w-[200px]">
                  {currentOption?.name || 'All Websites'} ({currentOption ? currentOption.count : visitors.length})
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180 text-blue-400' : ''}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-[calc(100vw-3rem)] max-w-72 sm:w-72 rounded-2xl bg-[#0c1322] border border-[#233354] shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[9999] p-1.5 animate-in fade-in slide-in-from-top-2 duration-150 ring-1 ring-blue-500/20">
                  <div className="px-2.5 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between border-b border-dark-border/60 mb-1">
                    <span>Filter by Website</span>
                    <span>{filterOptions.length} Options</span>
                  </div>
                  <div className="space-y-1 max-h-72 overflow-y-auto pr-0.5">
                    {filterOptions.map((opt) => {
                      const isSelected = selectedFilter === opt.slug;
                      return (
                        <button
                          key={opt.slug}
                          type="button"
                          onClick={() => {
                            onSelectFilter(opt.slug);
                            setDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 rounded-xl text-left text-xs flex items-center justify-between transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600/25 text-blue-400 font-bold border border-blue-500/40 shadow-sm'
                              : 'text-gray-300 hover:bg-white/5 hover:text-white border border-transparent'
                          }`}
                        >
                          <div className="flex flex-col min-w-0 pr-2">
                            <span className="truncate font-semibold text-xs">
                              {opt.name}
                            </span>
                            {opt.domain && (
                              <span className="text-[10px] text-gray-500 truncate">
                                {opt.domain}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 flex-shrink-0">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              opt.count > 0
                                ? 'bg-brand-emerald/20 text-brand-emerald border-brand-emerald/40'
                                : 'bg-white/5 text-gray-500 border-white/10'
                            }`}>
                              {opt.count}
                            </span>
                            {isSelected && <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <span className="text-[11px] text-dark-muted font-medium hidden md:inline">
            Real-Time IP, Duration & Geolocation Analytics
          </span>
        </div>
      </div>

      {/* 📱 Mobile Live Visitor Card List (Hidden on Desktop md+) */}
      <div className="md:hidden divide-y divide-dark-border/60 rounded-b-2xl overflow-hidden">
        {visitors.length === 0 ? (
          <div className="py-12 px-4 text-center text-dark-muted space-y-2">
            <Globe className="w-8 h-8 mx-auto text-dark-border animate-pulse" />
            <p className="font-semibold text-white text-sm">
              No active visitors on {selectedWebsiteName} right now
            </p>
            <p className="text-[11px] text-dark-muted">
              When a visitor arrives on the website, they will appear here with continuous live tracking and duration!
            </p>
          </div>
        ) : (
          visitors.map((v) => {
            const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.city + ', ' + v.country)}`;
            const flagSrc = getCountryFlagUrl(v.country_code);
            const siteBadge = getSiteBadge(v.property_slug, v.current_page);
            const pageInfo = formatActivePage(v.current_page, v.page_title);

            return (
              <div key={v.id} className="p-3.5 space-y-2.5 hover:bg-dark-cardHover/50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={flagSrc}
                      alt={v.country_code}
                      className="w-4 h-3 object-cover rounded shadow-sm flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-white text-xs flex items-center gap-1 truncate">
                        <span className="truncate">{v.city}, {v.country}</span>
                        <a
                          href={mapUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-secondary hover:text-white flex-shrink-0"
                        >
                          <MapPin className="w-3 h-3 inline" />
                        </a>
                      </div>
                      <p className="font-mono text-[10px] text-dark-muted truncate">IP: {v.ip_address}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${siteBadge.badge}`}>
                      {siteBadge.label}
                    </span>
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-emerald/15 text-brand-emerald border border-brand-emerald/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-emerald animate-pulse" />
                      <span>Online</span>
                    </span>
                  </div>
                </div>

                {/* Active Page & Device Row */}
                <div className="flex items-center justify-between gap-2 bg-dark-bg/60 rounded-xl p-2 border border-dark-border/50 text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0 animate-pulse" />
                    <span className="font-semibold text-white truncate">{pageInfo.title}</span>
                    <span className="font-mono text-[10px] text-brand-secondary/80 truncate">{pageInfo.path}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-dark-muted flex-shrink-0">
                    {v.device === 'Mobile' ? (
                      <Smartphone className="w-3 h-3 text-brand-secondary" />
                    ) : (
                      <Laptop className="w-3 h-3 text-brand-primary" />
                    )}
                    <span>{v.os || 'OS'}</span>
                  </div>
                </div>

                {/* Bottom Row: Stopwatch + Visits + Chat Button */}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <div className="flex items-center gap-2">
                    <VisitorDurationTimer createdAt={v.created_at || v.last_active_at} />
                    <span className="font-bold font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                      {v.visit_count || 1} visit{(v.visit_count || 1) > 1 ? 's' : ''}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onInitiateChat(v)}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition-all inline-flex items-center space-x-1.5 cursor-pointer active:scale-95"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Chat</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="hidden md:block overflow-x-auto w-full rounded-b-2xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-dark-bg/80 text-dark-muted font-bold uppercase tracking-wider border-b border-dark-border text-[10px]">
            <tr>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Website</th>
              <th className="py-2.5 px-3">Location & Map</th>
              <th className="py-2.5 px-3">IP Address</th>
              <th className="py-2.5 px-3">Active Page</th>
              <th className="py-2.5 px-3 hidden lg:table-cell">Referrer</th>
              <th className="py-2.5 px-3">Device</th>
              <th className="py-2.5 px-3">Time on Site</th>
              <th className="py-2.5 px-2 text-center">Visits</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border/60">
            {visitors.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-14 text-center text-dark-muted space-y-2">
                  <Globe className="w-9 h-9 mx-auto text-dark-border animate-pulse" />
                  <p className="font-semibold text-white text-sm">
                    No active visitors on {selectedWebsiteName} right now
                  </p>
                  <p className="text-[11px] text-dark-muted">
                    When a visitor arrives on the website, they will appear here with continuous live tracking and duration!
                  </p>
                </td>
              </tr>
            ) : (
              visitors.map((v) => {
                const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.city + ', ' + v.country)}`;
                const flagSrc = getCountryFlagUrl(v.country_code);
                const siteBadge = getSiteBadge(v.property_slug, v.current_page);

                return (
                  <tr key={v.id} className="hover:bg-dark-cardHover/70 transition-colors">
                    {/* Status */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-emerald/15 text-brand-emerald border border-brand-emerald/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-emerald animate-pulse" />
                        <span>Online</span>
                      </span>
                    </td>

                    {/* Website Badge */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${siteBadge.badge}`}>
                        {siteBadge.label}
                      </span>
                    </td>

                    {/* Location & Map */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center space-x-2">
                        <img
                          src={flagSrc}
                          alt={v.country_code}
                          className="w-4 h-3 object-cover rounded shadow-sm flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-white text-[11px] flex items-center space-x-1 truncate">
                            <span className="truncate">{v.city}, {v.country}</span>
                            <a
                              href={mapUrl}
                              target="_blank"
                              rel="noreferrer"
                              title="Open on Google Maps"
                              className="text-brand-secondary hover:text-white inline-block flex-shrink-0"
                            >
                              <MapPin className="w-3 h-3 inline" />
                            </a>
                          </div>
                          <span className="text-[9px] text-dark-muted block">Verified Location</span>
                        </div>
                      </div>
                    </td>

                    {/* IP Address */}
                    <td className="py-2.5 px-3 font-mono text-[11px] text-white font-semibold whitespace-nowrap">
                      {v.ip_address}
                    </td>

                    {/* Active Page */}
                    <td className="py-2.5 px-3">
                      {(() => {
                        const pageInfo = formatActivePage(v.current_page, v.page_title);
                        return (
                          <div className="flex items-center space-x-1.5 max-w-[140px]" title={pageInfo.full}>
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0 animate-pulse" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-[11px] font-bold text-white truncate leading-tight">
                                {pageInfo.title}
                              </span>
                              <span className="font-mono text-[9px] text-brand-secondary/80 truncate leading-tight">
                                {pageInfo.path}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Referrer */}
                    <td className="py-2.5 px-3 text-dark-muted max-w-[100px] truncate text-[11px] hidden lg:table-cell" title={v.referrer}>
                      {v.referrer || 'Direct'}
                    </td>

                    {/* Device & OS */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center space-x-1 text-[10px] text-dark-muted">
                        {v.device === 'Mobile' ? (
                          <Smartphone className="w-3.5 h-3.5 text-brand-secondary flex-shrink-0" />
                        ) : (
                          <Laptop className="w-3.5 h-3.5 text-brand-primary flex-shrink-0" />
                        )}
                        <span>{v.os || 'OS'}</span>
                      </div>
                    </td>

                    {/* Time on Site (Live stopwatch) */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <VisitorDurationTimer createdAt={v.created_at || v.last_active_at} />
                    </td>

                    {/* Visits count (Frequency) */}
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">
                      <span className="font-bold font-mono text-[11px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        {v.visit_count || 1}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onInitiateChat(v)}
                        className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition-all inline-flex items-center space-x-1.5 cursor-pointer hover:scale-105 active:scale-95"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Chat</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
