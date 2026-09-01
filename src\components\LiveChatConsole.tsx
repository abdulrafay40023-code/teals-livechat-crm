'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Send,
  Lock, UserPlus, MapPin, Eye, ShieldAlert, Bot
} from 'lucide-react';
import { AgentAvatar } from '@/components/AgentAvatar';
import { getCountryFlagUrl } from '@/lib/flags';
import { supabase } from '@/lib/supabase';
import { REALTIME_CHANNEL } from '@/lib/realtime';
import { ClaimChatModal } from '@/components/ClaimChatModal';

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
  const [messages, setMessages] = useState<Array<{ id: string; sender_type: string; sender_name: string; content: string; is_whisper: boolean; seq?: number; status?: 'sent' | 'delivered' | 'read'; created_at: string }>>([]);
  const [inputText, setInputText] = useState('');
  const [isWhisperMode, setIsWhisperMode] = useState(false);
  const [sending, setSending] = useState(false);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [liveTypingPreview, setLiveTypingPreview] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingPreviewEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ROLE-BASED VISIBILITY FILTERING
  const isAdmin = currentAgent.role === 'admin' || currentAgent.email === 'garryamelia6265@gmail.com';

  const visibleConversations = conversations.filter((conv) => {
    // 1. ADMIN: Sees EVERYTHING (AI chats, unclaimed human requests, claimed chats)
    if (isAdmin) return true;

    // 2. REGULAR AGENT:
    // a) Chats they personally claimed:
    const isMine = !!(
      (conv.assigned_agent_id && conv.assigned_agent_id === currentAgent.id) ||
      (conv.assigned_agent_name && conv.assigned_agent_name.toLowerCase() === currentAgent.full_name?.toLowerCase()) ||
      (conv.assigned_agent_email && conv.assigned_agent_email.toLowerCase() === currentAgent.email?.toLowerCase())
    );
    if (isMine) return true;

    // b) Unclaimed chats that explicitly need human assistance:
    const isNeedsHuman = !conv.assigned_agent_id && !conv.assigned_agent_name && (conv.mode === 'human' || conv.status === 'pending_agent');
    if (isNeedsHuman) return true;

    // c) Regular agents DO NOT see AI-only conversations!
    return false;
  });

  // Manual selection only (no auto-select to preserve list browsing)
  // Search across full conversations list so selected conversation is NEVER dropped during filtering
  const selectedConv = selectedChatId ? (conversations.find((c) => c.id === selectedChatId) || null) : null;

  const isClaimedByMe = !!(
    (selectedConv?.assigned_agent_id && selectedConv?.assigned_agent_id === currentAgent.id) ||
    (selectedConv?.assigned_agent_name && selectedConv?.assigned_agent_name.toLowerCase() === currentAgent.full_name?.toLowerCase()) ||
    (selectedConv?.assigned_agent_email && selectedConv?.assigned_agent_email.toLowerCase() === currentAgent.email?.toLowerCase())
  );
  const isClaimedByOther = !!(selectedConv?.assigned_agent_id || selectedConv?.assigned_agent_name) && !isClaimedByMe;
  const isNeedsClaim = !isClaimedByMe && !isClaimedByOther && (selectedConv?.mode === 'human' || selectedConv?.status === 'pending_agent');
  const isAiAutomated = !isClaimedByMe && !isClaimedByOther && selectedConv?.mode === 'ai' && selectedConv?.status !== 'pending_agent';

  // Real-Time Direct WebSocket Stream for Messages & Keystrokes
  useEffect(() => {
    const targetId = selectedConv?.id;
    if (!targetId || (isClaimedByOther && !isAdmin)) return;
    setClaimError(null);

    const channel = supabase.channel(REALTIME_CHANNEL, {
      config: { broadcast: { self: true } }
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'chat_message' }, (payload: unknown) => {
        const raw = (payload as Record<string, unknown>)?.payload || payload;
        const cId = (raw as Record<string, unknown>)?.conversationId;
        const message = (raw as Record<string, unknown>)?.message as { id: string; sender_type: string; sender_name: string; content: string; is_whisper: boolean; created_at: string };
        const systemMessage = (raw as Record<string, unknown>)?.systemMessage as { id: string; sender_type: string; sender_name: string; content: string; is_whisper: boolean; created_at: string };

        if (cId === targetId) {
          // Immediately dismiss sneak-peek preview once message is posted
          if (message?.sender_type === 'visitor') {
            setLiveTypingPreview(null);
          }

          const nowIso = new Date().toISOString();
          setMessages((prev) => {
            const map = new Map<string, any>();
            prev.forEach(m => map.set(m.id, { ...m, created_at: m.created_at || nowIso }));
            if (message) map.set(message.id, { ...message, created_at: message.created_at || nowIso });
            if (systemMessage) map.set(systemMessage.id, { ...systemMessage, created_at: systemMessage.created_at || nowIso });
            return Array.from(map.values()).sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          });
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
      .subscribe();

    if (targetId) {
      onMarkRead?.(targetId);
    }

    // Initial message load with Non-Destructive Merge
    const fetchMsgs = async () => {
      try {
        const res = await fetch(`/api/chat/message?conversationId=${targetId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.messages && Array.isArray(data.messages)) {
            setMessages((prev) => {
              const map = new Map();
              data.messages.forEach((m: { id: string }) => map.set(m.id, m));
              prev.forEach(m => map.set(m.id, m));
              return Array.from(map.values()).sort((a, b) => {
                if (typeof a.seq === 'number' && typeof b.seq === 'number' && a.seq !== b.seq) {
                  return a.seq - b.seq;
                }
                const timeA = new Date(a.created_at || 0).getTime();
                const timeB = new Date(b.created_at || 0).getTime();
                return timeA - timeB;
              });
            });
          }
        }
      } catch {}
    };

    fetchMsgs();

    return () => {
      channelRef.current = null;
      channel.unsubscribe();
    };
  }, [selectedConv?.id, isClaimedByOther, isAdmin, onMarkRead]);

  // Synchronize messages immediately when selectedConv updates in parent conversations list
  useEffect(() => {
    if (selectedConv?.messages && Array.isArray(selectedConv.messages) && selectedConv.messages.length > 0) {
      if (selectedConv.id) {
        onMarkRead?.(selectedConv.id);
      }
      setMessages((prev) => {
        const map = new Map();
        prev.forEach(m => map.set(m.id, m));
        selectedConv.messages!.forEach(m => map.set(m.id, m));
        return Array.from(map.values()).sort((a, b) => {
          if (typeof a.seq === 'number' && typeof b.seq === 'number' && a.seq !== b.seq) {
            return a.seq - b.seq;
          }
          const timeA = new Date(a.created_at || 0).getTime();
          const timeB = new Date(b.created_at || 0).getTime();
          return timeA - timeB;
        });
      });

      const last = selectedConv.messages[selectedConv.messages.length - 1];
      if (last && last.sender_type === 'visitor') {
        setLiveTypingPreview(null);
      }
    }
  }, [selectedConv?.messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (liveTypingPreview) {
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
          setMessages(data.conversation.messages);
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

  const handleAgentInputChange = (val: string) => {
    setInputText(val);
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

    const updatedConv = {
      ...selectedConv,
      mode: 'human' as const,
      status: 'active' as const,
      assigned_agent_id: agentId,
      assigned_agent_name: agentName,
      assigned_agent_email: agentEmail,
      messages: [...messages.filter(m => !(m.sender_type === 'system' && m.content?.includes('has claimed and joined'))), sysMsg]
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

    setMessages((prev) => {
      const map = new Map<string, any>();
      prev.filter(m => !(m.sender_type === 'system' && m.content?.includes('has claimed and joined'))).forEach(m => map.set(m.id, { ...m, created_at: m.created_at || nowIso }));
      map.set(sysMsg.id, sysMsg);
      return Array.from(map.values()).sort((a, b) => {
        if (typeof a.seq === 'number' && typeof b.seq === 'number' && a.seq !== b.seq) {
          return a.seq - b.seq;
        }
        const timeA = new Date(a.created_at || 0).getTime();
        const timeB = new Date(b.created_at || 0).getTime();
        return timeA - timeB;
      });
    });

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
          setMessages((prev) => {
            const map = new Map<string, any>();
            prev.filter(m => !(m.sender_type === 'system' && m.content?.includes('has claimed and joined'))).forEach(m => map.set(m.id, { ...m, created_at: m.created_at || nowIso }));
            data.conversation.messages.forEach((m: any) => map.set(m.id, { ...m, created_at: m.created_at || nowIso }));
            return Array.from(map.values()).sort((a, b) => {
              if (typeof a.seq === 'number' && typeof b.seq === 'number' && a.seq !== b.seq) {
                return a.seq - b.seq;
              }
              const timeA = new Date(a.created_at || 0).getTime();
              const timeB = new Date(b.created_at || 0).getTime();
              return timeA - timeB;
            });
          });
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedConv?.id || sending) return;
    if (!isClaimedByMe && !isAdmin) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

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

    setMessages((prev) => {
      const map = new Map();
      prev.forEach(m => map.set(m.id, m));
      map.set(optimisticMsg.id, optimisticMsg);
      return Array.from(map.values()).sort((a, b) => {
        if (typeof a.seq === 'number' && typeof b.seq === 'number' && a.seq !== b.seq) {
          return a.seq - b.seq;
        }
        const timeA = new Date(a.created_at || 0).getTime();
        const timeB = new Date(b.created_at || 0).getTime();
        return timeA - timeB;
      });
    });

    // Direct WebSocket broadcast to visitor widget (sub-5ms!)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'chat_message',
      payload: {
        conversationId: selectedConv.id,
        message: optimisticMsg,
        conversation: {
          ...selectedConv,
          mode: 'human',
          assigned_agent_id: currentAgent.id,
          assigned_agent_name: currentAgent.full_name,
          assigned_agent_email: currentAgent.email,
          messages: [...messages, optimisticMsg]
        },
        isHandoffRequested: false
      }
    });

    try {
      await fetch('/api/chat/message', {
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
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
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

          <div className="flex-1 overflow-y-auto divide-y divide-dark-border/40">
            {visibleConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-dark-muted space-y-2">
                <AgentAvatar type="ai" size="md" className="mx-auto" />
                <p className="font-semibold text-white">No pending chats</p>
                <p className="text-[11px] leading-relaxed">
                  {isAdmin
                    ? 'Visitors chatting on CRM will appear here.'
                    : 'When a visitor requests a human agent, it will alert and appear here!'}
                </p>
              </div>
            ) : (
              visibleConversations.map((conv) => {
                const isSelected = conv.id === selectedConv?.id;
                const isConvMine = !!(
                  (conv.assigned_agent_id && conv.assigned_agent_id === currentAgent.id) ||
                  (conv.assigned_agent_name && conv.assigned_agent_name.toLowerCase() === currentAgent.full_name?.toLowerCase()) ||
                  (conv.assigned_agent_email && conv.assigned_agent_email.toLowerCase() === currentAgent.email?.toLowerCase())
                );
                const isConvClaimedOther = !!(conv.assigned_agent_id || conv.assigned_agent_name) && !isConvMine;
                const isConvNeedsClaim = !isConvMine && !isConvClaimedOther && (conv.mode === 'human' || conv.status === 'pending_agent');

                const flagSrc = getCountryFlagUrl(conv.visitor?.country_code || 'PK');
                const lastMsg = conv.messages && conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null;

                return (
                  <div
                    key={conv.id}
                    onClick={() => onSelectChat(conv.id)}
                    className={`p-3.5 cursor-pointer transition-all hover:bg-[#131d33] ${
                      isSelected ? 'bg-[#152038] border-l-4 border-brand-primary' : 'bg-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2.5">
                        <img
                          src={flagSrc}
                          alt="Flag"
                          className="w-5 h-3.5 object-cover rounded shadow-sm flex-shrink-0"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white flex items-center space-x-1 truncate">
                            <span>{conv.visitor_name}</span>
                            {conv.visitor_email && (
                              <span className="text-[10px] font-normal text-dark-muted truncate">({conv.visitor_email})</span>
                            )}
                          </h4>
                          <p className="text-[11px] text-dark-muted truncate max-w-[150px] mt-0.5">
                            {lastMsg ? lastMsg.content : (conv.visitor?.current_page || '/')}
                          </p>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0 ml-2">
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
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-brand-rose/15 text-brand-rose border border-brand-rose/30 animate-pulse">
                            NEEDS CLAIM
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center space-x-1">
                            <Bot className="w-2.5 h-2.5" />
                            <span>AI Active</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
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

                <div>
                  {isNeedsClaim ? (
                    <button
                      onClick={() => setClaimModalOpen(true)}
                      disabled={claiming}
                      className="px-3.5 py-1.5 rounded-xl bg-brand-rose hover:bg-rose-600 text-white text-xs font-bold shadow-lg transition-all flex items-center space-x-1.5 animate-bounce disabled:opacity-50"
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
                        className="px-3 py-1 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-bold transition-all flex items-center space-x-1.5 disabled:opacity-50"
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
                </div>
              </div>

              {/* Claim Error Notice */}
              {claimError && (
                <div className="p-2.5 bg-brand-rose/20 border-b border-brand-rose/40 text-brand-rose text-xs flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{claimError}</span>
                </div>
              )}

              {/* View Rendering: Locked Screen vs Active Message Stream */}
              {isNeedsClaim && !isAdmin ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#0a0f1d] space-y-5 select-none">
                  <div className="w-20 h-20 rounded-3xl bg-brand-rose/15 border border-brand-rose/30 flex items-center justify-center text-brand-rose animate-pulse shadow-2xl shadow-brand-rose/25">
                    <Lock className="w-10 h-10" />
                  </div>
                  <div className="space-y-2 max-w-md">
                    <h3 className="text-lg font-bold text-white tracking-tight">Human Support Requested</h3>
                    <p className="text-xs text-dark-muted leading-relaxed">
                      The customer requested to speak with a real person. Claim this conversation to verify your details, view the message history, and start chatting.
                    </p>
                  </div>
                  <button
                    onClick={() => setClaimModalOpen(true)}
                    disabled={claiming}
                    className="px-8 py-3.5 rounded-2xl bg-brand-rose hover:bg-rose-600 text-white text-sm font-bold shadow-xl shadow-brand-rose/30 transition-all flex items-center space-x-2.5 cursor-pointer transform hover:scale-105 active:scale-95 disabled:opacity-50"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{claiming ? 'Claiming Chat...' : 'Claim Chat Now'}</span>
                  </button>
                </div>
              ) : isClaimedByOther && !isAdmin ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-dark-muted space-y-3 bg-[#0a0f1d]/50">
                  <div className="w-12 h-12 rounded-2xl bg-dark-card border border-dark-border flex items-center justify-center text-dark-muted">
                    <Lock className="w-6 h-6 text-brand-amber" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Conversation in Progress</h4>
                  <p className="text-xs text-dark-muted max-w-xs leading-relaxed">
                    This conversation is assigned to <span className="text-brand-amber font-semibold">{selectedConv.assigned_agent_name}</span>.
                  </p>
                </div>
              ) : (
                <>
                  {/* Message Stream */}
                  <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
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
                            <span className="text-[10px] font-bold text-dark-muted">{m.sender_name}</span>
                            {isWhisper && (
                              <span className="text-[9px] bg-brand-amber/15 text-brand-amber px-1.5 py-0.2 rounded font-bold">
                                Whisper (Private)
                              </span>
                            )}
                            {isAi && (
                              <span className="text-[9px] bg-blue-500/15 text-blue-400 px-1.5 py-0.2 rounded font-bold">
                                AI
                              </span>
                            )}
                          </div>
                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm break-words whitespace-pre-wrap ${
                              isVisitor
                                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-tl-none'
                                : isWhisper
                                ? 'bg-brand-amber/10 border border-brand-amber/30 text-brand-amber rounded-tr-none'
                                : isAi
                                ? 'bg-blue-950/60 border border-blue-900/50 text-blue-100 rounded-tr-none'
                                : 'bg-dark-card border border-dark-border text-white rounded-tr-none'
                            }`}
                          >
                            {m.content}
                            <div className={`flex items-center space-x-1.5 mt-1.5 ${isVisitor ? 'justify-start text-white/70' : 'justify-end text-dark-muted'}`}>
                              <span className="text-[9px]">
                                {new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
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

                    <div className="flex items-center space-x-2">
                      <textarea
                        value={inputText}
                        onChange={(e) => handleAgentInputChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage(e);
                          }
                        }}
                        rows={1}
                        disabled={(!isClaimedByMe && !isAdmin) || sending}
                        placeholder={
                          isClaimedByMe || isAdmin
                            ? 'Type reply as support agent (Enter to send)...'
                            : isAiAutomated
                            ? 'AI is active. Claim chat to reply directly...'
                            : 'Claim this chat to reply...'
                        }
                        className="flex-1 bg-dark-card border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-dark-muted focus:outline-none focus:border-brand-primary disabled:opacity-40 resize-none overflow-y-auto max-h-28 leading-relaxed"
                        style={{ minHeight: '38px' }}
                      />
                      <button
                        type="submit"
                        disabled={(!isClaimedByMe && !isAdmin) || sending || !inputText.trim()}
                        className="p-2.5 rounded-xl bg-brand-primary text-white hover:bg-brand-primaryHover transition-all disabled:opacity-40 flex-shrink-0"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                </>
              )}
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
    </>
  );
};
