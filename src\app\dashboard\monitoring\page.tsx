'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { LiveVisitorTable } from '@/components/LiveVisitorTable';
import { useLiveSync } from '@/context/LiveSyncContext';

export default function MonitoringPage() {
  const router = useRouter();
  const { liveVisitors } = useLiveSync();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Live Visitor Monitoring</h1>
        <p className="text-xs text-dark-muted mt-0.5">Real-time session monitoring with geolocation flags, referrers, and live page routing</p>
      </div>

      <LiveVisitorTable
        visitors={liveVisitors}
        onInitiateChat={() => {
          router.push('/dashboard/chats');
        }}
      />
    </div>
  );
}
