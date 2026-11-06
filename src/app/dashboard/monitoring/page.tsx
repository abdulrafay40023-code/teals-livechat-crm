'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { LiveVisitorTable } from '@/components/LiveVisitorTable';
import { useLiveSync } from '@/context/LiveSyncContext';
import { getAllWebsites, WEBSITES } from '@/lib/websites-config';

export default function MonitoringPage() {
  const router = useRouter();
  const { liveVisitors, websites: contextWebsites, isWebsitePermitted } = useLiveSync();
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  const websites = useMemo(() => {
    const allConfiguredWebsites = contextWebsites && contextWebsites.length > 0 ? contextWebsites : getAllWebsites();
    return allConfiguredWebsites.filter(site => isWebsitePermitted(site.slug));
  }, [contextWebsites, isWebsitePermitted, liveVisitors]);

  useEffect(() => {
    if (selectedFilter !== 'all' && !websites.some(w => w.slug === selectedFilter)) {
      setSelectedFilter('all');
    }
  }, [websites, selectedFilter]);

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
    const permittedVisitors = liveVisitors.filter(v => isWebsitePermitted(v.property_slug || 'amz-solutions-hub'));
    if (!selectedFilter || selectedFilter === 'all') {
      return permittedVisitors;
    }
    const cfg = WEBSITES[selectedFilter];
    return permittedVisitors.filter(v => {
      const p = (v.property_slug || '').toLowerCase();
      const page = (v.current_page || '').toLowerCase();
      const ref = (v.referrer || '').toLowerCase();
      if (p === selectedFilter.toLowerCase()) return true;
      if (cfg) {
        return (
          p === cfg.domain ||
          cfg.hostnames.some(h => p.includes(h)) ||
          page.includes(cfg.domain) ||
          ref.includes(cfg.domain)
        );
      }
      return false;
    });
  }, [liveVisitors, selectedFilter]);

  const selectedSiteName = useMemo(() => {
    if (!selectedFilter || selectedFilter === 'all') return 'All Websites';
    if (WEBSITES[selectedFilter]?.name) return WEBSITES[selectedFilter].name;
    return selectedFilter
      .split(/[-_.]/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }, [selectedFilter]);

  const filterOptions = useMemo(() => {
    const list = [
      {
        slug: 'all',
        name: 'All Websites',
        count: liveVisitors.length,
      },
      ...websites.map((site) => ({
        slug: site.slug,
        name: site.name,
        domain: site.domain,
        count: getSiteLiveCount(site.slug),
      })),
    ];

    // Check for any newly added or custom website entities in liveVisitors not in the pre-configured list
    const knownSlugs = new Set(websites.map(s => s.slug.toLowerCase()));
    const dynamicSites = new Map<string, number>();

    liveVisitors.forEach(v => {
      const p = (v.property_slug || '').trim().toLowerCase();
      if (p && p !== 'all' && !knownSlugs.has(p) && isWebsitePermitted(p)) {
        dynamicSites.set(p, (dynamicSites.get(p) || 0) + 1);
      }
    });

    dynamicSites.forEach((count, slug) => {
      const formattedName = slug
        .split(/[-_.]/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      list.push({
        slug,
        name: formattedName,
        domain: slug.includes('.') ? slug : `${slug}.com`,
        count,
      });
    });

    return list;
  }, [liveVisitors, websites]);

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

      {/* Live Visitor Table with filtered data & integrated dropdown */}
      <LiveVisitorTable
        visitors={filteredVisitors}
        selectedWebsiteName={selectedSiteName}
        selectedFilter={selectedFilter}
        onSelectFilter={setSelectedFilter}
        filterOptions={filterOptions}
        onInitiateChat={(visitor) => {
          const slug = visitor.property_slug || 'amz-solutions-hub';
          const targetVisitorId = visitor.visitor_token || visitor.id;
          router.push(`/dashboard/chats?website=${encodeURIComponent(slug)}&visitor=${encodeURIComponent(targetVisitorId)}`);
        }}
      />
    </div>
  );
}
