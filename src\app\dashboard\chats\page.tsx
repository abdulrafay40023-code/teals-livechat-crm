'use client';

import React, { useState, useEffect } from 'react';
import { LiveChatConsole, ChatSession } from '@/components/LiveChatConsole';
import { useLiveSync } from '@/context/LiveSyncContext';
import { getAllWebsites, getWebsiteConfig } from '@/lib/websites-config';
import {
  Globe, ShoppingCart, Rocket, BookOpen, PenTool, BookMarked,
  ExternalLink, Layers
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
        if (rawSession) return JSON.parse(rawSession);
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

  const [selectedWebsiteSlug, setSelectedWebsiteSlug] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('teals_active_website_tab');
        if (saved && saved !== 'all') return saved;
      } catch {}
    }
    return 'amz-solutions-hub';
  });

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
    try {
      localStorage.setItem('teals_active_website_tab', slug);
    } catch {}
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

  const filteredConversations = conversations.filter(c => {
    return (c.property_slug || 'amz-solutions-hub') === selectedWebsiteSlug;
  });

  const activeSiteConfig = getWebsiteConfig(selectedWebsiteSlug);

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
    </div>
  );
}
