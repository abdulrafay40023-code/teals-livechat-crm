'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, Globe, MessageSquare, Smartphone, Laptop, Clock, UserCheck } from 'lucide-react';
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

interface LiveVisitorTableProps {
  visitors: VisitorRecord[];
  selectedWebsiteName?: string;
  onInitiateChat: (visitor: VisitorRecord) => void;
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
}) => {
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
      default:
        return { label: config.shortName || 'Website', badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30' };
    }
  };

  return (
    <div className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-4 px-6 border-b border-dark-border flex items-center justify-between bg-dark-surface/50">
        <div className="flex items-center space-x-3">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-emerald animate-ping" />
          <h3 className="text-sm font-bold text-white">
            {selectedWebsiteName} Live Visitors ({visitors.length} Active Now)
          </h3>
        </div>
        <span className="text-[11px] text-dark-muted font-medium">Real-Time IP, Duration & Geolocation Analytics</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-dark-bg/60 text-dark-muted font-bold uppercase tracking-wider border-b border-dark-border text-[10px]">
            <tr>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">Website</th>
              <th className="py-3.5 px-4">Location & Map</th>
              <th className="py-3.5 px-4">IP Address</th>
              <th className="py-3.5 px-4">Active Page</th>
              <th className="py-3.5 px-4">Referrer</th>
              <th className="py-3.5 px-4">Device</th>
              <th className="py-3.5 px-4">Time on Site</th>
              <th className="py-3.5 px-4 text-center">Visits</th>
              <th className="py-3.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border">
            {visitors.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-14 text-center text-dark-muted space-y-2">
                  <Globe className="w-9 h-9 mx-auto text-dark-border animate-pulse" />
                  <p className="font-semibold text-white text-sm">
                    No active visitors on {selectedWebsiteName} right now
                  </p>
                  <p className="text-[11px] text-dark-muted">
                    Jab koi visitor website par aayega, continuous live tracking aur IP duration ke sath yahan appear hoga!
                  </p>
                </td>
              </tr>
            ) : (
              visitors.map((v) => {
                const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.city + ', ' + v.country)}`;
                const flagSrc = getCountryFlagUrl(v.country_code);
                const siteBadge = getSiteBadge(v.property_slug, v.current_page);

                return (
                  <tr key={v.id} className="hover:bg-dark-cardHover transition-colors">
                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-emerald/15 text-brand-emerald border border-brand-emerald/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-emerald animate-pulse" />
                        <span>Online</span>
                      </span>
                    </td>

                    {/* Website Badge */}
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${siteBadge.badge}`}>
                        {siteBadge.label}
                      </span>
                    </td>

                    {/* Location & Map */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2.5">
                        <img
                          src={flagSrc}
                          alt={v.country_code}
                          className="w-5 h-3.5 object-cover rounded shadow-sm flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div>
                          <div className="font-bold text-white flex items-center space-x-1">
                            <span>{v.city}, {v.country}</span>
                            <a
                              href={mapUrl}
                              target="_blank"
                              rel="noreferrer"
                              title="Open on Google Maps"
                              className="text-brand-secondary hover:text-white inline-block ml-1"
                            >
                              <MapPin className="w-3 h-3 inline" />
                            </a>
                          </div>
                          <span className="text-[10px] text-dark-muted">Verified Geolocation</span>
                        </div>
                      </div>
                    </td>

                    {/* IP Address */}
                    <td className="py-3.5 px-4 font-mono text-white font-semibold">
                      {v.ip_address}
                    </td>

                    {/* Active Page */}
                    <td className="py-3.5 px-4">
                      {(() => {
                        const pageInfo = formatActivePage(v.current_page, v.page_title);
                        return (
                          <div className="flex items-center space-x-1.5 max-w-[200px]" title={pageInfo.full}>
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0 animate-pulse" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-[11px] font-bold text-white truncate leading-tight">
                                {pageInfo.title}
                              </span>
                              <span className="font-mono text-[10px] text-brand-secondary/80 truncate leading-tight">
                                {pageInfo.path}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Referrer */}
                    <td className="py-3.5 px-4 text-dark-muted max-w-[130px] truncate" title={v.referrer}>
                      {v.referrer || 'Direct'}
                    </td>

                    {/* Device & OS */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-1.5 text-[11px] text-dark-muted">
                        {v.device === 'Mobile' ? (
                          <Smartphone className="w-3.5 h-3.5 text-brand-secondary flex-shrink-0" />
                        ) : (
                          <Laptop className="w-3.5 h-3.5 text-brand-primary flex-shrink-0" />
                        )}
                        <span>{v.os || 'OS'}</span>
                        <span className="text-[10px] text-gray-500">({v.browser || 'Browser'})</span>
                      </div>
                    </td>

                    {/* Time on Site (Live stopwatch) */}
                    <td className="py-3.5 px-4">
                      <VisitorDurationTimer createdAt={v.created_at || v.last_active_at} />
                    </td>

                    {/* Visits count (Frequency) */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-bold font-mono text-xs px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        {v.visit_count || 1}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => onInitiateChat(v)}
                        className="px-3 py-1.5 rounded-xl bg-brand-primary hover:bg-brand-primaryHover text-white text-xs font-bold shadow-md transition-all inline-flex items-center space-x-1"
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
