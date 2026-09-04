'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { REALTIME_CHANNEL } from '@/lib/realtime';
import {
  playVisitorAlertSound,
  playChatMessageAlertSound,
  playHandoffAlertSound,
  initAndUnlockAudio,
  flushPending,
} from '@/lib/audio';

const ADMIN_EMAILS = ['garryamelia6265@gmail.com', 'tzafar04@gmail.com', 'annusraees@gmail.com'];

const checkIsAdmin = (user?: { role?: string; email?: string } | null): boolean => {
  if (!user) return true;
  if (user.role === 'admin') return true;
  const email = (user.email || '').toLowerCase().trim();
  return ADMIN_EMAILS.includes(email) || email.includes('garry') || email.includes('tzafar') || email.includes('annus');
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
  content: string;
  is_whisper?: boolean;
  seq?: number;
  status?: 'sent' | 'delivered' | 'read';
  created_at: string;
}

export interface LiveConversation {
  id: string;
  property_slug: string;
  visitor_id: string;
  visitor_name: string;
  visitor_email?: string;
  visitor_ip?: string;
  visitor?: LiveVisitor;
  assigned_agent_id?: string;
  assigned_agent_name?: string;
  assigned_agent_email?: string;
  assigned_at?: string;
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

interface LiveSyncContextType {
  liveVisitors: LiveVisitor[];
  conversations: LiveConversation[];
  liveCount: number;
  todayCount: number;
  totalUniqueCount: number;
  chatCount: number;
  pageViews: number;
  soundEnabled: boolean;
  unreadCount: number;
  unreadConversationsCount: number;
  readConvMap: Record<string, string>;
  toggleSound: () => void;
  resetAll: () => Promise<void>;
  refreshSync: () => Promise<void>;
  resetUnreadCount: () => void;
  markConversationAsRead: (convId: string) => void;
  deleteConversation: (convId: string) => Promise<void>;
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

export const LiveSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [liveVisitors, setLiveVisitors] = useState<LiveVisitor[]>([]);
  const [conversations, setConversations] = useState<LiveConversation[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('teals_cached_conversations');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  });

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
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const soundEnabledRef = useRef<boolean>(true);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const [readConvMap, setReadConvMap] = useState<Record<string, string>>({});

  // Load per-user read map on client mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const key = getUserStorageKey();
        const saved = localStorage.getItem(key);
        if (saved) setReadConvMap(JSON.parse(saved));
      } catch {}
    }
  }, []);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const computeUnread = useCallback((convList: LiveConversation[], readMap: Record<string, string>) => {
    let currentUser: { role?: string; email?: string; id?: string; full_name?: string } | null = null;
    if (typeof window !== 'undefined') {
      try {
        const rawSession = localStorage.getItem('teals_agent_session');
        if (rawSession) currentUser = JSON.parse(rawSession);
      } catch {}
    }
    const isAdm = checkIsAdmin(currentUser);

    return convList.filter(c => {
      // For working agents: only consider chats they can access (claimed by them or pending human pickup)
      if (!isAdm) {
        const isMine = !!(
          (c.assigned_agent_id && c.assigned_agent_id === currentUser?.id) ||
          (c.assigned_agent_name && c.assigned_agent_name.toLowerCase() === currentUser?.full_name?.toLowerCase()) ||
          (c.assigned_agent_email && c.assigned_agent_email.toLowerCase() === currentUser?.email?.toLowerCase())
        );
        const isNeedsHuman = !c.assigned_agent_id && !c.assigned_agent_name && (c.mode === 'human' || c.status === 'pending_agent');
        if (!isMine && !isNeedsHuman) return false;
      }

      if (!c.messages || c.messages.length === 0) return false;
      const visitorMsgs = c.messages.filter(m => m.sender_type === 'visitor');
      if (visitorMsgs.length === 0) return false;

      const lastVisitorMsg = visitorMsgs[visitorMsgs.length - 1];

      // Pure ID-based unread matching (zero clock dependency)
      const readVal = readMap[c.id];
      if (readVal) {
        let savedId = readVal;
        if (readVal.includes('__')) {
          savedId = readVal.split('__')[0];
        }
        if (savedId === lastVisitorMsg.id || savedId === 'all') {
          return false;
        }
      }

      return true;
    }).length;
  }, []);

  const unreadConversationsCount = computeUnread(conversations, readConvMap);

  const userVisibleConversations = useMemo(() => {
    let currentUser: { role?: string; email?: string; id?: string; full_name?: string } | null = null;
    if (typeof window !== 'undefined') {
      try {
        const rawSession = localStorage.getItem('teals_agent_session');
        if (rawSession) currentUser = JSON.parse(rawSession);
      } catch {}
    }
    const isAdm = checkIsAdmin(currentUser);
    if (isAdm) return conversations;

    return conversations.filter(c => {
      const isMine = !!(
        (c.assigned_agent_id && c.assigned_agent_id === currentUser?.id) ||
        (c.assigned_agent_name && c.assigned_agent_name.toLowerCase() === currentUser?.full_name?.toLowerCase()) ||
        (c.assigned_agent_email && c.assigned_agent_email.toLowerCase() === currentUser?.email?.toLowerCase())
      );
      const isNeedsHuman = !c.assigned_agent_id && !c.assigned_agent_name && (c.mode === 'human' || c.status === 'pending_agent');
      return isMine || isNeedsHuman;
    });
  }, [conversations]);

  const chatCount = userVisibleConversations.length;

  const markConversationAsRead = useCallback((convId: string) => {
    if (!convId) return;

    setReadConvMap(rMap => {
      // Find latest visitor message in current state to store exact message ID
      const conv = conversations.find(c => c.id === convId);
      const vMsgs = (conv?.messages || []).filter(m => m.sender_type === 'visitor');
      const lastMsgId = vMsgs.length > 0 ? vMsgs[vMsgs.length - 1].id : 'all';

      // Store exact last seen message ID
      const next = { ...rMap, [convId]: lastMsgId };
      if (typeof window !== 'undefined') {
        try {
          const storageKey = getUserStorageKey();
          localStorage.setItem(storageKey, JSON.stringify(next));
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

  const recentArrivalTimestamps = useRef<Map<string, number>>(new Map());
  const initialLoadDone = useRef(false);
  const prevLiveCountRef = useRef<number>(0);

  const triggerArrivalBeepIfNew = useCallback((key: string, source: string) => {
    if (!key) return;

    let currentUser: { role?: string; email?: string } | null = null;
    try {
      const rawSession = localStorage.getItem('teals_agent_session');
      if (rawSession) currentUser = JSON.parse(rawSession);
    } catch {}
    // Working agents do NOT get visitor arrival beeps (only admins monitor live arrivals)
    if (!checkIsAdmin(currentUser)) return;

    const now = Date.now();
    const lastTime = recentArrivalTimestamps.current.get(key) || 0;
    if (now - lastTime > 15000) {
      console.log(`[SYNC_DEBUG] Triggering arrival alert for key: ${key} via ${source}`);
      recentArrivalTimestamps.current.set(key, now);
      if (soundEnabledRef.current) {
        initAndUnlockAudio().then(() => {
          playVisitorAlertSound();
        });
      }
    }
  }, []);

  const refreshSync = useCallback(async () => {
    try {
      const res = await fetch('/api/sync?property=teals-crm');
      if (!res.ok) return;
      const data = await res.json();

      const uniqueVisitors: LiveVisitor[] = Array.isArray(data.visitors) ? data.visitors : [];
      setLiveVisitors(uniqueVisitors);
      setLiveCount(typeof data.liveVisitorsCount === 'number' ? data.liveVisitorsCount : uniqueVisitors.length);
      setTodayCount(data.todayVisitorsCount || 0);
      setTotalUniqueCount(data.totalUniqueCount || 0);
      setPageViews(data.pageViews || 0);

      const convsList: LiveConversation[] = Array.isArray(data.conversations) ? data.conversations : [];
      if (convsList.length === 0) {
        setConversations([]);
        if (typeof window !== 'undefined') {
          try {
            Object.keys(localStorage).forEach(k => {
              if (k.startsWith('teals_cached_') || k.startsWith('teals_selected_') || k.startsWith('teals_read_map')) {
                localStorage.removeItem(k);
              }
            });
          } catch {}
        }
        return;
      }

      // NON-DESTRUCTIVE UNION MERGE: never let a background sync poll erase newer messages received via WebSockets
      setConversations(prev => {
        if (prev.length === convsList.length) {
          const hasDiff = convsList.some(apiConv => {
            const p = prev.find(x => x.id === apiConv.id);
            if (!p) return true;
            if ((p.messages?.length || 0) !== (apiConv.messages?.length || 0)) return true;
            if (p.mode !== apiConv.mode || p.status !== apiConv.status) return true;
            if (p.assigned_agent_id !== apiConv.assigned_agent_id) return true;
            const pLast = p.messages?.[p.messages.length - 1]?.id;
            const aLast = apiConv.messages?.[apiConv.messages.length - 1]?.id;
            return pLast !== aLast;
          });
          if (!hasDiff) {
            return prev; // Return existing reference to prevent any glitch or UI jump
          }
        }

        const prevMap = new Map(prev.map(c => [c.id, c]));

        const updatedList: LiveConversation[] = convsList.map(apiConv => {
          const prevConv = prevMap.get(apiConv.id);
          if (!prevConv) return apiConv;

          const msgMap = new Map<string, LiveMessage>();
          (prevConv.messages || []).forEach(m => msgMap.set(m.id, m));
          (apiConv.messages || []).forEach(m => msgMap.set(m.id, m));

          const mergedMessages = Array.from(msgMap.values()).sort((a, b) => {
            if (typeof a.seq === 'number' && typeof b.seq === 'number' && a.seq !== b.seq) {
              return a.seq - b.seq;
            }
            const timeA = new Date(a.created_at || 0).getTime();
            const timeB = new Date(b.created_at || 0).getTime();
            return timeA - timeB;
          });

          const effectiveAssignedId = apiConv.assigned_agent_id || prevConv.assigned_agent_id;
          const effectiveAssignedName = apiConv.assigned_agent_name || prevConv.assigned_agent_name;
          const effectiveAssignedEmail = apiConv.assigned_agent_email || prevConv.assigned_agent_email;
          const isClaimed = !!effectiveAssignedId || !!effectiveAssignedName;

          const effectiveMode: 'ai' | 'human' = isClaimed || apiConv.mode === 'human' || prevConv.mode === 'human' ? 'human' : 'ai';
          const effectiveStatus: 'active' | 'pending_agent' | 'closed' = isClaimed 
            ? 'active'
            : (apiConv.status === 'pending_agent' || prevConv.status === 'pending_agent' ? 'pending_agent' : 'active');

          return {
            ...prevConv,
            ...apiConv,
            visitor_name: apiConv.visitor_name || prevConv.visitor_name,
            visitor_email: apiConv.visitor_email || prevConv.visitor_email,
            mode: effectiveMode,
            status: effectiveStatus,
            assigned_agent_id: effectiveAssignedId,
            assigned_agent_name: effectiveAssignedName,
            assigned_agent_email: effectiveAssignedEmail,
            messages: mergedMessages
          };
        });

        return updatedList;
      });

      // Populate known sessions cache without noisy polling beeps
      uniqueVisitors.forEach(v => {
        const key = v.ip_address || v.id;
        if (!recentArrivalTimestamps.current.has(key)) {
          recentArrivalTimestamps.current.set(key, Date.now());
        }
      });
      initialLoadDone.current = true;
    } catch (err) {
      console.error('[SYNC_DEBUG] Poll sync error:', err);
    }
  }, []);

  useEffect(() => {
    refreshSync();

    const channel = supabase.channel(REALTIME_CHANNEL, {
      config: { broadcast: { self: true } }
    });

    channel
      .on('broadcast', { event: 'visitor_arrival' }, (payload: unknown) => {
        console.log('[SYNC_DEBUG] WebSocket visitor_arrival event received:', payload);
        const raw = (payload as Record<string, unknown>)?.payload || payload;
        const session: LiveVisitor | undefined = ((raw as Record<string, unknown>)?.session as LiveVisitor) || (((raw as Record<string, unknown>)?.id) ? (raw as unknown as LiveVisitor) : undefined);

        if (session && session.id) {
          const dedupeKey = session.ip_address || session.id; // IP for count dedup
          // Dedup by IP so page changes or refreshes do not re-chime
          triggerArrivalBeepIfNew(dedupeKey, 'WebSocket_visitor_arrival');

          setLiveVisitors((prev) => {
            const map = new Map<string, LiveVisitor>();
            prev.forEach(v => map.set(v.ip_address || v.id, v));
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
        if (sessionId && currentPage) {
          setLiveVisitors((prev) =>
            prev.map(v => v.id === sessionId ? { ...v, current_page: currentPage } : v)
          );
        }
      })
      .on('broadcast', { event: 'visitor_offline' }, (payload: unknown) => {
        console.log('[SYNC_DEBUG] WebSocket visitor_offline event received:', payload);
        const raw = (payload as Record<string, unknown>)?.payload || payload;
        const sessionId = (raw as Record<string, unknown>)?.sessionId as string;
        const sessionIp = (raw as Record<string, unknown>)?.ip as string;

        if (sessionId || sessionIp) {
          // Grace period: allow 30 seconds before allowing re-arrival beep for same session/IP
          // This prevents rapid navigation between website pages from repeatedly ringing arrival alerts
          setTimeout(() => {
            if (sessionId) recentArrivalTimestamps.current.delete(sessionId);
            if (sessionIp) recentArrivalTimestamps.current.delete(sessionIp);
          }, 30000);

          setLiveVisitors((prev) => {
            const nextList = prev.filter(v => v.id !== sessionId && (!sessionIp || v.ip_address !== sessionIp));
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
        const isHandoffEvent = isHandoffRequested || conversation?.status === 'pending_agent' || conversation?.mode === 'human';
        const isVisitorMsg = message && message.sender_type === 'visitor';

        // When a new visitor message arrives, immediately invalidate read map for this conversation
        if (isVisitorMsg && conversation?.id) {
          setReadConvMap(rMap => {
            if (!rMap[conversation.id]) return rMap;
            const next = { ...rMap };
            delete next[conversation.id];
            if (typeof window !== 'undefined') {
              try {
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

              if (typeof a.seq === 'number' && typeof b.seq === 'number' && a.seq !== b.seq) {
                return a.seq - b.seq;
              }
              const timeA = new Date(a.created_at || 0).getTime();
              const timeB = new Date(b.created_at || 0).getTime();
              return timeA - timeB;
            });

            const mergedConv: LiveConversation = {
              ...existing,
              ...conversation,
              mode: effectiveMode,
              status: effectiveStatus,
              assigned_agent_id: effectiveAssignedId,
              assigned_agent_name: effectiveAssignedName,
              assigned_agent_email: effectiveAssignedEmail,
              messages: mergedMessages,
              updated_at: new Date().toISOString()
            };

            const isHumanActive = mergedConv.mode === 'human' || mergedConv.status === 'pending_agent' || !!mergedConv.assigned_agent_id;
            let updated: LiveConversation[];
            if (isAdmin) {
              // Admin sees ALL conversations including AI conversations in real-time (newest on top)
              const other = prev.filter(c => c.id !== conversation.id);
              updated = [mergedConv, ...other];
            } else {
              if (isHumanActive) {
                const other = prev.filter(c => c.id !== conversation.id);
                updated = [mergedConv, ...other];
              } else {
                updated = prev.filter(c => c.id !== conversation.id);
              }
            }

            return updated;
          });
        }

        // Beep logic (instant audio chimes)
        if (soundEnabledRef.current) {
          if (isHandoffEvent) {
            // Customer requested real human agent: 2-second urgent alert chime (both admin and working agents hear this!)
            playHandoffAlertSound();
          } else if (isVisitorMsg) {
            // Working agents only hear visitor message chime if it is their claimed chat!
            if (isAdmin || isMyClaimedChat) {
              playChatMessageAlertSound();
            }
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
            const merged = existing ? { ...existing, ...conversation } : conversation;
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
          setConversations(prev => prev.filter(c => c.id !== cId));
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
          if (soundEnabledRef.current) {
            playHandoffAlertSound();
          }
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            const raw = (payload as Record<string, unknown>)?.payload || payload;
            const agentName = (raw as Record<string, unknown>)?.agentName || 'A new agent';
            new Notification('New Agent Approval Request', {
              body: `${agentName} has submitted registration and is waiting for approval!`,
              icon: '/favicon.ico'
            });
          }
        }
      })
      .on('broadcast', { event: 'stats_reset' }, () => {
        console.log('[SYNC_DEBUG] WebSocket stats_reset event received.');
        recentArrivalTimestamps.current.clear();
        setLiveVisitors([]);
        setConversations([]);
        setLiveCount(0);
        setTodayCount(0);
        setTotalUniqueCount(0);
        setPageViews(0);
        if (typeof window !== 'undefined') {
          try {
            Object.keys(localStorage).forEach(k => {
              if (k.startsWith('teals_cached_') || k.startsWith('teals_selected_') || k.startsWith('teals_read_map')) {
                localStorage.removeItem(k);
              }
            });
          } catch {}
        }
      })
      .on('broadcast', { event: 'system_reset' }, () => {
        console.log('[SYNC_DEBUG] WebSocket system_reset event received.');
        recentArrivalTimestamps.current.clear();
        setLiveVisitors([]);
        setConversations([]);
        setLiveCount(0);
        setTodayCount(0);
        setTotalUniqueCount(0);
        setPageViews(0);
        if (typeof window !== 'undefined') {
          try {
            Object.keys(localStorage).forEach(k => {
              if (k.startsWith('teals_cached_') || k.startsWith('teals_selected_') || k.startsWith('teals_read_map')) {
                localStorage.removeItem(k);
              }
            });
          } catch {}
        }
      })
      .subscribe((status) => {
        if (status === 'TIMED_OUT' || status === 'CLOSED') {
          setTimeout(() => channel.subscribe(), 1000);
        }
      });

    channelRef.current = channel;

    // 2-second rapid reconciliation poll
    const interval = setInterval(refreshSync, 2000);

    return () => {
      channelRef.current = null;
      channel.unsubscribe();
      clearInterval(interval);
    };
  }, [refreshSync, triggerArrivalBeepIfNew]);

  const toggleSound = () => {
    const next = !soundEnabledRef.current;
    soundEnabledRef.current = next;
    setSoundEnabled(next);
  };

  const deleteConversation = useCallback(async (convId: string) => {
    if (!convId) return;
    setConversations(prev => prev.filter(c => c.id !== convId));
    setReadConvMap(rMap => {
      const next = { ...rMap };
      delete next[convId];
      if (typeof window !== 'undefined') {
        try { localStorage.setItem(getUserStorageKey(), JSON.stringify(next)); } catch {}
      }
      return next;
    });

    try {
      await fetch(`/api/chat/message?conversationId=${encodeURIComponent(convId)}`, {
        method: 'DELETE'
      });
    } catch {}
  }, []);

  const resetAll = async () => {
    recentArrivalTimestamps.current.clear();
    prevLiveCountRef.current = 0;     // reset so next arrival triggers beep
    initialLoadDone.current = false;  // reset so initial sync doesn't beep
    setUnreadCount(0);
    setLiveVisitors([]);
    setConversations([]);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('teals_cached_conversations');
        localStorage.removeItem('teals_selected_chat_id');
      } catch {}
    }
    setLiveCount(0);
    setTodayCount(0);
    setTotalUniqueCount(0);
    setPageViews(0);
    await fetch('/api/admin/reset', { method: 'POST' });
    await refreshSync();
  };

  // Silently attempt audio unlock on every user interaction (persistent, not once)
  useEffect(() => {
    const tryUnlock = () => { initAndUnlockAudio().catch(() => {}); };
    tryUnlock(); // try immediately
    window.addEventListener('click', tryUnlock, { passive: true });
    window.addEventListener('keydown', tryUnlock, { passive: true });
    window.addEventListener('pointerdown', tryUnlock, { passive: true });
    // CRITICAL: When tab becomes visible again (Chrome suspends AudioContext in background)
    // flush any pending beeps that accumulated while tab was in background
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        initAndUnlockAudio().then(() => flushPending()).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('click', tryUnlock);
      window.removeEventListener('keydown', tryUnlock);
      window.removeEventListener('pointerdown', tryUnlock);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Keep liveCount ref updated without playing noisy phantom chimes
  useEffect(() => {
    prevLiveCountRef.current = liveCount;
  }, [liveCount]);

  const resetUnreadCount = () => setUnreadCount(0);

  return (
    <LiveSyncContext.Provider
      value={{
        liveVisitors,
        conversations,
        liveCount,
        todayCount,
        totalUniqueCount,
        chatCount,
        pageViews,
        soundEnabled,
        unreadCount,
        unreadConversationsCount,
        readConvMap,
        toggleSound,
        resetAll,
        refreshSync,
        resetUnreadCount,
        markConversationAsRead,
        deleteConversation,
      }}
    >
      {children}
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
