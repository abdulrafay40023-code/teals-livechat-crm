'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Users, MessageSquare, Eye, Radio, ArrowRight, RotateCcw, Smartphone, Laptop
} from 'lucide-react';
import { getCountryFlagUrl } from '@/lib/flags';
import { useLiveSync } from '@/context/LiveSyncContext';

export default function OverviewDashboard() {
  const {
    liveVisitors,
    liveCount,
    todayCount,
    totalUniqueCount,
    chatCount,
    pageViews,
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

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Overview Dashboard</h2>
          <p className="text-xs text-dark-muted mt-0.5">Real-time live traffic & 24-hour daily analytics for Teals CRM</p>
        </div>
        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleReset}
            disabled={resetting}
            title="Reset traffic counters to 0 (preserves chat history)"
            className="px-3.5 py-2 rounded-xl bg-dark-card hover:bg-dark-cardHover border border-dark-border text-dark-muted hover:text-white text-xs font-semibold transition-all flex items-center space-x-1.5"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
            <span>Reset to 0</span>
          </button>
          <Link
            href="/dashboard/monitoring"
            className="px-4 py-2 rounded-xl bg-brand-primary/15 hover:bg-brand-primary/25 border border-brand-primary/30 text-brand-secondary text-xs font-bold transition-all flex items-center space-x-2 w-fit"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse text-brand-emerald" />
            <span>Open Live Monitoring</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Live Traffic Now */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-4 hover:border-brand-emerald/40 transition-all">
          <div className="flex items-center justify-between text-xs text-dark-muted font-semibold">
            <span>Live Traffic Now</span>
            <span className="w-2.5 h-2.5 rounded-full bg-brand-emerald animate-ping" />
          </div>
          <div className="text-3xl font-black text-white mt-2 flex items-baseline space-x-2">
            <span>{liveCount}</span>
          </div>
          <p className="text-[11px] text-brand-emerald font-semibold mt-1">Active on CRM site</p>
        </div>

        {/* Card 2: Today's Total Visitors */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-4 hover:border-brand-primary/40 transition-all">
          <div className="flex items-center justify-between text-xs text-dark-muted font-semibold">
            <span>Today's Total Visitors</span>
            <Users className="w-4 h-4 text-brand-secondary" />
          </div>
          <div className="text-3xl font-black text-white mt-2">
            {todayCount}
          </div>
          <p className="text-[11px] text-dark-muted mt-1">Resets every 24 hours</p>
        </div>

        {/* Card 3: Active Conversations */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-4 hover:border-brand-primary/40 transition-all">
          <div className="flex items-center justify-between text-xs text-dark-muted font-semibold">
            <span>Active Conversations</span>
            <MessageSquare className="w-4 h-4 text-brand-primary" />
          </div>
          <div className="text-3xl font-black text-white mt-2">
            {chatCount}
          </div>
          <p className="text-[11px] text-dark-muted mt-1">AI & Human Handled</p>
        </div>

        {/* Card 4: Total Unique Visitors */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-4 hover:border-brand-secondary/40 transition-all">
          <div className="flex items-center justify-between text-xs text-dark-muted font-semibold">
            <span>Total Unique Visitors</span>
            <Eye className="w-4 h-4 text-brand-secondary" />
          </div>
          <div className="text-3xl font-black text-white mt-2">
            {totalUniqueCount}
          </div>
          <p className="text-[11px] text-brand-emerald font-semibold mt-1">Unique IP Analytics</p>
        </div>
      </div>

      {/* Live Visitors Quick Table */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-brand-emerald" />
            <h3 className="text-sm font-bold text-white">Current Active Visitors on CRM ({liveVisitors.length})</h3>
          </div>
          <Link
            href="/dashboard/monitoring"
            className="text-xs text-brand-secondary hover:underline font-bold flex items-center space-x-1"
          >
            <span>View Full Monitoring</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {liveVisitors.length === 0 ? (
          <div className="py-12 text-center text-dark-muted text-xs space-y-2">
            <Users className="w-8 h-8 mx-auto text-dark-border" />
            <p className="font-semibold text-sm text-dark-text">No active visitors on CRM right now</p>
            <p>Jab koi banda CRM kholta hai, count 1 ho jayega aur tab band karte hi 0 ho jayega!</p>
          </div>
        ) : (
          <div className="divide-y divide-dark-border">
            {liveVisitors.map((v) => (
              <div key={v.id} className="py-3.5 flex items-center justify-between text-xs hover:bg-dark-surface/40 transition-colors rounded-xl px-2">
                <div className="flex items-center space-x-3">
                  <img
                    src={getCountryFlagUrl(v.country_code)}
                    alt="Flag"
                    className="w-5 h-3.5 object-cover rounded shadow-sm flex-shrink-0"
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                  <div>
                    <div className="font-bold text-white flex items-center space-x-1.5">
                      <span>{v.city}, {v.country}</span>
                    </div>
                    <div className="text-[10px] text-dark-muted font-mono">{v.ip_address}</div>
                  </div>
                </div>

                {/* Device & OS Badge */}
                <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-dark-bg border border-dark-border text-[11px] text-dark-muted">
                  {v.device === 'Mobile' ? (
                    <Smartphone className="w-3.5 h-3.5 text-brand-secondary" />
                  ) : (
                    <Laptop className="w-3.5 h-3.5 text-brand-primary" />
                  )}
                  <span className="font-medium text-white">{v.os || 'Android'}</span>
                  <span className="text-[10px] text-dark-muted">({v.browser || 'Chrome'})</span>
                </div>

                <div className="text-center font-mono text-brand-secondary text-[11px] px-2 py-0.5 rounded bg-dark-bg border border-dark-border">
                  {v.current_page}
                </div>

                <Link
                  href="/dashboard/chats"
                  className="px-3 py-1.5 rounded-xl bg-brand-primary hover:bg-brand-primaryHover text-white text-xs font-semibold shadow-sm transition-all"
                >
                  Open Chat
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
