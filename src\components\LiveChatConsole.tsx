'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Send,
  Lock, UserPlus, MapPin, Eye, ShieldAlert, Bot, Trash2,
  UserCheck, ArrowRightLeft, X
} from 'lucide-react';
import { AgentAvatar } from '@/components/AgentAvatar';
import { getCountryFlagUrl } from '@/lib/flags';
import { supabase } from '@/lib/supabase';
import { REALTIME_CHANNEL } from '@/lib/realtime';
import { ClaimChatModal } from '@/components/ClaimChatModal';
import { useLiveSync } from '@/context/LiveSyncContext';

export interface ChatSession {
  id: string;
  visitor_id: string;
  visitor_name: string;
  visitor_email?: string;
  visitor_ip?: string;
  assigned_agent_id?: string;
  assigned_agent_name?: string;
  assigned_agent_email?: string;
  assigned_at?: string;
  last_agent_reply_at?: string;
  last_visitor_message_at?: string;
  mode: 'ai' | 'human';
  status: 'active' | 'pending_agent' | 'resolved';
  typing_preview?: string;
  created_at?: string;
  updated_at: string;
  messages?: Array<{ id: string; sender_type: string; sender_name: string; content: string; is_whisper: boolean; seq?: number; status?: 'sent' | 'delivered' | 'read'; created_at: string }>;
  visitor?: {
    ip_address: string;
    city: string;
    country: string;
    country_code: string;
    flag: string;
    referrer: string;
    current_page: string;
    browser: string;
    os: string;
    device: string;
  };
}

interface LiveChatConsoleProps {
  currentAgent: {
    id: string;
    email: string;
    full_name: string;
    role: string;
  };
  selectedChatId: string | null;
  conversations: ChatSession[];
  onSelectChat: (id: string) => void;
  onClaimSuccess: () => void;
  onMarkRead?: (id: string) => void;
}

export const LiveChatConsole: React.FC<LiveChatConsoleProps> = ({
  currentAgent,
  selectedChatId,
  conversations,
  onSelectChat,
  onClaimSuccess,
  onMarkRead,
}) => {
  const [messages, setMessages] = useState<Array<{ id: string; conversation_id?: string; sender_type: string; sender_name: string; content: string; is_whisper: boolean; seq?: number; status?: 'sent' | 'delivered' | 'read'; created_at: string }>>([]);
  const [inputText, setInputText] = useState('');
  const [isWhisperMode, setIsWhisperMode] = useState(false);
  const [sending, setSending] = useState(false);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [liveTypingPreview, setLiveTypingPreview] = useState<string | null>(null);
  const [inboxTab, setInboxTab] = useState<'chat1' | 'chat2' | 'locked' | 'claimed'>('chat1');
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferAgentName, setTransferAgentName] = useState('');
  const [transferAgentEmail, setTransferAgentEmail] = useState('');
  const [transferTargetAgentId, setTransferTargetAgentId] = useState('');
  const [availableAgents, setAvailableAgents] = useState<Array<{ id: string; full_name: string; email: string; role: string; is_online?: boolean }>>([]);
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingPreviewEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const agentInputRef = useRef<HTMLTextAreaElement>(null);

  // ROLE-BASED VISIBILITY FILTERING
  const isAdmin = currentAgent.role === 'admin' || currentAgent.email === 'garryamelia6265@gmail.com';

  const { readConvMap, deleteConversation } = useLiveSync();

  // ROLE-BASED VISIBILITY: Admin sees everything; Regular agents only see handoff requests & their claimed chats
  const visibleConversations = conversations.filter((conv) => {
    if (isAdmin) return true;

    const isMine = !!(
      (conv.assigned_agent_id && (
        conv.assigned_agent_id === currentAgent.id ||
        conv.assigned_agent_id.toLowerCase() === (currentAgent.id || '').toLowerCase()
      )) ||
      (conv.assigned_agent_name && (
        conv.assigned_agent_name.toLowerCase().trim() === (currentAgent.full_name || '').toLowerCase().trim()
      )) ||
      (conv.assigned_agent_email && (
        conv.assigned_agent_email.toLowerCase().trim() === (currentAgent.email || '').toLowerCase().trim()
      ))
    );
    if (isMine) return true;

    // Unclaimed chats that requested a real human agent
    const isNeedsHuman = !conv.assigned_agent_id && !conv.assigned_agent_name && (conv.mode === 'human' || conv.status === 'pending_agent');
    return isNeedsHuman;
  });

  // Sort visible conversations so the one with the latest message is ALWAYS at the very top (WhatsApp style)
  const sortedVisibleConversations = [...visibleConversations].sort((a, b) => {
    const getLatestTime = (c: ChatSession) => {
      let maxTime = new Date(c.updated_at || c.created_at || 0).getTime();
      if (c.messages && c.messages.length > 0) {
        c.messages.forEach(m => {
          const t = new Date(m.created_at || 0).getTime();
          if (t > maxTime) maxTime = t;
        });
      }
      return maxTime;
    };
    return getLatestTime(b) - getLatestTime(a);
  });

  // Map to identify which chat number a conversation is when visitor has multiple
  const emailToConvs = new Map<string, ChatSession[]>();
  sortedVisibleConversations.forEach(c => {
    const key = (c.visitor_email || c.visitor_name || c.id).toLowerCase();
    if (!emailToConvs.has(key)) emailToConvs.set(key, []);
    emailToConvs.get(key)!.push(c);
  });

  const getChatNumber = (conv: ChatSession): 1 | 2 => {
    const key = (conv.visitor_email || conv.visitor_name || conv.id).toLowerCase();
    const group = emailToConvs.get(key) || [];
    if (group.length <= 1) return 1;
    const sortedChronological = [...group].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    const idx = sortedChronological.findIndex(c => c.id === conv.id);
    return idx === 0 ? 1 : 2;
  };

  const getChatBadge = (conv: ChatSession) => {
    const key = (conv.visitor_email || conv.visitor_name || conv.id).toLowerCase();
    const group = emailToConvs.get(key) || [];
    if (group.length <= 1) return null;
    return `Chat #${getChatNumber(conv)}`;
  };

  // 4 Core Categorized Lists as requested by User (All tab removed):
  // 1. Chat 1: Initial / first chats of visitors
  const chat1List = sortedVisibleConversations.filter(c => getChatNumber(c) === 1);
  // 2. Chat 2: Newly started 2nd chats of visitors
  const chat2List = sortedVisibleConversations.filter(c => getChatNumber(c) === 2);
  // 3. Locked: Visitors who requested human assistance, awaiting agent claim
  const lockedList = sortedVisibleConversations.filter(c => !c.assigned_agent_id && !c.assigned_agent_name && (c.mode === 'human' || c.status === 'pending_agent'));
  // 4. Claimed: Chats claimed by live agents
  const claimedList = sortedVisibleConversations.filter(c => !!(c.assigned_agent_id || c.assigned_agent_name));

  // Calculate unread count for each conversation
  const getUnreadCountForConv = (conv: ChatSession) => {
    // If this conversation is currently open on screen, it is seen!
    if (conv.id === selectedChatId) return 0;

    if (!conv.messages || conv.messages.length === 0) return 0;

    const visitorMsgs = conv.messages.filter(m => m.sender_type === 'visitor');
    if (visitorMsgs.length === 0) return 0;

    const lastVisitorMsg = visitorMsgs[visitorMsgs.length - 1];
    const readVal = readConvMap?.[conv.id];
    if (!readVal) return visitorMsgs.length;

    let savedId = readVal;
    if (readVal.includes('__')) {
      savedId = readVal.split('__')[0];
    }

    if (savedId === lastVisitorMsg.id || savedId === 'all') return 0;

    // Count visitor messages sent after the last seen visitor message
    const lastSeenIdx = visitorMsgs.findIndex(m => m.id === savedId);
    if (lastSeenIdx >= 0) {
      return visitorMsgs.length - (lastSeenIdx + 1);
    }
    return visitorMsgs.length;
  };

  // Tab unread notification counts (seen kro tu gayab)
  const chat1Unread = chat1List.reduce((sum, c) => sum + getUnreadCountForConv(c), 0);
  const chat2Unread = chat2List.reduce((sum, c) => sum + getUnreadCountForConv(c), 0);
  const lockedUnread = lockedList.reduce((sum, c) => sum + getUnreadCountForConv(c), 0);
  const claimedUnread = claimedList.reduce((sum, c) => sum + getUnreadCountForConv(c), 0);

  // Unseen locked chats count (wahan seen krey admin/agent tu gayab uskey pass sy)
  const unseenLockedCount = lockedList.filter(c => {
    if (c.id === selectedChatId) return false;
    const readVal = readConvMap?.[c.id];
    if (!readVal) return true; // Never opened/seen yet
    const visitorMsgs = (c.messages || []).filter(m => m.sender_type === 'visitor');
    if (visitorMsgs.length === 0) return false;
    const lastMsg = visitorMsgs[visitorMsgs.length - 1];
    let savedId = readVal;
    if (readVal.includes('__')) savedId = readVal.split('__')[0];
    return savedId !== lastMsg.id && savedId !== 'all';
  }).length;

  const handleDeleteChat = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this chat?')) return;
    if (selectedChatId === id) {
      onSelectChat('');
    }
    await deleteConversation(id);
  };

  // Manual selection only (no auto-select to preserve list browsing)
  // Search across full conversations list so selected conversation is NEVER dropped during filtering
  const selectedConv = selectedChatId ? (conversations.find((c) => c.id === selectedChatId) || null) : null;

  const isClaimedByMe = !!(
    (selectedConv?.assigned_agent_id && (
      selectedConv.assigned_agent_id === currentAgent.id ||
      selectedConv.assigned_agent_id.toLowerCase() === (currentAgent.id || '').toLowerCase()
    )) ||
    (selectedConv?.assigned_agent_name && (
      selectedConv.assigned_agent_name.toLowerCase().trim() === (currentAgent.full_name || '').toLowerCase().trim()
    )) ||
    (selectedConv?.assigned_agent_email && (
      selectedConv.assigned_agent_email.toLowerCase().trim() === (currentAgent.email || '').toLowerCase().trim()
    ))
  );
  const isClaimedByOther = !!(selectedConv?.assigned_agent_id || selectedConv?.assigned_agent_name) && !isClaimedByMe;
  const isNeedsClaim = !isClaimedByMe && !isClaimedByOther && (selectedConv?.mode === 'human' || selectedConv?.status === 'pending_agent');
  const isAiAutomated = !isClaimedByMe && !isClaimedByOther && selectedConv?.mode === 'ai' && selectedConv?.status !== 'pending_agent';

const sortTimelineMessages = <T extends { id?: string; seq?: number; created_at?: string; sender_type?: string; content?: string }>(msgs: T[]): T[] => {
  const map = new Map<string, T>();
  
  const hasClaimOrJoined = msgs.some(m => m && m.sender_type === 'system' && (
    m.content?.includes('has claimed and joined') ||
    m.content?.includes('transferred to Live Support Agent') ||
    m.content?.includes('taken over')
  ));

  msgs.forEach(m => {
    if (!m || !m.id) return;
    // If an agent has claimed/joined, omit temporary handoff messages
    if (hasClaimOrJoined && m.sender_type === 'system' && m.content?.includes('Transferring to a live support agent')) {
      return;
    }
    map.set(m.id, m);
  });

  // Deduplicate multiple claim/transfer system messages: keep only the newest one
  const claimMsgs = Array.from(map.values()).filter(m => m.sender_type === 'system' && (
    m.content?.includes('has claimed and joined') ||
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
        map.delete(sortedClaims[i].id!);
      }
    }
  }

  const list = Array.from(map.values());
  return list.sort((a, b) => {
    const isAiGreetA = a.id === 'init-greet' || (a.sender_type === 'ai' && a.seq === 1);
    const isAiGreetB = b.id === 'init-greet' || (b.sender_type === 'ai' && b.seq === 1);
    if (isAiGreetA && !isAiGreetB) return -1;
    if (!isAiGreetA && isAiGreetB) return 1;

    // Primary sort: sequence number
    const seqA = typeof a.seq === 'number' ? a.seq : null;
    const seqB = typeof b.seq === 'number' ? b.seq : null;
    if (seqA !== null && seqB !== null && seqA !== seqB) {
      return seqA - seqB;
    }

    // Secondary sort: timestamp
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    if (timeA !== timeB) {
      return timeA - timeB;
    }

    return (a.id || '').localeCompare(b.id || '');
  });
};

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef<boolean>(false);

  const handleChatScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    isUserScrolledUp.current = scrollHeight - scrollTop - clientHeight > 80;
  };

  // Real-Time Direct WebSocket Stream for Messages & Keystrokes
  useEffect(() => {
    const targetId = selectedConv?.id;
    if (!targetId || (isClaimedByOther && !isAdmin)) return;
    setClaimError(null);
    isUserScrolledUp.current = false;

    const channel = supabase.channel(REALTIME_CHANNEL, {
      config: { broadcast: { self: true } }
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'chat_message' }, (payload: unknown) => {
        const raw = (payload as Record<string, unknown>)?.payload || payload;
        const cId = (raw as Record<string, unknown>)?.conversationId;
        const message = (raw as Record<string, unknown>)?.message as { id: string; sender_type: string; sender_name: string; content: string; is_whisper: boolean; seq?: number; created_at: string };
        const systemMessage = (raw as Record<string, unknown>)?.systemMessage as { id: string; sender_type: string; sender_name: string; content: string; is_whisper: boolean; seq?: number; created_at: string };

        if (cId === targetId) {
          // Immediately dismiss sneak-peek preview once message is posted
          if (message?.sender_type === 'visitor') {
            setLiveTypingPreview(null);
            onMarkRead?.(targetId);
          }

          setMessages((prev) => {
            const map = new Map<string, any>();
            prev.forEach(m => {
              if (!(m as any).conversation_id || (m as any).conversation_id === targetId) {
                map.set(m.id, m);
              }
            });
            if (message) map.set(message.id, { ...message, conversation_id: targetId });
            if (systemMessage) map.set(systemMessage.id, { ...systemMessage, conversation_id: targetId });
            return sortTimelineMessages(Array.from(map.values()));
          });
        }
      })
      .on('broadcast', { event: 'chat_claimed' }, (payload: unknown) => {
        const raw = (payload as Record<string, unknown>)?.payload || payload;
        const cId = (raw as Record<string, unknown>)?.conversationId;
        const conv = (raw as Record<string, unknown>)?.conversation as { messages?: Array<{ id: string; sender_type: string; sender_name: string; content: string; is_whisper: boolean; seq?: number; created_at: string }> };

        if (cId === targetId && conv?.messages && Array.isArray(conv.messages)) {
          setMessages(sortTimelineMessages(conv.messages));
        }
      })
      .on('broadcast', { event: 'typing_event' }, (payload: unknown) => {
        const raw = (payload as Record<string, unknown>)?.payload || payload;
        const cId = (raw as Record<string, unknown>)?.conversationId;
        const typingText = (raw as Record<string, unknown>)?.typingText as string;
        const isTyping = (raw as Record<string, unknown>)?.isTyping as boolean;
        const senderType = (raw as Record<string, unknown>)?.senderType as string;

        if (cId === targetId && senderType === 'visitor') {
          if (isTyping && typingText && typingText.trim().length > 0) {
            setLiveTypingPreview(typingText);
          } else {
            setLiveTypingPreview(null);
          }
        }
      })
      .on('broadcast', { event: 'chat_read' }, (payload: unknown) => {
        const raw = (payload as Record<string, unknown>)?.payload || payload;
        const cId = (raw as Record<string, unknown>)?.conversationId as string;
        const readerType = (raw as Record<string, unknown>)?.readerType as string;

        if (cId === targetId && readerType === 'visitor') {
          setMessages((prev) => prev.map(m => (m.sender_type === 'agent' || m.sender_type === 'ai') ? { ...m, status: 'read' as const } : m));
        }
      })
      .on('broadcast', { event: 'stats_reset' }, () => {
        setMessages([]);
        setLiveTypingPreview(null);
      })
      .on('broadcast', { event: 'system_reset' }, () => {
        setMessages([]);
        setLiveTypingPreview(null);
      })
      .subscribe();

    if (targetId) {
      onMarkRead?.(targetId);
    }

    // Scoped message load strictly for targetId (never wipe optimistic or newer messages)
    const fetchMsgs = async () => {
      try {
        const res = await fetch(`/api/chat/message?conversationId=${targetId}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.messages)) {
            setMessages(prev => {
              if (prev.length === data.messages.length) {
                const isIdentical = prev.every((m, idx) => m.id === data.messages[idx]?.id && m.status === data.messages[idx]?.status);
                if (isIdentical) return prev;
              }
              const map = new Map<string, any>();
              prev.forEach(m => {
                if (!m.conversation_id || m.conversation_id === targetId) {
                  map.set(m.id, m);
                }
              });
              data.messages.forEach((m: any) => map.set(m.id, m));
              return sortTimelineMessages(Array.from(map.values()));
            });
          }
        }
      } catch {}
    };

    fetchMsgs();
    const interval = setInterval(fetchMsgs, 1500);

    return () => {
      clearInterval(interval);
      channelRef.current = null;
    };
  }, [selectedConv?.id, isClaimedByOther, isAdmin, onMarkRead]);

  // Reset selected chat only if conversations become completely empty
  useEffect(() => {
    if (conversations.length === 0 && selectedChatId) {
      onSelectChat('');
      setMessages([]);
    }
  }, [conversations.length, selectedChatId]);

  const prevConvIdRef = useRef<string | null>(null);

  // Synchronize messages immediately when selectedConv updates in parent conversations list
  useEffect(() => {
    if (!selectedConv?.id) {
      if (prevConvIdRef.current !== null) {
        setMessages([]);
        setLiveTypingPreview(null);
      }
      return;
    }

    onMarkRead?.(selectedConv.id);

    const isNewConv = prevConvIdRef.current !== selectedConv.id;
    prevConvIdRef.current = selectedConv.id;

    if (isNewConv) {
      setMessages(sortTimelineMessages(selectedConv.messages || []));
    } else {
      setMessages(prev => {
        const map = new Map<string, any>();
        prev.forEach(m => {
          if (!m.conversation_id || m.conversation_id === selectedConv.id) {
            map.set(m.id, m);
          }
        });
        (selectedConv.messages || []).forEach(m => map.set(m.id, m));
        return sortTimelineMessages(Array.from(map.values()));
      });
    }

    const last = selectedConv.messages?.[selectedConv.messages.length - 1];
    if (last && last.sender_type === 'visitor') {
      setLiveTypingPreview(null);
    }
  }, [selectedConv?.id, selectedConv?.messages?.length, selectedConv?.updated_at, onMarkRead]);

  useEffect(() => {
    // Only auto-scroll if user is near the bottom
    if (!isUserScrolledUp.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (liveTypingPreview && !isUserScrolledUp.current) {
      typingPreviewEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [liveTypingPreview]);

  const [claiming, setClaiming] = useState(false);

  const handleDirectClaim = async () => {
    if (!selectedConv?.id || claiming) return;
    setClaiming(true);
    setClaimError(null);

    const agentId = currentAgent.id || `agent_${(currentAgent.email || 'agent').replace(/[^a-zA-Z0-9]/g, '_')}`;
    const agentName = currentAgent.full_name || currentAgent.email?.split('@')[0] || 'Support Agent';
    const agentEmail = currentAgent.email || 'agent@teals.ai';

    try {
      const res = await fetch('/api/agent/claim-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConv.id,
          agentId,
          agentName,
          agentEmail,
          force: true
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setClaimError(data.error || 'Failed to claim chat.');
      } else {
        if (data.conversation?.messages) {
          setMessages(sortTimelineMessages(data.conversation.messages));
        }
        onClaimSuccess();
      }
    } catch {
      setClaimError('Network error while claiming chat.');
    } finally {
      setClaiming(false);
      setClaimModalOpen(false);
    }
  };

  const handleAgentInputChange = (val: string, el?: HTMLTextAreaElement | null) => {
    setInputText(val);

    const textarea = el || agentInputRef.current;
    if (textarea) {
      textarea.style.height = '0px';
      const scrollH = textarea.scrollHeight;
      textarea.style.height = `${Math.min(Math.max(scrollH, 38), 130)}px`;
    }

    if (!selectedConv?.id || (!isClaimedByMe && !isAdmin)) return;

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    // Direct WebSocket broadcast (sub-5ms)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'typing_event',
      payload: {
        conversationId: selectedConv.id,
        typingText: val,
        isTyping: val.trim().length > 0,
        senderType: 'agent',
        senderName: currentAgent.full_name
      }
    });

    typingTimerRef.current = setTimeout(() => {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'typing_event',
        payload: {
          conversationId: selectedConv.id,
          typingText: '',
          isTyping: false,
          senderType: 'agent'
        }
      });
    }, 2000);
  };

  const handleConfirmClaim = async (agentName: string, agentEmail: string) => {
    if (!selectedConv?.id || claiming) return;
    setClaiming(true);
    setClaimError(null);

    const agentId = currentAgent.id || `agent_${(agentEmail || agentName).replace(/[^a-zA-Z0-9]/g, '_')}`;
    const maxSeq = messages.reduce((max, m) => Math.max(max, m.seq || 0), 0);
    const claimMsgId = 'msg_sys_claim_' + selectedConv.id;
    const nowIso = new Date(Date.now() + 50).toISOString();
    const sysMsg = {
      id: claimMsgId,
      conversation_id: selectedConv.id,
      sender_type: 'system' as const,
      sender_name: 'System',
      content: `Live Support Agent ${agentName} has claimed and joined the conversation.`,
      is_whisper: false,
      seq: maxSeq + 1,
      created_at: nowIso
    };

    const isSystemClaimOrHandoff = (m: any) =>
      m.sender_type === 'system' && (
        m.content?.includes('has claimed and joined') ||
        m.content?.includes('transferred to Live Support Agent') ||
        m.content?.includes('Transferring to a live support agent') ||
        m.content?.includes('taken over')
      );

    const updatedConv = {
      ...selectedConv,
      mode: 'human' as const,
      status: 'active' as const,
      assigned_agent_id: agentId,
      assigned_agent_name: agentName,
      assigned_agent_email: agentEmail,
      messages: sortTimelineMessages([...messages.filter(m => !isSystemClaimOrHandoff(m)), sysMsg])
    };

    // Immediate WebSocket broadcast to Visitor Widget and all Dashboards (sub-5ms)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'chat_claimed',
      payload: {
        conversationId: selectedConv.id,
        agentId,
        agentName,
        conversation: updatedConv
      }
    });

    setMessages((prev) => sortTimelineMessages([...prev.filter(m => !isSystemClaimOrHandoff(m)), sysMsg]));

    try {
      const res = await fetch('/api/agent/claim-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConv.id,
          agentId,
          agentName,
          agentEmail,
          force: true
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setClaimError(data.error || 'Failed to claim chat.');
      } else {
        if (data.conversation?.messages) {
          setMessages(sortTimelineMessages(data.conversation.messages));
        }
        onClaimSuccess();

        // Automatically redirect to the claimed chat's section (Chat 1 or Chat 2) and focus input
        const targetTab = getChatNumber(selectedConv) === 2 ? 'chat2' : 'chat1';
        setInboxTab(targetTab);
        setTimeout(() => {
          agentInputRef.current?.focus();
        }, 100);
      }
    } catch {
      setClaimError('Network error while claiming chat.');
    } finally {
      setClaiming(false);
      setClaimModalOpen(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedConv?.id || sending) return;
    if (!isClaimedByMe && !isAdmin) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);
    if (agentInputRef.current) {
      agentInputRef.current.style.height = '38px';
      agentInputRef.current.focus();
    }

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    // Instantly clear agent typing on visitor widget
    channelRef.current?.send({
      type: 'broadcast',
      event: 'typing_event',
      payload: {
        conversationId: selectedConv.id,
        typingText: '',
        isTyping: false,
        senderType: 'agent'
      }
    });

    const maxSeq = messages.reduce((max, m) => Math.max(max, m.seq || 0), 0);
    const clientMsgId = 'msg_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);

    const optimisticMsg = {
      id: clientMsgId,
      conversation_id: selectedConv.id,
      sender_type: 'agent',
      sender_name: currentAgent.full_name,
      content: text,
      is_whisper: isWhisperMode,
      seq: maxSeq + 1,
      created_at: new Date().toISOString()
    };

    setMessages((prev) => sortTimelineMessages([...prev, optimisticMsg]));

    try {
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: clientMsgId,
          conversationId: selectedConv.id,
          senderType: 'agent',
          senderName: currentAgent.full_name,
          content: text,
          isWhisper: isWhisperMode
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setMessages((prev) => sortTimelineMessages([...prev.filter(m => m.id !== clientMsgId), data.message]));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
      setTimeout(() => {
        agentInputRef.current?.focus();
      }, 10);
    }
  };

  // Open transfer modal & prefetch approved agents
  const openTransferModal = async () => {
    setTransferModalOpen(true);
    setTransferError(null);
    setTransferAgentName('');
    setTransferAgentEmail('');
    setTransferTargetAgentId('');
    try {
      const res = await fetch('/api/agent/approvals');
      if (res.ok) {
        const data = await res.json();
        const approved = Array.isArray(data.approvedAgents) ? data.approvedAgents : [];
        setAvailableAgents(approved);
      }
    } catch {}
  };

  // Transfer chat to another agent / admin
  const handleTransferChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConv?.id || !transferAgentName.trim()) return;

    setTransferring(true);
    setTransferError(null);
    try {
      const res = await fetch('/api/agent/claim-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConv.id,
          agentId: transferTargetAgentId || undefined,
          agentName: transferAgentName.trim(),
          agentEmail: transferAgentEmail.trim() || undefined,
          force: true
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTransferModalOpen(false);
        setTransferAgentName('');
        setTransferAgentEmail('');
        setTransferTargetAgentId('');
        onClaimSuccess?.();
      } else {
        setTransferError(data.error || 'Failed to transfer chat.');
      }
    } catch {
      setTransferError('Network error while transferring chat.');
    } finally {
      setTransferring(false);
    }
  };

  const renderConvItem = (conv: ChatSession) => {
    const isSelected = conv.id === selectedConv?.id;
    const isConvMine = !!(
      (conv.assigned_agent_id && (
        conv.assigned_agent_id === currentAgent.id ||
        conv.assigned_agent_id.toLowerCase() === (currentAgent.id || '').toLowerCase()
      )) ||
      (conv.assigned_agent_name && (
        conv.assigned_agent_name.toLowerCase().trim() === (currentAgent.full_name || '').toLowerCase().trim()
      )) ||
      (conv.assigned_agent_email && (
        conv.assigned_agent_email.toLowerCase().trim() === (currentAgent.email || '').toLowerCase().trim()
      ))
    );
    const isConvClaimedOther = !!(conv.assigned_agent_id || conv.assigned_agent_name) && !isConvMine;
    const isConvNeedsClaim = !isConvMine && !isConvClaimedOther && (conv.mode === 'human' || conv.status === 'pending_agent');

    const flagSrc = getCountryFlagUrl(conv.visitor?.country_code || 'PK');
    const lastMsg = conv.messages && conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null;
    const unreadCount = getUnreadCountForConv(conv);
    const isTyping = !!(conv.typing_preview && conv.typing_preview.trim().length > 0);
    const chatBadge = getChatBadge(conv);

    return (
      <div
        key={conv.id}
        onClick={() => {
          onSelectChat(conv.id);
          onMarkRead?.(conv.id);
        }}
        className={`p-3.5 cursor-pointer transition-all hover:bg-[#131d33] group relative ${
          isSelected ? 'bg-[#152038] border-l-4 border-brand-primary' : 'bg-transparent'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2.5 min-w-0 flex-1 mr-2">
            <img
              src={flagSrc}
              alt="Flag"
              className="w-5 h-3.5 object-cover rounded shadow-sm flex-shrink-0"
              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
            />
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-white flex items-center space-x-1.5 truncate">
                <span className="truncate">{conv.visitor_name}</span>
                {chatBadge && (
                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/40 flex-shrink-0">
                    {chatBadge}
                  </span>
                )}
                {conv.visitor_email && (
                  <span className="text-[10px] font-normal text-dark-muted truncate">({conv.visitor_email})</span>
                )}
              </h4>
              <p className="text-[11px] text-dark-muted truncate max-w-[170px] mt-0.5">
                {isTyping ? (
                  <span className="text-brand-emerald italic font-medium">typing...</span>
                ) : lastMsg ? (
                  lastMsg.sender_type === 'agent' ? (
                    <span><span className="text-gray-400">You: </span>{lastMsg.content}</span>
                  ) : (
                    <span className={unreadCount > 0 ? 'text-white font-semibold' : 'text-dark-muted'}>{lastMsg.content}</span>
                  )
                ) : (
                  conv.visitor?.current_page || '/'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 flex-shrink-0 ml-1">
            {unreadCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1.5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg shadow-rose-500/40 animate-pulse flex-shrink-0">
                {unreadCount}
              </span>
            )}

            {isConvMine ? (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-brand-emerald/15 text-brand-emerald border border-brand-emerald/30 flex items-center space-x-1">
                <Lock className="w-2.5 h-2.5" />
                <span>Claimed (You)</span>
              </span>
            ) : isConvClaimedOther ? (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-brand-amber/15 text-brand-amber border border-brand-amber/30 flex items-center space-x-1">
                <Lock className="w-2.5 h-2.5" />
                <span>{conv.assigned_agent_name || 'Claimed'}</span>
              </span>
            ) : isConvNeedsClaim ? (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-brand-rose/15 text-brand-rose border border-brand-rose/30 animate-pulse flex items-center space-x-1">
                <Lock className="w-2.5 h-2.5" />
                <span>LOCKED</span>
              </span>
            ) : (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center space-x-1">
                <Bot className="w-2.5 h-2.5" />
                <span>AI Active</span>
              </span>
            )}

            {(isAdmin || isConvMine) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteChat(conv.id);
                }}
                title="Delete Chat"
                className="p-1 rounded-lg text-dark-muted hover:text-rose-400 hover:bg-rose-500/15 transition-all opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[650px] bg-dark-card border border-dark-border rounded-2xl overflow-hidden shadow-2xl">
        {/* Column 1: Conversations Inbox List */}
        <div className="lg:col-span-4 border-r border-dark-border flex flex-col bg-[#0b101d]">
          <div className="p-3.5 border-b border-dark-border flex items-center justify-between bg-[#0e1526]">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-brand-primary" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Inbox ({visibleConversations.length})
              </h3>
            </div>
            <span className="text-[10px] text-brand-emerald font-bold">
              {isAdmin ? 'Admin View (All Chats)' : 'Agent View'}
            </span>
          </div>

          {/* Tabs Grid: 4 tabs for Admin, 3 tabs for Regular Agent */}
          <div className={`grid ${isAdmin ? 'grid-cols-4' : 'grid-cols-3'} gap-1 p-1.5 bg-[#080d1a] border-b border-dark-border`}>
            {/* 1. Chat 1 (Old) Tab */}
            <button
              type="button"
              onClick={() => setInboxTab('chat1')}
              className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1 ${
                inboxTab === 'chat1'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-dark-muted hover:text-white hover:bg-dark-surface'
              }`}
            >
              <span className="text-[11px] truncate">Chat 1 (Old)</span>
              {chat1Unread > 0 ? (
                <span className="min-w-[17px] h-[17px] px-1 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse shadow-sm shadow-rose-500/50">
                  {chat1Unread}
                </span>
              ) : (
                <span className="text-[10px] px-1 rounded-full bg-white/10 text-gray-400">
                  {chat1List.length}
                </span>
              )}
            </button>

            {/* 2. Chat 2 (New) Tab */}
            <button
              type="button"
              onClick={() => setInboxTab('chat2')}
              className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1 ${
                inboxTab === 'chat2'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-dark-muted hover:text-white hover:bg-dark-surface'
              }`}
            >
              <span className="text-[11px] truncate">Chat 2 (New)</span>
              {chat2Unread > 0 ? (
                <span className="min-w-[17px] h-[17px] px-1 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse shadow-sm shadow-rose-500/50">
                  {chat2Unread}
                </span>
              ) : (
                <span className="text-[10px] px-1 rounded-full bg-white/10 text-gray-400">
                  {chat2List.length}
                </span>
              )}
            </button>

            {/* 3. Locked Tab */}
            <button
              type="button"
              onClick={() => setInboxTab('locked')}
              className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1 ${
                inboxTab === 'locked'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-dark-muted hover:text-white hover:bg-dark-surface'
              }`}
            >
              <Lock className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <span className="text-[11px] truncate">Locked</span>
              {unseenLockedCount > 0 ? (
                <span className="min-w-[17px] h-[17px] px-1 bg-amber-500 text-dark-bg text-[9px] font-black rounded-full flex items-center justify-center animate-pulse shadow-sm shadow-amber-500/50">
                  {unseenLockedCount}
                </span>
              ) : (
                <span className="text-[10px] px-1 rounded-full bg-white/10 text-gray-400">
                  {lockedList.length}
                </span>
              )}
            </button>

            {/* 4. Claimed Tab (Admin Only) */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setInboxTab('claimed')}
                className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1 ${
                  inboxTab === 'claimed'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-dark-muted hover:text-white hover:bg-dark-surface'
                }`}
              >
                <UserCheck className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                <span className="text-[11px] truncate">Claimed</span>
                {claimedUnread > 0 ? (
                  <span className="min-w-[17px] h-[17px] px-1 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse shadow-sm shadow-rose-500/50">
                    {claimedUnread}
                  </span>
                ) : (
                  <span className="text-[10px] px-1 rounded-full bg-white/10 text-gray-400">
                    {claimedList.length}
                  </span>
                )}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-dark-border/40">
            {/* 1. Chat 1 List */}
            {inboxTab === 'chat1' && (
              chat1List.length === 0 ? (
                <div className="p-8 text-center text-xs text-dark-muted space-y-2">
                  <AgentAvatar type="ai" size="md" className="mx-auto" />
                  <p className="font-semibold text-white">No Chat 1 conversations</p>
                  <p className="text-[11px] leading-relaxed">
                    Initial conversations from visitors will appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-dark-border/30">
                  {chat1List.map(renderConvItem)}
                </div>
              )
            )}

            {/* 2. Chat 2 List */}
            {inboxTab === 'chat2' && (
              chat2List.length === 0 ? (
                <div className="p-8 text-center text-xs text-dark-muted space-y-2">
                  <AgentAvatar type="ai" size="md" className="mx-auto" />
                  <p className="font-semibold text-white">No Chat 2 conversations</p>
                  <p className="text-[11px] leading-relaxed">
                    When visitors click &quot;Start a New Conversation&quot;, their 2nd chat will appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-dark-border/30">
                  {chat2List.map(renderConvItem)}
                </div>
              )
            )}

            {/* 3. Locked List (Awaiting Human Agent Claim) */}
            {inboxTab === 'locked' && (
              lockedList.length === 0 ? (
                <div className="p-8 text-center text-xs text-dark-muted space-y-2">
                  <Lock className="w-8 h-8 text-dark-muted mx-auto opacity-50" />
                  <p className="font-semibold text-white">No locked chats</p>
                  <p className="text-[11px] leading-relaxed">
                    Chats where visitors ask for a real human agent will lock and appear here for claim.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-dark-border/30">
                  {lockedList.map(renderConvItem)}
                </div>
              )
            )}

            {/* 4. Claimed List */}
            {inboxTab === 'claimed' && (
              claimedList.length === 0 ? (
                <div className="p-8 text-center text-xs text-dark-muted space-y-2">
                  <UserCheck className="w-8 h-8 text-dark-muted mx-auto opacity-50" />
                  <p className="font-semibold text-white">No claimed chats</p>
                  <p className="text-[11px] leading-relaxed">
                    Chats claimed by live support agents will appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-dark-border/30">
                  {claimedList.map(renderConvItem)}
                </div>
              )
            )}
          </div>
        </div>

        {/* Column 2: Live Chat Messaging Stream */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-dark-bg/40 relative min-h-0 h-full overflow-hidden">
          {selectedConv ? (
            <>
              {/* Header */}
              <div className="p-3.5 border-b border-dark-border bg-dark-surface/60 flex items-center justify-between">
                <button
                  onClick={() => onSelectChat('')}
                  title="Back to List"
                  className="mr-2 p-1.5 rounded-lg bg-dark-card hover:bg-dark-cardHover border border-dark-border text-dark-muted hover:text-white text-xs font-semibold flex items-center space-x-1"
                >
                  <span>← Back</span>
                </button>
                <div className="flex items-center space-x-3">
                  <AgentAvatar
                    type={selectedConv.assigned_agent_id ? 'male' : 'ai'}
                    name={selectedConv.assigned_agent_name || ''}
                    size="md"
                  />
                  <div>
                    <h3 className="text-xs font-bold text-white">
                      {selectedConv.assigned_agent_name
                        ? selectedConv.assigned_agent_name
                        : isAiAutomated
                        ? 'Teals AI Auto-Support'
                        : 'Unassigned Chat'}
                    </h3>
                    <p className="text-[10px] text-dark-muted">
                      {isClaimedByMe
                        ? 'You are actively assisting this customer'
                        : isClaimedByOther
                        ? `Assigned to ${selectedConv.assigned_agent_name}`
                        : isAiAutomated
                        ? 'AI is handling conversation — Admin monitoring'
                        : 'Customer requested human assistance — claim to take over'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {isNeedsClaim ? (
                    <button
                      onClick={() => setClaimModalOpen(true)}
                      disabled={claiming}
                      className="px-3.5 py-1.5 rounded-xl bg-brand-rose hover:bg-rose-600 text-white text-xs font-bold shadow-lg transition-all flex items-center space-x-1.5 animate-bounce disabled:opacity-50 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{claiming ? 'Claiming...' : 'Claim Chat'}</span>
                    </button>
                  ) : isAiAutomated ? (
                    isAdmin ? (
                      <span className="px-3 py-1 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30 text-xs font-bold flex items-center space-x-1.5">
                        <Bot className="w-3.5 h-3.5" />
                        <span>AI Active</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => setClaimModalOpen(true)}
                        disabled={claiming}
                        className="px-3 py-1 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-bold transition-all flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{claiming ? 'Claiming...' : 'Take Over'}</span>
                      </button>
                    )
                  ) : isClaimedByMe ? (
                    <span className="px-3 py-1 rounded-xl bg-brand-emerald/15 text-brand-emerald border border-brand-emerald/30 text-xs font-bold flex items-center space-x-1">
                      <Lock className="w-3 h-3" />
                      <span>Claimed (You)</span>
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-xl bg-brand-amber/15 text-brand-amber border border-brand-amber/30 text-xs font-bold flex items-center space-x-1">
                      <Lock className="w-3 h-3" />
                      <span>{selectedConv.assigned_agent_name}</span>
                    </span>
                  )}

                  {(isClaimedByMe || isAdmin) && (selectedConv.assigned_agent_name || selectedConv.mode === 'human') && (
                    <button
                      onClick={openTransferModal}
                      title="Transfer Conversation to Another Agent / Admin"
                      className="px-2.5 py-1 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                      <span>Transfer</span>
                    </button>
                  )}

                  {(isAdmin || isClaimedByMe) && (
                    <button
                      onClick={() => handleDeleteChat(selectedConv.id)}
                      title="Delete Conversation"
                      className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold flex items-center space-x-1 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Delete</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Claim Error Notice */}
              {claimError && (
                <div className="p-2.5 bg-brand-rose/20 border-b border-brand-rose/40 text-brand-rose text-xs flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{claimError}</span>
                </div>
              )}

              {/* Message Stream with Optional Blurred Claim Overlay */}
              <div className="relative flex-1 min-h-0 flex flex-col">
                <div
                  ref={chatContainerRef}
                  onScroll={handleChatScroll}
                  className={`flex-1 min-h-0 overflow-y-auto p-4 space-y-3 transition-all duration-300 ${
                    isNeedsClaim && !isAdmin ? 'filter blur-sm select-none pointer-events-none' : ''
                  }`}
                >
                  {messages.map((m) => {
                    const isVisitor = m.sender_type === 'visitor';
                    const isSystem = m.sender_type === 'system';
                    const isAi = m.sender_type === 'ai';
                    const isWhisper = m.is_whisper;

                    if (isSystem) {
                      return (
                        <div key={m.id} className="text-center my-2">
                          <span className="text-[10px] px-3 py-1 rounded-full bg-dark-surface border border-dark-border text-dark-muted font-medium">
                            {m.content}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isVisitor ? 'items-start' : 'items-end'}`}
                      >
                        <div className="flex items-center space-x-1.5 mb-1 px-1">
                          <span className="text-[10px] font-semibold text-dark-muted">
                            {isVisitor ? selectedConv.visitor_name : m.sender_name}
                          </span>
                          <span className="text-[9px] text-dark-muted">
                            {new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div
                          className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                            isWhisper
                              ? 'bg-brand-amber/15 text-brand-amber border border-brand-amber/30 italic'
                              : isVisitor
                              ? 'bg-brand-rose text-white rounded-bl-sm shadow-md'
                              : isAi
                              ? 'bg-blue-900/60 text-blue-100 border border-blue-700/50 rounded-br-sm'
                              : 'bg-blue-600 text-white rounded-br-sm shadow-md'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Centered Claim Card with Blur Overlay */}
                {isNeedsClaim && !isAdmin && (
                  <div className="absolute inset-0 z-20 backdrop-blur-md bg-[#0a0f1d]/75 flex flex-col items-center justify-center p-6 text-center space-y-4 animate-in fade-in duration-200">
                    <div className="w-16 h-16 rounded-3xl bg-brand-rose/15 border border-brand-rose/30 flex items-center justify-center text-brand-rose animate-pulse shadow-2xl shadow-brand-rose/25">
                      <Lock className="w-8 h-8" />
                    </div>
                    <div className="space-y-1.5 max-w-sm">
                      <h3 className="text-base font-bold text-white tracking-tight">Human Support Requested</h3>
                      <p className="text-xs text-dark-muted leading-relaxed">
                        {selectedConv.visitor_name || 'Customer'} requested to speak with a real person. Claim this conversation to verify your details and start chatting.
                      </p>
                    </div>
                    <button
                      onClick={() => setClaimModalOpen(true)}
                      disabled={claiming}
                      className="px-8 py-3 rounded-2xl bg-brand-rose hover:bg-rose-600 text-white text-xs font-bold shadow-xl shadow-brand-rose/30 transition-all flex items-center space-x-2 cursor-pointer transform hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>{claiming ? 'Claiming Chat...' : 'Claim Chat Now'}</span>
                    </button>
                  </div>
                )}
              </div>

                  {/* Real-time Ghost Keystroke Preview Bar with Auto-Wrap & Scroll */}
                  {liveTypingPreview && (isClaimedByMe || isAdmin || isAiAutomated) && !isClaimedByOther && (
                    <div className="px-4 py-2 bg-blue-950/60 border-t border-blue-900/50 flex items-start space-x-2 text-[11px] text-blue-300">
                      <Eye className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5 animate-pulse" />
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-blue-300 block mb-0.5">{selectedConv.visitor_name} is typing (Live Preview):</span>
                        <div className="max-h-24 overflow-y-auto whitespace-pre-wrap break-words text-white italic font-sans bg-blue-900/20 px-2.5 py-1.5 rounded-lg border border-blue-800/40 w-full text-xs">
                          {liveTypingPreview}
                          <div ref={typingPreviewEndRef} />
                        </div>
                      </div>
                    </div>
                  )}

                  {isClaimedByOther && !isAdmin && (
                    <div className="px-4 py-2 bg-brand-amber/10 border-t border-brand-amber/20 text-center text-xs text-brand-amber font-medium">
                      This conversation is handled by {selectedConv.assigned_agent_name} (Read-only)
                    </div>
                  )}

                  {/* Reply Form */}
                  <form onSubmit={handleSendMessage} className="p-3 border-t border-dark-border bg-dark-surface/60 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <button
                        type="button"
                        onClick={() => setIsWhisperMode(!isWhisperMode)}
                        disabled={!isClaimedByMe && !isAdmin}
                        className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                          isWhisperMode
                            ? 'bg-brand-amber text-dark-bg'
                            : 'bg-dark-card text-dark-muted hover:text-white border border-dark-border'
                        }`}
                      >
                        {isWhisperMode ? 'Whisper (Private)' : 'Public Reply'}
                      </button>
                    </div>

                    <div className="flex items-end space-x-2">
                      <textarea
                        ref={agentInputRef}
                        value={inputText}
                        onChange={(e) => handleAgentInputChange(e.target.value, e.currentTarget)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage(e);
                            agentInputRef.current?.focus();
                          }
                        }}
                        rows={1}
                        disabled={!isClaimedByMe && !isAdmin}
                        placeholder={
                          isClaimedByMe || isAdmin
                            ? 'Type reply as support agent (Enter to send)...'
                            : isAiAutomated
                            ? 'AI is active. Claim chat to reply directly...'
                            : 'Claim this chat to reply...'
                        }
                        className="flex-1 bg-dark-card border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-dark-muted focus:outline-none focus:border-brand-primary disabled:opacity-40 resize-none overflow-y-auto whitespace-pre-wrap break-words leading-relaxed transition-[height] duration-75"
                        style={{ minHeight: '38px', maxHeight: '130px' }}
                      />
                      <button
                        type="submit"
                        disabled={(!isClaimedByMe && !isAdmin) || sending || !inputText.trim()}
                        className="p-2.5 rounded-xl bg-brand-primary text-white hover:bg-brand-primaryHover transition-all disabled:opacity-40 flex-shrink-0 mb-0.5 shadow-md"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-dark-muted text-xs space-y-2">
              <MessageSquare className="w-8 h-8 text-dark-border" />
              <p className="font-semibold text-white">Select a conversation from the left</p>
            </div>
          )}
        </div>

        {/* Column 3: Visitor Session Details */}
        <div className="lg:col-span-3 border-l border-dark-border p-4 bg-[#0b101d] flex flex-col justify-between overflow-y-auto">
          {selectedConv && (!isClaimedByOther || isAdmin) ? (
            <div className="space-y-5">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
                  Session Information
                </h3>
                <div className="bg-dark-card border border-dark-border rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center space-x-2.5">
                    <img
                      src={getCountryFlagUrl(selectedConv.visitor?.country_code || 'pk')}
                      alt="Flag"
                      className="w-6 h-4 object-cover rounded shadow-sm"
                    />
                    <div>
                      <div className="text-xs font-bold text-white flex items-center space-x-1">
                        <span>{selectedConv.visitor?.city || 'Karachi'}, {selectedConv.visitor?.country || 'Pakistan'}</span>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((selectedConv.visitor?.city || 'Karachi') + ', ' + (selectedConv.visitor?.country || 'Pakistan'))}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-secondary hover:text-white"
                        >
                          <MapPin className="w-3 h-3 inline" />
                        </a>
                      </div>
                      <div className="text-[10px] text-dark-muted font-mono">{selectedConv.visitor?.ip_address || selectedConv.visitor_ip || 'Live Online'}</div>
                    </div>
                  </div>
                  {selectedConv.visitor_email && (
                    <div className="pt-1.5 border-t border-dark-border/60 text-[10px] text-dark-muted">
                      <span>Email: </span>
                      <span className="text-white font-medium">{selectedConv.visitor_email}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-[11px] font-bold text-dark-muted uppercase mb-2">Navigation</h4>
                <div className="bg-dark-card border border-dark-border rounded-xl p-3 space-y-2 text-xs">
                  <div>
                    <span className="text-dark-muted text-[10px]">Active CRM Page:</span>
                    <p className="font-mono text-brand-secondary text-[11px] truncate">{selectedConv.visitor?.current_page || '/crm'}</p>
                  </div>
                  <div>
                    <span className="text-dark-muted text-[10px]">Referrer:</span>
                    <p className="font-mono text-white text-[11px] truncate">{selectedConv.visitor?.referrer || 'Direct Visit'}</p>
                  </div>
                  <div>
                    <span className="text-dark-muted text-[10px]">Device:</span>
                    <p className="text-dark-text text-[11px]">{selectedConv.visitor?.os || 'Mobile / Desktop'} on {selectedConv.visitor?.browser || 'Chrome'}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-xs text-dark-muted py-8">
              {isClaimedByOther && !isAdmin ? 'Details hidden for another agent’s chat' : 'No visitor details selected'}
            </div>
          )}
        </div>
      </div>

      <ClaimChatModal
        isOpen={claimModalOpen}
        onClose={() => setClaimModalOpen(false)}
        onConfirm={handleConfirmClaim}
        defaultName={currentAgent.full_name}
        defaultEmail={currentAgent.email}
        visitorName={selectedConv?.visitor_name || 'Visitor'}
      />

      {/* Transfer Chat Modal */}
      {transferModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0f172a] border border-dark-border rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-dark-border/60 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Transfer Conversation</h3>
                  <p className="text-[11px] text-dark-muted">
                    Reassign {selectedConv?.visitor_name || 'Visitor'} to another agent or admin
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTransferModalOpen(false)}
                className="text-dark-muted hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {transferError && (
              <div className="p-2.5 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
                {transferError}
              </div>
            )}

            <form onSubmit={handleTransferChat} className="space-y-3.5">
              {availableAgents.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-300">
                    Select Team Member
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-[#131d33]/80 rounded-xl border border-dark-border/60">
                    {availableAgents.map(ag => {
                      const isSelected = transferAgentName === ag.full_name || (transferTargetAgentId && transferTargetAgentId === ag.id);
                      return (
                        <button
                          key={ag.id}
                          type="button"
                          onClick={() => {
                            setTransferAgentName(ag.full_name);
                            setTransferAgentEmail(ag.email || '');
                            setTransferTargetAgentId(ag.id);
                          }}
                          className={`text-[11px] px-2.5 py-1.5 rounded-lg border transition-all flex items-center space-x-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-purple-600/30 border-purple-500 text-purple-200 shadow-sm'
                              : 'bg-[#18233e] border-dark-border hover:border-purple-500/50 text-gray-300'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${ag.is_online ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                          <span className="font-semibold">{ag.full_name}</span>
                          {ag.role === 'admin' && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-brand-amber/20 text-brand-amber font-bold">Admin</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Target Agent / Admin Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Garry Amelia (Admin) or Abdul Rafay"
                  value={transferAgentName}
                  onChange={(e) => setTransferAgentName(e.target.value)}
                  className="w-full bg-[#131d33] border border-dark-border rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Target Agent Email (Optional)
                </label>
                <input
                  type="email"
                  placeholder="e.g. garryamelia6265@gmail.com"
                  value={transferAgentEmail}
                  onChange={(e) => setTransferAgentEmail(e.target.value)}
                  className="w-full bg-[#131d33] border border-dark-border rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="flex-1 py-2 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferring || !transferAgentName.trim()}
                  className="flex-1 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-lg disabled:opacity-50 flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>{transferring ? 'Transferring...' : 'Transfer Chat'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
