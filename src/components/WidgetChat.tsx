'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Send, User, Mail, Phone, ArrowRight, Sparkles, PlusCircle, Eye, History, MessageSquare, ChevronLeft, AlertCircle, RotateCcw } from 'lucide-react';
import { AgentAvatar } from '@/components/AgentAvatar';
import { ConsultationBookingCard } from '@/components/ConsultationBookingCard';
import { supabase } from '@/lib/supabase';
import { REALTIME_CHANNEL } from '@/lib/realtime';
import { stopWaitingForHumanBeep } from '@/lib/audio';

import { getWebsiteConfig } from '@/lib/websites-config';

interface WidgetChatProps {
  propertySlug?: string;
  visitorTokenProp?: string;
  sessionIdProp?: string;
  pageUrl?: string;
  referrerUrl?: string;
  isEmbeddedProp?: boolean;
}

const DEFAULT_GREETING = 'Hey how can i help you ?';

interface SavedConvSummary {
  id: string;
  lastMessage?: string;
  updatedAt: string;
  chatNumber?: number;
}

const STAFF_EMAILS = [
  'garryamelia6265@gmail.com',
  'tzafar04@gmail.com',
  'annusraees@gmail.com',
  'abdulrafay40023@gmail.com'
];

const STAFF_NAMES = [
  'garry amelia',
  't zafar',
  'annus raees',
  'abdul rafay',
  'abdulrafay'
];

function isStaffCredentials(email?: string, name?: string): boolean {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanName = (name || '').trim().toLowerCase();
  if (cleanEmail && STAFF_EMAILS.includes(cleanEmail)) return true;
  if (cleanName && STAFF_NAMES.includes(cleanName)) return true;
  return false;
}

const dedupeMessages = (incomingList: any[], defaultGreeting = DEFAULT_GREETING, defaultSenderName = 'AI Assistant') => {
  const map = new Map<string, any>();
  let seenGreet = false;

  const hasAgentMessages = incomingList.some(m => m && m.sender_type === 'agent');
  const hasClaimOrJoined = incomingList.some(m => m && m.sender_type === 'system' && (
    m.content?.includes('has claimed and joined') ||
    m.content?.includes('has joined the conversation') ||
    m.content?.includes('transferred to Real Agent') ||
    m.content?.includes('transferred to Live Support Agent') ||
    m.content?.includes('taken over')
  ));

  const hasRealAgentMessage = incomingList.some(m => m && m.sender_type === 'agent' && !m.is_whisper && !m.isWhisper && m.content?.trim());

  incomingList.forEach(m => {
    if (!m) return;
    // CRITICAL: Whisper / internal messages must NEVER appear on visitor widget
    if (m.is_whisper || m.isWhisper) return;

    // If an agent has claimed/joined, omit temporary handoff messages
    if (hasClaimOrJoined && m.sender_type === 'system' && m.content?.includes('Transferring to a live support agent')) {
      return;
    }
    const isGreet = m.sender_type === 'ai' && (
      m.id === 'init-greet' || 
      m.id?.startsWith?.('init-greet') ||
      (m.seq === 1 && m.created_at === '1970-01-01T00:00:00.000Z')
    );
    if (isGreet) {
      if (hasRealAgentMessage) return; // Only omit AI init greeting if an actual agent message exists
      if (seenGreet) return;
      seenGreet = true;
      map.set('init-greet', {
        ...m,
        id: 'init-greet',
        seq: 1,
        status: 'read',
        created_at: m.created_at || '1970-01-01T00:00:00.000Z'
      });
      return;
    }
    const msgId = m.id || ('msg_' + Math.random().toString(36).substring(2, 9));

    // Prevent duplicate visitor message flashing (optimistic vs server) strictly within a 15s window
    if (m.sender_type === 'visitor' && m.content) {
      const cKey = m.content.trim();
      const mTime = new Date(m.created_at || Date.now()).getTime();
      let matchedExistingId: string | null = null;
      for (const [id, item] of map.entries()) {
        if (item.sender_type === 'visitor' && item.content?.trim() === cKey) {
          const itemTime = new Date(item.created_at || Date.now()).getTime();
          if (Math.abs(mTime - itemTime) < 15000) {
            matchedExistingId = id;
            break;
          }
        }
      }
      if (matchedExistingId) {
        const existing = map.get(matchedExistingId);
        map.set(matchedExistingId, { ...existing, ...m, id: matchedExistingId });
        return;
      }
    }

    // Prevent duplicate AI messages strictly within a 15s window
    if (m.sender_type === 'ai' && m.content) {
      const cKey = m.content.trim();
      const mTime = new Date(m.created_at || Date.now()).getTime();
      let matchedExisting = false;
      for (const item of map.values()) {
        if (item.sender_type === 'ai' && item.content?.trim() === cKey) {
          const itemTime = new Date(item.created_at || Date.now()).getTime();
          if (Math.abs(mTime - itemTime) < 15000) {
            matchedExisting = true;
            break;
          }
        }
      }
      if (matchedExisting) return;
    }

    map.set(msgId, { ...m, id: msgId });
  });

  if (!seenGreet && !hasRealAgentMessage) {
    map.set('init-greet', {
      id: 'init-greet',
      sender_type: 'ai',
      sender_name: defaultSenderName,
      content: defaultGreeting,
      seq: 1,
      status: 'read',
      created_at: '1970-01-01T00:00:00.000Z'
    });
  }

  // Absolute safety fallback: ensure visitor never sees an empty chat window
  if (map.size === 0) {
    map.set('init-greet', {
      id: 'init-greet',
      sender_type: 'ai',
      sender_name: defaultSenderName,
      content: defaultGreeting,
      seq: 1,
      status: 'read',
      created_at: '1970-01-01T00:00:00.000Z'
    });
  }

  // Deduplicate multiple claim/transfer system messages: keep only the newest one
  const claimMsgs = Array.from(map.values()).filter(m => m.sender_type === 'system' && (
    m.content?.includes('has claimed and joined') ||
    m.content?.includes('has joined the conversation') ||
    m.content?.includes('transferred to Real Agent') ||
    m.content?.includes('transferred to Live Support Agent')
  ));
  if (claimMsgs.length > 1) {
    const sortedClaims = claimMsgs.sort((a, b) => {
      const sA = typeof a.seq === 'number' ? a.seq : 0;
      const sB = typeof b.seq === 'number' ? b.seq : 0;
      if (sA !== sB) return sB - sA;
      const tA = new Date(a.created_at || 0).getTime();
      const tB = new Date(b.created_at || 0).getTime();
      return tB - tA;
    });
    for (let i = 1; i < sortedClaims.length; i++) {
      if (sortedClaims[i].id) {
        map.delete(sortedClaims[i].id);
      }
    }
  }

  const result = Array.from(map.values());
  const sorted = result.sort((a, b) => {
    const isAiGreetA = a.id === 'init-greet';
    const isAiGreetB = b.id === 'init-greet';
    if (isAiGreetA && !isAiGreetB) return -1;
    if (!isAiGreetA && isAiGreetB) return 1;

    // Strict chronological order by real physical creation timestamp
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    if (timeA !== timeB) {
      return timeA - timeB;
    }

    // Tie-breakers if identical millisecond timestamp:
    if (a.sender_type === 'visitor' && b.sender_type === 'system') return -1;
    if (a.sender_type === 'system' && b.sender_type === 'visitor') return 1;

    const seqA = typeof a.seq === 'number' ? a.seq : null;
    const seqB = typeof b.seq === 'number' ? b.seq : null;
    if (seqA !== null && seqB !== null && seqA !== seqB) {
      return seqA - seqB;
    }

    return (a.id || '').localeCompare(b.id || '');
  });

  // Content-based deduplication for matching sender and text within 10s window
  const finalCleanList: any[] = [];
  sorted.forEach(m => {
    const isDup = finalCleanList.some(existing => 
      existing.id !== m.id &&
      existing.sender_type === m.sender_type &&
      existing.content?.trim() === m.content?.trim() &&
      Math.abs(new Date(existing.created_at || 0).getTime() - new Date(m.created_at || 0).getTime()) < 10000
    );
    if (!isDup) finalCleanList.push(m);
  });

  return finalCleanList;
};

class ChatCardErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any) {
    console.error('[ChatCardErrorBoundary]', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="mt-2 p-2.5 rounded-lg bg-red-950/40 border border-red-500/30 text-[11px] text-red-300">
          Booking form is loading. You can also send your details directly in chat.
        </div>
      );
    }
    return this.props.children;
  }
}

export const WidgetChat: React.FC<WidgetChatProps> = ({
  propertySlug = 'teals-crm',
  visitorTokenProp,
  sessionIdProp,
  pageUrl,
  referrerUrl,
  isEmbeddedProp = false
}) => {
  const siteConfig = getWebsiteConfig(propertySlug);
  const siteAiName = `${siteConfig.shortName} AI`;
  const siteGreeting = DEFAULT_GREETING;

  const [isOpen, setIsOpen] = useState(false);
  const [showGreetingBubble, setShowGreetingBubble] = useState(true);
  const [messages, setMessages] = useState<any[]>([
    {
      id: 'init-greet',
      sender_type: 'ai',
      sender_name: siteAiName,
      content: siteGreeting,
      seq: 1,
      status: 'read',
      created_at: '1970-01-01T00:00:00.000Z'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try { return localStorage.getItem('teals_lead_name') || ''; } catch {}
    }
    return '';
  });
  const [userEmail, setUserEmail] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try { return localStorage.getItem('teals_lead_email') || ''; } catch {}
    }
    return '';
  });
  const [userPhone, setUserPhone] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try { return localStorage.getItem('teals_lead_phone') || ''; } catch {}
    }
    return '';
  });
  const [hasSubmittedLead, setHasSubmittedLead] = useState<boolean>(true);
  const [isHumanConnected, setIsHumanConnected] = useState(false);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [agentPseudoName, setAgentPseudoName] = useState<string | null>(null);
  const [agentRoleTitle, setAgentRoleTitle] = useState<string | null>(null);
  const [agentTypingText, setAgentTypingText] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      // STRICT: On page load/mount, ALWAYS select Chat #1!
      const rawConvList = localStorage.getItem('teals_visitor_conv_list');
      if (rawConvList) {
        const parsed: SavedConvSummary[] = JSON.parse(rawConvList);
        const chat1 = parsed.find(c => c.chatNumber === 1);
        if (chat1 && chat1.id && !chat1.id.startsWith('vis_')) {
          return chat1.id;
        }
      }
      const activeId = localStorage.getItem('teals_active_conv_id');
      const activeNum = activeId ? localStorage.getItem('teals_chat_num_' + activeId) : null;
      if (activeId && !activeId.startsWith('vis_') && activeNum !== '2') {
        return activeId;
      }
    } catch {}
    return null;
  });
  const activeConvIdRef = useRef<string | null>(conversationId);

  const changeActiveConversation = useCallback((newId: string | null) => {
    activeConvIdRef.current = newId;
    setConversationId(newId);
    if (newId && typeof window !== 'undefined') {
      try {
        localStorage.setItem('teals_active_conv_id', newId);
      } catch {}
    }
  }, []);

  const [visitorToken, setVisitorToken] = useState<string>('');
  const visitorTokenRef = useRef<string>(visitorToken);
  useEffect(() => {
    visitorTokenRef.current = visitorToken;
  }, [visitorToken]);
  const [savedConversations, setSavedConversations] = useState<SavedConvSummary[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const rawConvList = localStorage.getItem('teals_visitor_conv_list');
      const parsedConvs: SavedConvSummary[] = rawConvList ? JSON.parse(rawConvList) : [];
      let cappedConvs = Array.isArray(parsedConvs) ? parsedConvs.slice(0, 2) : [];
      cappedConvs = cappedConvs.filter(c => {
        if (c.chatNumber === 2) {
          const cache = localStorage.getItem('teals_conv_cache_' + c.id);
          if (!cache) return false;
          try {
            const msgs = JSON.parse(cache);
            return msgs.some((m: any) => m && m.id !== 'init-greet' && m.seq !== 1 && (m.sender_type === 'visitor' || m.sender_type === 'agent'));
          } catch { return false; }
        }
        return true;
      });
      cappedConvs.sort((a, b) => (a.chatNumber || 1) - (b.chatNumber || 1));
      return cappedConvs;
    } catch {
      return [];
    }
  });
  const [viewingHistory, setViewingHistory] = useState(false);
  const [showChatLimitModal, setShowChatLimitModal] = useState(false);
  const [staffBlockError, setStaffBlockError] = useState<string | null>(null);
  const [showStaffBlockModal, setShowStaffBlockModal] = useState(false);

  // Dynamic bubble text: if a real agent has sent a message, show agent message in the bubble!
  const latestAgentMessage = useMemo(() => {
    const agentMsgs = messages.filter(m => m && m.sender_type === 'agent' && !m.is_whisper && !m.isWhisper);
    if (agentMsgs.length > 0) {
      return agentMsgs[agentMsgs.length - 1]?.content;
    }
    return null;
  }, [messages]);

  const displayBubbleText = latestAgentMessage || siteGreeting;

  const widgetChatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const visitorTextareaRef = useRef<HTMLTextAreaElement>(null);
  const channelRef = useRef<any>(null);
  const isWidgetUserScrolledUp = useRef<boolean>(false);
  const prevMsgCountRef = useRef<number>(1);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // In-flight visitor messages that have been submitted locally but not yet acknowledged by the server.
  // These are strictly preserved and CAN NEVER be erased by background sync polls or history fetches!
  const inFlightVisitorMessagesRef = useRef<Map<string, any>>(new Map());

  // Indestructible session visitor messages: every message the visitor sends during this tab session
  // is permanently preserved so it NEVER disappears or flickers under any circumstances!
  const sessionVisitorMessagesRef = useRef<Map<string, any>>(new Map());

  const safeMergeMessages = useCallback((prevList: any[], incomingList: any[], targetId?: string | null) => {
    const map = new Map<string, any>();
    const effectiveTarget = targetId || activeConvIdRef.current || conversationId;

    // 1. Add incoming server messages (ONLY for effectiveTarget)
    (incomingList || []).forEach(m => {
      if (!m) return;
      if (effectiveTarget && m.conversation_id && m.conversation_id !== effectiveTarget && m.id !== 'init-greet') return;
      const mId = m.id || ('msg_' + Math.random().toString(36).substring(2, 9));
      map.set(mId, { ...m, id: mId, conversation_id: effectiveTarget || m.conversation_id });

      // If server confirmed an in-flight message (by id or content match within 20s), remove from in-flight
      if (inFlightVisitorMessagesRef.current.has(mId)) {
        inFlightVisitorMessagesRef.current.delete(mId);
      }
      if (m.sender_type === 'visitor' && m.content) {
        const mTime = new Date(m.created_at || Date.now()).getTime();
        for (const [infId, infMsg] of inFlightVisitorMessagesRef.current.entries()) {
          const infTime = new Date(infMsg.created_at || Date.now()).getTime();
          if (infMsg.content?.trim() === m.content?.trim() && Math.abs(mTime - infTime) < 20000) {
            inFlightVisitorMessagesRef.current.delete(infId);
          }
        }
      }
    });

    // 2. Non-destructively preserve previous messages for THIS conversation only
    (prevList || []).forEach(m => {
      if (!m || !m.id) return;
      // STRICT ISOLATION: Never preserve messages from a different conversation ID
      if (effectiveTarget && m.conversation_id && m.conversation_id !== effectiveTarget && m.id !== 'init-greet') return;
      if (m.id === 'init-greet') {
        if (!map.has('init-greet')) map.set('init-greet', m);
        return;
      }
      if (!map.has(m.id)) {
        const hasEquivalentInIncoming = (incomingList || []).some((inc: any) =>
          inc && inc.sender_type === m.sender_type &&
          inc.content?.trim() === m.content?.trim() &&
          Math.abs(new Date(inc.created_at || 0).getTime() - new Date(m.created_at || 0).getTime()) < 15000
        );
        if (!hasEquivalentInIncoming) {
          map.set(m.id, {
            ...m,
            conversation_id: effectiveTarget || m.conversation_id
          });
        }
      }
    });

    // 3. Absolute guarantee: ANY message currently in flight for THIS conversation MUST be rendered
    for (const [infId, infMsg] of inFlightVisitorMessagesRef.current.entries()) {
      if (effectiveTarget && infMsg.conversation_id && infMsg.conversation_id !== effectiveTarget) continue;
      const alreadyHas = Array.from(map.values()).some((m: any) =>
        m.id === infId ||
        (m.sender_type === 'visitor' && m.content?.trim() === infMsg.content?.trim() &&
         Math.abs(new Date(m.created_at || 0).getTime() - new Date(infMsg.created_at || 0).getTime()) < 20000)
      );
      if (!alreadyHas) {
        map.set(infId, { ...infMsg, conversation_id: effectiveTarget || infMsg.conversation_id });
      }
    }

    // 4. Absolute guarantee: Visitor messages sent during session for THIS conversation MUST NEVER DISAPPEAR
    for (const [sId, sMsg] of sessionVisitorMessagesRef.current.entries()) {
      if (effectiveTarget && sMsg.conversation_id && sMsg.conversation_id !== effectiveTarget) continue;
      const alreadyHas = Array.from(map.values()).some((m: any) =>
        m.id === sId ||
        (m.sender_type === 'visitor' && m.content?.trim() === sMsg.content?.trim() &&
         Math.abs(new Date(m.created_at || 0).getTime() - new Date(sMsg.created_at || 0).getTime()) < 30000)
      );
      if (!alreadyHas) {
        map.set(sId, { ...sMsg, conversation_id: effectiveTarget || sMsg.conversation_id });
      }
    }

    return dedupeMessages(Array.from(map.values()), siteGreeting, siteAiName);
  }, [conversationId, siteGreeting, siteAiName]);

  const scrollToBottom = (instant = false) => {
    const el = widgetChatContainerRef.current;
    if (!el) return;
    try {
      if (instant) {
        el.scrollTop = el.scrollHeight;
      } else {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
    } catch {
      el.scrollTop = el.scrollHeight;
    }
  };

  const handleWidgetScroll = () => {
    const el = widgetChatContainerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    // If user has scrolled up more than 35px from the bottom, respect their scroll position
    isWidgetUserScrolledUp.current = (scrollHeight - scrollTop - clientHeight) > 35;
  };

  const handleFullWipe = useCallback((newResetAt?: number) => {
    const resetTime = newResetAt || Date.now();
    try {
      const lastReset = String(resetTime);
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('teals_') && k !== 'teals_last_reset_ack') {
          localStorage.removeItem(k);
        }
      });
      Object.keys(sessionStorage).forEach(k => {
        if (k.startsWith('teals_')) {
          sessionStorage.removeItem(k);
        }
      });
      localStorage.setItem('teals_last_reset_ack', lastReset);
      localStorage.setItem('teals_visitor_reset_at', lastReset);
    } catch {}

    // 1. Generate brand new visitor token for a completely fresh session
    const freshToken = 'vis_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    setVisitorToken(freshToken);
    try {
      localStorage.setItem('teals_visitor_token', freshToken);
    } catch {}

    // 2. Generate brand new conversation ID for fresh Chat #1
    const freshConvId = 'conv_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    changeActiveConversation(freshConvId);
    try {
      localStorage.setItem('teals_active_conv_id', freshConvId);
    } catch {}

    // 3. Clear conversation list and cache
    setSavedConversations([]);
    try {
      localStorage.removeItem('teals_visitor_conv_list');
    } catch {}

    // 4. Initialize fresh greeting with current timestamp
    const initGreet: StoreMessage = {
      id: 'init-greet',
      conversation_id: freshConvId,
      sender_type: 'ai',
      sender_name: siteAiName,
      content: siteGreeting,
      seq: 1,
      status: 'read',
      created_at: new Date().toISOString()
    };
    setMessages([initGreet]);
    try {
      localStorage.setItem('teals_conv_cache_' + freshConvId, JSON.stringify([initGreet]));
    } catch {}

    // 5. Reset UI states
    setHasSubmittedLead(true);
    setUserName('');
    setUserEmail('');
    setIsHumanConnected(false);
    setAgentName(null);
    setViewingHistory(false);
    setShowChatLimitModal(false);
  }, [siteAiName, siteGreeting, changeActiveConversation]);

  const handleConversationDeleted = useCallback((deletedCId: string) => {
    if (!deletedCId) return;

    // 1. Clean localStorage for this deleted conversation
    try {
      localStorage.removeItem('teals_conv_cache_' + deletedCId);
      localStorage.removeItem('teals_cached_messages_' + deletedCId);
      localStorage.removeItem('teals_chat_num_' + deletedCId);
    } catch {}

    // 2. Remove from savedConversations list
    setSavedConversations(prev => {
      const remaining = prev.filter(c => c.id !== deletedCId);
      try {
        localStorage.setItem('teals_visitor_conv_list', JSON.stringify(remaining));
      } catch {}
      return remaining;
    });

    // 3. If currently active conversation was the one deleted, switch to fresh clean chat
    const currentActive = activeConvIdRef.current || conversationId;
    if (deletedCId === currentActive) {
      const freshId = 'conv_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      changeActiveConversation(freshId);
      try {
        localStorage.setItem('teals_active_conv_id', freshId);
      } catch {}

      setIsHumanConnected(false);
      setAgentName(null);
      setAgentPseudoName(null);
      setAgentRoleTitle(null);
      setAgentTypingText(null);
      setViewingHistory(false);
      setShowChatLimitModal(false);

      const initGreet: StoreMessage = {
        id: 'init-greet',
        conversation_id: freshId,
        sender_type: 'ai',
        sender_name: siteAiName,
        content: siteGreeting,
        seq: 1,
        status: 'read',
        created_at: new Date().toISOString()
      };
      setMessages([initGreet]);
      try {
        localStorage.setItem('teals_conv_cache_' + freshId, JSON.stringify([initGreet]));
      } catch {}
    }
  }, [conversationId, siteAiName, siteGreeting, changeActiveConversation]);

  const currentChatNumber = useMemo((): 1 | 2 => {
    // 1. Check local storage explicit chat number for this exact conversation
    if (conversationId && typeof window !== 'undefined') {
      const stored = localStorage.getItem('teals_chat_num_' + conversationId);
      if (stored === '2') return 2;
      if (stored === '1') return 1;
    }
    // 2. Check savedConversations entry for this conversation
    const current = savedConversations.find(c => c.id === conversationId);
    if (current && typeof current.chatNumber === 'number') {
      return (current.chatNumber === 2 ? 2 : 1);
    }
    // Default is strictly 1! NEVER guess based on array indices!
    return 1;
  }, [savedConversations, conversationId]);

  const fetchVisitorConversations = async (token: string) => {
    try {
      if (!token) return;
      const res = await fetch(`/api/chat/message?visitorToken=${encodeURIComponent(token)}`);
      if (res.ok) {
        const data = await res.json();
        const serverResetAt = data.serverResetAt || 0;
        const localAckReset = typeof window !== 'undefined' ? parseInt(localStorage.getItem('teals_last_reset_ack') || '0', 10) : 0;

        if (serverResetAt > 0 && serverResetAt > localAckReset) {
          handleFullWipe(serverResetAt);
          return;
        }

        if (serverResetAt > 0) {
          try {
            localStorage.setItem('teals_last_reset_ack', String(serverResetAt));
          } catch {}
        }

        const visitorResetAt = typeof window !== 'undefined' ? parseInt(localStorage.getItem('teals_visitor_reset_at') || '0', 10) : 0;

        // Filter out any conversation created before visitor reset
        const rawServerList: any[] = (data.conversations && Array.isArray(data.conversations))
          ? data.conversations.filter((c: any) => {
              if (!visitorResetAt) return true;
              const cTime = new Date(c.created_at || c.updated_at || 0).getTime();
              return cTime >= visitorResetAt;
            })
          : [];

        // In store.ts, conversations are sorted: Chat #1 first, Chat #2 second
        const mapped: SavedConvSummary[] = rawServerList.map((c: any) => {
          const lastMsg = c.messages?.[c.messages.length - 1]?.content || DEFAULT_GREETING;
          const timeStr = c.updated_at ? new Date(c.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';
          const storedNum = typeof window !== 'undefined' ? localStorage.getItem('teals_chat_num_' + c.id) : null;
          const num: 1 | 2 = storedNum === '2' ? 2 : storedNum === '1' ? 1 : (c.chat_number === 2 ? 2 : 1);
          return {
            id: c.id,
            lastMessage: lastMsg,
            updatedAt: timeStr,
            chatNumber: num
          };
        });

        let combined = [...mapped];

        // RETAIN active local conversation ONLY if it has real messages or is in-flight
        const activeId = activeConvIdRef.current || conversationId;
        if (activeId && !combined.some(c => c.id === activeId)) {
          const storedNum = typeof window !== 'undefined' ? localStorage.getItem('teals_chat_num_' + activeId) : null;
          const localCache = typeof window !== 'undefined' ? localStorage.getItem('teals_conv_cache_' + activeId) : null;
          let lastMsg = siteGreeting;
          let hasRealMsgs = false;
          if (localCache) {
            try {
              const parsed = JSON.parse(localCache);
              const real = parsed.filter((m: any) => m && m.id !== 'init-greet' && m.seq !== 1 && (m.sender_type === 'visitor' || m.sender_type === 'agent'));
              if (real.length > 0) {
                hasRealMsgs = true;
                lastMsg = parsed[parsed.length - 1]?.content || siteGreeting;
              }
            } catch {}
          }
          const isInFlight = inFlightVisitorMessagesRef.current.size > 0 || sessionVisitorMessagesRef.current.size > 0;
          if (isInFlight || hasRealMsgs) {
            const localEntry: SavedConvSummary = {
              id: activeId,
              lastMessage: lastMsg,
              updatedAt: 'Just now',
              chatNumber: storedNum === '2' ? 2 : 1
            };
            combined.push(localEntry);
          }
        }

        // Clean up any ghost Chat #2 that has NO real visitor messages
        combined = combined.filter(c => {
          if (c.chatNumber === 2) {
            const localCache = typeof window !== 'undefined' ? localStorage.getItem('teals_conv_cache_' + c.id) : null;
            if (!localCache) return false;
            try {
              const parsed = JSON.parse(localCache);
              return parsed.some((m: any) => m && m.id !== 'init-greet' && m.seq !== 1 && (m.sender_type === 'visitor' || m.sender_type === 'agent'));
            } catch { return false; }
          }
          return true;
        });

        if (combined.length > 2) {
          combined = combined.slice(0, 2);
        }
        // STRICT DETERMINISTIC ORDER: Chat #1 first, Chat #2 second
        combined.sort((a, b) => (a.chatNumber || 1) - (b.chatNumber || 1));

        setSavedConversations(combined);
        try {
          localStorage.setItem('teals_visitor_conv_list', JSON.stringify(combined));
        } catch {}

        const activeCurrent = activeConvIdRef.current || conversationId;
        const currentValid = activeCurrent && combined.some(c => c.id === activeCurrent);
        if (!currentValid && combined.length > 0) {
          const targetInit = combined.find(c => c.chatNumber === 1) || combined[0];
          changeActiveConversation(targetInit.id);
        }
      }
    } catch {}
  };

  // Load saved lead details and previous conversation IDs on mount
  useEffect(() => {
    try {
      const savedName = localStorage.getItem('teals_lead_name');
      const savedEmail = localStorage.getItem('teals_lead_email');

      const rawConvList = localStorage.getItem('teals_visitor_conv_list');
      const parsedConvs: SavedConvSummary[] = rawConvList ? JSON.parse(rawConvList) : [];
      let cappedConvs = Array.isArray(parsedConvs) ? parsedConvs.slice(0, 2) : [];

      // Discard any empty Chat #2 that has no real visitor messages and purge from storage
      const ghostChat2List = cappedConvs.filter(c => {
        if (c.chatNumber === 2) {
          const cache = localStorage.getItem('teals_conv_cache_' + c.id);
          if (!cache) return true;
          try {
            const msgs = JSON.parse(cache);
            const hasReal = msgs.some((m: any) => m && m.id !== 'init-greet' && m.seq !== 1 && (m.sender_type === 'visitor' || m.sender_type === 'agent'));
            return !hasReal;
          } catch { return true; }
        }
        return false;
      });

      ghostChat2List.forEach(g => {
        try {
          localStorage.removeItem('teals_conv_cache_' + g.id);
          localStorage.removeItem('teals_chat_num_' + g.id);
          if (localStorage.getItem('teals_active_conv_id') === g.id) {
            localStorage.removeItem('teals_active_conv_id');
          }
        } catch {}
      });

      cappedConvs = cappedConvs.filter(c => !ghostChat2List.some(g => g.id === c.id));
      cappedConvs.sort((a, b) => (a.chatNumber || 1) - (b.chatNumber || 1));

      if (cappedConvs.length === 2) {
        cappedConvs[0].chatNumber = 1;
        cappedConvs[1].chatNumber = 2;
      } else if (cappedConvs.length === 1) {
        cappedConvs[0].chatNumber = 1;
      }
      setSavedConversations(cappedConvs);
      try {
        localStorage.setItem('teals_visitor_conv_list', JSON.stringify(cappedConvs));
      } catch {}

      if (savedName) setUserName(savedName);
      if (savedEmail) setUserEmail(savedEmail);

      const isSubmitted = localStorage.getItem('teals_lead_submitted') === 'true';
      const targetId = localStorage.getItem('teals_active_conv_id') || localStorage.getItem('teals_visitor_token');
      let hasCachedMsgs = false;
      if (targetId) {
        try {
          const cached = localStorage.getItem('teals_conv_cache_' + targetId);
          if (cached) {
            const parsed = JSON.parse(cached);
            const real = (parsed || []).filter((m: any) => m && m.id !== 'init-greet' && m.seq !== 1);
            if (real.length > 0) hasCachedMsgs = true;
          }
        } catch {}
      }

      setHasSubmittedLead(true);
      setViewingHistory(false);
    } catch {
      setUserName('');
      setUserEmail('');
      setHasSubmittedLead(true);
      setViewingHistory(false);
    }
  }, []);

  // Auto-save current conversation to the list whenever messages update
  useEffect(() => {
    if (!conversationId || messages.length <= 1) return;
    const targetId = activeConvIdRef.current || conversationId;

    // Strict guard: Do not save if foreign messages from another conversation are in state
    const hasForeignMsg = messages.some(m => m && m.id !== 'init-greet' && m.conversation_id && m.conversation_id !== targetId);
    if (hasForeignMsg) return;

    const lastMsg = messages[messages.length - 1]?.content || 'Conversation';
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    try {
      localStorage.setItem('teals_conv_cache_' + targetId, JSON.stringify(messages));
    } catch {}

    setSavedConversations(prev => {
      const exists = prev.some(c => c.id === targetId);
      let updated: SavedConvSummary[];
      if (exists) {
        // Update in-place to preserve stable order and chat numbers!
        updated = prev.map(c => c.id === targetId ? { ...c, lastMessage: lastMsg, updatedAt: timeStr } : c);
      } else {
        const storedNum = typeof window !== 'undefined' ? localStorage.getItem('teals_chat_num_' + targetId) : null;
        const num: 1 | 2 = storedNum === '2' ? 2 : 1;
        const newEntry: SavedConvSummary = { id: targetId, lastMessage: lastMsg, updatedAt: timeStr, chatNumber: num };
        updated = num === 2 ? [newEntry, ...prev] : [...prev, newEntry];
      }
      try { 
        localStorage.setItem('teals_visitor_conv_list', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, [conversationId, messages]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.parent) {
      window.parent.postMessage({ type: 'TEALS_WIDGET_RESIZE', isOpen }, '*');
    }
  }, [isOpen]);

  // Expand iframe when greeting bubble is shown so it's not clipped
  useEffect(() => {
    if (typeof window !== 'undefined' && window.parent) {
      window.parent.postMessage({
        type: 'TEALS_WIDGET_RESIZE',
        isOpen: showGreetingBubble && !isOpen ? 'bubble' : isOpen
      }, '*');
    }
  }, [showGreetingBubble, isOpen]);

  // Initialize Visitor Token & Restore Active Conversation
  useEffect(() => {
    let token = visitorTokenProp;
    if (!token) {
      try {
        token = localStorage.getItem('teals_visitor_token') || ('vis_' + Math.random().toString(36).substring(2, 10));
        localStorage.setItem('teals_visitor_token', token);
      } catch {
        token = 'vis_' + Math.random().toString(36).substring(2, 10);
      }
    }
    setVisitorToken(token);

    // Check if there is an existing active conversation saved in localStorage
    // STRICT RULE: On initial mount, ALWAYS activate Chat #1! Never default to Chat #2!
    let targetConvId: string | null = null;
    try {
      const rawConvList = localStorage.getItem('teals_visitor_conv_list');
      if (rawConvList) {
        const parsed: SavedConvSummary[] = JSON.parse(rawConvList);
        const chat1 = parsed.find(c => c.chatNumber === 1);
        if (chat1 && chat1.id && !chat1.id.startsWith('vis_')) {
          targetConvId = chat1.id;
        }
      }
      if (!targetConvId) {
        const activeId = localStorage.getItem('teals_active_conv_id');
        const activeNum = activeId ? localStorage.getItem('teals_chat_num_' + activeId) : null;
        if (activeId && !activeId.startsWith('vis_') && activeNum !== '2') {
          targetConvId = activeId;
        }
      }
    } catch {}

    if (!targetConvId) {
      targetConvId = 'conv_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      try {
        localStorage.setItem('teals_chat_num_' + targetConvId, '1');
        localStorage.setItem('teals_active_conv_id', targetConvId);
      } catch {}
    } else {
      try {
        localStorage.setItem('teals_chat_num_' + targetConvId, '1');
        localStorage.setItem('teals_active_conv_id', targetConvId);
      } catch {}
    }
    changeActiveConversation(targetConvId);

    // 0ms INSTANT LOCAL CACHE RESTORE (Zero network delay on refresh)
    try {
      const cached = localStorage.getItem('teals_conv_cache_' + targetConvId);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(dedupeMessages(parsed));
        }
      }
    } catch {}

    // Track visitor session (fire and forget) - ONLY if not already tracked by host page's widget.js
    if (!isEmbeddedProp) {
      fetch('/api/visitor/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdProp || token,
          visitorToken: token,
          propertySlug,
          currentPage: pageUrl || (typeof window !== 'undefined' ? (window.location.pathname + window.location.search) : '/'),
          referrer: referrerUrl || (typeof document !== 'undefined' && document.referrer ? document.referrer : 'Direct'),
          isNewPageView: true,
          isFirstVisit: true,
          visitorName: userName || undefined,
          visitorEmail: userEmail || undefined
        })
      }).catch(() => {});
    }

    // Restore full conversation history from server or local cache
    const restoreChatHistory = async () => {
      try {
        let loadedConv: any = null;
        let serverData: any = null;

        // 1. Check target conversation ID
        const res = await fetch(`/api/chat/message?conversationId=${encodeURIComponent(targetConvId)}&_t=${Date.now()}`, {
          cache: 'no-store'
        });
        if (res.ok) {
          const data = await res.json();
          serverData = data;
          const serverResetAt = data.serverResetAt || 0;
          const localAckReset = typeof window !== 'undefined' ? parseInt(localStorage.getItem('teals_last_reset_ack') || '0', 10) : 0;

          if (serverResetAt > 0 && serverResetAt > localAckReset) {
            handleFullWipe(serverResetAt);
            return;
          }

          if (serverResetAt > 0) {
            try { localStorage.setItem('teals_last_reset_ack', String(serverResetAt)); } catch {}
          }

          if (data.conversation?.messages?.length || data.messages?.length) {
            loadedConv = data.conversation || { messages: data.messages };
          }
        }

        // 2. If not found and sessionIdProp is distinct, check sessionId
        if (!loadedConv?.messages?.length && sessionIdProp && sessionIdProp !== targetConvId) {
          const sessRes = await fetch(`/api/chat/message?conversationId=${encodeURIComponent(sessionIdProp)}&_t=${Date.now()}`, {
            cache: 'no-store'
          });
          if (sessRes.ok) {
            const sessData = await sessRes.json();
            if (sessData.conversation?.messages?.length || sessData.messages?.length) {
              loadedConv = sessData.conversation || { messages: sessData.messages };
              setConversationId(sessionIdProp);
              try { localStorage.setItem('teals_active_conv_id', sessionIdProp); } catch {}
            }
          }
        }

        if (loadedConv) {
          const serverMsgs: any[] = loadedConv.messages || [];
          const realMsgs = serverMsgs.filter(m => m && m.id !== 'init-greet' && m.seq !== 1);
          if (realMsgs.length > 0) {
            const hasAgentMsg = realMsgs.some(m => m.sender_type === 'agent');
            const isHuman = loadedConv.mode === 'human' || hasAgentMsg || Boolean(loadedConv.assigned_agent_name);
            if (hasAgentMsg || isHuman) {
              setIsHumanConnected(true);
              if (loadedConv.assigned_agent_name) setAgentName(loadedConv.assigned_agent_name);
              if (loadedConv.assigned_agent_pseudo_name) setAgentPseudoName(loadedConv.assigned_agent_pseudo_name);
              if (loadedConv.assigned_agent_role_title) setAgentRoleTitle(loadedConv.assigned_agent_role_title);
            }
            setMessages(prev => {
              const merged = safeMergeMessages(prev, serverMsgs, loadedConv.id || targetConvId);
              try {
                localStorage.setItem('teals_conv_cache_' + (loadedConv.id || targetConvId), JSON.stringify(merged));
              } catch {}
              return merged;
            });
          } else {
            const initGreet = {
              id: 'init-greet',
              sender_type: 'ai' as const,
              sender_name: siteAiName,
              content: siteGreeting,
              seq: 1,
              status: 'read' as const,
              created_at: new Date().toISOString()
            };
            setMessages(prev => {
              if (inFlightVisitorMessagesRef.current.size > 0 || prev.some(m => m && m.id !== 'init-greet' && m.sender_type === 'visitor')) {
                return prev;
              }
              return [initGreet];
            });
          }
        } else {
          // Check local cache for targetConvId
          let cachedMsgs: any[] = [];
          try {
            const cached = localStorage.getItem('teals_conv_cache_' + targetConvId);
            if (cached) {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length > 0) {
                cachedMsgs = parsed;
              }
            }
          } catch {}

          // If server confirmed conversation was deleted by agent:
          if (serverData?.isDeleted) {
            handleConversationDeleted(targetConvId);
            return;
          }

          if (cachedMsgs.length > 0) {
            setMessages(prev => safeMergeMessages(prev, cachedMsgs, targetConvId));
          } else {
            const initGreet = {
              id: 'init-greet',
              conversation_id: targetConvId,
              sender_type: 'ai' as const,
              sender_name: siteAiName,
              content: siteGreeting,
              seq: 1,
              status: 'read' as const,
              created_at: new Date().toISOString()
            };
            setMessages(prev => {
              if (inFlightVisitorMessagesRef.current.size > 0 || prev.some(m => m && m.id !== 'init-greet' && m.sender_type === 'visitor')) {
                return prev;
              }
              return [initGreet];
            });
          }
        }
      } catch {}

      // Fetch all conversations for this visitor so YOUR CONVERSATIONS is always up to date
      fetchVisitorConversations(token);
    };

    restoreChatHistory();
  }, [visitorTokenProp, sessionIdProp, propertySlug, pageUrl, referrerUrl]);

  // Clean up waiting loop and send instant offline beacon ONLY when visitor closes tab
  useEffect(() => {
    const handleOffline = () => {
      const sid = sessionIdProp || visitorToken;
      if (!sid) return;
      const url = `/api/visitor/offline?sessionId=${encodeURIComponent(sid)}&_t=${Date.now()}`;
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(url, 'offline');
        } else {
          fetch(url, { method: 'POST', keepalive: true, mode: 'no-cors' }).catch(() => {});
        }
      } catch {}
    };

    window.addEventListener('beforeunload', handleOffline);
    return () => {
      window.removeEventListener('beforeunload', handleOffline);
    };
  }, [sessionIdProp, visitorToken]);

  // Track visitor arrival immediately when WidgetChat loads (guarantees arrival chime even on direct /widget view)
  useEffect(() => {
    const sid = sessionIdProp || visitorToken;
    if (!sid) return;

    // 1. Initial Arrival Track (strictly standalone only, guarded with sessionStorage)
    if (!isEmbeddedProp) {
      const trackKey = `teals_widget_init_tracked_${sid}`;
      let alreadyTracked = false;
      try { alreadyTracked = Boolean(sessionStorage.getItem(trackKey)); } catch {}
      if (!alreadyTracked) {
        try { sessionStorage.setItem(trackKey, '1'); } catch {}
        fetch('/api/visitor/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sid,
            visitorToken,
            propertySlug: propertySlug || 'amz-solutions-hub',
            currentPage: pageUrl || (typeof window !== 'undefined' ? window.location.pathname : '/'),
            referrer: referrerUrl || 'Direct',
            isNewPageView: true,
            isFirstVisit: true
          })
        }).catch(() => {});
      }
    }

    // 2. Keep visitor session online with 5s heartbeat ping
    const pingInterval = setInterval(() => {
      fetch('/api/visitor/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sid,
          visitorToken,
          currentPage: pageUrl || (typeof window !== 'undefined' ? window.location.pathname : '/'),
          propertySlug: propertySlug || 'amz-solutions-hub'
        })
      }).catch(() => {});
    }, 5000);

    return () => clearInterval(pingInterval);
  }, [sessionIdProp, visitorToken, pageUrl, referrerUrl, propertySlug]);

  // Auto-expire agent typing after 3.5s so it never gets stuck
  useEffect(() => {
    if (agentTypingText) {
      const t = setTimeout(() => {
        setAgentTypingText(null);
      }, 3500);
      return () => clearTimeout(t);
    }
  }, [agentTypingText]);

  // Continuous 2s background sync so proactive agent messages appear immediately on the visitor's floating bubble without page refresh!
  useEffect(() => {
    // STRICT: only sync by conversationId to prevent cross-chat message bleed
    const targetId = conversationId;
    if (!targetId) return;

    let isCancelled = false;

    const syncMessages = async () => {
      if (isCancelled || activeConvIdRef.current !== targetId) return;
      try {
        // Use ONLY conversationId - never pass visitorToken here to avoid getting ALL visitor chats merged
        const res = await fetch(`/api/chat/message?conversationId=${encodeURIComponent(targetId)}&_t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok && !isCancelled && activeConvIdRef.current === targetId) {
          const data = await res.json();
          if (isCancelled || activeConvIdRef.current !== targetId) return;

          // If conversation is deleted by agent on server, immediately wipe and reset
          if (data.isDeleted) {
            handleConversationDeleted(targetId);
            return;
          }

          let serverMsgs: any[] = [];
          let serverConv: any = null;

          // STRICT: only accept messages from the exact conversationId we requested
          if (data.conversation?.id === targetId && data.conversation?.messages && Array.isArray(data.conversation.messages)) {
            serverMsgs = data.conversation.messages;
            serverConv = data.conversation;
          } else if (!data.conversation && Array.isArray(data.messages)) {
            serverMsgs = data.messages;
          }
          // If server returns conversations[] (multi-conv response), ignore it - wrong endpoint

          if (serverMsgs.length > 0) {
            const hasAgentMsg = serverMsgs.some(m => m && m.sender_type === 'agent' && !m.is_whisper && !m.isWhisper);
            if (hasAgentMsg) {
              setIsHumanConnected(true);
              setShowGreetingBubble(true);
              if (serverConv?.assigned_agent_name) setAgentName(serverConv.assigned_agent_name);
              if (serverConv?.assigned_agent_pseudo_name) setAgentPseudoName(serverConv.assigned_agent_pseudo_name);
              if (serverConv?.assigned_agent_role_title) setAgentRoleTitle(serverConv.assigned_agent_role_title);
            }

            setMessages(prev => {
              if (isCancelled || activeConvIdRef.current !== targetId) return prev;
              const merged = safeMergeMessages(prev, serverMsgs, targetId);
              if (
                prev.length === merged.length &&
                prev[prev.length - 1]?.id === merged[merged.length - 1]?.id &&
                prev[prev.length - 1]?.content === merged[merged.length - 1]?.content &&
                prev[prev.length - 1]?.status === merged[merged.length - 1]?.status
              ) {
                return prev;
              }
              try {
                localStorage.setItem('teals_conv_cache_' + targetId, JSON.stringify(merged));
              } catch {}
              return merged;
            });
          }
        }
      } catch {}
    };

    const interval = setInterval(syncMessages, 2000);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [conversationId]);

  // Real-Time WebSockets for Messages & Agent Typing
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase.channel(REALTIME_CHANNEL, {
      config: { broadcast: { self: true } }
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'chat_message' }, (payload: unknown) => {
        const raw = (payload as Record<string, unknown>)?.payload || payload;
        const cId = (raw as Record<string, unknown>)?.conversationId as string | undefined;
        const message = (raw as Record<string, unknown>)?.message as { id: string; sender_type: string; sender_name: string; content: string; is_whisper?: boolean; isWhisper?: boolean; seq?: number; created_at?: string };
        const systemMessage = (raw as Record<string, unknown>)?.systemMessage as { id: string; sender_type: string; sender_name: string; content: string; is_whisper?: boolean; isWhisper?: boolean; seq?: number; created_at?: string };
        const conv = (raw as Record<string, unknown>)?.conversation as { id?: string; visitor_id?: string; mode?: string; assigned_agent_name?: string };

        const isWhisperMsg = !!(message?.is_whisper || message?.isWhisper);

        // Update last message in conversation list (only non-whisper messages)
        if (cId && message?.content && !isWhisperMsg) {
          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setSavedConversations(prev => {
            return prev.map(c => c.id === cId ? { ...c, lastMessage: message.content, updatedAt: timeStr } : c);
          });
        }

        // STRICT: ONLY accept message into current chat window if it belongs to THIS exact active conversationId
        const activeTarget = activeConvIdRef.current || conversationId;

        if (cId && cId === activeTarget) {
          // If whisper, ignore on visitor widget!
          if (isWhisperMsg) return;

          // Immediately dismiss agent typing bubble when a message arrives from agent
          if (message?.sender_type === 'agent') {
            stopWaitingForHumanBeep(cId);
            setAgentTypingText(null);
            setLoading(false);
            setIsHumanConnected(true);
            setShowGreetingBubble(true);
            if (message?.sender_name) setAgentName(message.sender_name);
            if ((message as any)?.sender_pseudo_name) setAgentPseudoName((message as any).sender_pseudo_name);
            if ((message as any)?.sender_role_title) setAgentRoleTitle((message as any).sender_role_title);
          } else if (message?.sender_type === 'ai') {
            setAgentTypingText(null);
            setLoading(false);
          }

          setMessages((prev) => {
            const incoming: any[] = [];
            if (message) incoming.push({ ...message, conversation_id: cId });
            if (systemMessage && !systemMessage.is_whisper && !systemMessage.isWhisper) {
              incoming.push({ ...systemMessage, conversation_id: cId });
            }
            const deduped = safeMergeMessages(prev, incoming, cId);
            try {
              localStorage.setItem('teals_conv_cache_' + cId, JSON.stringify(deduped));
            } catch {}
            return deduped;
          });
          if (conv && (conv.mode === 'human' || conv.assigned_agent_name)) {
            setIsHumanConnected(true);
            if (conv.assigned_agent_name) setAgentName(conv.assigned_agent_name);
            if ((conv as any).assigned_agent_pseudo_name) setAgentPseudoName((conv as any).assigned_agent_pseudo_name);
            if ((conv as any).assigned_agent_role_title) setAgentRoleTitle((conv as any).assigned_agent_role_title);
          }
        } else if (cId && cId !== activeTarget) {
          // Message belongs to other conversation: DO NOT switch screen!
          // Silently update background chat cache so it's fresh when clicked
          if (!isWhisperMsg && (message || systemMessage)) {
            try {
              const oldCache = localStorage.getItem('teals_conv_cache_' + cId);
              let oldList: any[] = [];
              if (oldCache) {
                try { oldList = JSON.parse(oldCache); } catch {}
              }
              const incoming: any[] = [];
              if (message) incoming.push({ ...message, conversation_id: cId });
              if (systemMessage && !systemMessage.is_whisper && !systemMessage.isWhisper) {
                incoming.push({ ...systemMessage, conversation_id: cId });
              }
              const mergedBg = dedupeMessages([...oldList, ...incoming], siteGreeting, siteAiName);
              localStorage.setItem('teals_conv_cache_' + cId, JSON.stringify(mergedBg));
            } catch {}
          }
        }
      })
      .on('broadcast', { event: 'typing_event' }, (payload: unknown) => {
        const raw = (payload as Record<string, unknown>)?.payload || payload;
        const cId = (raw as Record<string, unknown>)?.conversationId as string | undefined;
        const typingText = (raw as Record<string, unknown>)?.typingText as string;
        const isTyping = (raw as Record<string, unknown>)?.isTyping as boolean;
        const senderType = (raw as Record<string, unknown>)?.senderType as string;
        const sName = (raw as Record<string, unknown>)?.senderName as string;

        const matches = !cId || cId === conversationId || cId === visitorToken;
        if (matches && senderType === 'agent') {
          if (isTyping) {
            setAgentTypingText(typingText || 'typing');
            if (sName) setAgentName(sName);
          } else {
            setAgentTypingText(null);
          }
        }
      })
      .on('broadcast', { event: 'chat_claimed' }, (payload: unknown) => {
        const raw = (payload as Record<string, unknown>)?.payload || payload;
        const cId = (raw as Record<string, unknown>)?.conversationId as string | undefined;
        const agentName = (raw as Record<string, unknown>)?.agentName as string;
        const conv = (raw as Record<string, unknown>)?.conversation as { messages?: Array<{ id: string; sender_type: string; sender_name?: string; content: string; seq?: number; created_at?: string }> };

        const matches = !cId || cId === conversationId;
        if (matches) {
          // Stop repeating waiting beep immediately once agent claims chat
          stopWaitingForHumanBeep(cId || conversationId);
          setIsHumanConnected(true);
          if (agentName) setAgentName(agentName);
          if ((raw as any)?.agentPseudoName || (raw as any)?.conversation?.assigned_agent_pseudo_name) {
            setAgentPseudoName((raw as any).agentPseudoName || (raw as any).conversation?.assigned_agent_pseudo_name);
          }
          if ((raw as any)?.agentRoleTitle || (raw as any)?.conversation?.assigned_agent_role_title) {
            setAgentRoleTitle((raw as any).agentRoleTitle || (raw as any).conversation?.assigned_agent_role_title);
          }
          setLoading(false);
          setAgentTypingText(null);

          if (conv?.messages && Array.isArray(conv.messages)) {
            setMessages(prev => safeMergeMessages(prev, conv.messages!, cId || conversationId));
          }
        }
      })
      .on('broadcast', { event: 'chat_read' }, (payload: unknown) => {
        const raw = (payload as Record<string, unknown>)?.payload || payload;
        const cId = (raw as Record<string, unknown>)?.conversationId as string | undefined;
        const readerType = (raw as Record<string, unknown>)?.readerType as string;

        const matches = !cId || cId === conversationId;
        if (matches && (readerType === 'agent' || readerType === 'admin')) {
          setMessages(prev => prev.map(m => m.sender_type === 'visitor' ? { ...m, status: 'read' as const } : m));
        }
      })
      .on('broadcast', { event: 'chat_deleted' }, (payload: unknown) => {
        const raw = (payload as Record<string, unknown>)?.payload || payload;
        const cId = (raw as Record<string, unknown>)?.conversationId as string | undefined;
        if (!cId) return;

        handleConversationDeleted(cId);
      })
      .on('broadcast', { event: 'stats_reset' }, (payload: any) => {
        const resetAt = payload?.payload?.resetAt || payload?.resetAt || Date.now();
        handleFullWipe(resetAt);
      })
      .on('broadcast', { event: 'system_reset' }, (payload: any) => {
        const resetAt = payload?.payload?.resetAt || payload?.resetAt || Date.now();
        handleFullWipe(resetAt);
      })
      .subscribe();

    const fetchFullHistory = async () => {
      const targetId = conversationId;
      if (!targetId) return;
      try {
        const res = await fetch(`/api/chat/message?conversationId=${encodeURIComponent(targetId)}&_t=${Date.now()}`, {
          cache: 'no-store'
        });
        if (res.ok) {
          if (activeConvIdRef.current !== targetId) return;
          const data = await res.json();
          if (activeConvIdRef.current !== targetId) return;
          const serverResetAt = data.serverResetAt || 0;
          const localAckReset = typeof window !== 'undefined' ? parseInt(localStorage.getItem('teals_last_reset_ack') || '0', 10) : 0;

          if (serverResetAt > 0 && serverResetAt > localAckReset) {
            handleFullWipe(serverResetAt);
            return;
          }

          if (serverResetAt > 0) {
            try {
              localStorage.setItem('teals_last_reset_ack', String(serverResetAt));
            } catch {}
          }

          // If conversation was deleted by agent on server, immediately wipe and reset
          if (data.isDeleted) {
            handleConversationDeleted(targetId);
            return;
          }

          // STRICT: only accept messages that belong to THIS conversation
          if (!data.conversation && (!data.messages || data.messages.length === 0)) {
            return;
          }

          // Guard: if server returns a conversation with a different ID, reject it
          if (data.conversation && data.conversation.id && data.conversation.id !== targetId) {
            return;
          }

          const serverMsgs: any[] = data.conversation?.messages || data.messages || [];
          if (serverMsgs.length > 0) {
            setMessages(prev => {
              if (activeConvIdRef.current !== targetId) return prev;
              const deduped = safeMergeMessages(prev, serverMsgs, targetId);
              try {
                localStorage.setItem('teals_conv_cache_' + targetId, JSON.stringify(deduped));
              } catch {}
              return deduped;
            });
          }
          if (data.conversation) {
            if (data.conversation.mode === 'human' && (data.conversation.assigned_agent_name || data.conversation.assigned_agent_pseudo_name)) {
              setIsHumanConnected(true);
              if (data.conversation.assigned_agent_name) setAgentName(data.conversation.assigned_agent_name);
              if (data.conversation.assigned_agent_pseudo_name) setAgentPseudoName(data.conversation.assigned_agent_pseudo_name);
              if (data.conversation.assigned_agent_role_title) setAgentRoleTitle(data.conversation.assigned_agent_role_title);
            }
          }
        }
      } catch {}
    };

    fetchFullHistory();

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // When conversation opens or changes: scroll to bottom once
  useEffect(() => {
    isWidgetUserScrolledUp.current = false;
    prevMsgCountRef.current = messages.length;
    const t = setTimeout(() => {
      scrollToBottom(true);
    }, 40);
    return () => clearTimeout(t);
  }, [conversationId, isOpen]);

  // When messages update: ONLY scroll down if new message arrived AND user is NOT scrolled up reading past messages
  useEffect(() => {
    const hasNewMessage = messages.length > prevMsgCountRef.current;
    prevMsgCountRef.current = messages.length;

    if (hasNewMessage && !isWidgetUserScrolledUp.current) {
      scrollToBottom(false);
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && conversationId && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'chat_read',
        payload: {
          conversationId,
          readerType: 'visitor',
          readAt: new Date().toISOString()
        }
      });
    }
  }, [isOpen, conversationId]);

  const handleInputChange = (val: string, el?: HTMLTextAreaElement | null) => {
    setInputText(val);

    const textarea = el || visitorTextareaRef.current;
    if (textarea) {
      textarea.style.height = '0px';
      const scrollH = textarea.scrollHeight;
      textarea.style.height = `${Math.min(Math.max(scrollH, 38), 130)}px`;
    }

    if (!conversationId) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Instant direct WebSocket broadcast (sub-5ms)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'typing_event',
      payload: {
        conversationId,
        typingText: val,
        isTyping: val.trim().length > 0,
        senderType: 'visitor',
        senderName: userName || 'Visitor'
      }
    });

    typingTimeoutRef.current = setTimeout(() => {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'typing_event',
        payload: {
          conversationId,
          typingText: '',
          isTyping: false,
          senderType: 'visitor'
        }
      });
    }, 2000);
  };

  const handleLeadSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const cleanName = (formData.get('name') as string || userName || '').trim();
    const cleanEmail = (formData.get('email') as string || userEmail || '').trim();
    const cleanPhone = (formData.get('phone') as string || userPhone || '').trim();
    if (!cleanName || !cleanEmail || !cleanPhone) return;

    // Strict Client vs Staff check: Agents & Admins cannot initiate chats as clients
    if (isStaffCredentials(cleanEmail, cleanName)) {
      setStaffBlockError('Agents & Admins cannot initiate chats as clients. Please sign in via the CRM console or use a client email.');
      setShowStaffBlockModal(true);
      return;
    }

    setUserName(cleanName);
    setUserEmail(cleanEmail);
    if (cleanPhone) setUserPhone(cleanPhone);

    try {
      localStorage.setItem('teals_lead_name', cleanName);
      localStorage.setItem('teals_lead_email', cleanEmail);
      if (cleanPhone) localStorage.setItem('teals_lead_phone', cleanPhone);
      localStorage.setItem('teals_lead_submitted', 'true');
      localStorage.setItem('teals_last_reset_ack', String(Date.now()));
    } catch {}

    const effectiveToken = visitorToken || visitorTokenProp || (typeof window !== 'undefined' ? localStorage.getItem('teals_visitor_token') || '' : '') || ('vis_' + Math.random().toString(36).substring(2, 10));
    const targetConvId = (conversationId && !conversationId.startsWith('vis_')) 
      ? conversationId 
      : ('conv_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36));
    changeActiveConversation(targetConvId);
    try {
      localStorage.setItem('teals_active_conv_id', targetConvId);
    } catch {}

    const initialConv = {
      id: targetConvId,
      lastMessage: messages.length > 1 ? (messages[messages.length - 1]?.content || DEFAULT_GREETING) : DEFAULT_GREETING,
      updatedAt: 'Just now',
      chatNumber: 1
    };

    setSavedConversations(prev => {
      const existing = prev.find(c => c.id === targetConvId);
      if (existing) return prev;
      return [initialConv];
    });

    setHasSubmittedLead(true);
    setViewingHistory(false);

    fetchVisitorConversations(effectiveToken);

    try {
      const trackRes = await fetch('/api/visitor/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdProp || visitorToken || targetConvId,
          visitorToken: visitorToken || sessionIdProp || targetConvId,
          propertySlug,
          currentPage: pageUrl || '/',
          referrer: referrerUrl || 'Direct',
          visitorName: cleanName,
          visitorEmail: cleanEmail,
          visitorPhone: cleanPhone || undefined
        })
      });
      if (trackRes.status === 403) {
        const errData = await trackRes.json();
        if (errData.isStaffBlocked) {
          setStaffBlockError(errData.error || 'Agents & Admins cannot initiate chats as clients. Please sign in via the CRM console or use a client email.');
          setShowStaffBlockModal(true);
          return;
        }
      }
    } catch {}
  };

  // Open conversations history and fetch latest server records
  const handleOpenConversations = () => {
    if (conversationId && messages.length > 1) {
      const lastMsg = messages[messages.length - 1]?.content || siteGreeting;
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSavedConversations(prev => prev.map(c => c.id === conversationId ? { ...c, lastMessage: lastMsg, updatedAt: timeStr } : c));
      try {
        localStorage.setItem('teals_conv_cache_' + conversationId, JSON.stringify(messages));
      } catch {}
    }
    setViewingHistory(true);
    const token = visitorToken || (typeof window !== 'undefined' ? localStorage.getItem('teals_visitor_token') || '' : '');
    fetchVisitorConversations(token);
  };

  // Switch to a previous conversation
  const handleSelectOldChat = async (convId: string) => {
    if (!convId) return;

    // If currently on a conversation with real messages, save its cache; if leaving an empty Chat #2, prune it!
    const currentId = activeConvIdRef.current || conversationId;
    if (currentId && currentId !== convId) {
      const currentStoredNum = typeof window !== 'undefined' ? localStorage.getItem('teals_chat_num_' + currentId) : null;
      const currentCache = typeof window !== 'undefined' ? localStorage.getItem('teals_conv_cache_' + currentId) : null;
      let hasReal = false;
      if (currentCache) {
        try {
          const parsed = JSON.parse(currentCache);
          hasReal = parsed.some((m: any) => m && m.id !== 'init-greet' && m.seq !== 1 && (m.sender_type === 'visitor' || m.sender_type === 'agent'));
        } catch {}
      }

      if (currentStoredNum === '2' && !hasReal) {
        try {
          localStorage.removeItem('teals_conv_cache_' + currentId);
          localStorage.removeItem('teals_chat_num_' + currentId);
        } catch {}
        setSavedConversations(prev => {
          const filtered = prev.filter(c => c.id !== currentId);
          try { localStorage.setItem('teals_visitor_conv_list', JSON.stringify(filtered)); } catch {}
          return filtered;
        });
      } else if (messages.length > 0) {
        try {
          const filteredCurrentMsgs = messages.filter(m => !m.conversation_id || m.conversation_id === currentId || m.id === 'init-greet');
          localStorage.setItem('teals_conv_cache_' + currentId, JSON.stringify(filteredCurrentMsgs));
        } catch {}
      }
    }

    // Synchronously update ref FIRST so any pending async calls for previous chat are dropped
    changeActiveConversation(convId);

    const initGreet = {
      id: 'init-greet',
      conversation_id: convId,
      sender_type: 'ai' as const,
      sender_name: siteAiName,
      content: siteGreeting,
      seq: 1,
      status: 'read' as const,
      created_at: new Date().toISOString()
    };

    let targetMsgs: any[] = [initGreet];
    try {
      const localCached = localStorage.getItem('teals_conv_cache_' + convId);
      if (localCached) {
        const parsed = JSON.parse(localCached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleanParsed = parsed.filter((m: any) => !m.conversation_id || m.conversation_id === convId || m.id === 'init-greet');
          if (cleanParsed.length > 0) {
            targetMsgs = dedupeMessages(cleanParsed, siteGreeting, siteAiName);
          }
        }
      }
    } catch {}

    const normalizedTargetMsgs = targetMsgs.map(m => ({ ...m, conversation_id: convId }));
    setMessages(normalizedTargetMsgs.length > 0 ? normalizedTargetMsgs : [initGreet]);
    setViewingHistory(false);
    setIsHumanConnected(false);
    setAgentName(null);

    try {
      const res = await fetch(`/api/chat/message?conversationId=${encodeURIComponent(convId)}&_t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (res.ok) {
        if (activeConvIdRef.current !== convId) return;
        const data = await res.json();
        if (activeConvIdRef.current !== convId) return;

        const serverMsgs: any[] = data.conversation?.messages || data.messages || [];
        if (serverMsgs.length > 0) {
          const filteredServer = serverMsgs.filter((m: any) => !m.conversation_id || m.conversation_id === convId || m.id === 'init-greet');
          const normalizedServer = filteredServer.map((m: any) => ({ ...m, conversation_id: convId }));
          const deduped = dedupeMessages(normalizedServer, siteGreeting, siteAiName);
          setMessages(deduped);
          try {
            localStorage.setItem('teals_conv_cache_' + convId, JSON.stringify(deduped));
          } catch {}
        }
        if (data.conversation?.mode === 'human' && (data.conversation.assigned_agent_name || data.conversation.assigned_agent_pseudo_name)) {
          setIsHumanConnected(true);
          if (data.conversation.assigned_agent_name) setAgentName(data.conversation.assigned_agent_name);
          if (data.conversation.assigned_agent_pseudo_name) setAgentPseudoName(data.conversation.assigned_agent_pseudo_name);
          if (data.conversation.assigned_agent_role_title) setAgentRoleTitle(data.conversation.assigned_agent_role_title);
        }
      }
    } catch {}
  };

  // Reset current visitor chat and start fresh (wipe local storage & show lead form)
  const handleResetVisitorChat = () => {
    if (!window.confirm('Are you sure you want to reset and start a fresh chat?')) return;
    handleFullWipe();
  };

  // Start a brand new conversation and preserve old ones (Max 2 chats limit)
  const handleStartNewChat = async () => {
    const currentOldId = activeConvIdRef.current || conversationId;

    // 1. Snapshot current conversation to history list & cache
    let currentList = [...savedConversations];
    if (currentOldId) {
      const lastMsg = messages.length > 1 ? (messages[messages.length - 1]?.content || 'Chat Session') : siteGreeting;
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const currentEntry: SavedConvSummary = { id: currentOldId, lastMessage: lastMsg, updatedAt: timeStr, chatNumber: 1 };
      currentList = [currentEntry, ...currentList.filter(c => c.id !== currentOldId)];
      const filteredCurrent = messages.filter(m => !m.conversation_id || m.conversation_id === currentOldId || m.id === 'init-greet');
      try {
        localStorage.setItem('teals_conv_cache_' + currentOldId, JSON.stringify(filteredCurrent.length > 0 ? filteredCurrent : messages));
        localStorage.setItem('teals_chat_num_' + currentOldId, '1');
      } catch {}
    }

    // Check if Chat #2 already exists
    const existingChat2 = currentList.find(c => c.chatNumber === 2);
    if (existingChat2 && existingChat2.id !== currentOldId) {
      handleSelectOldChat(existingChat2.id);
      return;
    }

    if (savedConversations.length >= 2) {
      setShowChatLimitModal(true);
      return;
    }

    // 2. Generate new unique conversation ID for Chat #2
    const newConvId = 'conv_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    try {
      localStorage.setItem('teals_chat_num_' + newConvId, '2');
      if (currentOldId) localStorage.setItem('teals_chat_num_' + currentOldId, '1');
    } catch {}
    
    // Synchronously set ref FIRST to prevent any pending async responses from bleeding into new chat
    changeActiveConversation(newConvId);

    const initGreet: StoreMessage = {
      id: 'init-greet',
      conversation_id: newConvId,
      sender_type: 'ai',
      sender_name: siteAiName,
      content: siteGreeting,
      seq: 1,
      status: 'read',
      created_at: new Date().toISOString()
    };
    setMessages([initGreet]);
    try {
      localStorage.setItem('teals_conv_cache_' + newConvId, JSON.stringify([initGreet]));
    } catch {}

    const newConvSummary: SavedConvSummary = {
      id: newConvId,
      lastMessage: siteGreeting,
      updatedAt: 'Just now',
      chatNumber: 2
    };

    const oldConvs = currentList.map(c => ({ ...c, chatNumber: 1 }));
    const finalList = [newConvSummary, ...oldConvs.filter(c => c.id !== newConvId)].slice(0, 2);
    setSavedConversations(finalList);
    try {
      localStorage.setItem('teals_visitor_conv_list', JSON.stringify(finalList));
    } catch {}

    setIsHumanConnected(false);
    setAgentName(null);
    setViewingHistory(false);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || loading) return;

    const userText = inputText.trim();
    setInputText('');
    if (visitorTextareaRef.current) {
      visitorTextareaRef.current.style.height = '38px';
      setTimeout(() => visitorTextareaRef.current?.focus(), 10);
    }
    setLoading(true);
    setShowGreetingBubble(false);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (conversationId) {
      // Instantly clear preview on dashboard
      channelRef.current?.send({
        type: 'broadcast',
        event: 'typing_event',
        payload: {
          conversationId,
          typingText: '',
          isTyping: false,
          senderType: 'visitor'
        }
      });
    }

    const maxSeq = messages.reduce((max, m) => Math.max(max, m.seq || 0), 0);
    const nowIso = new Date().toISOString();
    const clientMsgId = 'msg_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    const currentCId = activeConvIdRef.current || conversationId;
    const optimisticMsg = {
      id: clientMsgId,
      conversation_id: currentCId || undefined,
      sender_type: 'visitor' as const,
      sender_name: userName || 'You',
      content: userText,
      seq: maxSeq + 1,
      status: 'delivered' as const,
      created_at: nowIso
    };

    const cleanHandoffCheck = (text: string) => {
      const clean = (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

      // Guard: conditional or deferred mentions (e.g. "before i talk to a real person") must NOT trigger handoff!
      const conditionalAvoidRegex = /\b(before|prior to|without|instead of|rather than|dont want|don't want|before talking|before i talk|before speaking)\b.*(talk|speak|connect|chat|real person|real human|live agent|human|agent|person)/i;
      if (conditionalAvoidRegex.test(clean)) {
        return false;
      }

      // Guard: pricing / estimate queries must go to AI and Booking Form, NOT lock the chat!
      const isPricingOrEstimate = /\b(price|pricing|cost|costing|budget|fee|fees|charge|charges|rate|rates|quote|quotation|estimate|estimation|package|packages|how much)\b/i.test(clean);
      if (isPricingOrEstimate) {
        const explicitTransferOverride = /\b(transfer me|connect me|switch me|put me through|agent now|human now|stop ai|not ai)\b/i.test(clean);
        if (!explicitTransferOverride) {
          return false;
        }
      }

      // Standalone single-phrase handoff
      const exactHandoffs = [
        'agent', 'human', 'rep', 'representative', 'real agent', 'live agent', 'real person',
        'live person', 'person', 'human please', 'agent please', 'person please', 'real support',
        'insan se baat', 'bande se baat', 'real banda', 'actual person', 'actual human', 'agent chahiye',
        'human support', 'live support', 'talk to human', 'talk to agent', 'speak to agent', 'connect to agent',
        'connect with agent', 'speak to human', 'transfer to agent', 'transfer to human', 'connect with human'
      ];
      if (exactHandoffs.includes(clean)) return true;

      // Direct explicit transfer commands
      const directTransferCommands = [
        'not ai', 'stop ai', 'transfer me', 'connect me with', 'connect me to', 'connect with real agent',
        'talk to human', 'talk to agent', 'speak to agent', 'connect to agent', 'speak to human',
        'talk to a person', 'talk to the real person', 'talk to a real person', 'talk to real man',
        'talk to a real man', 'speak to a real man', 'speak to real man', 'can i talk to a real man',
        'can i talk to real man', 'talk to real guy', 'can i talk to the real person', 'can i talk to a real person',
        'can i speak to a person', 'can i speak to a real person', 'can i talk to real person', 'transfer to real person',
        'i want to talk to a human', 'i want to speak to a person', 'i want to talk to an agent',
        'let me talk to a human', 'let me speak to an agent', 'i need a real person', 'i want a real person'
      ];
      if (directTransferCommands.some(p => clean.includes(p))) {
        return true;
      }

      const humanKeywords = ['human', 'real agent', 'live agent', 'agent', 'person', 'someone', 'representative', 'rep', 'specialist', 'insan', 'banda'];
      const actionKeywords = ['talk to', 'speak to', 'speak with', 'connect to', 'connect with', 'transfer to', 'switch to', 'reach out to'];
      return actionKeywords.some(a => clean.includes(a)) && humanKeywords.some(h => clean.includes(h));
    };

    const isAlreadyHuman = isHumanConnected || !!agentName || latestAgentMessage !== null || (conversationId ? messages.some(m => m.sender_type === 'agent' || (m.sender_type === 'system' && (m.content.includes('claimed and joined') || m.content.includes('taken over') || m.content.includes('transferred to')))) : false);
    const isHandoff = !isAlreadyHuman && cleanHandoffCheck(userText);

    const optimisticSysMsg = isHandoff ? {
      id: 'msg_sys_handoff_' + (currentCId || clientMsgId),
      conversation_id: currentCId || undefined,
      sender_type: 'system' as const,
      sender_name: 'System',
      content: 'Transferring to a live support agent. Please hold on...',
      seq: maxSeq + 2,
      created_at: new Date(Date.now() + 50).toISOString()
    } : null;

    inFlightVisitorMessagesRef.current.set(clientMsgId, optimisticMsg);
    sessionVisitorMessagesRef.current.set(clientMsgId, optimisticMsg);
    if (optimisticSysMsg) {
      inFlightVisitorMessagesRef.current.set(optimisticSysMsg.id, optimisticSysMsg);
      sessionVisitorMessagesRef.current.set(optimisticSysMsg.id, optimisticSysMsg);
    }

    setMessages((prev) => {
      const toMerge = [optimisticMsg];
      if (optimisticSysMsg) toMerge.push(optimisticSysMsg);
      return safeMergeMessages(prev, toMerge, currentCId);
    });

    if (isHandoff || isAlreadyHuman) {
      setIsHumanConnected(true);
    }

    setLoading(true);

    isWidgetUserScrolledUp.current = false;
    setTimeout(() => {
      scrollToBottom(false);
    }, 30);

    try {
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: clientMsgId,
          conversationId: currentCId,
          visitorToken,
          propertySlug,
          pageUrl: pageUrl || (typeof window !== 'undefined' ? window.location.href : '/'),
          referrerUrl: referrerUrl || (typeof document !== 'undefined' && document.referrer ? document.referrer : 'Direct'),
          senderType: 'visitor',
          senderName: userName || 'Visitor',
          senderEmail: userEmail || undefined,
          senderPhone: userPhone || undefined,
          content: userText,
          isHumanConnected: isHumanConnected || isAlreadyHuman,
          assignedAgentName: agentName || (isAlreadyHuman ? 'Support Specialist' : undefined),
          chatNumber: currentChatNumber
        })
      });

      if (res.ok) {
        const data = await res.json();
        const effectiveCId = data.conversationId || data.conversation?.id || currentCId;
        if (effectiveCId && effectiveCId !== activeConvIdRef.current) {
          changeActiveConversation(effectiveCId);
        }

        // Clean up acknowledged in-flight messages
        inFlightVisitorMessagesRef.current.delete(clientMsgId);
        if (optimisticSysMsg) inFlightVisitorMessagesRef.current.delete(optimisticSysMsg.id);

        const serverMsgs = data.conversation?.messages || 
          (data.aiMessages ? [data.message, ...data.aiMessages] : (data.aiMessage ? [data.message, data.aiMessage] : [data.message]));
        if (serverMsgs && Array.isArray(serverMsgs)) {
          setMessages(prev => {
            const merged = safeMergeMessages(prev, serverMsgs, effectiveCId);
            if (effectiveCId) {
              try {
                localStorage.setItem('teals_conv_cache_' + effectiveCId, JSON.stringify(merged));
              } catch {}
            }
            return merged;
          });
        }
      }
    } catch (err) {
      console.error(err);
      // Safety: retain in-flight message so user never loses their text
      setTimeout(() => {
        inFlightVisitorMessagesRef.current.delete(clientMsgId);
      }, 15000);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenWidget = () => {
    setIsOpen(true);
    setShowGreetingBubble(false);
    setViewingHistory(false);
    if (visitorToken) {
      fetchVisitorConversations(visitorToken);
    }
  };

  return (
    <div className="fixed bottom-2 right-2 z-50 font-sans flex flex-col items-end bg-transparent">
      {/* Dynamic Greeting / Agent Message Bubble (Full text wrapping with no truncation) */}
      {!isOpen && showGreetingBubble && (
        <div className="mb-2 mr-1 bg-white text-gray-900 border border-gray-200 shadow-2xl rounded-2xl px-4 py-2.5 flex items-start space-x-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300 relative cursor-pointer max-w-[320px] break-words">
          <div onClick={handleOpenWidget} className="flex items-start space-x-2 min-w-0 flex-1">
            {latestAgentMessage && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0 mt-1" />
            )}
            <span className="text-xs font-medium text-gray-900 leading-snug whitespace-normal break-words">
              {displayBubbleText}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowGreetingBubble(false);
            }}
            className="text-gray-400 hover:text-gray-700 p-0.5 rounded-full transition-colors shrink-0 mt-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-white border-r border-b border-gray-200 rotate-45" />
        </div>
      )}

      {/* Clean Circular Launcher Button */}
      {!isOpen && (
        <button
          onClick={handleOpenWidget}
          className="w-14 h-14 rounded-full bg-white border-2 border-white shadow-2xl hover:scale-105 transition-all flex items-center justify-center relative group p-0 overflow-hidden"
          style={{ background: 'transparent' }}
        >
          <AgentAvatar
            type={isHumanConnected ? (agentName ? 'male' : 'female') : 'ai'}
            name={isHumanConnected ? (agentPseudoName || 'Support Specialist') : (agentName || '')}
            size="xl"
            className="w-full h-full"
          />
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-brand-emerald rounded-full border-2 border-white animate-pulse" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="w-[350px] sm:w-[380px] h-[520px] bg-[#0d1322] border border-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 relative">
          {/* 2-Chat Limit Modal */}
          {showChatLimitModal && (
            <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-5 animate-in fade-in duration-200">
              <div className="bg-[#11192e] border border-blue-500/40 rounded-2xl p-5 max-w-[310px] w-full text-center space-y-3.5 shadow-2xl animate-in zoom-in-95 duration-150">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white tracking-tight">Chat Limit Reached</h4>
                  <p className="text-xs text-gray-300 mt-2 leading-relaxed">
                    You cannot start more than 2 active conversations. You can continue speaking with a live support agent inside your existing chats. Please send your message, and an agent will reply shortly.
                  </p>
                </div>
                <div className="flex flex-col space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowChatLimitModal(false)}
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg cursor-pointer"
                  >
                    Understood
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowChatLimitModal(false);
                      handleFullWipe();
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset & Start Fresh</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Staff / Admin Client Restriction Modal */}
          {showStaffBlockModal && (
            <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-5 animate-in fade-in duration-200">
              <div className="bg-[#11192e] border border-red-500/40 rounded-2xl p-5 max-w-[310px] w-full text-center space-y-3.5 shadow-2xl animate-in zoom-in-95 duration-150">
                <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white tracking-tight">Access Restricted</h4>
                  <p className="text-xs text-gray-300 mt-2 leading-relaxed">
                    {staffBlockError || 'Agents & Admins cannot initiate chats as clients. Please sign in via the CRM console or use a client email.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowStaffBlockModal(false);
                    setUserName('');
                    setUserEmail('');
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-lg cursor-pointer"
                >
                  Understood
                </button>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="p-3 px-4 bg-gradient-to-r from-blue-900/40 via-[#11192e] to-[#11192e] border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              {!viewingHistory ? (
                <button
                  type="button"
                  onClick={handleOpenConversations}
                  className="p-1 px-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white flex items-center space-x-1 text-xs border border-gray-700 flex-shrink-0 transition-colors cursor-pointer"
                  title="Back to Conversations"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (conversationId) {
                      handleSelectOldChat(conversationId);
                    } else {
                      setViewingHistory(false);
                    }
                  }}
                  className="p-1 px-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white flex items-center space-x-1 text-xs border border-gray-700 flex-shrink-0 transition-colors cursor-pointer"
                  title="Back to Chat"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Chat</span>
                </button>
              )}
              <AgentAvatar
                type={isHumanConnected ? (agentName ? 'male' : 'female') : 'ai'}
                name={isHumanConnected ? (agentPseudoName || 'Support Specialist') : (agentName || '')}
                size="md"
              />
              <div>
                <div className="flex items-center space-x-1.5">
                  <h3 className="text-xs font-bold text-white">
                    {viewingHistory
                      ? 'Conversations'
                      : isHumanConnected
                      ? (agentPseudoName || 'Support Agent')
                      : siteAiName}
                  </h3>
                  {!viewingHistory && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-600/30 text-blue-300 border border-blue-500/40">
                      {`Chat #${currentChatNumber}`}
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-1.5 text-[10px] text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>
                    {viewingHistory
                      ? 'Select a chat or start new'
                      : isHumanConnected
                      ? (agentRoleTitle || 'Support Specialist')
                      : 'Online & Ready to Help'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1.5">
              {!viewingHistory && (
                <button
                  onClick={handleResetVisitorChat}
                  title="Reset Chat"
                  className="p-1.5 rounded-xl text-gray-400 hover:text-rose-400 hover:bg-gray-800 transition-colors flex items-center space-x-1 text-[10px]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Chat Switcher Tabs Bar */}
          {!viewingHistory && (
            <div className="px-3 py-1.5 bg-[#0b1120] border-b border-gray-800/80 flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                {/* Chat 1 Tab */}
                <button
                  type="button"
                  onClick={() => {
                    const chat1 = savedConversations.find(c => c.chatNumber === 1);
                    if (chat1 && chat1.id !== conversationId) {
                      handleSelectOldChat(chat1.id);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                    currentChatNumber === 1
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/40 ring-1 ring-blue-400/50'
                      : 'bg-gray-800/70 text-gray-300 hover:text-white hover:bg-gray-700/80'
                  }`}
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>Chat #1</span>
                </button>

                {/* Chat 2 Tab or + New Chat */}
                {savedConversations.some(c => c.chatNumber === 2 && c.id !== (savedConversations.find(x => x.chatNumber === 1)?.id)) || currentChatNumber === 2 ? (
                  <button
                    type="button"
                    onClick={() => {
                      const chat2 = savedConversations.find(c => c.chatNumber === 2);
                      if (chat2 && chat2.id !== conversationId) {
                        handleSelectOldChat(chat2.id);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                      currentChatNumber === 2
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/40 ring-1 ring-blue-400/50'
                        : 'bg-gray-800/70 text-gray-300 hover:text-white hover:bg-gray-700/80'
                    }`}
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>Chat #2</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartNewChat}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-blue-400 hover:text-white hover:bg-blue-600/30 border border-blue-500/30 transition-all flex items-center space-x-1 cursor-pointer"
                    title="Open a separate Chat #2"
                  >
                    <PlusCircle className="w-3 h-3" />
                    <span>+ New Chat</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleOpenConversations}
                className="text-[10px] text-gray-400 hover:text-gray-200 px-1.5 py-0.5 rounded hover:bg-gray-800 transition-colors"
                title="View All Conversations"
              >
                All Chats
              </button>
            </div>
          )}

          {/* View Routing: 1. Conversations Inbox, 2. Active Chat */}
          {viewingHistory ? (
            /* Conversations Inbox View (Instagram style with chat list & new chat button at the bottom) */
            <div className="flex-1 bg-[#0a0f1c] text-white flex flex-col justify-between overflow-hidden">
              {/* Conversations List */}
              <div className="flex-1 p-3 space-y-2 overflow-y-auto">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1 mb-2">Your Conversations</h4>
                {savedConversations.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-400 space-y-3 my-12">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/20 flex items-center justify-center text-blue-400 mx-auto">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <p className="text-xs text-gray-300 font-medium">No previous conversations</p>
                    <p className="text-[11px] text-gray-500">Start a new conversation to connect with support.</p>
                    <button
                      type="button"
                      onClick={() => {
                        handleStartNewChat();
                      }}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                    >
                      Start New Chat
                    </button>
                  </div>
                ) : (
                  savedConversations.map((c, idx) => {
                    const isCurrent = c.id === conversationId;
                    const itemChatNum = savedConversations.length >= 2 ? (idx === 0 ? 2 : 1) : 1;
                    return (
                      <div
                        key={c.id}
                        onClick={() => handleSelectOldChat(c.id)}
                        className={`flex items-center space-x-3 p-3 rounded-xl cursor-pointer transition-all border ${
                          isCurrent 
                            ? 'bg-blue-950/40 border-blue-600/50 shadow-sm' 
                            : 'bg-[#131b2e] border-gray-800 hover:border-gray-700 hover:bg-[#18233c]'
                        }`}
                      >
                        {/* Avatar */}
                        <div className="flex-shrink-0 relative">
                          <AgentAvatar type="ai" name="" size="md" />
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-brand-emerald rounded-full border border-[#131b2e]" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                              <span>{`Chat #${itemChatNum}`}</span>
                              {isCurrent && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-semibold">
                                  Active
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">{c.updatedAt || 'Just now'}</span>
                          </div>
                          <div className="flex items-center space-x-1 mt-0.5">
                            {isCurrent && <MessageSquare className="w-3 h-3 text-blue-400 flex-shrink-0" />}
                            <p className="text-[11px] text-gray-300 truncate">{c.lastMessage || DEFAULT_GREETING}</p>
                          </div>
                        </div>

                        {/* Arrow */}
                        <ArrowRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                      </div>
                    );
                  })
                )}
              </div>

              {/* Start new chat card at the BOTTOM */}
              <div className="p-3 border-t border-gray-800 bg-[#11192e]">
                <button
                  onClick={handleStartNewChat}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-2">
                    <PlusCircle className="w-4 h-4 text-white group-hover:rotate-90 transition-transform" />
                    <span>{savedConversations.length === 1 ? 'Start a New Conversation (Chat #2)' : 'Start a New Conversation'}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-white/80 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Stream */}
              <div 
                ref={widgetChatContainerRef}
                onScroll={handleWidgetScroll}
                className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-[#0a0f1c] overscroll-contain"
                style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
              >
                {(messages && messages.length > 0 ? messages : [{
                  id: 'init-greet',
                  conversation_id: conversationId || undefined,
                  sender_type: 'ai' as const,
                  sender_name: siteAiName,
                  content: siteGreeting,
                  seq: 1,
                  status: 'read' as const,
                  created_at: new Date().toISOString()
                }]).map((m) => {
                  const isVisitor = m.sender_type === 'visitor';
                  const isSystem = m.sender_type === 'system';

                  if (isSystem) {
                    return (
                      <div key={m.id} className="text-center my-1.5">
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#131b2e] border border-gray-800 text-gray-400 font-medium">
                          {m.content}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={m.id}
                      className={"flex flex-col " + (isVisitor ? "items-end" : "items-start")}
                    >
                      <div className="flex items-center space-x-1.5 mb-1 px-1">
                        {!isVisitor && (
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[10px] font-bold text-gray-300">
                              {m.sender_type === 'agent'
                                ? (m.sender_pseudo_name || agentPseudoName || 'Support Agent')
                                : (m.sender_name || 'AI Assistant')}
                            </span>
                            {m.sender_type === 'agent' && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium">
                                {m.sender_role_title || agentRoleTitle || 'Support Specialist'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div
                        className={"max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-sm " + (isVisitor ? "bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-br-none" : "bg-[#131b2e] border border-gray-800 text-gray-100 rounded-bl-none")}
                      >
                        <div>
                          {m.sender_type === 'ai'
                            ? m.content?.replace(/[\u2014\u2013\u2015\u2012\u2212\uFE58\uFE63\uFF0D—–―]/g, ', ').replace(/\s*--+\s*/g, ', ')
                            : m.content}
                        </div>

                        {/* Interactive Consultation Booking Form Card */}
                        {(m.is_form || m.form_type === 'booking' || (m.sender_type === 'ai' && /consultation booking form|strategy meeting|booking form right below|consultation booking|schedule a call|book a free 1-on-1|pricing is fully customized|our pricing is customized/i.test(m.content || ''))) && (
                          <ChatCardErrorBoundary>
                            <ConsultationBookingCard
                              conversationId={conversationId || m.conversation_id || ''}
                              visitorToken={visitorToken}
                              propertySlug={propertySlug}
                              initialName={userName}
                              initialEmail={userEmail}
                              initialPhone={userPhone}
                              availableServices={siteConfig?.services}
                              alreadySubmittedData={m.form_data}
                              onBookingSubmitted={(booked) => {
                                setUserName(booked.name);
                                setUserEmail(booked.email);
                                setUserPhone(booked.phone);
                                try {
                                  localStorage.setItem('teals_visitor_name', booked.name);
                                  localStorage.setItem('teals_visitor_email', booked.email);
                                  localStorage.setItem('teals_visitor_phone', booked.phone);
                                } catch {}
                              }}
                            />
                          </ChatCardErrorBoundary>
                        )}

                        <div className={`flex items-center space-x-1 mt-1 ${isVisitor ? 'justify-end text-white/70' : 'justify-start text-gray-400'}`}>
                          <span className="text-[9px]">
                            {m.id === 'init-greet' || !m.created_at || m.created_at.startsWith('1970')
                              ? ''
                              : new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Agent Typing Indicator (Simple "Real Agent is typing..." with animated dots) */}
                {agentTypingText && (
                  <div className="flex items-center space-x-2 text-[11px] text-blue-400 bg-blue-950/50 border border-blue-900/40 rounded-xl px-3 py-2 animate-pulse">
                    <div className="flex space-x-1 items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce delay-100" />
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce delay-200" />
                    </div>
                    <span className="font-medium text-blue-300">{(agentPseudoName || "Support Agent")} is typing...</span>
                  </div>
                )}

                {loading && (
                  <div className="flex items-center space-x-1.5 text-[11px] text-gray-400 p-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce delay-100" />
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce delay-200" />
                    <span>Typing...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSend} className="p-2.5 border-t border-gray-800 bg-[#11192e] flex items-end space-x-2">
                <textarea
                  ref={visitorTextareaRef}
                  value={inputText}
                  onChange={(e) => handleInputChange(e.target.value, e.currentTarget)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
                  placeholder="Type your message here (Enter to send)..."
                  className="flex-1 bg-[#131b2e] border border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none overflow-y-auto whitespace-pre-wrap break-words leading-relaxed transition-[height] duration-75"
                  style={{ minHeight: '38px', maxHeight: '130px' }}
                />
                <button
                  type="submit"
                  disabled={loading || !inputText.trim()}
                  className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-all disabled:opacity-40 flex-shrink-0 mb-0.5 shadow-md"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
};
