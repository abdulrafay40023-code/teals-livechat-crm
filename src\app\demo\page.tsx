'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Sparkles, Users, Mail, Calendar, CheckCircle2, TrendingUp, Bell, RefreshCw, ExternalLink } from 'lucide-react';
import { WidgetChat } from '@/components/WidgetChat';

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-dark-bg text-dark-text relative">
      {/* Teals CRM Header Mockup */}
      <header className="h-16 border-b border-dark-border bg-dark-surface/80 px-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-primary to-brand-secondary flex items-center justify-center text-white font-bold">
            T
          </div>
          <div>
            <h1 className="text-sm font-bold text-dark-text">Teals CRM</h1>
            <p className="text-[10px] text-dark-muted">AI Sales Suite (Live Demo Site)</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/dashboard"
            target="_blank"
            className="px-3.5 py-1.5 rounded-xl bg-brand-primary/15 hover:bg-brand-primary text-brand-secondary hover:text-white border border-brand-primary/30 text-xs font-semibold flex items-center space-x-1.5 transition-all"
          >
            <span>Open Agent Dashboard in New Tab</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* CRM Main Dashboard Mockup (Matching Screenshot 5) */}
      <main className="p-6 sm:p-10 max-w-6xl mx-auto space-y-6">
        <div>
          <div className="flex items-center space-x-2 text-xs text-brand-emerald mb-1">
            <span className="w-2 h-2 rounded-full bg-brand-emerald animate-ping" />
            <span>Live • Connected to LiveChat Hub</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-dark-text">
            Good afternoon, Garry
          </h1>
          <p className="text-xs text-dark-muted mt-1">
            Here is how your sales pipeline is performing today.
          </p>
        </div>

        {/* Pipeline Cards Mockup */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-dark-card border border-dark-border rounded-xl p-4">
            <p className="text-[11px] text-dark-muted font-medium">Total Leads</p>
            <h3 className="text-xl font-bold text-dark-text mt-1">1,248</h3>
            <span className="text-[10px] text-brand-emerald">+12% today</span>
          </div>
          <div className="bg-dark-card border border-dark-border rounded-xl p-4">
            <p className="text-[11px] text-dark-muted font-medium">Contacted</p>
            <h3 className="text-xl font-bold text-dark-text mt-1">842</h3>
            <span className="text-[10px] text-brand-secondary">Automated</span>
          </div>
          <div className="bg-dark-card border border-dark-border rounded-xl p-4">
            <p className="text-[11px] text-dark-muted font-medium">Meetings Booked</p>
            <h3 className="text-xl font-bold text-dark-text mt-1">54</h3>
            <span className="text-[10px] text-brand-amber">High intent</span>
          </div>
          <div className="bg-dark-card border border-dark-border rounded-xl p-4">
            <p className="text-[11px] text-dark-muted font-medium">Meetings Today</p>
            <h3 className="text-xl font-bold text-dark-text mt-1">6</h3>
            <span className="text-[10px] text-dark-muted">Scheduled</span>
          </div>
          <div className="bg-dark-card border border-dark-border rounded-xl p-4">
            <p className="text-[11px] text-dark-muted font-medium">Tomorrow</p>
            <h3 className="text-xl font-bold text-dark-text mt-1">8</h3>
            <span className="text-[10px] text-dark-muted">Upcoming</span>
          </div>
          <div className="bg-dark-card border border-dark-border rounded-xl p-4">
            <p className="text-[11px] text-dark-muted font-medium">Won Deals</p>
            <h3 className="text-xl font-bold text-brand-emerald mt-1">$42,800</h3>
            <span className="text-[10px] text-brand-emerald">Closed</span>
          </div>
        </div>

        {/* Demo Info Callout */}
        <div className="bg-dark-card/90 border border-brand-primary/30 rounded-2xl p-6 shadow-xl space-y-3">
          <div className="flex items-center space-x-2 text-brand-secondary font-bold text-sm">
            <Sparkles className="w-5 h-5" />
            <span>Interactive LiveChat Widget Simulation</span>
          </div>
          <p className="text-xs text-dark-muted leading-relaxed">
            By visiting this page, your session is already tracked on the <strong className="text-dark-text">Agent Dashboard</strong>. 
            Click the circular chat launcher at the bottom-right to test Gemini AI auto-replies, request human assistance, or watch real-time typing sneak peek!
          </p>
        </div>
      </main>

      {/* Floating Embedded LiveChat Widget */}
      <WidgetChat propertySlug="teals-crm" />
    </div>
  );
}
