'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { crmSupabase } from '@/lib/crm-supabase';
import { REALTIME_CHANNEL } from '@/lib/realtime';
import {
  WebsiteConfig,
  getAllWebsites,
  registerCustomWebsite,
  unregisterWebsite,
  syncCustomWebsitesFromList,
} from '@/lib/websites-config';
import {
  playVisitorAlertSound,
  playChatMessageAlertSound,
  playHandoffAlertSound,
  startContinuousHandoffRinger,
  stopContinuousHandoffRinger,
  initAndUnlockAudio,
  showBackgroundNotification,
  flashTabTitle,
  stopTabTitleFlash,
  requestNotificationPermission,
  tryPlayDeduplicatedSound,
  isEventAlreadyPlayed,
  markEventAsPlayed,
  startWaitingForHumanBeep,
  stopWaitingForHumanBeep,
  clearAudioEventLocks,
  createWorkerInterval,
} from '@/lib/audio';

const ADMIN_EMAILS = ['garryamelia6265@gmail.com', 'tzafar04@gmail.com', 'annusraees@gmail.com', 'jennifer.cisternino2027@gmail.com'];
const BASE_5_SLUGS = ['amz-solutions-hub', 'amz-innovators', 'authors-breeze', 'pro-book-publishing', 'amz-writers-hub'];

export const checkIsAdmin = (user?: { role?: string; email?: string } | null): boolean => {
  if (!user) return true;
  if (user.role === 'admin') return true;
  const email = (user.email || '').toLowerCase().trim();
  return ADMIN_EMAILS.includes(email) || email.includes('garryamelia') || email.includes('tzafar04') || email.includes('annusraees') || email.includes('jennifer.cisternino');
};

export const normalizeWebsiteSlug = (raw?: string | null): string => {
  if (!raw) return '';
  const str = raw.toLowerCase().trim();
  if (str.includes('solutions') || str.includes('amz-solutions') || str.includes('amzsolutions')) return 'amz-solutions-hub';
  if (str.includes('innovators') || str.includes('amz-innovators') || str.includes('amzinnovators')) return 'amz-innovators';
  if (str.includes('breeze') || str.includes('authors-breeze') || str.includes('authorsbreeze')) return 'authors-breeze';
  if (str.includes('pro-book') || str.includes('probook') || str.includes('publishing')) return 'pro-book-publishing';
  if (str.includes('writers') || str.includes('amz-writers') || str.includes('amzwriters')) return 'amz-writers-hub';
  if (str.includes('patch') || str.includes('promos') || str.includes('patchandpromos')) return 'patch-and-promos';
  return str;
};

export const getCurrentAgentPermissions = (): { isAdmin: boolean; assignedWebsites: string[] } => {
  if (typeof window === 'undefined') return { isAdmin: true, assignedWebsites: [] };
  try {
    let email = '';
    let role = '';
    const rawSession = localStorage.getItem('teals_agent_session');
    if (rawSession) {
      try {
        const u = JSON.parse(rawSession);
        if (checkIsAdmin(u)) return { isAdmin: true, assignedWebsites: [] };
        if (u.email) email = (u.email || '').toLowerCase().trim();
        if (u.role) role = (u.role || '').toLowerCase().trim();
      } catch {}
    }

    const savedRole = localStorage.getItem('teals_agent_role');
    if (savedRole === 'admin') return { isAdmin: true, assignedWebsites: [] };

    const params = new URLSearchParams(window.location.search);
    const ssoEmail = (params.get('sso_email') || '').toLowerCase().trim();
    const ssoRole = (params.get('sso_role') || '').toLowerCase().trim();
    const effectiveEmail = email || ssoEmail;
    const effectiveRole = role || ssoRole;

    if (effectiveRole === 'admin' || ADMIN_EMAILS.includes(effectiveEmail)) {
      try {
        localStorage.setItem('teals_agent_role', 'admin');
      } catch {}
      return { isAdmin: true, assignedWebsites: [] };
    }

    // 1. Authoritative URL SSO params from CRM parent iframe
    if (params.has('sso_websites')) {
      const ssoWebsitesRaw = params.get('sso_websites');
      let list: string[] = [];
      if (!ssoWebsitesRaw || ssoWebsitesRaw === 'all') {
        try {
          localStorage.setItem('teals_agent_role', 'admin');
          localStorage.removeItem('teals_assigned_websites');
        } catch {}
        return { isAdmin: true, assignedWebsites: [] };
      }
      if (ssoWebsitesRaw === 'none') {
        list = [];
      } else {
        list = ssoWebsitesRaw.split(',').map(s => s.trim().toLowerCase()).filter(s => Boolean(s) && s !== '__none__' && s !== 'none' && s !== 'all');
      }
      try {
        localStorage.setItem('teals_assigned_websites', JSON.stringify(list));
      } catch {}
      return { isAdmin: false, assignedWebsites: list };
    }

    // 2. Dynamic local storage override (updated live on real-time events)
    const rawAssigned = localStorage.getItem('teals_assigned_websites');
    if (rawAssigned !== null && rawAssigned !== undefined) {
      try {
        const list = JSON.parse(rawAssigned);
        if (Array.isArray(list) && list.length > 0) {
          const cleaned = list.filter((s: string) => Boolean(s) && s !== '__none__' && s !== 'none' && s !== 'all');
          if (cleaned.length > 0) {
            return { isAdmin: false, assignedWebsites: cleaned };
          }
        }
      } catch {}
    }
  } catch {}
  return { isAdmin: true, assignedWebsites: [] };
};

export const isWebsitePermitted = (propertySlug?: string | null): boolean => {
  if (!propertySlug) return true;
  const { isAdmin, assignedWebsites } = getCurrentAgentPermissions();
  if (isAdmin) return true; // Full access to all websites for Admins
  const validAssigned = assignedWebsites.filter(s => Boolean(s) && s !== '__none__' && s !== 'none' && s !== 'all');
  if (validAssigned.length === 0) return true; // Default allow if no explicit restriction

  const targetSlug = normalizeWebsiteSlug(propertySlug);
  const normalizedList = validAssigned.map(normalizeWebsiteSlug);
  return normalizedList.includes(targetSlug);
};

export interface LiveVisitor {
  id: string;
  visitor_token: string;
  property_slug: string;
  ip_address: string;
  country: string;
  country_code: string;
  city: string;
  flag: string;
  referrer: string;
  current_page: string;
  page_title?: string;
  browser: string;
  os: string;
  device: string;
  is_online: boolean;
  last_active_at: string;
  created_at: string;
}

export interface LiveMessage {
  id: string;
  conversation_id: string;
  sender_type: 'visitor' | 'agent' | 'ai' | 'system';
  sender_name: string;
  sender_pseudo_name?: string;
  sender_role_title?: string;
  sender_real_name?: string;
  content: string;
  is_whisper?: boolean;
  seq?: number;
  status?: 'sent' | 'delivered' | 'read';
  created_at: string;
  is_form?: boolean;
  form_type?: 'booking';
  form_data?: any;
}

export interface LiveConversation {
  id: string;
  property_slug: string;
  visitor_id: string;
  visitor_name: string;
  visitor_email?: string;
  visitor_phone?: string;
  visitor_ip?: string;
  visitor?: LiveVisitor;
  assigned_agent_id?: string;
  assigned_agent_name?: string;
  assigned_agent_email?: string;
  assigned_agent_pseudo_name?: string;
  assigned_agent_role_title?: string;
  assigned_at?: string;
  claimed_by?: string;
  claimed?: boolean;
  needs_human?: boolean;
  mode: 'ai' | 'human';
  status: 'active' | 'pending_agent' | 'closed';
  typing_preview?: string;
  last_visitor_message_at?: string;
  last_agent_reply_at?: string;
  last_read_by_agent_at?: string;
  last_read_by_visitor_at?: string;
  created_at: string;
  updated_at: string;
  messages: LiveMessage[];
}

export interface WebsiteStatItem {
  liveCount: number;
  todayCount: number;
  totalUniqueCount: number;
  chatCount: number;
}

interface LiveSyncContextType {
  liveVisitors: LiveVisitor[];
  conversations: LiveConversation[];
  websites: WebsiteConfig[];
  liveCount: number;
  todayCount: number;
  totalUniqueCount: number;
  chatCount: number;
  pageViews: number;
  websiteStats: Record<string, WebsiteStatItem>;
  soundEnabled: boolean;
  unreadCount: number;
  unreadConversationsCount: number;
  readConvMap: Record<string, string>;
  agentPermissions: { isAdmin: boolean; assignedWebsites: string[] };
  isWebsitePermitted: (propertySlug?: string | null) => boolean;
  addCustomWebsite: (input: { name: string; domain: string; slug?: string; category?: 'ecommerce' | 'publishing' }) => Promise<WebsiteConfig>;
  removeWebsite: (slug: string) => Promise<void>;
  toggleSound: () => void;
  resetAll: () => Promise<void>;
  resetChatsOnly: () => Promise<void>;
  refreshSync: () => Promise<void>;
  resetUnreadCount: () => void;
  markConversationAsRead: (convId: string) => void;
  deleteConversation: (convId: string) => Promise<void>;
  deleteConversations: (convIds: string[]) => Promise<void>;
}

const LiveSyncContext = createContext<LiveSyncContextType | undefined>(undefined);

const getUserStorageKey = () => {
  if (typeof window === 'undefined') return 'teals_read_map_default';
  try {
    const raw = localStorage.getItem('teals_agent_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.email) return `teals_read_map_${parsed.email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      if (parsed.id) return `teals_read_map_${parsed.id}`;
    }
  } catch {}
  return 'teals_read_map_default';
};

export const getDeletedConvIdsFromStorage = (): Set<string> => {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem('teals_deleted_conversations');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {}
  return new Set();
};

export const saveDeletedConvIdsToStorage = (ids: Set<string>) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('teals_deleted_conversations', JSON.stringify(Array.from(ids)));
  } catch {}
};

export const LiveSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [liveVisitors, setLiveVisitors] = useState<LiveVisitor[]>([]);
  const [websitesList, setWebsitesList] = useState<WebsiteConfig[]>(() => getAllWebsites());
  const [conversations, setConversations] = useState<LiveConversation[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const deletedSet = getDeletedConvIdsFromStorage();
        const cached = localStorage.getItem('teals_cached_conversations');
        if (cached) {
          const list: LiveConversation[] = JSON.parse(cached);
          if (Array.isArray(list)) {
            const filtered = list.filter(c => !deletedSet.has(c.id));
            if (filtered.length !== list.length) {
              if (filtered.length > 0) {
                localStorage.setItem('teals_cached_conversations', JSON.stringify(filtered));
              } else {
                localStorage.removeItem('teals_cached_conversations');
              }
            }
            return filtered;
          }
        }
      } catch {}
    }
    return [];
  });

  const [permissions, setPermissions] = useState<{ isAdmin: boolean; assignedWebsites: string[] }>(() => {
    return getCurrentAgentPermissions();
  });

  const applyNewPermissions = useCallback((newList: string[]) => {
    try {
      localStorage.setItem('teals_assigned_websites', JSON.stringify(newList));
      const rawSession = localStorage.getItem('teals_agent_session');
      if (rawSession) {
        const u = JSON.parse(rawSession);
        u.assigned_websites = newList;
        localStorage.setItem('teals_agent_session', JSON.stringify(u));
      }
    } catch {}
    setPermissions(prev => ({ ...prev, assignedWebsites: newList }));
  }, []);

  const isWebsitePermittedState = useCallback((propertySlug?: string | null): boolean => {
    if (!propertySlug) return false;
    if (permissions.isAdmin) return true;
    const validAssigned = permissions.assignedWebsites.filter(s => Boolean(s) && s !== '__none__' && s !== 'none' && s !== 'all');
    if (validAssigned.length === 0) return false;

    const targetSlug = normalizeWebsiteSlug(propertySlug);
    const normalizedList = validAssigned.map(normalizeWebsiteSlug);
    return normalizedList.includes(targetSlug);
  }, [permissions]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleWebsitesUpdated = () => {
      setWebsitesList(getAllWebsites());
    };
    window.addEventListener('teals-websites-updated', handleWebsitesUpdated);
    return () => window.removeEventListener('teals-websites-updated', handleWebsitesUpdated);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        if (conversations.length > 0) {
          localStorage.setItem('teals_cached_conversations', JSON.stringify(conversations));
        } else {
          localStorage.removeItem('teals_cached_conversations');
        }
      } catch {}
    }
  }, [conversations]);
  const [liveCount, setLiveCount] = useState<number>(0);
  const [todayCount, setTodayCount] = useState<number>(0);
  const [totalUniqueCount, setTotalUniqueCount] = useState<number>(0);
  const [pageViews, setPageViews] = useState<number>(0);
  const [websiteStats, setWebsiteStats] = useState<Record<string, WebsiteStatItem>>({});
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('teals_sound_enabled');
        if (saved !== null) return saved === 'true';
      } catch {}
    }
    return true;
  });
  const soundEnabledRef = useRef<boolean>(soundEnabled);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('teals_sound_enabled', String(soundEnabled));
      } catch {}
    }
  }, [soundEnabled]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const [readConvMap, setReadConvMap] = useState<Record<string, string>>({});

  // Load per-user read map on client mount with fallback across all storage keys
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const key = getUserStorageKey();
        const saved =
          localStorage.getItem(key) ||
          localStorage.getItem('teals_read_map_global') ||
          localStorage.getItem('teals_read_conv_map');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            setReadConvMap(parsed);
          }
        }
      } catch {}
    }
  }, []);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const dismissedLockedConvIdsRef = useRef<Set<string>>(new Set());

  const computeUnread = useCallback((convList: LiveConversation[], readMap: Record<string, string>) => {
    return convList.filter(c => {
      // Ignore closed, archived, or deleted conversations
      if (!c || c.status === 'closed' || (c as any).is_archived || (c as any).is_deleted) return false;
      if (!c.messages || c.messages.length === 0) return false;

      // If user has dismissed or claimed this chat in this session, do not count as unread
      if (dismissedLockedConvIdsRef.current.has(c.id)) return false;

      // Filter out internal whispers
      const validMsgs = c.messages.filter(m => !m.is_whisper && !(m as any).isWhisper);
      if (validMsgs.length === 0) return false;

      const lastMsg = validMsgs[validMsgs.length - 1];

      // 1. If the last message was sent by an agent, the agent has already answered!
      if (lastMsg.sender_type === 'agent') return false;

      // 2. If the last message was sent by AI in AI mode and NOT pending human agent handoff:
      // AI answered the visitor, so it does not require human attention or unread badge!
      if (lastMsg.sender_type === 'ai' && c.mode === 'ai' && c.status !== 'pending_agent') {
        return false;
      }

      // If chat is claimed by an agent and last message is not an unanswered visitor message, do not count as unread
      if ((c.assigned_agent_name || c.assigned_agent_id) && lastMsg.sender_type !== 'visitor') {
        return false;
      }

      // 3. Find latest visitor message
      const visitorMsgs = validMsgs.filter(m => m.sender_type === 'visitor');
      if (visitorMsgs.length === 0) return false;

      const lastVisitorMsg = visitorMsgs[visitorMsgs.length - 1];

      // 4. Check if an agent message exists after this last visitor message
      const lastVisitorIdx = validMsgs.lastIndexOf(lastVisitorMsg);
      const hasAgentReplyAfter = validMsgs.slice(lastVisitorIdx + 1).some(m => m.sender_type === 'agent');
      if (hasAgentReplyAfter) return false;

      // 5. Check persistent readMap for seen status
      const readVal = readMap[c.id];
      if (readVal) {
        if (readVal === 'all') return false;

        let savedId = readVal;
        let savedTime = 0;
        if (readVal.includes('__')) {
          const parts = readVal.split('__');
          savedId = parts[0];
          savedTime = new Date(parts[1] || 0).getTime();
        }

        // Exact ID match: this exact message was already seen
        if (savedId === lastVisitorMsg.id) return false;

        // Timestamp match with 10s clock skew grace period: agent viewed this chat at or after this visitor message was sent
        const visitorMsgTime = new Date(lastVisitorMsg.created_at || 0).getTime();
        if (savedTime > 0 && visitorMsgTime > 0 && (savedTime + 10000) >= visitorMsgTime) {
          return false;
        }
      }

      // 6. Only if the last message is from a visitor or chat is pending human agent
      if (lastMsg.sender_type !== 'visitor' && c.status !== 'pending_agent') {
        return false;
      }

      return true;
    }).length;
  }, []);

  const userVisibleLiveVisitors = useMemo(() => {
    if (permissions.isAdmin) return liveVisitors;
    return liveVisitors.filter(v => isWebsitePermittedState(v.property_slug || v.current_page));
  }, [liveVisitors, permissions, isWebsitePermittedState]);

  const userVisibleConversations = useMemo(() => {
    if (permissions.isAdmin) return conversations;
    return conversations.filter(c => isWebsitePermittedState(c.property_slug));
  }, [conversations, permissions, isWebsitePermittedState]);

  const userVisibleWebsiteStats = useMemo(() => {
    if (permissions.isAdmin) return websiteStats;
    const filtered: Record<string, WebsiteStatItem> = {};
    Object.entries(websiteStats).forEach(([slug, stats]) => {
      if (isWebsitePermittedState(slug)) {
        filtered[slug] = stats;
      }
    });
    return filtered;
  }, [websiteStats, permissions, isWebsitePermittedState]);

  const unreadConversationsCount = computeUnread(userVisibleConversations, readConvMap);
  const chatCount = userVisibleConversations.length;

  // Ensure any lingering continuous handoff ringer is terminated immediately
  useEffect(() => {
    stopContinuousHandoffRinger();
    return () => {
      stopContinuousHandoffRinger();
    };
  }, []);

  const markConversationAsRead = useCallback((convId: string) => {
    if (!convId) return;

    dismissedLockedConvIdsRef.current.add(convId);
    stopWaitingForHumanBeep(convId, true);

    setReadConvMap(rMap => {
      // Find latest visitor message in current state to store exact message ID and timestamp
      const conv = conversations.find(c => c.id === convId);
      const vMsgs = (conv?.messages || []).filter(m => m.sender_type === 'visitor');
      const lastMsg = vMsgs.length > 0 ? vMsgs[vMsgs.length - 1] : null;
      const lastMsgId = lastMsg?.id || 'all';
      const nowIso = new Date().toISOString();
      const readRecord = `${lastMsgId}__${nowIso}`;

      // Store exact last seen message ID + timestamp persistently
      const next = { ...rMap, [convId]: readRecord };
      if (typeof window !== 'undefined') {
        try {
          const storageKey = getUserStorageKey();
          localStorage.setItem(storageKey, JSON.stringify(next));
          localStorage.setItem('teals_read_map_global', JSON.stringify(next));
          localStorage.setItem('teals_read_conv_map', JSON.stringify(next));
        } catch {}
      }
      return next;
    });

    let currentUser: { role?: string; email?: string; full_name?: string } | null = null;
    if (typeof window !== 'undefined') {
      try {
        const rawSession = localStorage.getItem('teals_agent_session');
        if (rawSession) currentUser = JSON.parse(rawSession);
      } catch {}
    }

    // Inform visitor widget that an agent has seen their message
    channelRef.current?.send({
      type: 'broadcast',
      event: 'chat_read',
      payload: {
        conversationId: convId,
        readerType: currentUser?.role === 'admin' ? 'admin' : 'agent',
        readerName: currentUser?.full_name || 'Agent'
      }
    });
  }, [conversations]);

  const lastArrivalNoticeTime = useRef<Map<string, number>>(new Map());
  const initialLoadDone = useRef(false);
  const prevLiveCountRef = useRef<number>(0);
  const playedMsgIdsRef = useRef<Set<string>>(new Set());
  const lastConvBeepTimeRef = useRef<Map<string, number>>(new Map());

  // In-App Side Toast Notifications state
  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: 'visitor' | 'message' | 'handoff';
    title: string;
    description: string;
    actionUrl?: string;
  }>>([]);

  const isRunningInCrmIframe = useCallback(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  const showSideToast = useCallback((toast: {
    id?: string;
    type: 'visitor' | 'message' | 'handoff';
    title: string;
    description: string;
    actionUrl?: string;
  }) => {
    // When embedded in CRM iframe, parent CRM window displays all toasts to prevent duplicates
    if (isRunningInCrmIframe()) return;

    const toastId = toast.id || `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => {
      const filtered = prev.filter((t) => t.id !== toastId);
      return [{ ...toast, id: toastId }, ...filtered].slice(0, 4);
    });
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 6500);
  }, [isRunningInCrmIframe]);

  const triggerArrivalBeepIfNew = useCallback((key: string, source: string, session?: LiveVisitor) => {
    // When embedded in CRM iframe, parent CRM window handles all arrival beeps and alerts
    if (isRunningInCrmIframe()) return;

    if (session?.property_slug && !isWebsitePermitted(session.property_slug)) {
      return;
    }

    const now = Date.now();
    const token = session?.visitor_token || session?.id || key || 'guest';
    const dedupeKey = token;

    const lastSeen = lastArrivalNoticeTime.current.get(dedupeKey) || 0;
    if (now - lastSeen < 15000) {
      return; // 15-second burst debounce
    }
    lastArrivalNoticeTime.current.set(dedupeKey, now);

    const arrivalEventId = `visitor_arrival_${dedupeKey}_${now}`;

    // 1. Play clean single arrival notification chime when sound alerts are ON
    if (soundEnabledRef.current) {
      tryPlayDeduplicatedSound(arrivalEventId, 'arrival', 'global');
    }

    // 2. In-App Side Toast popup & Tab title flash
    if (typeof window !== 'undefined') {
      const loc = [session?.city, session?.country].filter(Boolean).join(', ');
      const page = session?.current_page ? ` on ${session.current_page}` : '';
      const rawProp = session?.property_slug || 'Website';
      const propName = rawProp.replace(/-/g, ' ').toUpperCase();

      showBackgroundNotification(
        `👤 New Visitor: ${propName}`,
        loc ? `Visitor active from ${loc}${page}.` : `A new visitor is actively browsing ${propName}.`,
        '/favicon.ico',
        arrivalEventId,
        false,
        '/dashboard/monitoring'
      );

      showSideToast({
        id: `visitor_${dedupeKey}`,
        type: 'visitor',
        title: `🟢 Live Visitor: ${propName}`,
        description: loc ? `Visitor active from ${loc}${page}.` : `A new visitor is actively browsing ${propName}.`,
        actionUrl: '/dashboard/monitoring',
      });

      flashTabTitle('👤 (1) New Visitor!');
    }
  }, [showSideToast, isRunningInCrmIframe]);

  const refreshSync = useCallback(async () => {
    try {
      const res = await fetch('/api/sync?property=all');
      if (!res.ok) return;
      const data = await res.json();

      if (Array.isArray(data.customWebsites) || Array.isArray(data.removedWebsites)) {
        syncCustomWebsitesFromList(data.customWebsites, data.removedWebsites);
      }
      setWebsitesList(getAllWebsites());

      const uniqueVisitors: LiveVisitor[] = Array.isArray(data.visitors) ? data.visitors : [];
      setLiveVisitors(uniqueVisitors);
      setLiveCount(typeof data.liveVisitorsCount === 'number' ? data.liveVisitorsCount : uniqueVisitors.length);
      setTodayCount(data.todayVisitorsCount || 0);
      setTotalUniqueCount(data.totalUniqueCount || 0);
      setPageViews(data.pageViews || 0);
      if (data.websiteStats) {
        setWebsiteStats(data.websiteStats);
      }

      const now = Date.now();
      if (initialLoadDone.current) {
        uniqueVisitors.forEach(v => {
          const token = v.visitor_token || v.id;
          if (v.is_online && token) {
            const last = lastArrivalNoticeTime.current.get(token);
            if (!last) {
              triggerArrivalBeepIfNew(token, 'poll_sync', v);
            }
          }
        });
      } else {
        uniqueVisitors.forEach(v => {
          const token = v.visitor_token || v.id;
          if (token) lastArrivalNoticeTime.current.set(token, now);
        });
        initialLoadDone.current = true;
      }

      // Synchronize persistent deleted set from server
      const localDeleted = getDeletedConvIdsFromStorage();
      if (Array.isArray(data.deletedConvIds)) {
        let added = false;
        data.deletedConvIds.forEach((id: string) => {
          if (id && !localDeleted.has(id)) {
            localDeleted.add(id);
            added = true;
          }
        });
        if (added) {
          saveDeletedConvIdsToStorage(localDeleted);
        }
      }

      const rawConvsList: LiveConversation[] = Array.isArray(data.conversations) ? data.conversations : [];
      // STRICT FILTER: NEVER allow any deleted conversation into convsList
      const convsList = rawConvsList.filter((c: LiveConversation) => !localDeleted.has(c.id));

      if (convsList.length === 0) {
        setConversations(prev => {
          const filtered = prev.filter(c => !localDeleted.has(c.id));
          if (data.serverResetAt && data.serverResetAt > 0) {
            const hasRecent = filtered.some(c => new Date(c.created_at || c.updated_at || 0).getTime() >= data.serverResetAt);
            if (!hasRecent) {
              if (typeof window !== 'undefined') {
                try {
                  localStorage.removeItem('teals_cached_conversations');
                } catch {}
              }
              return [];
            }
          }
          return filtered;
        });
        return;
      }

      // NON-DESTRUCTIVE UNION MERGE: never let a background sync poll erase newer messages received via WebSockets
      setConversations(prev => {
        // Also prune any deleted conversation from prev
        const nonDeletedPrev = prev.filter(p => !localDeleted.has(p.id));

        if (nonDeletedPrev.length === convsList.length) {
          const hasDiff = convsList.some(apiConv => {
            const p = nonDeletedPrev.find(x => x.id === apiConv.id);
            if (!p) return true;
            if ((p.messages?.length || 0) !== (apiConv.messages?.length || 0)) return true;
            if (p.mode !== apiConv.mode || p.status !== apiConv.status) return true;
            if (p.assigned_agent_id !== apiConv.assigned_agent_id) return true;
            const pLast = p.messages?.[p.messages.length - 1]?.id;
            const aLast = apiConv.messages?.[apiConv.messages.length - 1]?.id;
            return pLast !== aLast;
          });
          if (!hasDiff) {
            return nonDeletedPrev; // Return existing reference to prevent any glitch or UI jump
          }
        }

        const prevMap = new Map(nonDeletedPrev.map(c => [c.id, c]));

        const updatedList: LiveConversation[] = convsList.map(apiConv => {
          const prevConv = prevMap.get(apiConv.id);
          if (!prevConv) return apiConv;

          const msgMap = new Map<string, LiveMessage>();
          (prevConv.messages || []).forEach(m => msgMap.set(m.id, m));
          (apiConv.messages || []).forEach(m => msgMap.set(m.id, m));

          const mergedMessages = Array.from(msgMap.values()).sort((a, b) => {
            const isAiGreetA = a.id === 'init-greet' || (a.sender_type === 'ai' && a.seq === 1);
            const isAiGreetB = b.id === 'init-greet' || (b.sender_type === 'ai' && b.seq === 1);
            if (isAiGreetA && !isAiGreetB) return -1;
            if (!isAiGreetA && isAiGreetB) return 1;

            const timeA = new Date(a.created_at || 0).getTime();
            const timeB = new Date(b.created_at || 0).getTime();
            if (timeA !== timeB) {
              return timeA - timeB;
            }

            if (a.sender_type === 'visitor' && b.sender_type === 'system') return -1;
            if (a.sender_type === 'system' && b.sender_type === 'visitor') return 1;

            if (typeof a.seq === 'number' && typeof b.seq === 'number' && a.seq !== b.seq) {
              return a.seq - b.seq;
            }
            return (a.id || '').localeCompare(b.id || '');
          });

          const effectiveAssignedId = apiConv.assigned_agent_id || prevConv.assigned_agent_id;
          const effectiveAssignedName = apiConv.assigned_agent_name || prevConv.assigned_agent_name;
          const effectiveAssignedEmail = apiConv.assigned_agent_email || prevConv.assigned_agent_email;
          const isClaimed = !!effectiveAssignedId || !!effectiveAssignedName;

          const effectiveMode: 'ai' | 'human' = isClaimed || apiConv.mode === 'human' || prevConv.mode === 'human' ? 'human' : 'ai';
          const effectiveStatus: 'active' | 'pending_agent' | 'closed' = isClaimed 
            ? 'active'
            : (apiConv.status === 'pending_agent' || prevConv.status === 'pending_agent' ? 'pending_agent' : 'active');

          const matchedVisitor = apiConv.visitor || prevConv.visitor || uniqueVisitors.find(v => 
            v.id === apiConv.id || 
            v.visitor_token === apiConv.id || 
            v.visitor_token === apiConv.visitor_id || 
            v.id === apiConv.visitor_id ||
            (apiConv.visitor_ip && v.ip_address === apiConv.visitor_ip)
          );

          return {
            ...prevConv,
            ...apiConv,
            visitor: matchedVisitor,
            visitor_name: apiConv.visitor_name || prevConv.visitor_name,
            visitor_email: apiConv.visitor_email || prevConv.visitor_email,
            visitor_phone: apiConv.visitor_phone || prevConv.visitor_phone,
            mode: effectiveMode,
            status: effectiveStatus,
            assigned_agent_id: effectiveAssignedId,
            assigned_agent_name: effectiveAssignedName,
            assigned_agent_email: effectiveAssignedEmail,
            messages: mergedMessages
          };
        });

        // Retain ONLY genuinely new optimistic/local conversations created in the last 15 seconds
        const apiConvIds = new Set(convsList.map(c => c.id));
        const nowMs = Date.now();
        const pendingLocalConvs = nonDeletedPrev.filter(p => {
          if (apiConvIds.has(p.id)) return false;
          if (localDeleted.has(p.id)) return false;
          const createdMs = new Date(p.created_at || p.updated_at || 0).getTime();
          return (nowMs - createdMs) < 15000;
        });

        const finalList = [...updatedList, ...pendingLocalConvs];
        if (typeof window !== 'undefined') {
          try {
            if (finalList.length > 0) {
              localStorage.setItem('teals_cached_conversations', JSON.stringify(finalList));
            } else {
              localStorage.removeItem('teals_cached_conversations');
            }
          } catch {}
        }
        return finalList;
      });

      // Continuous monitor: If any recent locked chat is pending a human agent, keep repeating handoff chime active
      const unassignedLockedConv = convsList.find((c: any) => {
        const isRecent = (now - new Date(c.updated_at || c.created_at || 0).getTime()) < 90000;
        return (
          isRecent &&
          (c.status === 'pending_agent' || c.status === 'locked' || (c.mode === 'human' && !c.assigned_agent_id && !c.assigned_agent_name) || (c.agent_requested && !c.assigned_agent_id)) &&
          c.status !== 'closed' &&
          isWebsitePermitted(c.property_slug)
        );
      });

      if (unassignedLockedConv && soundEnabledRef.current) {
        startWaitingForHumanBeep(unassignedLockedConv.id);
      } else if (!unassignedLockedConv) {
        stopWaitingForHumanBeep();
      }
    } catch (err) {
      console.error('[SYNC_DEBUG] Poll sync error:', err);
    }
  }, []);

  useEffect(() => {
    // Stop any repeating loop immediately when CRM loads
    stopWaitingForHumanBeep();
    refreshSync();

    // 1. Proactively fetch latest assigned_websites from CRM Supabase profiles for active agent
    const fetchLatestAgentProfile = () => {
      try {
        let email = '';
        const params = new URLSearchParams(window.location.search);
        const ssoEmail = params.get('sso_email');
        if (ssoEmail) email = ssoEmail.toLowerCase().trim();
        if (!email) {
          const raw = localStorage.getItem('teals_agent_session');
          if (raw) email = (JSON.parse(raw)?.email || '').toLowerCase().trim();
        }
        if (email && !ADMIN_EMAILS.includes(email)) {
          crmSupabase.from('profiles').select('avatar_url, role, full_name').eq('email', email).maybeSingle().then(({ data: prof }) => {
            if (prof?.avatar_url) {
              try {
                const meta = JSON.parse(prof.avatar_url);
                if (Array.isArray(meta.assigned_websites)) {
                  applyNewPermissions(meta.assigned_websites);
                }
                const rawSession = localStorage.getItem('teals_agent_session');
                if (rawSession) {
                  const ag = JSON.parse(rawSession);
                  if (meta.pseudo_name) ag.pseudo_name = meta.pseudo_name;
                  if (meta.role_title) ag.role_title = meta.role_title;
                  if (Array.isArray(meta.assigned_websites)) ag.assigned_websites = meta.assigned_websites;
                  localStorage.setItem('teals_agent_session', JSON.stringify(ag));
                }
              } catch {}
            }
          });
        }
      } catch {}
    };
    fetchLatestAgentProfile();

    // 2. Window postMessage listener from parent CRM iframe
    const handleWindowMessage = (ev: MessageEvent) => {
      if (ev.data?.type === 'TEALS_PERMISSIONS_UPDATED' && Array.isArray(ev.data?.assigned_websites)) {
        applyNewPermissions(ev.data.assigned_websites);
        refreshSync();
      }
    };
    window.addEventListener('message', handleWindowMessage);

    // 3. Same-origin BroadcastChannel listener
    let bcSync: any = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bcSync = new BroadcastChannel('teals-crm-sync');
        bcSync.onmessage = (ev: MessageEvent) => {
          if (ev.data?.type === 'CHAT_DELETED') {
            const id = ev.data?.conversationId;
            if (id) {
              const localDeleted = getDeletedConvIdsFromStorage();
              localDeleted.add(id);
              saveDeletedConvIdsToStorage(localDeleted);
              setConversations(prev => {
                const filtered = prev.filter(c => c.id !== id && c.visitor_id !== id);
                try {
                  if (filtered.length > 0) {
                    localStorage.setItem('teals_cached_conversations', JSON.stringify(filtered));
                  } else {
                    localStorage.removeItem('teals_cached_conversations');
                  }
                } catch {}
                return filtered;
              });
            }
          }
          if (ev.data?.type === 'CHATS_BATCH_DELETED') {
            const ids = ev.data?.conversationIds;
            if (Array.isArray(ids)) {
              const localDeleted = getDeletedConvIdsFromStorage();
              ids.forEach((id: string) => localDeleted.add(id));
              saveDeletedConvIdsToStorage(localDeleted);
              const idSet = new Set(ids);
              setConversations(prev => {
                const filtered = prev.filter(c => !idSet.has(c.id) && (!c.visitor_id || !idSet.has(c.visitor_id)));
                try {
                  if (filtered.length > 0) {
                    localStorage.setItem('teals_cached_conversations', JSON.stringify(filtered));
                  } else {
                    localStorage.removeItem('teals_cached_conversations');
                  }
                } catch {}
                return filtered;
              });
            }
          }
          if (ev.data?.type === 'AGENT_PERMISSIONS_UPDATED') {
            const params = new URLSearchParams(window.location.search);
            const myEmail = (params.get('sso_email') || '').toLowerCase().trim() || (() => {
              try { return (JSON.parse(localStorage.getItem('teals_agent_session') || '{}')?.email || '').toLowerCase().trim(); } catch { return ''; }
            })();
            const targetEmail = (ev.data?.email || '').toLowerCase().trim();
            if (targetEmail === myEmail && Array.isArray(ev.data?.assigned_websites)) {
              applyNewPermissions(ev.data.assigned_websites);
              refreshSync();
            }
          }
        };
      }
    } catch {}

    const channel = supabase.channel(REALTIME_CHANNEL, {
      config: { broadcast: { self: true } }
    });

    const crmChannel = crmSupabase.channel(REALTIME_CHANNEL, {
      config: { broadcast: { self: true } }
    });

    const handlePermissionsBroadcast = (payload: unknown) => {
      try {
        const raw = (payload as Record<string, unknown>)?.payload || payload;
        const targetEmail = ((raw as Record<string, unknown>)?.email as string || '').toLowerCase().trim();
        const params = new URLSearchParams(window.location.search);
        const myEmail = (params.get('sso_email') || '').toLowerCase().trim() || (() => {
          try { return (JSON.parse(localStorage.getItem('teals_agent_session') || '{}')?.email || '').toLowerCase().trim(); } catch { return ''; }
        })();
        if (myEmail && myEmail === targetEmail && Array.isArray((raw as any)?.assigned_websites)) {
          applyNewPermissions((raw as any).assigned_websites);
          refreshSync();
        }
      } catch {}
    };

    crmChannel
      .on('broadcast', { event: 'agent_permissions_updated' }, handlePermissionsBroadcast)
      .subscribe();

    const profileChannel = crmSupabase.channel('teals-profiles-sync-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload: any) => {
        const row = payload?.new || payload?.old;
        const params = new URLSearchParams(window.location.search);
        const myEmail = (params.get('sso_email') || '').toLowerCase().trim() || (() => {
          try { return (JSON.parse(localStorage.getItem('teals_agent_session') || '{}')?.email || '').toLowerCase().trim(); } catch { return ''; }
        })();
        if (row && myEmail && (row.email || '').toLowerCase().trim() === myEmail && row.avatar_url) {
          try {
            const meta = JSON.parse(row.avatar_url);
            if (Array.isArray(meta.assigned_websites)) {
              applyNewPermissions(meta.assigned_websites);
              refreshSync();
            }
          } catch {}
        }
      })
      .subscribe();

    channel
      .on('broadcast', { event: 'visitor_arrival' }, (payload: unknown) => {
        console.log('[SYNC_DEBUG] WebSocket visitor_arrival event received:', payload);
        const raw = (payload as Record<string, unknown>)?.payload || payload;
        const session: LiveVisitor | undefined = ((raw as Record<string, unknown>)?.session as LiveVisitor) || (((raw as Record<string, unknown>)?.id) ? (raw as unknown as LiveVisitor) : undefined);
        const sid = session?.id || (raw as Record<string, unknown>)?.sessionId as string || (raw as Record<string, unknown>)?.id as string;
        const token = session?.visitor_token || (raw as Record<string, unknown>)?.visitorToken as string || sid || ('vis_' + Date.now());
        const ip = session?.ip_address && session.ip_address !== '::1' && session.ip_address !== '127.0.0.1' && session.ip_address !== 'unknown' ? session.ip_address : '';
        const dedupeKey = ip ? `ip_${ip}` : (token || sid);

        const propSlug = session?.property_slug || (raw as Record<string, unknown>)?.propertySlug as string || (raw as Record<string, unknown>)?.property_slug as string;
        if (isWebsitePermitted(propSlug)) {
          // Dedup alert chimes per distinct visitor IP
          triggerArrivalBeepIfNew(dedupeKey, 'WebSocket_visitor_arrival', session);
        }

        if (session && session.id) {

          setLiveVisitors((prev) => {
            const map = new Map<string, LiveVisitor>();
            prev.forEach(v => {
              const vIp = v.ip_address && v.ip_address !== '::1' && v.ip_address !== '127.0.0.1' && v.ip_address !== 'unknown' ? `ip_${v.ip_address}` : (v.visitor_token || v.id);
              map.set(vIp, v);
            });
            map.set(dedupeKey, session);
            const nextList = Array.from(map.values()).filter(v => v.is_online);
            setLiveCount(nextList.length);
            return nextList;
          });

          const rawToday = (raw as Record<string, unknown>)?.todayCount;
          const rawUnique = (raw as Record<string, unknown>)?.totalUniqueCount;
          if (typeof rawToday === 'number') setTodayCount(rawToday);
          if (typeof rawUnique === 'number') setTotalUniqueCount(rawUnique);
        }
      })
      .on('broadcast', { event: 'visitor_navigation' }, (payload: unknown) => {
        const raw = (payload as Record<string, unknown>)?.payload || payload;
        const sessionId = (raw as Record<string, unknown>)?.sessionId as string;
        const currentPage = (raw as Record<string, unknown>)?.currentPage as string;
        const pageTitle = (raw as Record<string, unknown>)?.pageTitle as string | undefined;
        if (sessionId && currentPage) {
          setLiveVisitors((prev) =>
            prev.map(v => (v.id === sessionId || v.visitor_token === sessionId) ? { ...v, current_page: currentPage, page_title: pageTitle || v.page_title } : v)
          );
        }
      })
      .on('broadcast', { event: 'visitor_offline' }, (payload: unknown) => {
        console.log('[SYNC_DEBUG] WebSocket visitor_offline event received:', payload);
        const raw = (payload as Record<string, unknown>)?.payload || payload;
        const sessionId = (raw as Record<string, unknown>)?.sessionId as string;
        const ip = (raw as Record<string, unknown>)?.ip as string;

        if (sessionId) {
          setLiveVisitors((prev) => {
            const nextList = prev.filter(v => v.id !== sessionId && v.visitor_token !== sessionId);
            setLiveCount(nextList.length);
            return nextList;
          });
        }
      })
      .on('broadcast', { event: 'chat_message' }, (payload: unknown) => {
        console.log('[SYNC_DEBUG] WebSocket chat_message event received:', payload);
        const raw = (payload as Record<string, unknown>)?.payload || payload;
        const conversation = (raw as Record<string, unknown>)?.conversation as LiveConversation;
        const message = (raw as Record<string, unknown>)?.message as LiveMessage;
        const systemMessage = (raw as Record<string, unknown>)?.systemMessage as LiveMessage | undefined;
        const isHandoffRequested = (raw as Record<string, unknown>)?.isHandoffRequested as boolean;

        // Determine user FIRST — needed for both conversation list and beep logic
        let currentUser: { role?: string; email?: string; id?: string } | null = null;
        try {
          const rawSession = localStorage.getItem('teals_agent_session');
          if (rawSession) currentUser = JSON.parse(rawSession);
        } catch {}

        const isAdmin = checkIsAdmin(currentUser);
        const currentFullName = ((currentUser as any)?.full_name || '').toLowerCase().trim();
        const currentEmail = (currentUser?.email || '').toLowerCase().trim();
        const currentId = (currentUser?.id || '').toLowerCase().trim();

        const isMyClaimedChat = !!(conversation && (
          (conversation.assigned_agent_id && conversation.assigned_agent_id.toLowerCase().trim() === currentId) ||
          (conversation.assigned_agent_name && conversation.assigned_agent_name.toLowerCase().trim() === currentFullName) ||
          (conversation.assigned_agent_email && conversation.assigned_agent_email.toLowerCase().trim() === currentEmail)
        ));
        // EXTRACT SENDER TYPE ACCURATELY:
        const msgObj = (message || (raw as any)?.message || ((raw as any)?.sender_type ? raw : undefined)) as LiveMessage | undefined;
        const actualSender = (
          msgObj?.sender_type || 
          (msgObj as any)?.senderType || 
          (raw as any)?.sender_type || 
          (raw as any)?.senderType || 
          ''
        ).toLowerCase().trim();

        // STRICT SENDER CHECK: ONLY 'visitor' is permitted to trigger message audio!
        // Never beep for AI, agent, admin, or system messages!
        const isStrictVisitorMsg = actualSender === 'visitor';
        const isAgentOrAdminOrAi = actualSender === 'agent' || actualSender === 'admin' || actualSender === 'ai' || actualSender === 'bot' || actualSender === 'system';
        const isClaimedAlready = !!(conversation?.assigned_agent_id || conversation?.assigned_agent_name);
        const isHandoffAlert = !isClaimedAlready && (
          isHandoffRequested || 
          conversation?.status === 'pending_agent' || 
          conversation?.needs_human === true ||
          (conversation?.mode === 'human' && !conversation?.assigned_agent_id && !conversation?.assigned_agent_name)
        );

        // When a new visitor message arrives, immediately invalidate read map for this conversation
        if (isStrictVisitorMsg && conversation?.id) {
          setReadConvMap(rMap => {
            if (!rMap[conversation.id]) return rMap;
            const next = { ...rMap };
            delete next[conversation.id];
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem(getUserStorageKey(), JSON.stringify(next));
                localStorage.setItem('teals_read_map_global', JSON.stringify(next));
                localStorage.setItem('teals_read_conv_map', JSON.stringify(next));
              } catch {}
            }
            return next;
          });
        }

        if (conversation && conversation.id) {
          setConversations((prev) => {
            const idx = prev.findIndex(c => c.id === conversation.id);
            const existing = idx >= 0 ? prev[idx] : null;

            const effectiveAssignedId = existing?.assigned_agent_id || conversation.assigned_agent_id;
            const effectiveAssignedName = existing?.assigned_agent_name || conversation.assigned_agent_name;
            const effectiveAssignedEmail = existing?.assigned_agent_email || conversation.assigned_agent_email;
            const isClaimed = !!effectiveAssignedId || !!effectiveAssignedName;

            const effectiveMode: 'ai' | 'human' = isClaimed || existing?.mode === 'human' || conversation.mode === 'human' ? 'human' : 'ai';
            const effectiveStatus: 'active' | 'pending_agent' | 'closed' = isClaimed 
              ? 'active' 
              : (conversation.status === 'pending_agent' || existing?.status === 'pending_agent' ? 'pending_agent' : 'active');

            const msgMap = new Map<string, LiveMessage>();
            (existing?.messages || []).forEach(m => msgMap.set(m.id, m));
            (conversation.messages || []).forEach(m => msgMap.set(m.id, m));
            if (message) msgMap.set(message.id, message as LiveMessage);
            if (systemMessage) msgMap.set(systemMessage.id, systemMessage as LiveMessage);

            const rawMsgList = Array.from(msgMap.values());
            const hasClaim = rawMsgList.some(m => m.sender_type === 'system' && (
              m.content?.includes('has claimed and joined') ||
              m.content?.includes('transferred to Live Support Agent') ||
              m.content?.includes('taken over')
            ));

            const filteredMsgs = rawMsgList.filter(m => {
              if (hasClaim && m.sender_type === 'system' && m.content?.includes('Transferring to a live support agent')) {
                return false;
              }
              return true;
            });

            const mergedMessages = filteredMsgs.sort((a, b) => {
              const isAiGreetA = a.id === 'init-greet' || (a.sender_type === 'ai' && a.seq === 1);
              const isAiGreetB = b.id === 'init-greet' || (b.sender_type === 'ai' && b.seq === 1);
              if (isAiGreetA && !isAiGreetB) return -1;
              if (!isAiGreetA && isAiGreetB) return 1;

              const timeA = new Date(a.created_at || 0).getTime();
              const timeB = new Date(b.created_at || 0).getTime();
              if (timeA !== timeB) {
                return timeA - timeB;
              }

              if (a.sender_type === 'visitor' && b.sender_type === 'system') return -1;
              if (a.sender_type === 'system' && b.sender_type === 'visitor') return 1;

              if (typeof a.seq === 'number' && typeof b.seq === 'number' && a.seq !== b.seq) {
                return a.seq - b.seq;
              }
              return (a.id || '').localeCompare(b.id || '');
            });

            const matchedVisitor = conversation.visitor || existing?.visitor || liveVisitors.find(v =>
              v.id === conversation.id ||
              v.visitor_token === conversation.id ||
              v.visitor_token === conversation.visitor_id ||
              v.id === conversation.visitor_id ||
              (conversation.visitor_ip && v.ip_address === conversation.visitor_ip)
            );

            const mergedConv: LiveConversation = {
              ...existing,
              ...conversation,
              visitor: matchedVisitor || conversation.visitor || existing?.visitor,
              visitor_ip: conversation.visitor_ip || existing?.visitor_ip || matchedVisitor?.ip_address,
              mode: effectiveMode,
              status: effectiveStatus,
              assigned_agent_id: effectiveAssignedId,
              assigned_agent_name: effectiveAssignedName,
              assigned_agent_email: effectiveAssignedEmail,
              messages: mergedMessages,
              updated_at: new Date().toISOString()
            };

            // Working Agents and Admins see ALL conversations in real-time (newest on top)
            const other = prev.filter(c => c.id !== conversation.id);
            const updated = [mergedConv, ...other];

            return updated;
          });
        }

        // Beep logic (instant audio chimes):
        const propertySlug = conversation?.property_slug || (raw as any)?.propertySlug || (raw as any)?.property_slug;
        const permitted = isWebsitePermitted(propertySlug);

        // 1. Live Agent Handoff Alert (Customer requested human: chime and start repeating loop until claimed!)
        if (isHandoffAlert && permitted) {
          const convId = conversation?.id || (raw as any)?.conversationId || 'global';
          const uniqueMsgId = msgObj?.id || (raw as any)?.id;
          if (soundEnabledRef.current) {
            startWaitingForHumanBeep(convId, uniqueMsgId);
          }
          showSideToast({
            id: `handoff_${convId}`,
            type: 'handoff',
            title: 'Live Agent Requested',
            description: `${conversation?.visitor_name || 'A customer'} requested a human agent!`,
            actionUrl: '/dashboard/chats',
          });
          flashTabTitle('🚨 (1) Agent Requested!');
        }
        // 2. Normal Visitor Message Beep (Only strictly visitor messages, NO beep for agent/admin/AI)
        else if (isStrictVisitorMsg && !isAgentOrAdminOrAi && permitted) {
          const uniqueMsgId = msgObj?.id || (raw as any)?.id || ('msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
          const convId = conversation?.id || (raw as any)?.conversationId || 'global';
          const now = Date.now();

          const isAlreadyPlayed = playedMsgIdsRef.current.has(uniqueMsgId);

          if (!isAlreadyPlayed) {
            playedMsgIdsRef.current.add(uniqueMsgId);
            if (playedMsgIdsRef.current.size > 2000) {
              const toPrune = Array.from(playedMsgIdsRef.current).slice(0, 1000);
              toPrune.forEach(id => playedMsgIdsRef.current.delete(id));
            }
            if (soundEnabledRef.current) {
              tryPlayDeduplicatedSound(uniqueMsgId, 'message', 'global');
            }
            const senderName = conversation?.visitor_name || 'Visitor';
            const snippet = msgObj?.content || 'Sent a new message';
            showSideToast({
              id: `msg_${uniqueMsgId}`,
              type: 'message',
              title: `💬 ${senderName}`,
              description: snippet.length > 80 ? snippet.slice(0, 77) + '...' : snippet,
              actionUrl: '/dashboard/chats',
            });
            flashTabTitle('💬 (1) New Message!');
          }
        }
      })
      .on('broadcast', { event: 'new_conversation' }, (payload: unknown) => {
        const raw = (payload as Record<string, unknown>)?.payload || payload;
        const conversation = (raw as Record<string, unknown>)?.conversation as LiveConversation;
        if (conversation && conversation.id) {
          setConversations(prev => {
            const other = prev.filter(c => c.id !== conversation.id);
            const existing = prev.find(c => c.id === conversation.id);
            const matchedVisitor = conversation.visitor || existing?.visitor || liveVisitors.find(v =>
              v.id === conversation.id ||
              v.visitor_token === conversation.id ||
              v.visitor_token === conversation.visitor_id ||
              v.id === conversation.visitor_id ||
              (conversation.visitor_ip && v.ip_address === conversation.visitor_ip)
            );
            const merged: LiveConversation = {
              ...(existing || {}),
              ...conversation,
              visitor: matchedVisitor || conversation.visitor || existing?.visitor,
              visitor_ip: conversation.visitor_ip || existing?.visitor_ip || matchedVisitor?.ip_address,
            };
            return [merged, ...other];
          });
          setReadConvMap(rMap => {
            if (!rMap[conversation.id]) return rMap;
            const next = { ...rMap };
            delete next[conversation.id];
            if (typeof window !== 'undefined') {
              try { localStorage.setItem(getUserStorageKey(), JSON.stringify(next)); } catch {}
            }
            return next;
          });
        }
      })
      .on('broadcast', { event: 'chat_deleted' }, (payload: unknown) => {
        const raw = (payload as Record<string, unknown>)?.payload || payload;
        const cId = (raw as Record<string, unknown>)?.conversationId as string;
        if (cId) {
          const localDeleted = getDeletedConvIdsFromStorage();
          localDeleted.add(cId);
          saveDeletedConvIdsToStorage(localDeleted);

          setConversations(prev => {
            const filtered = prev.filter(c => c.id !== cId && c.visitor_id !== cId);
            if (typeof window !== 'undefined') {
              try {
                if (filtered.length > 0) {
                  localStorage.setItem('teals_cached_conversations', JSON.stringify(filtered));
                } else {
                  localStorage.removeItem('teals_cached_conversations');
                }
              } catch {}
            }
            return filtered;
          });
          setReadConvMap(rMap => {
            if (!rMap[cId]) return rMap;
            const next = { ...rMap };
            delete next[cId];
            if (typeof window !== 'undefined') {
              try { localStorage.setItem(getUserStorageKey(), JSON.stringify(next)); } catch {}
            }
            return next;
          });
        }
      })
      .on('broadcast', { event: 'chat_claimed' }, (payload: unknown) => {
        console.log('[SYNC_DEBUG] WebSocket chat_claimed event received:', payload);
        const raw = (payload as Record<string, unknown>)?.payload || payload;
        const conversation = (raw as Record<string, unknown>)?.conversation as LiveConversation;
        const cId = (raw as Record<string, unknown>)?.conversationId as string || conversation?.id;

        // Stop waiting for human repeating beep loop across all tabs immediately
        if (cId) {
          dismissedLockedConvIdsRef.current.add(cId);
          stopWaitingForHumanBeep(cId, true);
        } else {
          stopWaitingForHumanBeep(undefined, true);
        }

        if (conversation && conversation.id) {
          setConversations((prev) => {
            const idx = prev.findIndex(c => c.id === conversation.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = conversation;
              return updated;
            }
            return [conversation, ...prev];
          });
        }
      })
      .on('broadcast', { event: 'chat_read' }, (payload: unknown) => {
        const raw = (payload as Record<string, unknown>)?.payload || payload;
        const cId = (raw as Record<string, unknown>)?.conversationId as string;
        const readerType = (raw as Record<string, unknown>)?.readerType as string;

        // If a visitor read an agent/AI message, mark agent message as read
        if (cId && readerType === 'visitor') {
          setConversations(prev => prev.map(c => {
            if (c.id !== cId) return c;
            return {
              ...c,
              messages: (c.messages || []).map(m => {
                if (m.sender_type === 'agent' || m.sender_type === 'ai') {
                  return { ...m, status: 'read' as const };
                }
                return m;
              })
            };
          }));
        }
      })
      .on('broadcast', { event: 'agent_pending_approval' }, (payload: unknown) => {
        console.log('[SYNC_DEBUG] WebSocket agent_pending_approval event received:', payload);
        let currentUser: { role?: string; email?: string } | null = null;
        try {
          const rawSession = localStorage.getItem('teals_agent_session');
          if (rawSession) currentUser = JSON.parse(rawSession);
        } catch {}
        const isAdmin = checkIsAdmin(currentUser);

        if (isAdmin) {
          const raw = (payload as Record<string, unknown>)?.payload || payload;
          const agentName = (raw as Record<string, unknown>)?.agentName || 'A new agent';
          showBackgroundNotification(
            'New Agent Approval Request',
            `${agentName} has submitted registration and is waiting for approval!`
          );
        }
      })
      .on('broadcast', { event: 'agent_permissions_updated' }, (payload: unknown) => {
        try {
          const raw = (payload as Record<string, unknown>)?.payload || payload;
          const targetEmail = ((raw as Record<string, unknown>)?.email as string || '').toLowerCase().trim();
          const params = new URLSearchParams(window.location.search);
          const myEmail = (params.get('sso_email') || '').toLowerCase().trim() || (() => {
            try { return (JSON.parse(localStorage.getItem('teals_agent_session') || '{}')?.email || '').toLowerCase().trim(); } catch { return ''; }
          })();
          if (myEmail && myEmail === targetEmail && Array.isArray((raw as any)?.assigned_websites)) {
            applyNewPermissions((raw as any).assigned_websites);
            refreshSync();
          }
        } catch {}
      })
      .on('broadcast', { event: 'stats_reset' }, () => {
        console.log('[SYNC_DEBUG] WebSocket stats_reset event received.');
        lastArrivalNoticeTime.current.clear();
        playedMsgIdsRef.current.clear();
        lastConvBeepTimeRef.current.clear();
        clearAudioEventLocks();
        setLiveVisitors([]);
        setConversations([]);
        setLiveCount(0);
        setTodayCount(0);
        setTotalUniqueCount(0);
        setPageViews(0);
        setWebsiteStats({});
        if (typeof window !== 'undefined') {
          try {
            Object.keys(localStorage).forEach(k => {
              if (k.startsWith('teals_cached_') || k.startsWith('teals_selected_') || k.startsWith('teals_read_map') || k.startsWith('teals_played_event_') || k.startsWith('teals_machine_played_')) {
                localStorage.removeItem(k);
              }
            });
          } catch {}
        }
      })
      .on('broadcast', { event: 'system_reset' }, () => {
        console.log('[SYNC_DEBUG] WebSocket system_reset event received.');
        lastArrivalNoticeTime.current.clear();
        playedMsgIdsRef.current.clear();
        lastConvBeepTimeRef.current.clear();
        clearAudioEventLocks();
        setLiveVisitors([]);
        setConversations([]);
        setLiveCount(0);
        setTodayCount(0);
        setTotalUniqueCount(0);
        setPageViews(0);
        setWebsiteStats({});
        if (typeof window !== 'undefined') {
          try {
            Object.keys(localStorage).forEach(k => {
              if (k.startsWith('teals_cached_') || k.startsWith('teals_selected_') || k.startsWith('teals_read_map') || k.startsWith('teals_played_event_') || k.startsWith('teals_machine_played_')) {
                localStorage.removeItem(k);
              }
            });
          } catch {}
        }
      })
      .on('broadcast', { event: 'custom_website_added' }, (payload: unknown) => {
        try {
          const raw = (payload as Record<string, unknown>)?.payload || payload;
          const website = (raw as Record<string, unknown>)?.website as WebsiteConfig;
          if (website && website.slug && website.name) {
            registerCustomWebsite({
              name: website.name,
              domain: website.domain || website.url || website.slug,
              slug: website.slug,
              category: website.category === 'publishing' ? 'publishing' : 'ecommerce',
            });
            setWebsitesList(getAllWebsites());
            refreshSync();
          }
        } catch {}
      })
      .on('broadcast', { event: 'website_removed' }, (payload: unknown) => {
        try {
          const raw = (payload as Record<string, unknown>)?.payload || payload;
          const removedSlug = ((raw as Record<string, unknown>)?.slug as string || '').toLowerCase().trim();
          if (removedSlug) {
            unregisterWebsite(removedSlug);
            setWebsitesList(getAllWebsites());
            setLiveVisitors(prev => prev.filter(v => v.property_slug !== removedSlug));
            setConversations(prev => prev.filter(c => c.property_slug !== removedSlug));
            setWebsiteStats(prev => {
              const next = { ...prev };
              delete next[removedSlug];
              return next;
            });
            refreshSync();
          }
        } catch {}
      })
      .subscribe((status) => {
        if (status === 'TIMED_OUT' || status === 'CLOSED') {
          setTimeout(() => channel.subscribe(), 1000);
        }
      });

    channelRef.current = channel;

    // 2-second rapid reconciliation poll using Web Worker (unthrottled in background tabs)
    const stopWorkerSync = createWorkerInterval(refreshSync, 2000);

    return () => {
      channelRef.current = null;
      channel.unsubscribe();
      stopWorkerSync();
    };
  }, [refreshSync, triggerArrivalBeepIfNew]);

  // Continuous Monitor: Keep ringing the handoff alert beep loop whenever any unassigned locked chat is waiting for a human agent
  useEffect(() => {
    if (!soundEnabled) {
      stopWaitingForHumanBeep(undefined, true);
      return;
    }

    const nowMs = Date.now();
    const lockedConv = userVisibleConversations.find(c => {
      if (dismissedLockedConvIdsRef.current.has(c.id)) return false;
      const isRecent = (nowMs - new Date(c.updated_at || c.created_at || 0).getTime()) < 90000;
      return (
        isRecent &&
        (c.status === 'pending_agent' || (c.mode === 'human' && !c.assigned_agent_id && !c.assigned_agent_name)) &&
        c.status !== 'closed' &&
        isWebsitePermitted(c.property_slug)
      );
    });

    if (lockedConv) {
      startWaitingForHumanBeep(lockedConv.id);
    } else {
      stopWaitingForHumanBeep(undefined, true);
    }
  }, [userVisibleConversations, soundEnabled]);

  const toggleSound = () => {
    const next = !soundEnabledRef.current;
    soundEnabledRef.current = next;
    setSoundEnabled(next);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('teals_sound_enabled', String(next));
      } catch {}
    }
    if (next) {
      initAndUnlockAudio();
      tryPlayDeduplicatedSound(`beep_enabled_${Date.now()}`, 'arrival', 'global');
    } else {
      stopContinuousHandoffRinger();
      stopWaitingForHumanBeep();
    }
  };

  const deleteConversation = useCallback(async (convId: string) => {
    if (!convId) return;

    // Immediately record to persistent deleted set so it can NEVER be resurrected
    const localDeleted = getDeletedConvIdsFromStorage();
    localDeleted.add(convId);

    setConversations(prev => {
      saveDeletedConvIdsToStorage(localDeleted);
      const filtered = prev.filter(c => c.id !== convId);
      if (typeof window !== 'undefined') {
        try {
          if (filtered.length > 0) {
            localStorage.setItem('teals_cached_conversations', JSON.stringify(filtered));
          } else {
            localStorage.removeItem('teals_cached_conversations');
          }
          const selected = localStorage.getItem('teals_selected_chat_id');
          if (selected === convId) {
            localStorage.removeItem('teals_selected_chat_id');
          }
        } catch {}
      }
      return filtered;
    });

    setReadConvMap(rMap => {
      const next = { ...rMap };
      delete next[convId];
      if (typeof window !== 'undefined') {
        try { localStorage.setItem(getUserStorageKey(), JSON.stringify(next)); } catch {}
      }
      return next;
    });

    // Notify other tabs immediately via BroadcastChannel
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('teals-crm-sync');
        bc.postMessage({ type: 'CHAT_DELETED', conversationId: convId });
        bc.close();
      }
    } catch {}

    // Dispatch realtime broadcast event directly to visitor widget
    try {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'chat_deleted',
        payload: { conversationId: convId }
      });
    } catch {}

    try {
      fetch(`/api/chat/message?conversationId=${encodeURIComponent(convId)}`, {
        method: 'DELETE'
      }).catch(() => {});
    } catch {}
  }, []);

  const deleteConversations = useCallback(async (convIds: string[]) => {
    if (!convIds || convIds.length === 0) return;
    const idSet = new Set(convIds);

    const localDeleted = getDeletedConvIdsFromStorage();
    convIds.forEach(id => localDeleted.add(id));

    setConversations(prev => {
      saveDeletedConvIdsToStorage(localDeleted);
      const filtered = prev.filter(c => !idSet.has(c.id));
      if (typeof window !== 'undefined') {
        try {
          if (filtered.length > 0) {
            localStorage.setItem('teals_cached_conversations', JSON.stringify(filtered));
          } else {
            localStorage.removeItem('teals_cached_conversations');
          }
          const selected = localStorage.getItem('teals_selected_chat_id');
          if (selected && idSet.has(selected)) {
            localStorage.removeItem('teals_selected_chat_id');
          }
        } catch {}
      }
      return filtered;
    });

    setReadConvMap(rMap => {
      const next = { ...rMap };
      convIds.forEach(id => delete next[id]);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem(getUserStorageKey(), JSON.stringify(next)); } catch {}
      }
      return next;
    });

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('teals-crm-sync');
        bc.postMessage({ type: 'CHATS_BATCH_DELETED', conversationIds: convIds });
        bc.close();
      }
    } catch {}

    // Dispatch realtime broadcast event directly to visitor widget for all deleted chats
    try {
      convIds.forEach(id => {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'chat_deleted',
          payload: { conversationId: id }
        });
      });
    } catch {}

    try {
      fetch('/api/chat/message', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationIds: convIds })
      }).catch(() => {});
    } catch {}
  }, []);

  const resetChatsOnly = async () => {
    lastArrivalNoticeTime.current.clear();
    playedMsgIdsRef.current.clear();
    lastConvBeepTimeRef.current.clear();
    clearAudioEventLocks();
    setUnreadCount(0);
    setConversations([]);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('teals_cached_conversations');
        localStorage.removeItem('teals_selected_chat_id');
        localStorage.removeItem(getUserStorageKey());
      } catch {}
    }
    await fetch('/api/admin/reset?type=chats', { method: 'POST' });
    await refreshSync();
  };

  const resetAll = async () => {
    lastArrivalNoticeTime.current.clear();
    playedMsgIdsRef.current.clear();
    lastConvBeepTimeRef.current.clear();
    clearAudioEventLocks();
    prevLiveCountRef.current = 0;     // reset so next arrival triggers beep
    initialLoadDone.current = false;  // reset so initial sync doesn't beep
    setUnreadCount(0);
    setLiveVisitors([]);
    setConversations([]);
    setWebsiteStats({});
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('teals_cached_conversations');
        localStorage.removeItem('teals_selected_chat_id');
        localStorage.removeItem(getUserStorageKey());
      } catch {}
    }
    setLiveCount(0);
    setTodayCount(0);
    setTotalUniqueCount(0);
    setPageViews(0);
    await fetch('/api/admin/reset', { method: 'POST' });
    await refreshSync();
  };

  // Silently unlock audio context on initial user interaction (once)
  useEffect(() => {
    const tryUnlock = () => { initAndUnlockAudio().catch(() => {}); };
    tryUnlock(); // attempt immediately
    window.addEventListener('click', tryUnlock, { passive: true });
    window.addEventListener('keydown', tryUnlock, { passive: true });
    window.addEventListener('pointerdown', tryUnlock, { passive: true });
    window.addEventListener('touchstart', tryUnlock, { passive: true });
    window.addEventListener('mousemove', tryUnlock, { passive: true });
    window.addEventListener('focus', tryUnlock, { passive: true });

    // Stop tab title blinking when the tab becomes active (NO audio calls on tab switch!)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        stopTabTitleFlash();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', stopTabTitleFlash);
    return () => {
      window.removeEventListener('click', tryUnlock);
      window.removeEventListener('keydown', tryUnlock);
      window.removeEventListener('pointerdown', tryUnlock);
      window.removeEventListener('touchstart', tryUnlock);
      window.removeEventListener('mousemove', tryUnlock);
      window.removeEventListener('focus', tryUnlock);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', stopTabTitleFlash);
    };
  }, []);

  // Keep liveCount ref updated without playing noisy phantom chimes
  useEffect(() => {
    prevLiveCountRef.current = liveCount;
  }, [liveCount]);

  const resetUnreadCount = () => setUnreadCount(0);

  const addCustomWebsite = useCallback(async (input: {
    name: string;
    domain: string;
    slug?: string;
    category?: 'ecommerce' | 'publishing';
  }): Promise<WebsiteConfig> => {
    const localCfg = registerCustomWebsite(input);
    setWebsitesList(getAllWebsites());

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.customWebsites) || Array.isArray(data.removedWebsites)) {
          syncCustomWebsitesFromList(data.customWebsites, data.removedWebsites);
          setWebsitesList(getAllWebsites());
        }
      }
    } catch (e) {
      console.error('Failed to persist custom website to server:', e);
    }

    try {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'custom_website_added',
        payload: { website: localCfg }
      });
    } catch {}

    await refreshSync();
    return localCfg;
  }, [refreshSync]);

  const removeWebsite = useCallback(async (slug: string): Promise<void> => {
    const cleanSlug = (slug || '').trim().toLowerCase();
    if (!cleanSlug) return;

    // 1. Immediately remove locally across the UI
    unregisterWebsite(cleanSlug);
    setWebsitesList(getAllWebsites());
    setLiveVisitors(prev => prev.filter(v => v.property_slug !== cleanSlug));
    setConversations(prev => prev.filter(c => c.property_slug !== cleanSlug));
    setWebsiteStats(prev => {
      const next = { ...prev };
      delete next[cleanSlug];
      return next;
    });

    // 2. Persist removal to server & Supabase storage
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_website', slug: cleanSlug }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.customWebsites) || Array.isArray(data.removedWebsites)) {
          syncCustomWebsitesFromList(data.customWebsites, data.removedWebsites);
          setWebsitesList(getAllWebsites());
        }
      }
    } catch (e) {
      console.error('Failed to remove website on server:', e);
    }

    // 3. Broadcast removal to any other connected agent tabs
    try {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'website_removed',
        payload: { slug: cleanSlug }
      });
    } catch {}

    await refreshSync();
  }, [refreshSync]);

  return (
    <LiveSyncContext.Provider
      value={{
        liveVisitors: userVisibleLiveVisitors,
        conversations: userVisibleConversations,
        websites: websitesList,
        liveCount: userVisibleLiveVisitors.length,
        todayCount,
        totalUniqueCount,
        chatCount: userVisibleConversations.length,
        pageViews,
        websiteStats: userVisibleWebsiteStats,
        soundEnabled,
        unreadCount,
        unreadConversationsCount,
        readConvMap,
        agentPermissions: permissions,
        isWebsitePermitted: isWebsitePermittedState,
        addCustomWebsite,
        removeWebsite,
        toggleSound,
        resetAll,
        resetChatsOnly,
        refreshSync,
        resetUnreadCount,
        markConversationAsRead,
        deleteConversation,
        deleteConversations,
      }}
    >
      {children}

      {/* Floating In-App Side Toast Notifications (Top-Right) - Only in Standalone Mode */}
      {!isRunningInCrmIframe() && toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[9999999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none p-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto rounded-xl p-3.5 shadow-2xl border backdrop-blur-md transition-all duration-300 transform translate-y-0 opacity-100 flex flex-col gap-1.5 ${
                t.type === 'visitor'
                  ? 'bg-[#062016]/95 border-emerald-500/50 text-emerald-100'
                  : t.type === 'handoff'
                  ? 'bg-[#291206]/95 border-amber-500/50 text-amber-100'
                  : 'bg-[#0b1329]/95 border-blue-500/40 text-slate-100'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">
                    {t.type === 'visitor' ? '🟢' : t.type === 'handoff' ? '🚨' : '💬'}
                  </span>
                  <span className="font-bold text-xs uppercase tracking-wide">
                    {t.title}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                  className="text-slate-400 hover:text-white text-xs px-1"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-slate-300 font-normal leading-relaxed pl-6">
                {t.description}
              </p>
              {t.actionUrl && (
                <div className="pl-6 pt-1">
                  <a
                    href={t.actionUrl}
                    onClick={(e) => {
                      e.preventDefault();
                      window.focus();
                      if (window.location.pathname + window.location.search !== t.actionUrl) {
                        window.location.href = t.actionUrl;
                      }
                      setToasts((prev) => prev.filter((x) => x.id !== t.id));
                    }}
                    className="inline-block text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-white px-2.5 py-1 rounded-md transition cursor-pointer"
                  >
                    {t.type === 'visitor' ? 'View Live Visitor →' : 'Open LiveChat →'}
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </LiveSyncContext.Provider>
  );
};

export const useLiveSync = () => {
  const context = useContext(LiveSyncContext);
  if (!context) {
    throw new Error('useLiveSync must be used within a LiveSyncProvider');
  }
  return context;
};
