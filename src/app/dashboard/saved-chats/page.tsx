'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Archive, Calendar, Search, ExternalLink, MessageSquare, Bot, UserCheck,
  Globe, Clock, Download, RefreshCw, Layers, Shield, FileText, CheckCircle2,
  Phone, Mail, ArrowRight, User
} from 'lucide-react';
import { getAllWebsites, WEBSITES, getWebsiteConfig } from '@/lib/websites-config';

interface SavedMessage {
  id: string;
  sender_type: 'visitor' | 'agent' | 'ai' | 'system';
  sender_name: string;
  content: string;
  is_whisper?: boolean;
  seq?: number;
  created_at: string;
}

interface SavedConversation {
  id: string;
  property_slug: string;
  visitor_id: string;
  visitor_name: string;
  visitor_email?: string;
  visitor_ip?: string;
  assigned_agent_id?: string;
  assigned_agent_name?: string;
  assigned_agent_email?: string;
  mode: 'ai' | 'human';
  status: 'active' | 'pending_agent' | 'closed';
  created_at: string;
  updated_at: string;
  messages: SavedMessage[];
}

export default function AllChatsSavePage() {
  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [selectedWebsite, setSelectedWebsite] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');

  const websites = getAllWebsites();
  const supabaseBucketUrl = 'https://supabase.com/dashboard/project/nyoegrnemmravwqdcqnp/storage/buckets/teals-livechat';

  const fetchSavedChats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/saved-chats');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.conversations) ? data.conversations : [];
        setConversations(list);
        if (list.length > 0 && !selectedConvId) {
          setSelectedConvId(list[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch saved chats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSavedChats();
  }, []);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter(c => {
      // 1. Website filter
      if (selectedWebsite !== 'all') {
        const p = (c.property_slug || '').toLowerCase();
        if (p !== selectedWebsite.toLowerCase()) return false;
      }

      // 2. Date filter (YYYY-MM-DD in PKT)
      if (selectedDateFilter !== 'all') {
        const created = c.created_at || c.updated_at || '';
        try {
          const sDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Karachi',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).format(new Date(created));
          if (sDate !== selectedDateFilter) return false;
        } catch {}
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (c.visitor_name || '').toLowerCase();
        const email = (c.visitor_email || '').toLowerCase();
        const ip = (c.visitor_ip || '').toLowerCase();
        const id = (c.id || '').toLowerCase();
        const msgMatch = (c.messages || []).some(m => (m.content || '').toLowerCase().includes(q));
        if (!name.includes(q) && !email.includes(q) && !ip.includes(q) && !id.includes(q) && !msgMatch) {
          return false;
        }
      }

      return true;
    });
  }, [conversations, selectedWebsite, selectedDateFilter, searchQuery]);

  // Group conversations by date (Day, Month, Date e.g. "Sunday, 07 September 2026")
  const groupedByDate = useMemo(() => {
    const groups: Record<string, { label: string; dateKey: string; items: SavedConversation[] }> = {};

    filteredConversations.forEach(c => {
      const dateObj = new Date(c.created_at || c.updated_at || Date.now());
      let dateKey = '';
      let dateLabel = '';

      try {
        dateKey = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Karachi',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(dateObj);

        dateLabel = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Karachi',
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        }).format(dateObj);
      } catch {
        dateKey = 'archive';
        dateLabel = 'Historical Archive';
      }

      if (!groups[dateKey]) {
        groups[dateKey] = {
          label: dateLabel,
          dateKey,
          items: []
        };
      }
      groups[dateKey].items.push(c);
    });

    // Sort dates newest first
    return Object.values(groups).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [filteredConversations]);

  // Map to identify Chat 1 vs Chat 2 for each visitor
  const emailToConvs = useMemo(() => {
    const map = new Map<string, SavedConversation[]>();
    conversations.forEach(c => {
      const key = (c.visitor_email || c.visitor_name || c.visitor_id || c.id).toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return map;
  }, [conversations]);

  const getChatNumberLabel = (conv: SavedConversation) => {
    const key = (conv.visitor_email || conv.visitor_name || conv.visitor_id || conv.id).toLowerCase();
    const group = emailToConvs.get(key) || [];
    if (group.length <= 1) return 'Chat 1 (Initial)';
    const sorted = [...group].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    const idx = sorted.findIndex(c => c.id === conv.id);
    return idx === 0 ? 'Chat 1 (Old)' : `Chat ${idx + 1} (New)`;
  };

  const selectedConversation = useMemo(() => {
    return conversations.find(c => c.id === selectedConvId) || filteredConversations[0] || null;
  }, [conversations, selectedConvId, filteredConversations]);

  const exportTranscript = () => {
    if (!selectedConversation) return;
    const lines = [
      `=========================================================`,
      `TEALS CRM - SAVED CHAT TRANSCRIPT`,
      `Website: ${getWebsiteConfig(selectedConversation.property_slug).name}`,
      `Visitor: ${selectedConversation.visitor_name || 'Anonymous Visitor'} (${selectedConversation.visitor_email || 'No email'})`,
      `Visitor IP: ${selectedConversation.visitor_ip || 'Unknown'}`,
      `Mode: ${selectedConversation.mode === 'human' ? 'Human Agent (' + (selectedConversation.assigned_agent_name || 'Agent') + ')' : 'AI Automated Support'}`,
      `Date: ${new Date(selectedConversation.created_at).toLocaleString()}`,
      `Chat ID: ${selectedConversation.id}`,
      `=========================================================\n`
    ];

    (selectedConversation.messages || []).forEach(m => {
      const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const sender = m.sender_type === 'visitor' ? selectedConversation.visitor_name || 'Visitor' :
                     m.sender_type === 'agent' ? m.sender_name || 'Human Agent' :
                     m.sender_type === 'ai' ? 'AI Assistant' : 'System';
      lines.push(`[${time}] ${sender}: ${m.content}`);
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_${selectedConversation.id}_transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatMessageTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Karachi',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(new Date(isoString));
    } catch {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  const getWebsiteBadge = (slug: string) => {
    const config = getWebsiteConfig(slug);
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
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#0e1628] border border-dark-border/80 rounded-2xl p-5 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
                <span>All Chats Save Page</span>
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-brand-emerald/15 text-brand-emerald border border-brand-emerald/30 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Permanent Cloud Archive</span>
                </span>
              </h1>
              <p className="text-xs text-dark-muted">
                Permanent day-by-day record of all conversations across all 5 websites (AI & Human Chats)
              </p>
            </div>
          </div>
        </div>

        {/* Supabase Storage Cloud Info & Refresh */}
        <div className="flex items-center space-x-3">
          <a
            href={supabaseBucketUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 rounded-xl bg-dark-card hover:bg-dark-cardHover border border-dark-border text-xs font-semibold text-brand-secondary hover:text-white transition-all flex items-center space-x-2 shadow-sm"
            title="Open Supabase Cloud Storage bucket where all conversation JSON files are saved"
          >
            <Shield className="w-3.5 h-3.5 text-brand-emerald" />
            <span>Supabase Cloud Bucket</span>
            <ExternalLink className="w-3 h-3 text-dark-muted" />
          </a>

          <button
            onClick={fetchSavedChats}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-brand-primary/15 hover:bg-brand-primary/25 border border-brand-primary/30 text-brand-secondary text-xs font-bold transition-all flex items-center space-x-2 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Archive</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-dark-card/90 border border-dark-border rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-dark-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search visitor, email, IP, message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0b101d] border border-dark-border/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-dark-muted focus:outline-none focus:border-brand-primary transition-all"
            />
          </div>

          {/* Website Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            <button
              onClick={() => setSelectedWebsite('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex-shrink-0 ${
                selectedWebsite === 'all'
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                  : 'bg-[#0b101d] text-dark-muted border-dark-border/80 hover:text-white'
              }`}
            >
              All Websites ({conversations.length})
            </button>
            {websites.map(site => (
              <button
                key={site.slug}
                onClick={() => setSelectedWebsite(site.slug)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex-shrink-0 ${
                  selectedWebsite === site.slug
                    ? 'bg-brand-primary/20 text-brand-secondary border-brand-primary/40'
                    : 'bg-[#0b101d] text-dark-muted border-dark-border/80 hover:text-white'
                }`}
              >
                {site.shortName}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[620px]">
        {/* Left Column: Date-wise Saved Chats List (5 cols) */}
        <div className="lg:col-span-5 bg-dark-card border border-dark-border rounded-2xl p-4 flex flex-col h-[650px] shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-dark-border text-xs">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-brand-secondary" />
              <span className="font-bold text-white">Date-Wise Chats ({filteredConversations.length})</span>
            </div>
            <span className="text-[11px] text-dark-muted">Chat 1 & Chat 2 History</span>
          </div>

          {/* Chat List Scroll Area */}
          <div className="flex-1 overflow-y-auto space-y-4 pt-3 pr-1">
            {loading ? (
              <div className="py-20 text-center text-dark-muted space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-secondary" />
                <p className="text-xs">Loading saved conversations from cloud storage...</p>
              </div>
            ) : groupedByDate.length === 0 ? (
              <div className="py-20 text-center text-dark-muted space-y-2">
                <Archive className="w-8 h-8 mx-auto text-dark-border" />
                <p className="font-semibold text-white text-xs">No saved chats found</p>
                <p className="text-[11px]">As visitors chat on websites, all historical conversations are automatically preserved here.</p>
              </div>
            ) : (
              groupedByDate.map(group => (
                <div key={group.dateKey} className="space-y-2">
                  {/* Date Header */}
                  <div className="sticky top-0 bg-[#0e1628]/95 backdrop-blur py-1 px-2.5 rounded-lg border border-dark-border/60 flex items-center justify-between z-10">
                    <span className="text-[11px] font-bold text-brand-secondary flex items-center space-x-1.5">
                      <Calendar className="w-3 h-3" />
                      <span>{group.label}</span>
                    </span>
                    <span className="text-[10px] text-dark-muted font-bold px-1.5 py-0.5 rounded bg-dark-bg">
                      {group.items.length} {group.items.length === 1 ? 'Chat' : 'Chats'}
                    </span>
                  </div>

                  {/* Conversation Cards in this date group */}
                  <div className="space-y-2">
                    {group.items.map(conv => {
                      const isSelected = selectedConvId === conv.id;
                      const siteBadge = getWebsiteBadge(conv.property_slug);
                      const chatLabel = getChatNumberLabel(conv);
                      const lastMsg = conv.messages && conv.messages.length > 0
                        ? conv.messages[conv.messages.length - 1]
                        : null;
                      const isHuman = conv.mode === 'human' || !!conv.assigned_agent_id;

                      return (
                        <div
                          key={conv.id}
                          onClick={() => setSelectedConvId(conv.id)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                            isSelected
                              ? 'bg-[#15223e] border-blue-500 shadow-md shadow-blue-500/10 ring-1 ring-blue-500/40'
                              : 'bg-[#0b101d] border-dark-border/70 hover:border-dark-border hover:bg-dark-cardHover'
                          }`}
                        >
                          {/* Top Row: Visitor Name & Website Badge */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center space-x-2">
                                <h4 className="text-xs font-bold text-white truncate">
                                  {conv.visitor_name || 'Anonymous Visitor'}
                                </h4>
                                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 flex-shrink-0">
                                  {chatLabel}
                                </span>
                              </div>
                              <p className="text-[10px] text-dark-muted truncate mt-0.5">
                                {conv.visitor_email || conv.visitor_ip || 'No email provided'}
                              </p>
                            </div>

                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border flex-shrink-0 ${siteBadge.badge}`}>
                              {siteBadge.label}
                            </span>
                          </div>

                          {/* Middle: Last Message Snippet */}
                          {lastMsg && (
                            <p className="text-[11px] text-dark-muted line-clamp-1 italic">
                              &ldquo;{lastMsg.content}&rdquo;
                            </p>
                          )}

                          {/* Bottom: Mode, Messages Count & Time */}
                          <div className="flex items-center justify-between text-[10px] text-dark-muted pt-1 border-t border-dark-border/40">
                            <div className="flex items-center space-x-1.5">
                              {isHuman ? (
                                <span className="text-amber-400 font-semibold flex items-center space-x-1">
                                  <UserCheck className="w-3 h-3" />
                                  <span>Agent: {conv.assigned_agent_name || 'Staff'}</span>
                                </span>
                              ) : (
                                <span className="text-purple-400 font-semibold flex items-center space-x-1">
                                  <Bot className="w-3 h-3" />
                                  <span>AI Automated</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center space-x-2">
                              <span>{conv.messages?.length || 0} msgs</span>
                              <span className="text-white font-mono">{formatMessageTime(conv.updated_at || conv.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Full Conversation Transcript Viewer (7 cols) */}
        <div className="lg:col-span-7 bg-dark-card border border-dark-border rounded-2xl flex flex-col h-[650px] shadow-xl overflow-hidden">
          {selectedConversation ? (
            <>
              {/* Transcript Header */}
              <div className="p-4 px-6 border-b border-dark-border bg-dark-surface/60 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-xl bg-brand-primary/15 border border-brand-primary/30 flex items-center justify-center text-brand-secondary flex-shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white truncate">
                        {selectedConversation.visitor_name || 'Anonymous Visitor'}
                      </h3>
                      <div className="flex items-center space-x-2 text-[11px] text-dark-muted truncate">
                        <span>{selectedConversation.visitor_email || 'No email'}</span>
                        <span>•</span>
                        <span>IP: {selectedConversation.visitor_ip || 'Hidden'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <button
                    onClick={exportTranscript}
                    title="Export transcript as text file"
                    className="px-3 py-1.5 rounded-xl bg-dark-bg hover:bg-dark-cardHover border border-dark-border text-xs font-semibold text-white transition-all flex items-center space-x-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-brand-secondary" />
                    <span>Download TXT</span>
                  </button>
                </div>
              </div>

              {/* Conversation Meta Bar */}
              <div className="px-6 py-2.5 bg-[#0b101d] border-b border-dark-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-dark-muted">
                <div className="flex items-center space-x-3">
                  <span className="flex items-center space-x-1">
                    <Globe className="w-3.5 h-3.5 text-brand-secondary" />
                    <span className="font-semibold text-white">{getWebsiteConfig(selectedConversation.property_slug).name}</span>
                  </span>
                  <span>•</span>
                  <span>{getChatNumberLabel(selectedConversation)}</span>
                </div>

                <div className="flex items-center space-x-3 font-mono">
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-dark-muted" />
                    <span>{new Date(selectedConversation.created_at).toLocaleDateString()} {formatMessageTime(selectedConversation.created_at)}</span>
                  </span>
                </div>
              </div>

              {/* Messages Thread */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-dark-bg/40">
                {(!selectedConversation.messages || selectedConversation.messages.length === 0) ? (
                  <div className="py-20 text-center text-dark-muted space-y-2">
                    <MessageSquare className="w-8 h-8 mx-auto text-dark-border" />
                    <p className="text-xs">No message logs recorded in this session</p>
                  </div>
                ) : (
                  selectedConversation.messages.map((m, index) => {
                    const isVisitor = m.sender_type === 'visitor';
                    const isAgent = m.sender_type === 'agent';
                    const isAi = m.sender_type === 'ai';
                    const isSystem = m.sender_type === 'system';

                    if (isSystem) {
                      return (
                        <div key={m.id || index} className="flex justify-center my-2">
                          <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-dark-card border border-dark-border text-dark-muted">
                            ⚙️ {m.content}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={m.id || index}
                        className={`flex flex-col ${isVisitor ? 'items-start' : 'items-end'}`}
                      >
                        {/* Sender Label & Timestamp */}
                        <div className="flex items-center space-x-2 text-[10px] text-dark-muted mb-1 px-1">
                          <span className="font-bold text-white">
                            {isVisitor
                              ? (selectedConversation.visitor_name || 'Visitor')
                              : isAgent
                              ? (m.sender_name || selectedConversation.assigned_agent_name || 'Live Agent')
                              : 'AI Assistant'}
                          </span>
                          <span>•</span>
                          <span className="font-mono">{formatMessageTime(m.created_at)}</span>
                        </div>

                        {/* Bubble */}
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-md leading-relaxed ${
                            isVisitor
                              ? 'bg-[#15223e] border border-blue-500/30 text-white rounded-tl-sm'
                              : isAgent
                              ? 'bg-brand-primary text-white rounded-tr-sm'
                              : 'bg-[#1f1938] border border-purple-500/30 text-purple-100 rounded-tr-sm'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Transcript Footer */}
              <div className="p-3 px-6 border-t border-dark-border/80 bg-dark-card flex items-center justify-between text-[11px] text-dark-muted">
                <span>Chat ID: <code className="text-white font-mono text-[10px]">{selectedConversation.id}</code></span>
                <span>Total Messages: <strong className="text-white">{selectedConversation.messages?.length || 0}</strong></span>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-dark-muted space-y-3">
              <FileText className="w-12 h-12 text-dark-border animate-pulse" />
              <p className="text-sm font-semibold text-white">Select a conversation from the left column</p>
              <p className="text-xs max-w-sm">Click on any saved chat entry on the left to read its complete transcript, timestamps, and visitor information.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
