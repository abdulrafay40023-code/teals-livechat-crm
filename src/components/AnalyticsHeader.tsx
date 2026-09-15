'use client';

import React from 'react';
import { Users, MessageSquare, Eye, CheckCircle2, TrendingUp, Radio } from 'lucide-react';

interface AnalyticsProps {
  liveVisitorsCount: number;
  activeChatsCount: number;
  answeredChatsCount: number;
  missedChatsCount: number;
  totalPageViews: number;
}

export const AnalyticsHeader: React.FC<AnalyticsProps> = ({
  liveVisitorsCount,
  activeChatsCount,
  answeredChatsCount,
  missedChatsCount,
  totalPageViews,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Live Visitors Card */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 flex items-center justify-between shadow-sm hover:border-brand-primary/40 transition-all">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-brand-emerald animate-ping" />
            <p className="text-xs font-medium text-dark-muted uppercase tracking-wider">Live Visitors Now</p>
          </div>
          <div className="flex items-baseline space-x-2 mt-2">
            <h3 className="text-2xl font-black text-dark-text">{liveVisitorsCount}</h3>
            <span className="text-xs font-semibold text-brand-emerald flex items-center">
              <TrendingUp className="w-3 h-3 mr-0.5" /> +100%
            </span>
          </div>
          <p className="text-[11px] text-dark-muted mt-1">Real-time traffic active</p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
          <Radio className="w-6 h-6 animate-pulse text-brand-emerald" />
        </div>
      </div>

      {/* Active Chats Card */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 flex items-center justify-between shadow-sm hover:border-brand-secondary/40 transition-all">
        <div>
          <p className="text-xs font-medium text-dark-muted uppercase tracking-wider">Active Conversations</p>
          <div className="flex items-baseline space-x-2 mt-2">
            <h3 className="text-2xl font-black text-dark-text">{activeChatsCount}</h3>
            <span className="text-xs font-semibold text-brand-secondary">AI & Live</span>
          </div>
          <p className="text-[11px] text-dark-muted mt-1">Instant sync connected</p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-brand-secondary/10 border border-brand-secondary/20 flex items-center justify-center text-brand-secondary">
          <MessageSquare className="w-6 h-6" />
        </div>
      </div>

      {/* Answered vs Missed */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 flex items-center justify-between shadow-sm hover:border-brand-emerald/40 transition-all">
        <div>
          <p className="text-xs font-medium text-dark-muted uppercase tracking-wider">Chats Handled</p>
          <div className="flex items-baseline space-x-3 mt-2">
            <div>
              <span className="text-xl font-bold text-brand-emerald">{answeredChatsCount}</span>
              <span className="text-[10px] text-dark-muted ml-1">Answered</span>
            </div>
            <div>
              <span className="text-xl font-bold text-dark-muted">{missedChatsCount}</span>
              <span className="text-[10px] text-dark-muted ml-1">Missed</span>
            </div>
          </div>
          <p className="text-[11px] text-brand-emerald mt-1">100% AI Uptime</p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-brand-emerald/10 border border-brand-emerald/20 flex items-center justify-center text-brand-emerald">
          <CheckCircle2 className="w-6 h-6" />
        </div>
      </div>

      {/* Page Views Card */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 flex items-center justify-between shadow-sm hover:border-brand-accent/40 transition-all">
        <div>
          <p className="text-xs font-medium text-dark-muted uppercase tracking-wider">Page Views Tracked</p>
          <div className="flex items-baseline space-x-2 mt-2">
            <h3 className="text-2xl font-black text-dark-text">{totalPageViews}</h3>
            <span className="text-xs font-semibold text-brand-accent">Today</span>
          </div>
          <p className="text-[11px] text-dark-muted mt-1">Live routing monitored</p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center text-brand-accent">
          <Eye className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};
