'use client';

import React, { useState, useEffect } from 'react';
import { LiveChatConsole, ChatSession } from '@/components/LiveChatConsole';
import { useLiveSync } from '@/context/LiveSyncContext';
import { getAllWebsites, getWebsiteConfig } from '@/lib/websites-config';
import {
  Globe, ShoppingCart, Rocket, BookOpen, PenTool, BookMarked,
  ExternalLink, Layers, ArrowRight, ArrowLeft, MessageSquare
} from 'lucide-react';

export default function ChatsPage() {
  const [currentAgent, setCurrentAgent] = useState<{
    id: string;
    email: string;
    full_name: string;
    role: string;
  }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const rawSession = localStorage.getItem('teals_agent_session');
        if (rawSession) {
          const parsed = JSON.parse(rawSession);
          const adminEmails = ['garryamelia6265@gmail.com', 'tzafar04@gmail.com', 'annusraees@gmail.com'];
          if (parsed?.email && adminEmails.includes(parsed.email.toLowerCase())) {
            parsed.role = 'admin';
          }
          return parsed;
        }
      } catch {}
    }
    return { id: 'agent_garry_admin', full_name: 'Garry Amelia', email: 'garryamelia6265@gmail.com', role: 'admin' };
  });

  const getSelectedKey = (email?: string) => {
    const clean = (email || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
    return clean ? `teals_selected_chat_${clean}` : 'teals_selected_chat_id';
  };

  const [selectedChatId, setSelectedChatId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('teals_agent_session');
        const email = raw ? JSON.parse(raw)?.email : '';
        const key = (email || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
        return localStorage.getItem(key ? `teals_selected_chat_${key}` : 'teals_selected_chat_id') || null;
      } catch {}
    }
    return null;
  });

  // Default to null so the user is never forced into any section automatically on entry
  const [selectedWebsiteSlug, setSelectedWebsiteSlug] = useState<string | null>(null);

  const { conversations, refreshSync, markConversationAsRead, readConvMap } = useLiveSync();

  useEffect(() => {
    const rawSession = localStorage.getItem('teals_agent_session');
    if (rawSession) {
      try {
        const parsed = JSON.parse(rawSession);
        setCurrentAgent(parsed);
        const key = getSelectedKey(parsed.email);
        const saved = localStorage.getItem(key);
        if (saved) setSelectedChatId(saved);
      } catch {}
    }
  }, []);

  const handleClaimSuccess = async () => {
    await refreshSync();
  };

  const handleSelectWebsiteTab = (slug: string) => {
    setSelectedWebsiteSlug(slug);
  };

  const websites = getAllWebsites();

  // Helper to compute unread count for any conversation
  const convHasUnread = (c: any) => {
    if (c.id === selectedChatId) return false;
    if (!c.messages || c.messages.length === 0) return false;
    const visitorMsgs = c.messages.filter((m: any) => m.sender_type === 'visitor');
    if (visitorMsgs.length === 0) return false;
    const lastMsg = visitorMsgs[visitorMsgs.length - 1];
    const readVal = readConvMap?.[c.id];
    if (!readVal) return true;
    let savedId = readVal;
    if (readVal.includes('__')) savedId = readVal.split('__')[0];
    return savedId !== lastMsg.id && savedId !== 'all';
  };

  const getWebsiteStats = (slug: string) => {
    const list = conversations.filter(c => (c.property_slug || 'amz-solutions-hub') === slug);
    const unread = list.filter(convHasUnread).length;
    return { count: list.length, unread };
  };

  const filteredConversations = selectedWebsiteSlug ? conversations.filter(c => {
    return (c.property_slug || 'amz-solutions-hub') === selectedWebsiteSlug;
  }) : [];

  const activeSiteConfig = selectedWebsiteSlug ? getWebsiteConfig(selectedWebsiteSlug) : null;

  const getWebsiteIcon = (slug: string) => {
    switch (slug) {
      case 'amz-solutions-hub': return ShoppingCart;
      case 'amz-innovators': return Rocket;
      case 'authors-breeze': return BookOpen;
      case 'pro-book-publishing': return PenTool;
      case 'amz-writers-hub': return BookMarked;
      default: return Globe;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-3">
      {/* Header & Section Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Active Chats & AI Handoff</h1>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center space-x-1">
              <Layers className="w-3 h-3" />
              <span>5 Websites Connected</span>
            </span>
          </div>
          <p className="text-xs text-dark-muted mt-0.5">
            Dedicated Gemini AI engine per website with auto domain routing & isolated agent inboxes
          </p>
        </div>

        {activeSiteConfig && (
          <div className="flex items-center space-x-2 text-xs bg-[#11192e] border border-dark-border px-3 py-1.5 rounded-xl self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-brand-emerald animate-pulse" />
            <span className="text-white font-semibold">{activeSiteConfig.shortName} Section</span>
            <span className="text-dark-muted">•</span>
            <a
              href={activeSiteConfig.url}
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 hover:underline flex items-center space-x-1 text-[11px]"
            >
              <span>{activeSiteConfig.domain}</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
            <span className="text-dark-muted">•</span>
            <button
              onClick={() => setSelectedWebsiteSlug(null)}
              className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-gray-700 text-[11px] font-medium flex items-center space-x-1 transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>All Sections</span>
            </button>
          </div>
        )}
      </div>

      {/* Top 5-Website Dedicated Isolated Inboxes */}
      <div className="bg-[#0b101d] border border-dark-border rounded-2xl p-2 shadow-xl">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {/* 5 Distinct Dedicated Website Sections */}
          {websites.map((site) => {
            const IconComponent = getWebsiteIcon(site.slug);
            const isSelected = selectedWebsiteSlug === site.slug;
            const stats = getWebsiteStats(site.slug);

            return (
              <button
                key={site.slug}
                type="button"
                onClick={() => handleSelectWebsiteTab(site.slug)}
                className={`p-2 rounded-xl text-left transition-all relative border flex flex-col justify-between ${
                  isSelected
                    ? 'bg-[#15223e] border-blue-500 shadow-lg shadow-blue-500/20 text-white'
                    : 'bg-[#0d1424] border-transparent hover:border-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <IconComponent className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-blue-400' : 'text-gray-500'}`} />
                    <span className="text-xs font-bold truncate">{site.shortName}</span>
                  </div>
                  {stats.unread > 0 ? (
                    <span className="min-w-[17px] h-[17px] px-1 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse shadow-sm shadow-rose-500/50 flex-shrink-0">
                      {stats.unread}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center justify-between mt-1 text-[10px] text-gray-400">
                  <span className="truncate text-[9px] text-gray-500">{site.domain}</span>
                  <span className={`px-1.5 py-0.2 rounded-full font-bold text-[9px] ${
                    stats.count > 0 ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'bg-white/10 text-gray-400'
                  }`}>
                    {stats.count}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {!selectedWebsiteSlug ? (
        <div className="bg-[#0b101d] border border-dark-border rounded-2xl p-6 sm:p-10 shadow-2xl space-y-6 text-center">
          <div className="max-w-xl mx-auto space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Multi-Website Live Inboxes</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Select a Website Section</h2>
            <p className="text-xs sm:text-sm text-dark-muted">
              Choose which website inbox you want to open. Incoming visitor chats are completely isolated per website.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto text-left pt-2">
            {websites.map((site) => {
              const IconComponent = getWebsiteIcon(site.slug);
              const stats = getWebsiteStats(site.slug);

              return (
                <div
                  key={site.slug}
                  onClick={() => handleSelectWebsiteTab(site.slug)}
                  className="group bg-[#0e1628] hover:bg-[#131f38] border border-dark-border hover:border-blue-500/60 rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/10 flex flex-col justify-between space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-110 group-hover:text-white group-hover:bg-blue-600 transition-all">
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                          {site.name}
                        </h3>
                        <span className="text-[11px] text-dark-muted">{site.domain}</span>
                      </div>
                    </div>

                    {stats.unread > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black animate-pulse shadow-md shadow-rose-500/40">
                        {stats.unread} New
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-dark-border/60 flex items-center justify-between text-xs">
                    <span className="text-dark-muted">
                      Active Chats: <strong className="text-white font-bold">{stats.count}</strong>
                    </span>
                    <span className="text-blue-400 font-semibold flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                      <span>Open Inbox</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <LiveChatConsole
          currentAgent={currentAgent || { id: 'agent_garry_admin', full_name: 'Garry Amelia', email: 'garryamelia6265@gmail.com', role: 'admin' }}
          selectedChatId={selectedChatId}
          conversations={filteredConversations as unknown as ChatSession[]}
          onSelectChat={(id) => {
            setSelectedChatId(id || null);
            const key = getSelectedKey(currentAgent?.email);
            if (id) {
              try {
                localStorage.setItem(key, id);
                localStorage.setItem('teals_selected_chat_id', id);
              } catch {}
              markConversationAsRead(id);
            } else {
              try {
                localStorage.removeItem(key);
                localStorage.removeItem('teals_selected_chat_id');
              } catch {}
            }
          }}
          onClaimSuccess={handleClaimSuccess}
          onMarkRead={markConversationAsRead}
        />
      )}
    </div>
  );
}
