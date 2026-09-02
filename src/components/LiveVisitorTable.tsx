'use client';

import React from 'react';
import { MapPin, Globe, MessageSquare } from 'lucide-react';
import { getCountryFlagUrl } from '@/lib/flags';

export interface VisitorRecord {
  id: string;
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
  onInitiateChat: (visitor: VisitorRecord) => void;
}

export const LiveVisitorTable: React.FC<LiveVisitorTableProps> = ({
  visitors,
  onInitiateChat,
}) => {
  return (
    <div className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-4 px-6 border-b border-dark-border flex items-center justify-between bg-dark-surface/50">
        <div className="flex items-center space-x-3">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-emerald animate-ping" />
          <h3 className="text-sm font-bold text-white">
            Live Visitors Monitoring ({visitors.length} Active Now)
          </h3>
        </div>
        <span className="text-[11px] text-dark-muted">Real-Time IP & Geolocation</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-dark-bg/60 text-dark-muted font-bold uppercase tracking-wider border-b border-dark-border text-[10px]">
            <tr>
              <th className="py-3.5 px-5">Status</th>
              <th className="py-3.5 px-5">Location & Map</th>
              <th className="py-3.5 px-5">IP Address</th>
              <th className="py-3.5 px-5">Active CRM Page</th>
              <th className="py-3.5 px-5">Referrer</th>
              <th className="py-3.5 px-5">Device</th>
              <th className="py-3.5 px-5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border">
            {visitors.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-dark-muted">
                  <Globe className="w-8 h-8 mx-auto mb-2 text-dark-border animate-pulse" />
                  <p className="font-semibold text-white">No active visitors on CRM right now</p>
                  <p className="text-[11px] mt-1">Jab koi client CRM kholega, 4 loud beeps ke sath yahan appear hoga!</p>
                </td>
              </tr>
            ) : (
              visitors.map((v) => {
                const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.city + ', ' + v.country)}`;
                const flagSrc = getCountryFlagUrl(v.country_code);

                return (
                  <tr key={v.id} className="hover:bg-dark-cardHover transition-colors">
                    <td className="py-3.5 px-5">
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-emerald/15 text-brand-emerald border border-brand-emerald/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-emerald animate-pulse" />
                        <span>Online</span>
                      </span>
                    </td>
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
                    <td className="py-3.5 px-5 font-mono text-dark-muted">
                      {v.ip_address}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="font-mono text-brand-secondary font-bold text-[11px] px-2 py-0.5 rounded bg-dark-bg border border-dark-border">
                        {v.current_page}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-dark-muted">
                      {v.referrer}
                    </td>
                    <td className="py-3.5 px-5 text-dark-muted">
                      {v.browser} / {v.os}
                    </td>
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
