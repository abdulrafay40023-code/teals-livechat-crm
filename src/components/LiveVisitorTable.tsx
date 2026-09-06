'use client';

import React from 'react';
import { MapPin, Globe, MessageSquare, Smartphone, Laptop, ExternalLink } from 'lucide-react';
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
  browser: string;
  os: string;
  device: string;
  is_online: boolean;
  last_active_at: string;
  created_at: string;
}

interface LiveVisitorTableProps {
  visitors: VisitorRecord[];
  selectedWebsiteName?: string;
  onInitiateChat: (visitor: VisitorRecord) => void;
}

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
        <span className="text-[11px] text-dark-muted font-medium">Real-Time IP & Geolocation Analytics</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-dark-bg/60 text-dark-muted font-bold uppercase tracking-wider border-b border-dark-border text-[10px]">
            <tr>
              <th className="py-3.5 px-5">Status</th>
              <th className="py-3.5 px-5">Website</th>
              <th className="py-3.5 px-5">Location & Map</th>
              <th className="py-3.5 px-5">IP Address</th>
              <th className="py-3.5 px-5">Active Page</th>
              <th className="py-3.5 px-5">Referrer</th>
              <th className="py-3.5 px-5">Device</th>
              <th className="py-3.5 px-5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border">
            {visitors.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-14 text-center text-dark-muted space-y-2">
                  <Globe className="w-9 h-9 mx-auto text-dark-border animate-pulse" />
                  <p className="font-semibold text-white text-sm">
                    No active visitors on {selectedWebsiteName} right now
                  </p>
                  <p className="text-[11px] text-dark-muted">
                    Jab koi visitor is website par aayega, real-time IP aur location ke sath yahan appear hoga!
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
                    <td className="py-3.5 px-5">
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-emerald/15 text-brand-emerald border border-brand-emerald/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-emerald animate-pulse" />
                        <span>Online</span>
                      </span>
                    </td>

                    {/* Website Badge */}
                    <td className="py-3.5 px-5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${siteBadge.badge}`}>
                        {siteBadge.label}
                      </span>
                    </td>

                    {/* Location & Map */}
                    <td className="py-3.5 px-5">
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
                    <td className="py-3.5 px-5 font-mono text-white font-semibold">
                      {v.ip_address}
                    </td>

                    {/* Active Page */}
                    <td className="py-3.5 px-5">
                      <span className="font-mono text-brand-secondary font-medium text-[11px] px-2 py-0.5 rounded bg-dark-bg border border-dark-border inline-block max-w-[200px] truncate" title={v.current_page}>
                        {v.current_page}
                      </span>
                    </td>

                    {/* Referrer */}
                    <td className="py-3.5 px-5 text-dark-muted max-w-[150px] truncate" title={v.referrer}>
                      {v.referrer || 'Direct'}
                    </td>

                    {/* Device & OS */}
                    <td className="py-3.5 px-5">
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

                    {/* Action */}
                    <td className="py-3.5 px-5 text-right">
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
