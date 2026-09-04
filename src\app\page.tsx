'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, Shield, ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-dark-bg flex flex-col justify-between p-6 sm:p-12 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-brand-primary/15 blur-[120px] rounded-full pointer-events-none" />

      {/* Top Navbar */}
      <header className="flex items-center justify-between z-10 max-w-6xl mx-auto w-full">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-primary to-brand-secondary flex items-center justify-center shadow-xl shadow-brand-primary/30">
            <span className="text-white font-black text-xl">T</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-dark-text">Teals LiveChat SaaS</h1>
            <p className="text-xs text-dark-muted">Real-Time AI & Human Support</p>
          </div>
        </div>

        <div>
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-primary to-brand-primaryHover text-white text-xs font-bold shadow-lg shadow-brand-primary/20 hover:opacity-95 transition-all flex items-center space-x-1.5"
          >
            <span>Agent Login</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto text-center my-auto py-16 z-10">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-brand-primary/10 border border-brand-primary/20 mb-6">
          <Sparkles className="w-4 h-4 text-brand-secondary" />
          <span className="text-xs font-bold text-brand-secondary">Next-Gen Live Chat + AI Handoff</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-dark-text tracking-tight leading-tight">
          Supercharge Customer Sales with <span className="bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-accent bg-clip-text text-transparent">Live AI & Human Intelligence</span>
        </h1>

        <p className="text-sm sm:text-base text-dark-muted mt-6 max-w-2xl mx-auto leading-relaxed">
          Embed modern live chat onto Teals CRM or Leadzmaker in seconds. Track visitors live with country geolocation, sound chimes, Gemini AI auto-support, and seamless live agent takeover.
        </p>

        <div className="flex items-center justify-center gap-4 mt-8">
          <Link
            href="/login"
            className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-brand-primary to-brand-primaryHover text-white text-sm font-bold shadow-xl shadow-brand-primary/30 hover:scale-105 transition-all flex items-center justify-center space-x-2"
          >
            <span>Sign In to Agent Portal →</span>
          </Link>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 text-left">
          <div className="bg-dark-card/60 border border-dark-border rounded-2xl p-5 hover:border-brand-primary/40 transition-all">
            <div className="w-3 h-3 rounded-full bg-brand-emerald animate-ping mb-3" />
            <h3 className="text-sm font-bold text-dark-text">Live Visitor Monitoring</h3>
            <p className="text-xs text-dark-muted mt-1.5 leading-relaxed">
              Track IP, country flags, active pages, referrers, and receive instant 3-tone chime alerts.
            </p>
          </div>

          <div className="bg-dark-card/60 border border-dark-border rounded-2xl p-5 hover:border-brand-secondary/40 transition-all">
            <Sparkles className="w-6 h-6 text-brand-primary mb-3" />
            <h3 className="text-sm font-bold text-dark-text">Gemini AI Auto-Assistant</h3>
            <p className="text-xs text-dark-muted mt-1.5 leading-relaxed">
              Answers customer questions automatically and transfers to live agents upon request.
            </p>
          </div>

          <div className="bg-dark-card/60 border border-dark-border rounded-2xl p-5 hover:border-brand-accent/40 transition-all">
            <Shield className="w-6 h-6 text-brand-accent mb-3" />
            <h3 className="text-sm font-bold text-dark-text">Admin & Agent Approvals</h3>
            <p className="text-xs text-dark-muted mt-1.5 leading-relaxed">
              Strict multi-agent approval workflows with real-time sneak peek typing preview.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-dark-muted py-4 border-t border-dark-border z-10">
        Teals CRM LiveChat Suite &copy; {new Date().getFullYear()} — Built with Supabase & Google Gemini AI.
      </footer>
    </div>
  );
}
