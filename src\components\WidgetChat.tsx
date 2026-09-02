'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, User, Mail, ArrowRight, Sparkles, PlusCircle, Eye, History, MessageSquare, ChevronLeft } from 'lucide-react';
import { AgentAvatar } from '@/components/AgentAvatar';
import { supabase } from '@/lib/supabase';
import { REALTIME_CHANNEL } from '@/lib/realtime';

interface WidgetChatProps {
  propertySlug?: string;
  visitorTokenProp?: string;
  sessionIdProp?: string;
  pageUrl?: string;
  referrerUrl?: string;
}

const DEFAULT_GREETING = 'Hey! How can I help you with Teals CRM today?';

interface SavedConvSummary {
  id: string;
  lastMessage?: string;
  updatedAt: string;
}

const dedupeMessages = (list: any[]) => {
  const map = new Map<string, any>();
  let seenGreet = false;
  list.forEach(m => {
    if (!m) return;
    const isGreet = m.sender_type === 'ai' && (m.id === 'init-greet' || (typeof m.id === 'string' && m.id.startsWith('init-greet')) || m.content?.trim() === DEFAULT_GREETING.trim());
    if (isGreet) {
      if (seenGreet) return;
      seenGreet = true;
      map.set('init-greet', {
        ...m,
        id: 'init-greet',
        seq: 1,
        status: 'read',
        created_at: m.created_at
      });
      return;
    }
    map.set(m.id, m);
  });
  return Array.from(map.values()).sort((a, b) => {
    if (typeof a.seq === 'number' && typeof b.seq === 'number' && a.seq !== b.seq) {
      return a.seq - b.seq;
    }
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    return timeA - timeB;
  });
};

export const WidgetChat: React.FC<WidgetChatProps> = ({
  propertySlug = 'teals-crm',
  visitorTokenProp,
  sessionIdProp,
  pageUrl,
  referrerUrl
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showGreetingBubble, setShowGreetingBubble] = useState(true);
  const [visitorToken, setVisitorToken] = useState(visitorTokenProp || '');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [viewingHistory, setViewingHistory] = useState(false);
  const [savedConversations, setSavedConversations] = useState<SavedConvSummary[]>([]);

  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [hasSubmittedLead, setHasSubmittedLead] = useState(false);

  const [messages, setMessages] = useState<Array<{ id: string; sender_type: string; sender_name: string; content: string; seq?: number; status?: 'sent' | 'delivered' | 'read'; created_at?: string }>>([
    {
      id: 'init-greet',
      sender_type: 'ai',
      sender_name: 'Teals AI Agent',
      content: DEFAULT_GREETING,
      seq: 1,
      status: 'read'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [agentName, setAgentName] = useState<string | null>(null);
  const [agentTypingText, setAgentTypingText] = useState<string | null>(null);
  const [isHumanConnected, setIsHumanConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load saved lead details and previous conversation IDs on mount
  useEffect(() => {
    try {
      const savedName = localStorage.getItem('teals_lead_name');
      const savedEmail = localStorage.getItem('teals_lead_email');
      const submitted = localStorage.getItem('teals_lead_submitted');
      if (savedName) setUserName(savedName);
      if (savedEmail) setUserEmail(savedEmail);
      if (savedName && savedEmail && submitted === 'true') {
        setHasSubmittedLead(true);
      } else {
        setHasSubmittedLead(false);
      }

      const rawConvList = localStorage.getItem('teals_visitor_conv_list');
      if (rawConvList) {
        setSavedConversations(JSON.parse(rawConvList));
      }
    } catch {}
  }, []);

  // Auto-save current conversation to the list whenever messages update
  // so it appears in the inbox next time widget opens
  useEffect(() => {
    if (!conversationId || messages.length <= 1) return;
    const lastMsg = messages[messages.length - 1]?.content || 'Conversation';
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setSavedConversations(prev => {
      const filtered = prev.filter(c => c.id !== conversationId);
      const updated = [{ id: conversationId, lastMessage: lastMsg, updatedAt: timeStr }, ...filtered];
      try { localStorage.setItem('teals_visitor_conv_list', JSON.stringify(updated)); } catch {}
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
    let activeConvId: string | null = null;
    try {
      activeConvId = localStorage.getItem('teals_active_conv_id');
    } catch {}

    const targetConvId = activeConvId || token;
    setConversationId(targetConvId);

    // Track visitor session (fire and forget)
    fetch('/api/visitor/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionIdProp || token,
        visitorToken: token,
        propertySlug,
        currentPage: pageUrl || '/',
        referrer: referrerUrl || 'Direct',
        isNewPageView: false,
        visitorName: userName || undefined,
        visitorEmail: userEmail || undefined
      })
    }).catch(() => {});

    // Restore full conversation history from server
    const restoreChatHistory = async () => {
      try {
        const res = await fetch('/api/chat/message?conversationId=' + targetConvId);
        if (res.ok) {
          const data = await res.json();
          if (data.conversation?.messages && data.conversation.messages.length > 0) {
            setMessages(dedupeMessages(data.conversation.messages));
          } else if (data.messages && data.messages.length > 0) {
            setMessages(dedupeMessages(data.messages));
          }
          if (data.conversation?.mode === 'human' && data.conversation.assigned_agent_name) {
            setIsHumanConnected(true);
            setAgentName(data.conversation.assigned_agent_name);
          }
        }
      } catch {}
    };

    restoreChatHistory();
  }, [visitorTokenProp, sessionIdProp, propertySlug, pageUrl, referrerUrl, userName, userEmail]);

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
        const message = (raw as Record<string, unknown>)?.message as { id: string; sender_type: string; sender_name: string; content: string; seq?: number; created_at?: string };
        const systemMessage = (raw as Record<string, unknown>)?.systemMessage as { id: string; sender_type: string; sender_name: string; content: string; seq?: number; created_at?: string };
        const conv = (raw as Record<string, unknown>)?.conversation as { mode?: string; assigned_agent_name?: string };

        const matches = !cId || cId === conversationId;
        if (matches) {
          // Immediately dismiss agent typing bubble when a message arrives from agent
          if (message?.sender_type === 'agent' || message?.sender_type === 'ai') {
            setAgentTypingText(null);
            setLoading(false);
          }

          setMessages((prev) => {
            const nextList = [...prev];
            if (message) nextList.push(message);
            if (systemMessage) nextList.push(systemMessage);
            return dedupeMessages(nextList);
          });
          if (conv && conv.mode === 'human' && conv.assigned_agent_name) {
            setIsHumanConnected(true);
            setAgentName(conv.assigned_agent_name);
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

        const matches = !cId || cId === conversationId;
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
          setIsHumanConnected(true);
          if (agentName) setAgentName(agentName);
          setLoading(false);
          setAgentTypingText(null);

          const claimMsgId = 'msg_sys_claim_' + (cId || conversationId || 'main');
          const nowIso = new Date(Date.now() + 50).toISOString();

          setMessages((prev) => {
            const maxSeq = prev.reduce((max, m) => Math.max(max, m.seq || 0), 0);
            const sysMsg = {
              id: claimMsgId,
              sender_type: 'system' as const,
              sender_name: 'System',
              content: `Live Support Agent ${agentName || 'Agent'} has claimed and joined the conversation.`,
              seq: maxSeq + 1,
              created_at: nowIso
            };
            const nextList = prev.filter(m => !(m.sender_type === 'system' && m.content?.includes('has claimed and joined')));
            if (conv?.messages && Array.isArray(conv.messages)) {
              conv.messages
                .filter(m => !(m.sender_type === 'system' && m.content?.includes('has claimed and joined')))
                .forEach(m => nextList.push({ ...m, sender_name: m.sender_name || 'Agent' }));
            }
            nextList.push(sysMsg);
            return dedupeMessages(nextList);
          });
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
      .on('broadcast', { event: 'stats_reset' }, () => {
        try {
          localStorage.removeItem('teals_lead_submitted');
          localStorage.removeItem('teals_active_conv_id');
          localStorage.removeItem('teals_visitor_conv_list');
          localStorage.removeItem('teals_lead_name');
          localStorage.removeItem('teals_lead_email');
        } catch {}
        setConversationId(null);
        setSavedConversations([]);
        setHasSubmittedLead(false);
        setUserName('');
        setUserEmail('');
        setIsHumanConnected(false);
        setAgentName(null);
        setViewingHistory(false);
        setMessages([
          {
            id: 'init-greet',
            sender_type: 'ai',
            sender_name: 'Teals AI Agent',
            content: DEFAULT_GREETING,
            seq: 1,
            status: 'read'
          }
        ]);
      })
      .subscribe();

    const fetchFullHistory = async () => {
      if (!conversationId) return;
      try {
        const res = await fetch('/api/chat/message?conversationId=' + conversationId);
        if (res.ok) {
          const data = await res.json();
          // If conversation was wiped / does not exist on backend (e.g. after reset):
          if (!data.conversation && (!data.messages || data.messages.length === 0)) {
            try {
              localStorage.removeItem('teals_active_conv_id');
              localStorage.removeItem('teals_visitor_conv_list');
            } catch {}
            setConversationId(null);
            setSavedConversations([]);
            setMessages([
              {
                id: 'init-greet',
                sender_type: 'ai',
                sender_name: 'Teals AI Agent',
                content: DEFAULT_GREETING,
                created_at: new Date().toISOString()
              }
            ]);
            return;
          }

          if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
            setMessages((prev) => {
              const map = new Map<string, any>();
              prev.forEach(m => map.set(m.id, m));
              data.messages.forEach((m: any) => {
                const existing = map.get(m.id);
                map.set(m.id, {
                  ...m,
                  status: m.status || existing?.status || 'delivered'
                });
              });
              return Array.from(map.values()).sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
            });
          }
          if (data.conversation) {
            if (data.conversation.mode === 'human' && data.conversation.assigned_agent_name) {
              setIsHumanConnected(true);
              setAgentName(data.conversation.assigned_agent_name);
            }
          }
        }
      } catch {}
    };

    fetchFullHistory();

    return () => {
      channelRef.current = null;
      channel.unsubscribe();
    };
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, agentTypingText]);

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

  const handleInputChange = (val: string) => {
    setInputText(val);
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

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !userEmail.trim()) return;

    const cleanName = userName.trim();
    const cleanEmail = userEmail.trim();

    try {
      localStorage.setItem('teals_lead_name', cleanName);
      localStorage.setItem('teals_lead_email', cleanEmail);
      localStorage.setItem('teals_lead_submitted', 'true');
    } catch {}

    const initialConv = {
      id: conversationId || ('conv_' + Math.random().toString(36).substring(2, 9)),
      lastMessage: DEFAULT_GREETING,
      updatedAt: 'Just now'
    };

    setSavedConversations(prev => {
      const list = prev.length > 0 ? prev : [initialConv];
      try { localStorage.setItem('teals_visitor_conv_list', JSON.stringify(list)); } catch {}
      return list;
    });

    setHasSubmittedLead(true);
    setViewingHistory(true);

    try {
      await fetch('/api/visitor/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdProp || visitorToken,
          visitorToken: conversationId || visitorToken,
          propertySlug,
          currentPage: pageUrl || '/',
          referrer: referrerUrl || 'Direct',
          visitorName: cleanName,
          visitorEmail: cleanEmail
        })
      });
    } catch {}
  };

  // Switch to a previous conversation
  const handleSelectOldChat = async (convId: string) => {
    setConversationId(convId);
    try {
      localStorage.setItem('teals_active_conv_id', convId);
    } catch {}
    setViewingHistory(false);
    setIsHumanConnected(false);
    setAgentName(null);

    try {
      const res = await fetch('/api/chat/message?conversationId=' + convId);
      if (res.ok) {
        const data = await res.json();
        if (data.messages && Array.isArray(data.messages)) {
          setMessages(dedupeMessages(data.messages));
        }
        if (data.conversation?.mode === 'human' && data.conversation.assigned_agent_name) {
          setIsHumanConnected(true);
          setAgentName(data.conversation.assigned_agent_name);
        }
      }
    } catch {}
  };

  // Start a brand new conversation and preserve old ones
  const handleStartNewChat = () => {
    // 1. Save current conversation to history list
    if (conversationId && messages.length > 1) {
      const lastMsg = messages[messages.length - 1]?.content || 'Chat Session';
      const updatedList = [
        { id: conversationId, lastMessage: lastMsg, updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
        ...savedConversations.filter(c => c.id !== conversationId)
      ];
      setSavedConversations(updatedList);
      try {
        localStorage.setItem('teals_visitor_conv_list', JSON.stringify(updatedList));
      } catch {}
    }

    // 2. Generate new conversation ID
    const newConvId = 'conv_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    setConversationId(newConvId);
    try {
      localStorage.setItem('teals_active_conv_id', newConvId);
    } catch {}

    setIsHumanConnected(false);
    setAgentName(null);
    setViewingHistory(false);
    setMessages([
      {
        id: 'init-greet',
        sender_type: 'ai',
        sender_name: 'Teals AI Agent',
        content: DEFAULT_GREETING,
        seq: 1,
        status: 'read',
        created_at: '2020-01-01T00:00:00.000Z'
      }
    ]);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || loading) return;

    const userText = inputText.trim();
    setInputText('');
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
    const optimisticMsg = {
      id: clientMsgId,
      sender_type: 'visitor' as const,
      sender_name: userName || 'You',
      content: userText,
      seq: maxSeq + 1,
      status: 'delivered' as const,
      created_at: nowIso
    };

    const cleanHandoffCheck = (text: string) => {
      const clean = (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const hasDirect = /(real person|real human|live agent|human agent|not ai|stop ai|human please|agent please|talk to human|talk to agent|speak to agent|connect to agent|speak to human|talk to a person|real support|insan se baat|bande se baat|real banda|actual person|actual human|talk to real person|speak to real person|chat with human|human support|live support)/i.test(clean);
      if (hasDirect) return true;
      const humans = ['human', 'real person', 'live person', 'live agent', 'representative', 'support person', 'insan', 'real banda'];
      const actions = ['talk', 'speak', 'connect', 'transfer', 'switch'];
      return actions.some(a => clean.includes(a)) && humans.some(h => clean.includes(h));
    };

    const isHandoff = cleanHandoffCheck(userText) && !isHumanConnected;

    const optimisticSysMsg = isHandoff ? {
      id: 'msg_sys_handoff_' + (conversationId || clientMsgId),
      sender_type: 'system' as const,
      sender_name: 'System',
      content: 'Transferring to a live support agent. Please hold on...',
      seq: maxSeq + 2,
      created_at: new Date(Date.now() + 50).toISOString()
    } : null;

    setMessages((prev) => {
      const nextList = [...prev, optimisticMsg];
      if (optimisticSysMsg) nextList.push(optimisticSysMsg);
      return dedupeMessages(nextList);
    });

    // Instantly stream visitor message and handoff system message to Dashboard (sub-5ms)
    if (conversationId) {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'chat_message',
        payload: {
          conversationId,
          message: {
            id: clientMsgId,
            conversation_id: conversationId,
            sender_type: 'visitor',
            sender_name: userName || 'Visitor',
            content: userText,
            is_whisper: false,
            seq: optimisticMsg.seq,
            created_at: nowIso
          },
          systemMessage: optimisticSysMsg,
          conversation: {
            id: conversationId,
            property_slug: propertySlug,
            visitor_name: userName || 'Visitor',
            visitor_email: userEmail || undefined,
            assigned_agent_name: agentName || undefined,
            mode: isHandoff ? 'human' : (isHumanConnected ? 'human' : 'ai'),
            status: isHandoff ? 'pending_agent' : 'active',
            messages: optimisticSysMsg ? [...messages, optimisticMsg, optimisticSysMsg] : [...messages, optimisticMsg]
          },
          isHandoffRequested: isHandoff
        }
      });
    }

    try {
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: clientMsgId,
          conversationId,
          visitorToken,
          senderType: 'visitor',
          senderName: userName || 'Visitor',
          senderEmail: userEmail || undefined,
          content: userText
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.conversationId && !conversationId) {
          setConversationId(data.conversationId);
          try {
            localStorage.setItem('teals_active_conv_id', data.conversationId);
          } catch {}
        }

        if (data.conversation?.messages) {
          setMessages((prev) => {
            const merged = [...prev, ...data.conversation.messages];
            return dedupeMessages(merged);
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-2 right-2 z-50 font-sans flex flex-col items-end bg-transparent">
      {/* Greeting Bubble */}
      {!isOpen && showGreetingBubble && (
        <div className="mb-2 mr-1 bg-white text-gray-900 border border-gray-200 shadow-2xl rounded-2xl px-4 py-2.5 flex items-center space-x-3 animate-in fade-in slide-in-from-bottom-2 duration-300 relative cursor-pointer">
          <div onClick={() => {
            setIsOpen(true);
            setShowGreetingBubble(false);
            setViewingHistory(true);
          }} className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-gray-800">{DEFAULT_GREETING}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowGreetingBubble(false);
            }}
            className="text-gray-400 hover:text-gray-700 p-0.5 rounded-full transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-white border-r border-b border-gray-200 rotate-45" />
        </div>
      )}

      {/* Clean Circular Launcher Button */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setShowGreetingBubble(false);
            setViewingHistory(true);
          }}
          className="w-14 h-14 rounded-full bg-white border-2 border-white shadow-2xl hover:scale-105 transition-all flex items-center justify-center relative group p-0 overflow-hidden"
          style={{ background: 'transparent' }}
        >
          <AgentAvatar
            type={isHumanConnected ? (agentName ? 'male' : 'female') : 'ai'}
            name={agentName || ''}
            size="xl"
            className="w-full h-full"
          />
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-brand-emerald rounded-full border-2 border-white animate-pulse" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="w-[350px] sm:w-[380px] h-[520px] bg-[#0d1322] border border-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="p-3 px-4 bg-gradient-to-r from-blue-900/40 via-[#11192e] to-[#11192e] border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {viewingHistory ? (
                <button
                  onClick={() => setViewingHistory(false)}
                  className="p-1 rounded-lg bg-gray-800 text-gray-300 hover:text-white flex items-center space-x-1 text-xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
              ) : (
                <AgentAvatar
                  type={isHumanConnected ? (agentName ? 'male' : 'female') : 'ai'}
                  name={agentName || ''}
                  size="md"
                />
              )}
              <div>
                <h3 className="text-xs font-bold text-white">
                  {viewingHistory
                    ? 'Conversation History'
                    : isHumanConnected
                    ? (agentName || 'Support Agent')
                    : 'Teals AI Agent'}
                </h3>
                <div className="flex items-center space-x-1.5 text-[10px] text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>
                    {viewingHistory
                      ? 'Previous Chats Saved'
                      : isHumanConnected
                      ? 'Live Support Connected'
                      : 'Online & Ready to Help'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1.5">
              {hasSubmittedLead && !viewingHistory && (
                <>
                  <button
                    onClick={handleStartNewChat}
                    title="Start New Chat"
                    className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors flex items-center space-x-1 text-[10px]"
                  >
                    <PlusCircle className="w-4 h-4 text-blue-400" />
                    <span className="hidden sm:inline">New</span>
                  </button>
                  {savedConversations.length > 0 && (
                    <button
                      onClick={() => setViewingHistory(true)}
                      title="Previous Chats"
                      className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors flex items-center space-x-1 text-[10px]"
                    >
                      <History className="w-4 h-4 text-emerald-400" />
                      <span className="hidden sm:inline">History</span>
                    </button>
                  )}
                </>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Conversations Inbox View */}
          {viewingHistory ? (
            <div className="flex-1 bg-[#0a0f1c] text-white overflow-y-auto flex flex-col">
              {/* Start new chat card */}
              <div className="p-4 border-b border-gray-800 bg-[#11192e]">
                <button
                  onClick={handleStartNewChat}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-2.5">
                    <PlusCircle className="w-4 h-4 text-white group-hover:rotate-90 transition-transform" />
                    <span>Start a New Conversation</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-white/80 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              {/* Conversations List */}
              <div className="flex-1 p-3 space-y-2 overflow-y-auto">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Your Conversations</h4>
                {savedConversations.map((c, idx) => {
                  const isCurrent = c.id === conversationId;
                  return (
                    <div
                      key={c.id}
                      onClick={() => isCurrent ? setViewingHistory(false) : handleSelectOldChat(c.id)}
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
                          <span className="text-xs font-bold text-white">
                            {isCurrent ? 'Current Active Chat' : `Support Chat #${savedConversations.length - idx}`}
                          </span>
                          <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">{c.updatedAt}</span>
                        </div>
                        <div className="flex items-center space-x-1 mt-0.5">
                          {isCurrent && <MessageSquare className="w-3 h-3 text-blue-400 flex-shrink-0" />}
                          <p className="text-[11px] text-gray-300 truncate">{c.lastMessage || 'Conversation'}</p>
                        </div>
                      </div>

                      {/* Arrow */}
                      <ArrowRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                    </div>
                  );
                })}

                {savedConversations.length === 0 && (
                  <div className="text-center py-10 text-gray-500 text-xs">No previous conversations yet</div>
                )}
              </div>
            </div>
          ) : !hasSubmittedLead ? (
            /* Lead Form */
            <div className="flex-1 p-6 flex flex-col justify-center bg-[#0a0f1c] text-white">
              <div className="text-center mb-5">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-3 text-blue-400">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold">Welcome to Live Support</h4>
                <p className="text-[11px] text-gray-400 mt-1">Please enter your details to start chatting with our team</p>
              </div>

              <form onSubmit={handleLeadSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-medium text-gray-300 mb-1">Your Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      name="name"
                      id="lead-name"
                      autoComplete="name"
                      required
                      placeholder="e.g. Alex Johnson"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full bg-[#131b2e] border border-gray-700 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-300 mb-1">Your Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      name="email"
                      id="lead-email"
                      autoComplete="email"
                      required
                      placeholder="e.g. alex@company.com"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      className="w-full bg-[#131b2e] border border-gray-700 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg flex items-center justify-center space-x-2 mt-2"
                >
                  <span>Start Live Chat</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          ) : (
            <>
              {/* Chat Stream */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-[#0a0f1c]">
                {messages.map((m) => {
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
                          <span className="text-[10px] font-bold text-gray-400">
                            {m.sender_name || 'Agent'}
                          </span>
                        )}
                      </div>
                      <div
                        className={"max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-sm " + (isVisitor ? "bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-br-none" : "bg-[#131b2e] border border-gray-800 text-gray-100 rounded-bl-none")}
                      >
                        {m.content}
                        <div className={`flex items-center space-x-1 mt-1 ${isVisitor ? 'justify-end text-white/70' : 'justify-start text-gray-400'}`}>
                          <span className="text-[9px]">
                            {new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Agent Typing Indicator (Simple "Agent is typing..." with animated dots) */}
                {agentTypingText && (
                  <div className="flex items-center space-x-2 text-[11px] text-blue-400 bg-blue-950/50 border border-blue-900/40 rounded-xl px-3 py-2 animate-pulse">
                    <div className="flex space-x-1 items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce delay-100" />
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce delay-200" />
                    </div>
                    <span className="font-medium text-blue-300">{agentName || 'Live Support Agent'} is typing...</span>
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
              <form onSubmit={handleSend} className="p-2.5 border-t border-gray-800 bg-[#11192e] flex items-center space-x-2">
                <textarea
                  value={inputText}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
                  rows={1}
                  placeholder="Ask something about Teals CRM (Enter to send)..."
                  className="flex-1 bg-[#131b2e] border border-gray-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none overflow-y-auto max-h-28 leading-relaxed"
                  style={{ minHeight: '36px' }}
                />
                <button
                  type="submit"
                  disabled={loading || !inputText.trim()}
                  className="p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-all disabled:opacity-40 flex-shrink-0"
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
