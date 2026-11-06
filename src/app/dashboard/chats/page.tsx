'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo } from 'react';
import { LiveChatConsole, ChatSession } from '@/components/LiveChatConsole';
import { useLiveSync, LiveConversation } from '@/context/LiveSyncContext';
import { getAllWebsites, getWebsiteConfig } from '@/lib/websites-config';
import {
  Globe, ShoppingCart, Rocket, BookOpen, PenTool, BookMarked,
  ExternalLink, Layers, ArrowRight, ArrowLeft, MessageSquare, Sparkles
} from 'lucide-react';

export default function ChatsPage() {
  const [currentAgent, setCurrentAgent] = useState<{
    id: string;
    email: string;
    full_name: string;
    pseudo_name?: string;
    role: string;
    role_title?: string;
    assigned_websites?: string[];
  }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const ssoEmail = urlParams.get('sso_email');
        const ssoName = urlParams.get('sso_name');
        const ssoRole = urlParams.get('sso_role');
        const ssoPseudo = urlParams.get('sso_pseudo');
        const ssoRoleTitle = urlParams.get('sso_role_title');
        const ssoWebsitesRaw = urlParams.get('sso_websites');

        let assigned_websites: string[] = [];
        if (!ssoWebsitesRaw || ssoWebsitesRaw === 'all' || ssoWebsitesRaw === 'none') assigned_websites = [];
        else assigned_websites = ssoWebsitesRaw.split(',').map(s => s.trim().toLowerCase()).filter(s => Boolean(s) && s !== '__none__' && s !== 'none' && s !== 'all');

        if (ssoEmail) {
          const adminEmails = ['garryamelia6265@gmail.com', 'tzafar04@gmail.com', 'annusraees@gmail.com', 'jennifer.cisternino2027@gmail.com'];
          const cleanEmail = ssoEmail.toLowerCase().trim();
          const isAdm = ssoRole === 'admin' || adminEmails.includes(cleanEmail);
          const computedPseudo = ssoPseudo || (ssoName ? ssoName.split(' ')[0] : 'Support Agent');
          const computedRoleTitle = ssoRoleTitle && ssoRoleTitle !== 'Manager' ? ssoRoleTitle : (isAdm ? 'Admin' : 'Support Specialist');
          const ssoAgent = {
            id: `agent_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
            email: cleanEmail,
            full_name: ssoName || cleanEmail.split('@')[0],
            pseudo_name: computedPseudo,
            role: isAdm ? 'admin' : (ssoRole || 'agent'),
            role_title: computedRoleTitle,
            status: 'approved',
            assigned_websites: isAdm ? [] : assigned_websites,
          };
          localStorage.setItem('teals_agent_session', JSON.stringify(ssoAgent));
          localStorage.setItem('teals_assigned_websites', JSON.stringify(assigned_websites));
          return ssoAgent;
        }

        const rawSession = localStorage.getItem('teals_agent_session');
        if (rawSession) {
          const parsed = JSON.parse(rawSession);
          const adminEmails = ['garryamelia6265@gmail.com', 'tzafar04@gmail.com', 'annusraees@gmail.com', 'jennifer.cisternino2027@gmail.com'];
          if (parsed?.email && adminEmails.includes(parsed.email.toLowerCase())) {
            parsed.role = 'admin';
            if (!parsed.role_title || parsed.role_title === 'Manager') parsed.role_title = 'Admin';
          }
          return parsed;
        }
      } catch {}
    }
    return { id: 'agent_garry_admin', full_name: 'Garry Amelia', pseudo_name: 'Garry Amelia', email: 'garryamelia6265@gmail.com', role: 'admin', role_title: 'Admin', assigned_websites: [] };
  });

  const getSelectedKey = (email?: string) => {
    const clean = (email || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
    return clean ? `teals_selected_chat_${clean}` : 'teals_selected_chat_id';
  };

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  // Default to null so the user is never forced into any section automatically on entry
  const [selectedWebsiteSlug, setSelectedWebsiteSlug] = useState<string | null>(null);

  const { conversations, websites: contextWebsites, refreshSync, markConversationAsRead, readConvMap, isWebsitePermitted } = useLiveSync();

  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const websiteParam = urlParams.get('website') || urlParams.get('site') || urlParams.get('property');
      const chatParam = urlParams.get('chat') || urlParams.get('conversationId') || urlParams.get('visitor') || urlParams.get('visitor_token');
      
      if (websiteParam) {
        setSelectedWebsiteSlug(websiteParam);
      }

      if (chatParam) {
        setSelectedChatId(chatParam);
        const key = getSelectedKey(currentAgent?.email);
        try {
          localStorage.setItem(key, chatParam);
          localStorage.setItem('teals_selected_chat_id', chatParam);
        } catch {}
      }

      const ssoEmail = urlParams.get('sso_email');
      const ssoName = urlParams.get('sso_name');
      const ssoRole = urlParams.get('sso_role');
      const ssoPseudo = urlParams.get('sso_pseudo');
      const ssoRoleTitle = urlParams.get('sso_role_title');
      const ssoWebsitesRaw = urlParams.get('sso_websites');

      let assigned_websites: string[] = [];
      if (!ssoWebsitesRaw || ssoWebsitesRaw === 'all' || ssoWebsitesRaw === 'none') assigned_websites = [];
      else assigned_websites = ssoWebsitesRaw.split(',').map(s => s.trim().toLowerCase()).filter(s => Boolean(s) && s !== '__none__' && s !== 'none' && s !== 'all');

      let cachedPseudo = '';
      let cachedRoleTitle = '';
      try {
        const prevSession = localStorage.getItem('teals_agent_session');
        if (prevSession) {
          const parsed = JSON.parse(prevSession);
          cachedPseudo = parsed.pseudo_name || '';
          cachedRoleTitle = parsed.role_title || '';
        }
      } catch {}

      if (ssoEmail) {
        const adminEmails = ['garryamelia6265@gmail.com', 'jennifer.cisternino2027@gmail.com', 'ashal.raza@teals.co', 'tzafar04@gmail.com', 'annusraees@gmail.com'];
        const cleanEmail = ssoEmail.toLowerCase().trim();
        const isAdm = ssoRole === 'admin' || adminEmails.includes(cleanEmail);
        const ssoAgent = {
          id: `agent_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
          email: cleanEmail,
          full_name: ssoName || cleanEmail.split('@')[0],
          pseudo_name: ssoPseudo || cachedPseudo || (isAdm ? 'Admin' : undefined),
          role: isAdm ? 'admin' : (ssoRole || 'agent'),
          role_title: ssoRoleTitle && ssoRoleTitle !== 'Manager' ? ssoRoleTitle : (isAdm ? 'Admin' : (cachedRoleTitle || 'Support Specialist')),
          status: 'approved',
          assigned_websites: isAdm ? [] : assigned_websites,
        };
        localStorage.setItem('teals_agent_session', JSON.stringify(ssoAgent));
        localStorage.setItem('teals_assigned_websites', JSON.stringify(assigned_websites));
        setCurrentAgent(ssoAgent);

        // Fetch latest profile from CRM Supabase to ensure pseudo_name & role_title are synced
        import('@/lib/crm-supabase').then(({ crmSupabase }) => {
          crmSupabase.from('profiles').select('avatar_url, full_name, role').eq('email', cleanEmail).maybeSingle().then(({ data: prof }) => {
            if (prof?.avatar_url) {
              try {
                const meta = JSON.parse(prof.avatar_url);
                if (meta.pseudo_name || meta.role_title || meta.assigned_websites) {
                  setCurrentAgent(prev => {
                    const updated = {
                      ...prev,
                      full_name: prof.full_name || prev.full_name,
                      pseudo_name: meta.pseudo_name || prev.pseudo_name,
                      role_title: meta.role_title || prev.role_title,
                      assigned_websites: Array.isArray(meta.assigned_websites) ? meta.assigned_websites : prev.assigned_websites,
                    };
                    localStorage.setItem('teals_agent_session', JSON.stringify(updated));
                    if (Array.isArray(meta.assigned_websites)) {
                      localStorage.setItem('teals_assigned_websites', JSON.stringify(meta.assigned_websites));
                    }
                    return updated;
                  });
                }
              } catch {}
            }
          });
        });
        return;
      }
    } catch {}

    const rawSession = localStorage.getItem('teals_agent_session');
    if (rawSession) {
      try {
        const parsed = JSON.parse(rawSession);
        setCurrentAgent(parsed);
      } catch {}
    }
  }, []);

  const handleClaimSuccess = async () => {
    await refreshSync();
  };

  const handleSelectWebsiteTab = (slug: string) => {
    setSelectedWebsiteSlug(slug);
  };

  const websites = useMemo(() => {
    const list = contextWebsites && contextWebsites.length > 0 ? contextWebsites : getAllWebsites();
    return list.filter(w => isWebsitePermitted(w.slug));
  }, [contextWebsites, isWebsitePermitted, currentAgent, conversations]);

  useEffect(() => {
    if (selectedWebsiteSlug && !websites.some(w => w.slug === selectedWebsiteSlug)) {
      setSelectedWebsiteSlug(null);
    }
  }, [websites, selectedWebsiteSlug]);

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

  const adminEmails = ['garryamelia6265@gmail.com', 'tzafar04@gmail.com', 'annusraees@gmail.com'];
  const isAdmin = currentAgent.role === 'admin' || (currentAgent.email && adminEmails.includes(currentAgent.email.toLowerCase()));

  // Full visibility: Working agents and Admins see ALL conversations across all websites
  // Only include genuine conversations (where either visitor replied or agent sent proactive outreach)
  const isConvVisibleToAgent = (c: any) => {
    const hasVisitor = (c.messages || []).some((m: any) => m && m.sender_type === 'visitor' && m.content && m.content.trim().length > 0);
    const hasAgent = (c.messages || []).some((m: any) => m && m.sender_type === 'agent' && m.content && m.content.trim().length > 0);
    return hasVisitor || hasAgent || Boolean(c.is_proactive);
  };

  const agentConversations = conversations.filter(isConvVisibleToAgent);

  const getWebsiteStats = (slug: string) => {
    const list = agentConversations.filter(c => (c.property_slug || 'amz-solutions-hub') === slug);
    const unread = list.filter(convHasUnread).length;
    return { count: list.length, unread };
  };

  const filteredConversations = useMemo(() => {
    if (!selectedWebsiteSlug) return [];
    const list = agentConversations.filter(c => {
      return (c.property_slug || 'amz-solutions-hub') === selectedWebsiteSlug;
    });

    // If an agent clicked Chat from Monitoring table for a live visitor who has not messaged yet
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const visitorParam = urlParams.get('visitor') || urlParams.get('visitor_token') || urlParams.get('chat');
        if (visitorParam && !list.some(c => c.id === visitorParam || c.visitor_id === visitorParam)) {
          const proactiveConv: LiveConversation = {
            id: visitorParam,
            property_slug: selectedWebsiteSlug,
            visitor_id: visitorParam,
            visitor_name: 'Live Visitor',
            mode: 'human',
            status: 'active',
            assigned_agent_id: currentAgent.id,
            assigned_agent_name: currentAgent.full_name,
            assigned_agent_email: currentAgent.email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            messages: []
          };
          list.unshift(proactiveConv);
        }
      } catch {}
    }

    return list;
  }, [agentConversations, selectedWebsiteSlug, currentAgent]);

  const activeSiteConfig = selectedWebsiteSlug ? getWebsiteConfig(selectedWebsiteSlug) : null;

  const getWebsiteIcon = (slug: string) => {
    switch (slug) {
      case 'amz-solutions-hub': return ShoppingCart;
      case 'amz-innovators': return Rocket;
      case 'authors-breeze': return BookOpen;
      case 'pro-book-publishing': return PenTool;
      case 'amz-writers-hub': return BookMarked;
      case 'patch-and-promos': return Sparkles;
      default: return Globe;
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Header & Section Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">Active Chats & AI Handoff</h1>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center space-x-1">
              <Layers className="w-3 h-3" />
              <span>{websites.length} {websites.length === 1 ? 'Website' : 'Websites'} Connected</span>
            </span>
          </div>
          <p className="text-xs text-dark-muted mt-0.5">
            Dedicated Gemini AI engine per website with auto domain routing & isolated agent inboxes
          </p>
        </div>

        {activeSiteConfig && (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs bg-[#11192e] border border-dark-border px-3 py-1.5 rounded-xl self-start sm:self-auto max-w-full">
            <span className="w-2 h-2 rounded-full bg-brand-emerald animate-pulse shrink-0" />
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

      {/* Top Dedicated Website Isolated Inboxes (Hidden on mobile when in Section Picker view to avoid duplicate list) */}
      <div className={`${!selectedWebsiteSlug ? 'hidden sm:block' : 'block'} bg-[#0b101d] border border-dark-border rounded-2xl p-2 shadow-xl`}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {/* Distinct Dedicated Website Sections */}
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
        <div className="bg-[#0b101d] border border-dark-border rounded-2xl p-4 sm:p-10 shadow-2xl space-y-4 sm:space-y-6 text-center">
          <div className="max-w-xl mx-auto space-y-1.5 sm:space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] sm:text-xs font-bold">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Multi-Website Live Inboxes</span>
            </div>
            <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight">Select a Website Section</h2>
            <p className="text-xs sm:text-sm text-dark-muted">
              Choose which website inbox you want to open. Incoming visitor chats are completely isolated per website.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 max-w-5xl mx-auto text-left pt-1 sm:pt-2">
            {websites.map((site) => {
              const IconComponent = getWebsiteIcon(site.slug);
              const stats = getWebsiteStats(site.slug);

              return (
                <div
                  key={site.slug}
                  onClick={() => handleSelectWebsiteTab(site.slug)}
                  className="group bg-[#0e1628] hover:bg-[#131f38] border border-dark-border hover:border-blue-500/60 rounded-2xl p-3.5 sm:p-5 cursor-pointer transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/10 flex flex-col justify-between space-y-3 sm:space-y-4"
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
          currentAgent={currentAgent || { id: 'agent_garry_admin', full_name: 'Garry Amelia', pseudo_name: 'Garry Amelia', email: 'garryamelia6265@gmail.com', role: 'admin' }}
          selectedChatId={selectedChatId}
          conversations={filteredConversations as unknown as ChatSession[]}
          onUpdateAgent={(updated) => {
            setCurrentAgent(prev => {
              const next = { ...prev, ...updated };
              try { localStorage.setItem('teals_agent_session', JSON.stringify(next)); } catch {}
              return next;
            });
          }}
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
