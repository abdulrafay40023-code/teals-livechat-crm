'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare, Send,
  Lock, UserPlus, MapPin, Eye, ShieldAlert, Bot, Trash2,
  UserCheck, ArrowRightLeft, X, ExternalLink, RotateCcw,
  Shield, Users, CheckCircle2, Radio, CheckSquare, Check, Calendar, Edit3
} from 'lucide-react';
import { AgentAvatar } from '@/components/AgentAvatar';
import { getCountryFlagUrl } from '@/lib/flags';
import { supabase } from '@/lib/supabase';
import { crmSupabase } from '@/lib/crm-supabase';
import { REALTIME_CHANNEL } from '@/lib/realtime';
import { ClaimChatModal } from '@/components/ClaimChatModal';
import { useLiveSync } from '@/context/LiveSyncContext';
import { getWebsiteConfig } from '@/lib/websites-config';
import { stopWaitingForHumanBeep } from '@/lib/audio';

const DEFAULT_ADMIN_PROFILES = [
  { id: 'agent_garry_admin', full_name: 'Garry Amelia', email: 'garryamelia6265@gmail.com', role: 'admin', is_online: true },
  { id: 'agent_tzafar', full_name: 'Talha Zafar', email: 'tzafar04@gmail.com', role: 'admin', is_online: true },
  { id: 'agent_annus', full_name: 'Annus Raees', email: 'annusraees@gmail.com', role: 'admin', is_online: true },
  { id: 'agent_jennifer', full_name: 'Jennifer Cisternino', email: 'jennifer.cisternino2027@gmail.com', role: 'admin', is_online: true }
];

const DEFAULT_SUPPORT_AGENTS: Array<{ id: string; full_name: string; email: string; role: string; is_online: boolean }> = [];

const ADMIN_EMAILS_LIST = [
  'garryamelia6265@gmail.com',
  'tzafar04@gmail.com',
  'annusraees@gmail.com',
  'jennifer.cisternino2027@gmail.com'
];

export interface ChatSession {
  id: string;
  property_slug?: string;
  visitor_id: string;
  visitor_name: string;
  visitor_email?: string;
  visitor_phone?: string;
  visitor_ip?: string;
  assigned_agent_id?: string;
  assigned_agent_name?: string;
  assigned_agent_email?: string;
  assigned_agent_pseudo_name?: string;
  assigned_agent_role_title?: string;
  assigned_at?: string;
  transferred_from_name?: string;
  transferred_from_role?: string;
  transferred_to_name?: string;
  transfer_note?: string;
  is_transferred?: boolean;
  last_agent_reply_at?: string;
  last_visitor_message_at?: string;
  mode: 'ai' | 'human';
  status: 'active' | 'pending_agent' | 'resolved';
  typing_preview?: string;
  created_at?: string;
  updated_at: string;
  messages?: Array<{
    id: string;
    conversation_id?: string;
    sender_type: string;
    sender_name: string;
    sender_pseudo_name?: string;
    sender_role_title?: string;
    sender_real_name?: string;
    content: string;
    is_whisper: boolean;
    seq?: number;
    status?: 'sent' | 'delivered' | 'read';
    created_at: string;
    is_form?: boolean;
    form_type?: 'booking';
    form_data?: any;
  }>;
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
    pseudo_name?: string;
    role: string;
    role_title?: string;
  };
  selectedChatId: string | null;
  conversations: ChatSession[];
  onSelectChat: (id: string) => void;
  onClaimSuccess: () => void;
  onMarkRead?: (id: string) => void;
  onUpdateAgent?: (updated: { pseudo_name?: string; role_title?: string }) => void;
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
  const [autoClaimPromptOpen, setAutoClaimPromptOpen] = useState(false);
  const [pendingTextToSend, setPendingTextToSend] = useState('');
  const [claimError, setClaimError] = useState<string | null>(null);
  const [liveTypingPreview, setLiveTypingPreview] = useState<string | null>(null);
  const [inboxTab, setInboxTab] = useState<'chat1' | 'chat2' | 'live_visitors' | 'locked' | 'claimed'>('chat1');
  const [mobileShowInfo, setMobileShowInfo] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferAgentName, setTransferAgentName] = useState('');
  const [transferAgentEmail, setTransferAgentEmail] = useState('');
  const [transferTargetAgentId, setTransferTargetAgentId] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [availableAgents, setAvailableAgents] = useState<Array<{ id: string; full_name: string; email: string; role: string; is_online?: boolean }>>([]);
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  // Never block agent entry with forced modal. Agents can open it anytime via the persona button in the header.
  const [showSetPseudoModal, setShowSetPseudoModal] = useState<boolean>(false);
  const [pseudoNameInput, setPseudoNameInput] = useState(currentAgent?.pseudo_name || '');
  const [roleTitleInput, setRoleTitleInput] = useState(
    currentAgent?.role_title || (currentAgent?.role === 'admin' ? 'Admin' : 'Support Specialist')
  );

  // Auto-close modal and update state if agent has a pseudo name
  useEffect(() => {
    if (currentAgent?.pseudo_name) {
      setShowSetPseudoModal(false);
      setPseudoNameInput(currentAgent.pseudo_name);
    }
    if (currentAgent?.role_title) {
      setRoleTitleInput(currentAgent.role_title);
    }
  }, [currentAgent?.pseudo_name, currentAgent?.role_title]);

  const handleSavePseudoName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pseudoNameInput.trim()) return;

    const newPseudo = pseudoNameInput.trim();
    const newRoleTitle = roleTitleInput.trim() || (currentAgent.role === 'admin' ? 'Admin' : 'Support Specialist');

    const updatedAgent = {
      ...currentAgent,
      pseudo_name: newPseudo,
      role_title: newRoleTitle
    };

    try {
      localStorage.setItem('teals_agent_session', JSON.stringify(updatedAgent));
      sessionStorage.setItem('teals_agent_session', JSON.stringify(updatedAgent));
    } catch {}

    if (currentAgent.email) {
      try {
        const cleanEmail = currentAgent.email.toLowerCase().trim();
        const { data: prof } = await crmSupabase
          .from('profiles')
          .select('id, avatar_url')
          .eq('email', cleanEmail)
          .maybeSingle();

        let meta: Record<string, any> = {};
        if (prof?.avatar_url) {
          try { meta = JSON.parse(prof.avatar_url); } catch {}
        }
        meta.pseudo_name = newPseudo;
        meta.role_title = newRoleTitle;

        await crmSupabase
          .from('profiles')
          .update({ avatar_url: JSON.stringify(meta) })
          .eq('email', cleanEmail);
      } catch (err) {
        console.warn('Could not sync pseudo name to Supabase profile:', err);
      }
    }

    setShowSetPseudoModal(false);
    onUpdateAgent?.({ pseudo_name: newPseudo, role_title: newRoleTitle });
  };

  const handleSendBookingForm = async () => {
    if (!selectedConv?.id || sending) return;
    const formPromptText = "Please select a convenient date and time below to schedule a one-on-one consultation with our team:";
    setSending(true);

    const maxSeq = messages.reduce((max, m) => Math.max(max, m.seq || 0), 0);
    const clientMsgId = 'msg_form_' + Math.random().toString(36).substring(2, 10);
    const optimisticMsg = {
      id: clientMsgId,
      conversation_id: selectedConv.id,
      sender_type: 'agent',
      sender_name: currentAgent.full_name,
      sender_pseudo_name: currentAgent.pseudo_name || (currentAgent.role === 'admin' ? 'Admin' : 'Support Specialist'),
      sender_role_title: currentAgent.role_title || (currentAgent.role === 'admin' ? 'Admin' : 'Support Specialist'),
      sender_real_name: currentAgent.full_name,
      content: formPromptText,
      is_whisper: false,
      seq: maxSeq + 1,
      is_form: true,
      form_type: 'booking' as const,
      created_at: new Date().toISOString()
    };

    setMessages((prev) => sortTimelineMessages([...prev, optimisticMsg]));

    try {
      await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: clientMsgId,
          conversationId: selectedConv.id,
          visitorToken: selectedConv.visitor_id || selectedConv.id,
          propertySlug: selectedConv.property_slug || 'amz-solutions-hub',
          senderType: 'agent',
          senderName: currentAgent.full_name,
          senderPseudoName: currentAgent.pseudo_name || (currentAgent.role === 'admin' ? 'Admin' : 'Support Specialist'),
          senderRoleTitle: currentAgent.role_title || (currentAgent.role === 'admin' ? 'Admin' : 'Support Specialist'),
          assignedAgentName: currentAgent.full_name,
          assignedAgentPseudoName: currentAgent.pseudo_name || (currentAgent.role === 'admin' ? 'Admin' : 'Support Specialist'),
          assignedAgentRoleTitle: currentAgent.role_title || (currentAgent.role === 'admin' ? 'Admin' : 'Support Specialist'),
          content: formPromptText,
          isWhisper: false,
          is_form: true,
          form_type: 'booking'
        })
      });
      onMarkRead?.(selectedConv.id);
      onClaimSuccess?.();
    } catch (err) {
      console.error('Error sending booking form:', err);
    } finally {
      setSending(false);
    }
  };

  // Memoized lists of Admins and Working Support Agents
  const { adminList, agentList } = useMemo(() => {
    const adminMap = new Map<string, { id: string; full_name: string; email: string; role: string; is_online?: boolean }>();
    const agentMap = new Map<string, { id: string; full_name: string; email: string; role: string; is_online?: boolean }>();

    // 1. Preload default profiles
    DEFAULT_ADMIN_PROFILES.forEach(adm => adminMap.set(adm.email.toLowerCase(), adm));
    DEFAULT_SUPPORT_AGENTS.forEach(ag => agentMap.set(ag.email.toLowerCase(), ag));

    // 2. Merge all live approved agents from API
    availableAgents.forEach(ag => {
      const emailKey = (ag.email || '').toLowerCase().trim();
      const isAdminRole = ag.role === 'admin' || (emailKey && ADMIN_EMAILS_LIST.includes(emailKey));
      const formatted = {
        id: ag.id || `agent_${emailKey || ag.full_name}`,
        full_name: ag.full_name || (emailKey ? emailKey.split('@')[0] : 'Agent'),
        email: ag.email || '',
        role: isAdminRole ? 'admin' : 'agent',
        is_online: ag.is_online ?? true
      };

      if (isAdminRole) {
        if (emailKey) adminMap.set(emailKey, formatted);
        else adminMap.set(ag.full_name.toLowerCase(), formatted);
      } else {
        if (emailKey) agentMap.set(emailKey, formatted);
        else agentMap.set(ag.full_name.toLowerCase(), formatted);
      }
    });

    return {
      adminList: Array.from(adminMap.values()),
      agentList: Array.from(agentMap.values())
    };
  }, [availableAgents]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingPreviewEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const agentInputRef = useRef<HTMLTextAreaElement>(null);

  // ROLE-BASED VISIBILITY FILTERING
  const adminEmails = ['garryamelia6265@gmail.com', 'tzafar04@gmail.com', 'annusraees@gmail.com', 'jennifer.cisternino2027@gmail.com'];
  const isAdmin = currentAgent.role === 'admin' || (currentAgent.email && adminEmails.includes(currentAgent.email.toLowerCase()));

  // Auto-fetch live approved agents from API on mount
  useEffect(() => {
    const fetchLiveAgents = async () => {
      try {
        const res = await fetch('/api/agent/approvals');
        if (res.ok) {
          const data = await res.json();
          const approved = Array.isArray(data.approvedAgents) ? data.approvedAgents : [];
          setAvailableAgents(approved);
        }
      } catch {}
    };
    fetchLiveAgents();
  }, []);

  const { readConvMap, deleteConversation, deleteConversations, resetChatsOnly, liveVisitors } = useLiveSync();

  const [chatToDelete, setChatToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingChat, setIsDeletingChat] = useState(false);
  const [showResetAllModal, setShowResetAllModal] = useState(false);
  const [isResettingAll, setIsResettingAll] = useState(false);

  const [isSelectMode, setIsSelectMode] = useState<boolean>(false);
  const [selectedChatIdsForDelete, setSelectedChatIdsForDelete] = useState<Set<string>>(new Set());
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState<boolean>(false);

  const handleResetAllChats = () => {
    setShowResetAllModal(true);
  };

  const confirmResetAllChatsAction = async () => {
    if (isResettingAll) return;
    setIsResettingAll(true);
    try {
      onSelectChat('');
      if (resetChatsOnly) {
        await resetChatsOnly();
      }
      setShowResetAllModal(false);
    } catch (e) {
      console.error('Error resetting all chats:', e);
    } finally {
      setIsResettingAll(false);
    }
  };

  // Helper to check if a conversation has received any visitor messages
  const hasVisitorReplied = (c: ChatSession) => {
    return Boolean(
      (c.messages || []).some(m => m && m.sender_type === 'visitor' && m.content && m.content.trim().length > 0)
    );
  };

  // Helper to check if an agent has sent a proactive outreach message from Monitoring table
  const hasAgentSentOutreach = (c: ChatSession) => {
    return Boolean(
      (c.messages || []).some(m => m && m.sender_type === 'agent' && m.content && m.content.trim().length > 0)
    );
  };

  // A genuine conversation must have either visitor interaction OR proactive agent outreach
  const isGenuineConversation = (c: ChatSession) => {
    return hasVisitorReplied(c) || hasAgentSentOutreach(c) || Boolean((c as any).is_proactive);
  };

  // Keep all genuine conversations visible for both Admin and Agents (filter out empty ghost sessions)
  const visibleConversations = conversations.filter(isGenuineConversation);

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

  // Helper to reliably identify visitor identity across multiple chats (email -> visitor_id -> visitor_name)
  const getVisitorKey = (c: ChatSession): string => {
    if (c.visitor_email && c.visitor_email.trim()) return `email:${c.visitor_email.trim().toLowerCase()}`;
    if (c.visitor_id && c.visitor_id.trim()) return `vis:${c.visitor_id.trim().toLowerCase()}`;
    if (c.visitor_name && c.visitor_name.trim() && c.visitor_name !== 'Visitor' && c.visitor_name !== 'System') return `name:${c.visitor_name.trim().toLowerCase()}`;
    return `id:${c.id}`;
  };

  // Map to identify which chat number a conversation is when visitor has multiple
  const emailToConvs = new Map<string, ChatSession[]>();
  sortedVisibleConversations.forEach(c => {
    const key = getVisitorKey(c);
    if (!emailToConvs.has(key)) emailToConvs.set(key, []);
    emailToConvs.get(key)!.push(c);
  });

  const getChatNumber = (conv: ChatSession): 1 | 2 => {
    if ((conv as any).chat_number === 2 || (conv as any).chatNumber === 2 || (conv as any).metadata?.chatNumber === 2) return 2;
    if ((conv as any).chat_number === 1 || (conv as any).chatNumber === 1 || (conv as any).metadata?.chatNumber === 1) return 1;
    const key = getVisitorKey(conv);
    const group = emailToConvs.get(key) || [];
    if (group.length <= 1) return 1;
    const sortedChronological = [...group].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    const idx = sortedChronological.findIndex(c => c.id === conv.id);
    return idx === 0 ? 1 : 2;
  };

  const getChatBadge = (conv: ChatSession) => {
    return `Chat #${getChatNumber(conv)}`;
  };

  // Helper to check if a conversation is claimed by the current logged-in agent
  const isConvMineHelper = (c: ChatSession) => {
    return !!(
      (c.assigned_agent_id && (
        c.assigned_agent_id === currentAgent.id ||
        c.assigned_agent_id.toLowerCase() === (currentAgent.id || '').toLowerCase()
      )) ||
      (c.assigned_agent_name && (
        c.assigned_agent_name.toLowerCase().trim() === (currentAgent.full_name || '').toLowerCase().trim()
      )) ||
      (c.assigned_agent_email && (
        c.assigned_agent_email.toLowerCase().trim() === (currentAgent.email || '').toLowerCase().trim()
      ))
    );
  };

  // 5 Core Categorized Lists (Full visibility for Working Agents and Admins):
  // 1. Live Visitors: Conversations initiated by agent with live visitors (proactive from Monitoring table) where visitor has NOT replied yet
  const liveVisitorsList = sortedVisibleConversations.filter(c => hasAgentSentOutreach(c) && !hasVisitorReplied(c));

  // 2. Chat 1: All Chat 1 conversations where visitor has messaged/replied
  const chat1List = sortedVisibleConversations.filter(c => hasVisitorReplied(c) && getChatNumber(c) === 1);

  // 3. Chat 2: All Chat 2 conversations where visitor has messaged/replied
  const chat2List = sortedVisibleConversations.filter(c => hasVisitorReplied(c) && getChatNumber(c) === 2);

  // 4. Locked: Visitors who requested human assistance, awaiting agent claim
  const lockedList = sortedVisibleConversations.filter(c => hasVisitorReplied(c) && !c.assigned_agent_id && !c.assigned_agent_name && (c.mode === 'human' || c.status === 'pending_agent'));

  // 5. Claimed: All chats claimed across team
  const claimedList = sortedVisibleConversations.filter(c => !!(c.assigned_agent_id || c.assigned_agent_name));

  // Calculate unread count for each conversation
  const getUnreadCountForConv = (conv: ChatSession) => {
    // If this conversation is currently open on screen, it is seen!
    if (conv.id === selectedChatId) return 0;

    if (!conv.messages || conv.messages.length === 0) return 0;

    // Filter out internal whispers
    const validMsgs = conv.messages.filter(m => !m.is_whisper && !(m as any).isWhisper);
    if (validMsgs.length === 0) return 0;

    const lastMsg = validMsgs[validMsgs.length - 1];

    // 1. If the last message was sent by an agent, the agent has already answered!
    if (lastMsg.sender_type === 'agent') return 0;

    // 2. If the last message was sent by AI in AI mode and NOT pending human agent handoff:
    if (lastMsg.sender_type === 'ai' && conv.mode === 'ai' && conv.status !== 'pending_agent') {
      return 0;
    }

    // 3. Find latest visitor message
    const visitorMsgs = validMsgs.filter(m => m.sender_type === 'visitor');
    if (visitorMsgs.length === 0) return 0;

    const lastVisitorMsg = visitorMsgs[visitorMsgs.length - 1];

    // 4. Check if an agent message exists after this last visitor message
    const lastVisitorIdx = validMsgs.lastIndexOf(lastVisitorMsg);
    const hasAgentReplyAfter = validMsgs.slice(lastVisitorIdx + 1).some(m => m.sender_type === 'agent');
    if (hasAgentReplyAfter) return 0;

    // 5. Check persistent readConvMap for seen status
    const readVal = readConvMap?.[conv.id];
    if (readVal) {
      if (readVal === 'all') return 0;

      let savedId = readVal;
      let savedTime = 0;
      if (readVal.includes('__')) {
        const parts = readVal.split('__');
        savedId = parts[0];
        savedTime = new Date(parts[1] || 0).getTime();
      }

      // Exact ID match: this exact message was already seen
      if (savedId === lastVisitorMsg.id) return 0;

      // Timestamp match: agent viewed this chat at or after this visitor message was sent
      const visitorMsgTime = new Date(lastVisitorMsg.created_at || 0).getTime();
      if (savedTime > 0 && visitorMsgTime > 0 && savedTime >= visitorMsgTime) {
        return 0;
      }

      // Count only visitor messages sent after the last seen marker
      const lastSeenIdx = visitorMsgs.findIndex(m => m.id === savedId || (savedTime > 0 && new Date(m.created_at || 0).getTime() <= savedTime));
      if (lastSeenIdx >= 0) {
        return visitorMsgs.length - (lastSeenIdx + 1);
      }
    }

    // 6. Only if the last message is from a visitor or chat is pending human agent
    if (lastMsg.sender_type !== 'visitor' && conv.status !== 'pending_agent') {
      return 0;
    }

    return 1;
  };

  // Tab unread notification counts (seen kro tu gayab)
  const chat1Unread = chat1List.reduce((sum, c) => sum + getUnreadCountForConv(c), 0);
  const chat2Unread = chat2List.reduce((sum, c) => sum + getUnreadCountForConv(c), 0);
  const lockedUnread = lockedList.reduce((sum, c) => sum + getUnreadCountForConv(c), 0);
  const claimedUnread = claimedList.reduce((sum, c) => sum + getUnreadCountForConv(c), 0);

  // Unseen locked chats count (wahan seen krey admin/agent tu gayab uskey pass sy)
  const unseenLockedCount = lockedList.filter(c => getUnreadCountForConv(c) > 0).length;

  const requestDeleteChat = (id: string, name?: string) => {
    setChatToDelete({ id, name: name || 'this visitor' });
  };

  const confirmDeleteChatAction = () => {
    if (!chatToDelete) return;
    const id = chatToDelete.id;
    if (selectedChatId === id) {
      onSelectChat('');
    }
    setChatToDelete(null);
    deleteConversation(id);
  };

  const handleDeleteChat = (id: string, name?: string) => {
    requestDeleteChat(id, name);
  };

  const toggleChatSelection = (id: string) => {
    setSelectedChatIdsForDelete(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getCurrentTabList = () => {
    if (inboxTab === 'chat1') return chat1List;
    if (inboxTab === 'chat2') return chat2List;
    if (inboxTab === 'live') return liveVisitorsList;
    if (inboxTab === 'locked') return lockedList;
    return claimedList;
  };

  const currentTabConvs = getCurrentTabList();
  const isAllCurrentSelected = currentTabConvs.length > 0 && currentTabConvs.every(c => selectedChatIdsForDelete.has(c.id));

  const handleToggleSelectAll = () => {
    if (isAllCurrentSelected) {
      setSelectedChatIdsForDelete(prev => {
        const next = new Set(prev);
        currentTabConvs.forEach(c => next.delete(c.id));
        return next;
      });
    } else {
      setSelectedChatIdsForDelete(prev => {
        const next = new Set(prev);
        currentTabConvs.forEach(c => next.add(c.id));
        return next;
      });
    }
  };

  const confirmBatchDelete = () => {
    const ids = Array.from(selectedChatIdsForDelete);
    if (ids.length === 0) return;
    if (selectedChatId && ids.includes(selectedChatId)) {
      onSelectChat('');
    }
    setShowBatchDeleteModal(false);
    setSelectedChatIdsForDelete(new Set());
    setIsSelectMode(false);
    deleteConversations(ids);
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
};

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef<boolean>(false);
  const prevDisplayCountRef = useRef<number>(0);

  const handleChatScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    // If user has scrolled up more than 35px from bottom, respect position and do NOT snap down
    isUserScrolledUp.current = (scrollHeight - scrollTop - clientHeight) > 35;
  };

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
          if (selectedConv?.id !== targetId) return;
          const data = await res.json();
          if (selectedConv?.id !== targetId) return;
          if (Array.isArray(data.messages)) {
            setMessages(prev => {
              if (prev.length === data.messages.length) {
                const isIdentical = prev.every((m, idx) => m.id === data.messages[idx]?.id && m.status === data.messages[idx]?.status);
                if (isIdentical) return prev;
              }
              const map = new Map<string, any>();
              prev.forEach(m => {
                if (m.conversation_id === targetId) {
                  map.set(m.id, { ...m, conversation_id: targetId });
                }
              });
              data.messages.forEach((m: any) => map.set(m.id, { ...m, conversation_id: targetId }));
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
          if (m.conversation_id === selectedConv.id) {
            map.set(m.id, { ...m, conversation_id: selectedConv.id });
          }
        });
        (selectedConv.messages || []).forEach(m => map.set(m.id, { ...m, conversation_id: selectedConv.id }));
        return sortTimelineMessages(Array.from(map.values()));
      });
    }

    const last = selectedConv.messages?.[selectedConv.messages.length - 1];
    if (last && last.sender_type === 'visitor') {
      setLiveTypingPreview(null);
    }
  }, [selectedConv?.id, selectedConv?.messages?.length, selectedConv?.updated_at, onMarkRead]);

  // Messages strictly belonging to the currently selected conversation (Zero leakage between chats!)
  const displayMessages = useMemo(() => {
    if (!selectedConv?.id) return [];
    const targetId = selectedConv.id;
    const map = new Map<string, any>();
    (selectedConv.messages || []).forEach(m => {
      if (m && m.id) map.set(m.id, { ...m, conversation_id: targetId });
    });
    messages.forEach(m => {
      if (m && m.id && m.conversation_id === targetId) {
        map.set(m.id, { ...m, conversation_id: targetId });
      }
    });
    return sortTimelineMessages(Array.from(map.values()));
  }, [selectedConv, messages]);

  const handleSwitchTab = (tab: 'chat1' | 'chat2' | 'live_visitors' | 'locked' | 'claimed') => {
    setInboxTab(tab);
    let targetList: ChatSession[] = [];
    if (tab === 'chat1') targetList = chat1List;
    else if (tab === 'chat2') targetList = chat2List;
    else if (tab === 'live_visitors') targetList = liveVisitorsList;
    else if (tab === 'locked') targetList = lockedList;
    else if (tab === 'claimed') targetList = claimedList;

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    if (isMobile) {
      // On mobile view: NEVER auto-open a conversation when switching/clicking tabs!
      // Always show the inbox list first so user can browse, and only open when a chat is clicked.
      onSelectChat('');
      setMessages([]);
      return;
    }

    const isCurrentInTarget = targetList.some(c => c.id === selectedChatId);
    if (!isCurrentInTarget) {
      onSelectChat('');
      setMessages([]);
    }
  };

  // Helper to scroll ONLY the chat message container without ever scrolling parent page/grid
  const scrollChatToBottom = (behavior: ScrollBehavior = 'auto') => {
    const container = chatContainerRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  };

  // When selecting a new conversation, scroll chat container to bottom once
  useEffect(() => {
    setMobileShowInfo(false);
    isUserScrolledUp.current = false;
    prevDisplayCountRef.current = displayMessages.length;
    const raf = requestAnimationFrame(() => {
      scrollChatToBottom('auto');
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedConv?.id]);

  useEffect(() => {
    const hasNewMessage = displayMessages.length > prevDisplayCountRef.current;
    prevDisplayCountRef.current = displayMessages.length;

    // Only auto-scroll if a brand new message arrived AND user is not scrolled up reading earlier messages
    if (hasNewMessage && !isUserScrolledUp.current) {
      scrollChatToBottom('smooth');
    }
  }, [displayMessages]);

  useEffect(() => {
    if (liveTypingPreview && !isUserScrolledUp.current) {
      const previewBox = typingPreviewEndRef.current?.parentElement;
      if (previewBox) {
        previewBox.scrollTo({ top: previewBox.scrollHeight, behavior: 'smooth' });
      }
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
          agentPseudoName: currentAgent.pseudo_name || (isAdmin ? 'Admin Support' : 'Support Specialist'),
          agentRoleTitle: currentAgent.role_title || (isAdmin ? 'Admin' : 'Support Specialist'),
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
        stopWaitingForHumanBeep(undefined, true);
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
    const agentPseudo = currentAgent.pseudo_name || (isAdmin ? 'Admin Support' : 'Support Specialist');
    const agentRole = currentAgent.role_title || (isAdmin ? 'Admin' : 'Support Specialist');
    const maxSeq = messages.reduce((max, m) => Math.max(max, m.seq || 0), 0);
    const claimMsgId = 'msg_sys_claim_' + selectedConv.id;
    const nowIso = new Date(Date.now() + 50).toISOString();
    const sysMsg = {
      id: claimMsgId,
      conversation_id: selectedConv.id,
      sender_type: 'system' as const,
      sender_name: 'System',
      content: `${agentPseudo} (${agentRole}) has joined the conversation.`,
      is_whisper: false,
      seq: maxSeq + 1,
      created_at: nowIso
    };

    const isSystemClaimOrHandoff = (m: any) =>
      m.sender_type === 'system' && (
        m.content?.includes('has claimed and joined') ||
        m.content?.includes('has joined the conversation') ||
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
      assigned_agent_pseudo_name: agentPseudo,
      assigned_agent_role_title: agentRole,
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
        agentPseudoName: agentPseudo,
        agentRoleTitle: agentRole,
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
          agentPseudoName: agentPseudo,
          agentRoleTitle: agentRole,
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
        stopWaitingForHumanBeep(undefined, true);
        onClaimSuccess();

        // Automatically redirect to the claimed chat's section (Chat 1 or Chat 2) and focus input
        const targetTab = getChatNumber(selectedConv) === 2 ? 'chat2' : 'chat1';
        setInboxTab(targetTab);
        setTimeout(() => {
          agentInputRef.current?.focus({ preventScroll: true });
        }, 100);
      }
    } catch {
      setClaimError('Network error while claiming chat.');
    } finally {
      setClaiming(false);
      setClaimModalOpen(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !selectedConv?.id || sending) return;
    if (isClaimedByOther && !isAdmin) return;

    // If chat is not yet claimed by current agent/admin, prompt auto-claim takeover modal
    if (!isClaimedByMe) {
      setPendingTextToSend(inputText.trim());
      setAutoClaimPromptOpen(true);
      return;
    }

    await executeSendMessage(inputText.trim(), isWhisperMode);
  };

  const executeSendMessage = async (text: string, whisper: boolean) => {
    if (!text || !selectedConv?.id) return;
    setInputText('');
    setSending(true);
    if (agentInputRef.current) {
      agentInputRef.current.style.height = '38px';
      agentInputRef.current.focus({ preventScroll: true });
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

    const agentPseudo = currentAgent.pseudo_name || (isAdmin ? 'Admin Support' : 'Support Specialist');
    const agentRole = currentAgent.role_title || (isAdmin ? 'Admin' : 'Support Specialist');

    const optimisticMsg = {
      id: clientMsgId,
      conversation_id: selectedConv.id,
      sender_type: 'agent',
      sender_name: currentAgent.full_name,
      sender_pseudo_name: agentPseudo,
      sender_role_title: agentRole,
      sender_real_name: currentAgent.full_name,
      content: text,
      is_whisper: whisper,
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
          visitorToken: selectedConv.visitor_id || selectedConv.id,
          propertySlug: selectedConv.property_slug || 'amz-solutions-hub',
          senderType: 'agent',
          senderName: currentAgent.full_name,
          senderPseudoName: agentPseudo,
          senderRoleTitle: agentRole,
          assignedAgentName: currentAgent.full_name,
          assignedAgentPseudoName: agentPseudo,
          assignedAgentRoleTitle: agentRole,
          content: text,
          isWhisper: whisper
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setMessages((prev) => sortTimelineMessages([...prev.filter(m => m.id !== clientMsgId), data.message]));
        }
        if (!whisper) {
          onMarkRead?.(selectedConv.id);
        }
        onClaimSuccess?.();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
      setTimeout(() => {
        agentInputRef.current?.focus({ preventScroll: true });
      }, 10);
    }
  };

  const handleConfirmAutoClaim = async () => {
    if (!selectedConv?.id) return;
    setClaiming(true);
    try {
      const res = await fetch('/api/agent/claim-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConv.id,
          agentId: currentAgent.id,
          agentName: currentAgent.full_name,
          agentEmail: currentAgent.email,
          force: true
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        stopWaitingForHumanBeep(selectedConv.id);
        setAutoClaimPromptOpen(false);
        onClaimSuccess?.();
        if (pendingTextToSend) {
          await executeSendMessage(pendingTextToSend, isWhisperMode);
          setPendingTextToSend('');
        }
      } else {
        setClaimError(data.error || 'Failed to claim chat.');
      }
    } catch {
      setClaimError('Network error while claiming chat.');
    } finally {
      setClaiming(false);
    }
  };

  const handleToggleWhisper = async () => {
    const nextVal = !isWhisperMode;
    setIsWhisperMode(nextVal);
    if (nextVal && selectedConv?.id) {
      // Switching to whisper locks chat and alerts team for assistance
      try {
        await fetch('/api/chat/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: selectedConv.id,
            senderType: 'system',
            senderName: 'System',
            content: `Agent ${currentAgent.full_name} switched to Private Assistance Mode.`,
            isWhisper: true
          })
        });
      } catch {}
    }
  };

  // Open transfer modal & prefetch approved agents
  const openTransferModal = async () => {
    setTransferModalOpen(true);
    setTransferError(null);
    setTransferAgentName('');
    setTransferAgentEmail('');
    setTransferTargetAgentId('');
    setTransferNote('');
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
          isTransfer: true,
          transferredFromName: currentAgent.full_name,
          transferredFromRole: isAdmin ? 'Admin' : 'Agent',
          transferNote: transferNote.trim(),
          force: true
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTransferModalOpen(false);
        setTransferAgentName('');
        setTransferAgentEmail('');
        setTransferTargetAgentId('');
        setTransferNote('');
        stopWaitingForHumanBeep(selectedConv.id);
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

    const matchedVisitor = conv.visitor || (Array.isArray(liveVisitors) ? liveVisitors.find(v =>
      v.id === conv.id ||
      v.visitor_token === conv.id ||
      v.visitor_token === conv.visitor_id ||
      v.id === conv.visitor_id ||
      (conv.visitor_ip && v.ip_address === conv.visitor_ip)
    ) : undefined);

    let effectiveCountryCode = matchedVisitor?.country_code || (matchedVisitor?.country === 'United Kingdom' || matchedVisitor?.country === 'UK' ? 'GB' : (matchedVisitor?.country === 'Pakistan' ? 'PK' : undefined));
    if (!effectiveCountryCode) {
      if (conv.visitor_ip && (conv.visitor_ip.startsWith('103.') || conv.visitor_ip.startsWith('111.'))) effectiveCountryCode = 'PK';
      else effectiveCountryCode = 'US';
    }
    const flagSrc = getCountryFlagUrl(effectiveCountryCode);
    const lastMsg = conv.messages && conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null;
    const unreadCount = getUnreadCountForConv(conv);
    const isTyping = !!(conv.typing_preview && conv.typing_preview.trim().length > 0);
    const chatBadge = getChatBadge(conv);
    const siteConfig = getWebsiteConfig(conv.property_slug || 'teals-crm');
    const isSelectedForDelete = selectedChatIdsForDelete.has(conv.id);

    return (
      <div
        key={conv.id}
        onClick={() => {
          if (isSelectMode) {
            toggleChatSelection(conv.id);
            return;
          }
          if (conv.messages && conv.messages.length > 0) {
            setMessages(sortTimelineMessages(conv.messages.map(m => ({ ...m, conversation_id: conv.id }))));
          } else {
            setMessages([]);
          }
          onSelectChat(conv.id);
          onMarkRead?.(conv.id);
        }}
        className={`p-3.5 cursor-pointer transition-all hover:bg-[#131d33] group relative ${
          isSelectedForDelete
            ? 'bg-blue-950/40 border-l-4 border-blue-500'
            : isSelected
            ? 'bg-[#152038] border-l-4 border-brand-primary'
            : 'bg-transparent'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2.5 min-w-0 flex-1 mr-2">
            {isSelectMode && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  toggleChatSelection(conv.id);
                }}
                className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 cursor-pointer transition-all ${
                  isSelectedForDelete
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'border-gray-500 hover:border-gray-300 bg-black/20'
                }`}
              >
                {isSelectedForDelete && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            )}
            <img
              src={flagSrc}
              alt="Flag"
              className="w-5 h-3.5 object-cover rounded shadow-sm flex-shrink-0"
              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1.5 mb-1">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${siteConfig.badgeColor}`}>
                  {siteConfig.shortName}
                </span>
                {chatBadge && (
                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/40 flex-shrink-0">
                    {chatBadge}
                  </span>
                )}
              </div>
              <h4 className="text-xs font-bold text-white flex items-center space-x-1.5 truncate">
                <span className="truncate">{conv.visitor_name}</span>
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
              <span
                className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-brand-amber/15 text-brand-amber border border-brand-amber/30 flex items-center space-x-1"
                title={conv.assigned_agent_name ? `Real Name: ${conv.assigned_agent_name}` : undefined}
              >
                <Lock className="w-2.5 h-2.5" />
                <span>
                  {conv.assigned_agent_pseudo_name || conv.assigned_agent_name || 'Claimed'}
                  {conv.assigned_agent_pseudo_name && conv.assigned_agent_name && conv.assigned_agent_pseudo_name !== conv.assigned_agent_name && (
                    <span className="text-[8px] font-normal text-brand-amber/80 ml-1">({conv.assigned_agent_name})</span>
                  )}
                </span>
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
                  handleDeleteChat(conv.id, conv.visitor_name || 'Visitor');
                }}
                title="Delete Chat"
                className="p-1 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 transition-all opacity-80 hover:opacity-100 cursor-pointer"
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
      <div
        className="grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-1 gap-0 lg:gap-4 h-[520px] sm:h-[calc(100vh-210px)] min-h-[420px] max-h-[680px] bg-dark-card border border-dark-border rounded-2xl overflow-hidden shadow-2xl"
        style={{ gridTemplateRows: 'minmax(0, 1fr)' }}
      >
        {/* Column 1: Conversations Inbox List */}
        <div
          className={`lg:col-span-4 border-r border-dark-border flex-col bg-[#0b101d] h-full max-h-full min-h-0 overflow-hidden ${
            selectedConv ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="p-3.5 border-b border-dark-border flex items-center justify-between bg-[#0e1526] shrink-0">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-brand-primary" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Inbox ({visibleConversations.length})
              </h3>
            </div>
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => setShowSetPseudoModal(true)}
                className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 text-[10px] font-semibold transition-all cursor-pointer"
                title="Change your public display (pseudo) name"
              >
                <span>{currentAgent.pseudo_name || currentAgent.full_name}</span>
                {currentAgent.pseudo_name && currentAgent.pseudo_name !== currentAgent.full_name && (
                  <span className="text-gray-400 text-[9px]">({currentAgent.full_name})</span>
                )}
                <Edit3 className="w-2.5 h-2.5 text-blue-400 ml-0.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSelectMode(!isSelectMode);
                  if (isSelectMode) setSelectedChatIdsForDelete(new Set());
                }}
                title={isSelectMode ? 'Exit select mode' : 'Select chats to delete'}
                className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${
                  isSelectMode
                    ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                    : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30'
                }`}
              >
                <CheckSquare className="w-3 h-3" />
                <span>{isSelectMode ? 'Done' : 'Select'}</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={handleResetAllChats}
                  title="Reset and clear all active chats"
                  className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Chats</span>
                </button>
              )}
              <span className="text-[10px] text-brand-emerald font-bold">
                {isAdmin ? 'Admin View' : 'Agent View'}
              </span>
            </div>
          </div>

          {/* Tabs Grid: 5 tabs for both Admin and Working Agents */}
          <div className="grid grid-cols-5 gap-1 p-1.5 bg-[#080d1a] border-b border-dark-border shrink-0">
            {/* 1. Chat 1 Tab */}
            <button
              type="button"
              onClick={() => handleSwitchTab('chat1')}
              className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1 ${
                inboxTab === 'chat1'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-dark-muted hover:text-white hover:bg-dark-surface'
              }`}
            >
              <span className="text-[10px] sm:text-[11px] whitespace-nowrap">Chat 1</span>
              {chat1Unread > 0 ? (
                <span className="min-w-[15px] h-[15px] px-1 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse shadow-sm shadow-rose-500/50">
                  {chat1Unread}
                </span>
              ) : (
                <span className="text-[9px] px-1 rounded-full bg-white/10 text-gray-400">
                  {chat1List.length}
                </span>
              )}
            </button>

            {/* 2. Chat 2 Tab */}
            <button
              type="button"
              onClick={() => handleSwitchTab('chat2')}
              className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1 ${
                inboxTab === 'chat2'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-dark-muted hover:text-white hover:bg-dark-surface'
              }`}
            >
              <span className="text-[10px] sm:text-[11px] whitespace-nowrap">Chat 2</span>
              {chat2Unread > 0 ? (
                <span className="min-w-[15px] h-[15px] px-1 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse shadow-sm shadow-rose-500/50">
                  {chat2Unread}
                </span>
              ) : (
                <span className="text-[9px] px-1 rounded-full bg-white/10 text-gray-400">
                  {chat2List.length}
                </span>
              )}
            </button>

            {/* 3. Live Tab (No emoji / icon) */}
            <button
              type="button"
              onClick={() => handleSwitchTab('live_visitors')}
              className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1 ${
                inboxTab === 'live_visitors'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-dark-muted hover:text-white hover:bg-dark-surface'
              }`}
            >
              <span className="text-[10px] sm:text-[11px] whitespace-nowrap">Live</span>
              <span className="text-[9px] px-1 rounded-full bg-white/10 text-gray-400">
                {liveVisitorsList.length}
              </span>
            </button>

            {/* 4. Lock Tab (Tala icon + Lock text) */}
            <button
              type="button"
              onClick={() => handleSwitchTab('locked')}
              className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1 ${
                inboxTab === 'locked'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-dark-muted hover:text-white hover:bg-dark-surface'
              }`}
            >
              <Lock className="w-2.5 h-2.5 text-amber-400 flex-shrink-0" />
              <span className="text-[10px] sm:text-[11px] whitespace-nowrap">Lock</span>
              {unseenLockedCount > 0 ? (
                <span className="min-w-[15px] h-[15px] px-1 bg-amber-500 text-dark-bg text-[9px] font-black rounded-full flex items-center justify-center animate-pulse shadow-sm shadow-amber-500/50">
                  {unseenLockedCount}
                </span>
              ) : (
                <span className="text-[9px] px-1 rounded-full bg-white/10 text-gray-400">
                  {lockedList.length}
                </span>
              )}
            </button>

            {/* 5. Claimed Tab (No emoji / icon) */}
            <button
              type="button"
              onClick={() => handleSwitchTab('claimed')}
              className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1 ${
                inboxTab === 'claimed'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-dark-muted hover:text-white hover:bg-dark-surface'
              }`}
            >
              <span className="text-[10px] sm:text-[11px] whitespace-nowrap">Claimed</span>
              {claimedUnread > 0 ? (
                <span className="min-w-[15px] h-[15px] px-1 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse shadow-sm shadow-rose-500/50">
                  {claimedUnread}
                </span>
              ) : (
                <span className="text-[9px] px-1 rounded-full bg-white/10 text-gray-400">
                  {claimedList.length}
                </span>
              )}
            </button>
          </div>

          {/* Multi-Select Toolbar (Active when isSelectMode is enabled) */}
          {isSelectMode && (
            <div className="px-3 py-2 bg-blue-950/70 border-b border-blue-500/30 flex items-center justify-between shrink-0 animate-in fade-in duration-150">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="flex items-center space-x-1.5 px-2 py-1 rounded bg-blue-900/60 hover:bg-blue-800/80 text-blue-200 text-[11px] font-semibold border border-blue-400/30 transition-all cursor-pointer"
                >
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                    isAllCurrentSelected ? 'bg-blue-500 border-blue-400 text-white' : 'border-gray-400 bg-transparent'
                  }`}>
                    {isAllCurrentSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </span>
                  <span>{isAllCurrentSelected ? 'Deselect All' : 'Select All'}</span>
                </button>
                <span className="text-[11px] text-blue-300 font-medium">
                  {selectedChatIdsForDelete.size} selected
                </span>
              </div>

              {selectedChatIdsForDelete.size > 0 && (
                <button
                  type="button"
                  onClick={() => setShowBatchDeleteModal(true)}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold shadow-md shadow-red-600/30 transition-all cursor-pointer animate-in zoom-in-95 duration-150"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete Selected ({selectedChatIdsForDelete.size})</span>
                </button>
              )}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto lg:overscroll-contain divide-y divide-dark-border/40">
            {/* 1. Chat 1 List */}
            {inboxTab === 'chat1' && (
              chat1List.length === 0 ? (
                <div className="p-8 text-center text-xs text-dark-muted space-y-2">
                  <AgentAvatar type="ai" size="md" className="mx-auto" />
                  <p className="font-semibold text-white">
                    {isAdmin ? 'No Chat 1 conversations' : 'No claimed Chat 1 conversations'}
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    {isAdmin
                      ? 'Conversations where visitors have replied or started chatting will appear here.'
                      : 'When you claim a Chat 1 conversation from the Locked tab, it will appear here.'}
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
                  <p className="font-semibold text-white">
                    {isAdmin ? 'No Chat 2 conversations' : 'No claimed Chat 2 conversations'}
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    {isAdmin
                      ? 'When visitors click "Start a New Conversation", their 2nd chat will appear here.'
                      : 'When you claim a Chat 2 conversation from the Locked tab, it will appear here.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-dark-border/30">
                  {chat2List.map(renderConvItem)}
                </div>
              )
            )}

            {/* 3. Live Visitors List (Awaiting Visitor Reply) */}
            {inboxTab === 'live_visitors' && (
              liveVisitorsList.length === 0 ? (
                <div className="p-8 text-center text-xs text-dark-muted space-y-2">
                  <Radio className="w-8 h-8 text-emerald-400 mx-auto opacity-70 animate-pulse" />
                  <p className="font-semibold text-white">No Live Visitor Chats</p>
                  <p className="text-[11px] leading-relaxed">
                    When you send a proactive message to a live visitor from the Monitoring table, it will appear here until they reply. Once they reply, the conversation automatically moves to Chat 1.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-dark-border/30">
                  {liveVisitorsList.map(renderConvItem)}
                </div>
              )
            )}

            {/* 4. Locked List (Awaiting Human Agent Claim) */}
            {inboxTab === 'locked' && (
              lockedList.length === 0 ? (
                <div className="p-8 text-center text-xs text-dark-muted space-y-2">
                  <Lock className="w-8 h-8 text-dark-muted mx-auto opacity-50" />
                  <p className="font-semibold text-white">No locked chats</p>
                  <p className="text-[11px] leading-relaxed">
                    Chats where visitors ask for a real human agent will lock and appear here for claim with an alert sound.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-dark-border/30">
                  {lockedList.map(renderConvItem)}
                </div>
              )
            )}

            {/* 5. Claimed List */}
            {inboxTab === 'claimed' && (
              claimedList.length === 0 ? (
                <div className="p-8 text-center text-xs text-dark-muted space-y-2">
                  <UserCheck className="w-8 h-8 text-dark-muted mx-auto opacity-50" />
                  <p className="font-semibold text-white">
                    {isAdmin ? 'No claimed chats' : 'No claimed chats yet'}
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    {isAdmin
                      ? 'Chats claimed by live support agents will appear here.'
                      : 'Chats you claim from the Locked tab will appear here for you to manage.'}
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
        <div
          className={`lg:col-span-5 flex-col justify-between bg-dark-bg/40 relative h-full max-h-full min-h-0 overflow-hidden ${
            selectedConv && !mobileShowInfo ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {selectedConv ? (
            <>
              {/* Header */}
              <div className="p-2.5 sm:p-3.5 border-b border-dark-border bg-dark-surface/60 flex items-center justify-between gap-2 sm:gap-3 shrink-0">
                <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                  <button
                    onClick={() => onSelectChat('')}
                    title="Back to List"
                    className="p-1.5 rounded-lg bg-dark-card hover:bg-dark-cardHover border border-dark-border text-dark-muted hover:text-white text-xs font-semibold flex items-center space-x-1 shrink-0"
                  >
                    <span>← Back</span>
                  </button>
                  <AgentAvatar
                    type={selectedConv.assigned_agent_id ? 'male' : 'ai'}
                    name={selectedConv.assigned_agent_name || ''}
                    size="md"
                  />
                  {(() => {
                    const selectedSiteConfig = getWebsiteConfig(selectedConv.property_slug || 'teals-crm');
                    return (
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-xs font-bold text-white truncate flex items-center space-x-1.5">
                            <span>
                              {selectedConv.assigned_agent_pseudo_name || selectedConv.assigned_agent_name
                                ? (selectedConv.assigned_agent_pseudo_name || selectedConv.assigned_agent_name)
                                : isAiAutomated
                                ? `${selectedSiteConfig.shortName} AI Auto-Support`
                                : 'Unassigned Chat'}
                            </span>
                            {selectedConv.assigned_agent_pseudo_name && selectedConv.assigned_agent_name && (
                              <span className="text-[10px] font-normal text-gray-400">
                                (Real: {selectedConv.assigned_agent_name})
                              </span>
                            )}
                            {selectedConv.assigned_agent_role_title && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 font-semibold">
                                {selectedConv.assigned_agent_role_title}
                              </span>
                            )}
                          </h3>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${selectedSiteConfig.badgeColor}`}>
                            {selectedSiteConfig.shortName}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-[10px] text-dark-muted mt-0.5 truncate">
                          <span className="truncate">
                            {isClaimedByMe
                              ? 'You are actively assisting this customer'
                              : isClaimedByOther
                              ? `Assigned to ${selectedConv.assigned_agent_name}`
                              : isAiAutomated
                              ? `AI handling via ${selectedSiteConfig.shortName} dedicated engine`
                              : 'Customer requested human assistance - claim to take over'}
                          </span>
                          {selectedSiteConfig.domain && (
                            <>
                              <span className="hidden sm:inline">•</span>
                              <a
                                href={selectedSiteConfig.url}
                                target="_blank"
                                rel="noreferrer"
                                className="hidden sm:flex text-blue-400 hover:underline items-center space-x-0.5 shrink-0"
                              >
                                <span>{selectedSiteConfig.domain}</span>
                                <ExternalLink className="w-2.5 h-2.5 inline" />
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex flex-col items-end justify-center space-y-1.5 shrink-0">
                  {/* Top Row: Mobile Info Toggle + Transfer Button & Delete Button */}
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => setMobileShowInfo(true)}
                      className="lg:hidden px-2 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 text-[10px] font-bold transition-all"
                      title="View Visitor Session Details"
                    >
                      Info
                    </button>
                    {(isClaimedByMe || isAdmin) && (selectedConv.assigned_agent_name || selectedConv.mode === 'human') && (
                      <button
                        onClick={openTransferModal}
                        title="Transfer Conversation to Another Agent / Admin"
                        className="px-2 sm:px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-[10px] sm:text-[11px] font-bold transition-all flex items-center space-x-1 cursor-pointer hover:scale-102 active:scale-98"
                      >
                        <ArrowRightLeft className="w-3 h-3 text-purple-400" />
                        <span>Transfer</span>
                      </button>
                    )}

                    {(isAdmin || isClaimedByMe) && (
                      <button
                        onClick={() => handleDeleteChat(selectedConv.id, selectedConv.visitor_name || 'Visitor')}
                        title="Delete Conversation"
                        className="p-1 px-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[11px] font-semibold flex items-center space-x-1 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    )}
                  </div>

                  {/* Bottom Row: Claim / Claimed / AI Active Badge */}
                  <div>
                    {isNeedsClaim ? (
                      <button
                        onClick={() => setClaimModalOpen(true)}
                        disabled={claiming}
                        className="px-3 py-1 rounded-lg bg-brand-rose hover:bg-rose-600 text-white text-xs font-bold shadow-lg transition-all flex items-center space-x-1.5 animate-bounce disabled:opacity-50 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{claiming ? 'Claiming...' : 'Claim Chat'}</span>
                      </button>
                    ) : isAiAutomated ? (
                      isAdmin ? (
                        <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[11px] font-bold flex items-center space-x-1.5">
                          <Bot className="w-3 h-3" />
                          <span>AI Active</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => setClaimModalOpen(true)}
                          disabled={claiming}
                          className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-[11px] font-bold transition-all flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                        >
                          <UserPlus className="w-3 h-3" />
                          <span>{claiming ? 'Claiming...' : 'Take Over'}</span>
                        </button>
                      )
                    ) : isClaimedByMe ? (
                      <span className="px-2.5 py-0.5 rounded-lg bg-brand-emerald/15 text-brand-emerald border border-brand-emerald/30 text-[11px] font-bold flex items-center space-x-1">
                        <Lock className="w-3 h-3" />
                        <span>Claimed (You)</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-lg bg-brand-amber/15 text-brand-amber border border-brand-amber/30 text-[11px] font-bold flex items-center space-x-1">
                        <Lock className="w-3 h-3" />
                        <span>{selectedConv.assigned_agent_name}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Claim Error Notice */}
              {claimError && (
                <div className="p-2.5 bg-brand-rose/20 border-b border-brand-rose/40 text-brand-rose text-xs flex items-center space-x-2 shrink-0">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{claimError}</span>
                </div>
              )}

              {/* Transferred Chat Notification Banner */}
              {selectedConv.transferred_from_name && (
                <div className="mx-4 mt-3 p-3 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-200 text-xs flex items-start gap-2.5 shrink-0">
                  <ArrowRightLeft className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold">
                      {selectedConv.transferred_from_role === 'Admin' ? 'Admin' : 'Agent'} {selectedConv.transferred_from_name} transferred this chat to you.
                    </p>
                    {selectedConv.transfer_note && (
                      <p className="text-[11px] text-purple-300/90 mt-1 italic bg-purple-950/40 p-1.5 rounded-lg border border-purple-500/20">
                        "{selectedConv.transfer_note}"
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Message Stream with Optional Blurred Claim Overlay */}
              <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
                <div
                  ref={chatContainerRef}
                  onScroll={handleChatScroll}
                  className={`flex-1 min-h-0 overflow-y-auto lg:overscroll-contain p-3 sm:p-4 space-y-3 transition-all duration-300 ${
                    isNeedsClaim && !isAdmin ? 'filter blur-sm select-none pointer-events-none' : ''
                  }`}
                >
                  {displayMessages.map((m) => {
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
                            {isVisitor ? selectedConv.visitor_name : (
                              (m as any).sender_pseudo_name && (m as any).sender_real_name && (m as any).sender_pseudo_name !== (m as any).sender_real_name
                                ? `${(m as any).sender_pseudo_name} (Real: ${(m as any).sender_real_name})`
                                : m.sender_name
                            )}
                          </span>
                          {!isVisitor && (() => {
                            if (m.sender_type === 'ai') {
                              return (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 font-semibold">
                                  AI
                                </span>
                              );
                            }
                            const roleTitle = (m as any).sender_role_title || (isAdmin ? 'Admin' : 'Support Specialist');
                            return (
                              <span
                                className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30"
                              >
                                {roleTitle}
                              </span>
                            );
                          })()}
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

                          {/* Consultation Form Indicator in Console */}
                          {(Boolean((m as any).is_form) || (m as any).form_type === 'booking' || (m.sender_type === 'ai' && /consultation booking form|strategy meeting|booking form right below|consultation booking|schedule a call|book a free 1-on-1|pricing is fully customized|our pricing is customized/i.test(m.content || ''))) && (
                            <div className="mt-2 p-2.5 rounded-xl bg-black/40 border border-blue-400/30 text-[11px] text-blue-200">
                              <div className="flex items-center space-x-1.5 font-bold text-white mb-1">
                                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                                <span>Interactive Consultation Booking Card</span>
                              </div>
                              {(m as any).form_data ? (
                                <div className="space-y-1 text-[10px] text-gray-300">
                                  <div className="text-emerald-400 font-semibold">
                                    🇵🇰 Pakistan Time: <strong className="text-white">{(m as any).form_data.pktDate || (m as any).form_data.date}</strong> at <strong className="text-white">{(m as any).form_data.pktTime || (m as any).form_data.time} [PKT]</strong>
                                  </div>
                                  <div className="text-sky-300">
                                    🌐 Client Local Time: <span>{(m as any).form_data.date} at {(m as any).form_data.time}</span> {Boolean((m as any).form_data.visitorTimezone) && `(${(m as any).form_data.visitorTimezone.replace('_', ' ')})`}
                                  </div>
                                  <div>Service: <span className="text-amber-300 font-medium">{(m as any).form_data.service}</span></div>
                                  <div>Contact: <span className="text-blue-300 font-medium">{(m as any).form_data.email}</span> | {(m as any).form_data.phone}</div>
                                </div>
                              ) : (
                                <span className="text-[10px] text-gray-400 italic">Booking form presented to visitor</span>
                              )}
                            </div>
                          )}
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
                <div className="px-4 py-2 bg-blue-950/60 border-t border-blue-900/50 flex items-start space-x-2 text-[11px] text-blue-300 shrink-0">
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
                <div className="px-4 py-2 bg-brand-amber/10 border-t border-brand-amber/20 text-center text-xs text-brand-amber font-medium shrink-0">
                  This conversation is handled by {selectedConv.assigned_agent_name} (Read-only)
                </div>
              )}

              {/* Reply Form */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-dark-border bg-dark-surface/60 space-y-2 shrink-0">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleToggleWhisper}
                      disabled={isClaimedByOther && !isAdmin}
                      className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        isWhisperMode
                          ? 'bg-brand-amber text-dark-bg font-black'
                          : 'bg-dark-card text-dark-muted hover:text-white border border-dark-border'
                      }`}
                    >
                      {isWhisperMode ? '🔒 Whisper (Private)' : 'Public Reply'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSendBookingForm}
                      disabled={isClaimedByOther && !isAdmin}
                      className="flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-400/40 transition-all cursor-pointer shadow-md shadow-blue-900/30 hover:shadow-blue-600/25 active:scale-95"
                      title="Send Consultation Booking & Estimate Form to visitor"
                    >
                      <Calendar className="w-3.5 h-3.5 text-blue-400" />
                      <span>📅 Send Booking Form</span>
                    </button>
                  </div>
                  {isWhisperMode && (
                    <span className="text-[10px] text-brand-amber italic font-medium">
                      🔒 Private note - Hidden from customer / Alert triggered
                    </span>
                  )}
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
                        agentInputRef.current?.focus({ preventScroll: true });
                      }
                    }}
                    rows={1}
                    disabled={isClaimedByOther && !isAdmin}
                    placeholder={
                      isClaimedByOther && !isAdmin
                        ? `Handled by ${selectedConv.assigned_agent_name} (Read-only)`
                        : isClaimedByMe || isAdmin
                        ? isWhisperMode
                          ? 'Type private note for team (Enter to send)...'
                          : 'Type reply as support agent (Enter to send)...'
                        : 'Type message to claim & take over from AI...'
                    }
                    className="flex-1 bg-dark-card border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-dark-muted focus:outline-none focus:border-brand-primary disabled:opacity-40 resize-none overflow-y-auto whitespace-pre-wrap break-words leading-relaxed transition-[height] duration-75"
                    style={{ minHeight: '38px', maxHeight: '130px' }}
                  />
                  <button
                    type="submit"
                    disabled={(isClaimedByOther && !isAdmin) || sending || !inputText.trim()}
                    className="p-2.5 rounded-xl bg-brand-primary text-white hover:bg-brand-primaryHover transition-all disabled:opacity-40 flex-shrink-0 mb-0.5 shadow-md cursor-pointer"
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
        <div
          className={`lg:col-span-3 border-l border-dark-border p-4 bg-[#0b101d] flex-col justify-start h-full max-h-full min-h-0 overflow-y-auto lg:overscroll-contain ${
            selectedConv && mobileShowInfo ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {selectedConv && (!isClaimedByOther || isAdmin) ? (
            <div className="space-y-5">
              <div className="lg:hidden flex items-center justify-between pb-2 border-b border-dark-border">
                <button
                  type="button"
                  onClick={() => setMobileShowInfo(false)}
                  className="px-3 py-1.5 rounded-lg bg-dark-card hover:bg-dark-cardHover border border-dark-border text-white text-xs font-semibold flex items-center space-x-1"
                >
                  <span>← Back to Chat</span>
                </button>
                <span className="text-xs font-bold text-dark-muted">Visitor Details</span>
              </div>
              {(() => {
                const visitorObj = selectedConv.visitor || (Array.isArray(liveVisitors) ? liveVisitors.find(v =>
                  v.id === selectedConv.id ||
                  v.visitor_token === selectedConv.id ||
                  v.visitor_token === selectedConv.visitor_id ||
                  v.id === selectedConv.visitor_id ||
                  (selectedConv.visitor_ip && v.ip_address === selectedConv.visitor_ip)
                ) : undefined);

                let countryCode = visitorObj?.country_code || (visitorObj?.country === 'United Kingdom' || visitorObj?.country === 'UK' ? 'GB' : (visitorObj?.country === 'Pakistan' ? 'PK' : undefined));
                if (!countryCode) {
                  if (selectedConv.visitor_ip && (selectedConv.visitor_ip.startsWith('103.') || selectedConv.visitor_ip.startsWith('111.'))) countryCode = 'PK';
                  else countryCode = 'US';
                }
                const flagSrc = getCountryFlagUrl(countryCode);
                const locCity = visitorObj?.city || 'United States';
                const locCountry = visitorObj?.country || (countryCode === 'GB' ? 'United Kingdom' : (countryCode === 'PK' ? 'Pakistan' : 'USA'));
                const mapQuery = encodeURIComponent(`${locCity}, ${locCountry}`);
                const selectedSiteConfig = getWebsiteConfig(selectedConv.property_slug || 'teals-crm');

                return (
                  <>
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
                        Session Information
                      </h3>
                      <div className="bg-dark-card border border-dark-border rounded-xl p-3.5 space-y-2">
                        <div className="flex items-center space-x-2.5">
                          <img
                            src={flagSrc}
                            alt="Flag"
                            className="w-6 h-4 object-cover rounded shadow-sm"
                          />
                          <div>
                            <div className="text-xs font-bold text-white flex items-center space-x-1">
                              <span>{locCity}, {locCountry}</span>
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-brand-secondary hover:text-white"
                              >
                                <MapPin className="w-3 h-3 inline" />
                              </a>
                            </div>
                            <div className="text-[10px] text-dark-muted font-mono">{visitorObj?.ip_address || selectedConv.visitor_ip || 'Live Online'}</div>
                          </div>
                        </div>
                        {(selectedConv.visitor_name || visitorObj?.visitor_name || visitorObj?.name) && (
                          <div className="pt-1.5 border-t border-dark-border/60 text-[10px] text-dark-muted flex justify-between items-center">
                            <span>Name: </span>
                            <span className="text-white font-medium truncate ml-2 text-right">
                              {selectedConv.visitor_name || visitorObj?.visitor_name || visitorObj?.name}
                            </span>
                          </div>
                        )}
                        {(selectedConv.visitor_email || visitorObj?.visitor_email || visitorObj?.email) && (
                          <div className="pt-1.5 border-t border-dark-border/60 text-[10px] text-dark-muted flex justify-between items-center">
                            <span>Email: </span>
                            <span className="text-white font-medium truncate ml-2 text-right">
                              {selectedConv.visitor_email || visitorObj?.visitor_email || visitorObj?.email}
                            </span>
                          </div>
                        )}
                        {(selectedConv.visitor_phone || visitorObj?.visitor_phone || visitorObj?.phone) && (
                          <div className="pt-1.5 border-t border-dark-border/60 text-[10px] text-dark-muted flex justify-between items-center">
                            <span>Phone: </span>
                            <span className="text-white font-medium truncate ml-2 text-right">
                              {selectedConv.visitor_phone || visitorObj?.visitor_phone || visitorObj?.phone}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[11px] font-bold text-dark-muted uppercase mb-2">Origin Website & Navigation</h4>
                      <div className="bg-dark-card border border-dark-border rounded-xl p-3 space-y-2.5 text-xs">
                        <div>
                          <span className="text-dark-muted text-[10px]">Origin Website:</span>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="font-bold text-white text-[11px] truncate mr-2">{selectedSiteConfig.name}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${selectedSiteConfig.badgeColor}`}>
                              {selectedSiteConfig.shortName}
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="text-dark-muted text-[10px]">Website URL:</span>
                          <p className="font-mono text-[11px] text-blue-400 truncate">
                            <a href={selectedSiteConfig.url} target="_blank" rel="noreferrer" className="hover:underline flex items-center space-x-1">
                              <span className="truncate">{selectedSiteConfig.url}</span>
                              <ExternalLink className="w-2.5 h-2.5 inline flex-shrink-0" />
                            </a>
                          </p>
                        </div>
                        <div>
                          <span className="text-dark-muted text-[10px]">Active Page URL:</span>
                          <p className="font-mono text-brand-secondary text-[11px] break-all">
                            {visitorObj?.current_page || selectedConv.visitor?.current_page || '/'}
                          </p>
                        </div>
                        <div>
                          <span className="text-dark-muted text-[10px]">Traffic Referrer:</span>
                          <p className="font-mono text-white text-[11px] truncate">
                            {visitorObj?.referrer || selectedConv.visitor?.referrer || 'Direct Visit'}
                          </p>
                        </div>
                        <div>
                          <span className="text-dark-muted text-[10px]">Dedicated AI Key:</span>
                          <p className="text-emerald-400 text-[10px] font-semibold flex items-center space-x-1 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                            <span className="truncate">Gemini 2.0 Flash ({selectedSiteConfig.shortName})</span>
                          </p>
                        </div>
                        <div>
                          <span className="text-dark-muted text-[10px]">Device & Browser:</span>
                          <p className="text-dark-text text-[11px] mt-0.5">{visitorObj?.os || selectedConv.visitor?.os || 'Mobile / Desktop'} on {visitorObj?.browser || selectedConv.visitor?.browser || 'Chrome'}</p>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
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
          <div className="bg-[#0b101d] border border-dark-border rounded-2xl max-w-xl w-full p-5 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-dark-border/60 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-500/10 shrink-0">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <span>Transfer Conversation</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30 uppercase">
                      Live Handoff
                    </span>
                  </h3>
                  <p className="text-[11px] text-dark-muted mt-0.5">
                    Reassign <span className="text-white font-semibold">{selectedConv?.visitor_name || 'Visitor'}</span> to an Admin or Support Agent
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTransferModalOpen(false)}
                className="text-dark-muted hover:text-white p-1.5 rounded-xl bg-dark-card hover:bg-dark-cardHover border border-dark-border transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {transferError && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{transferError}</span>
              </div>
            )}

            <form onSubmit={handleTransferChat} className="space-y-4">
              {/* 1. Section 1: Administrators */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-amber-400 flex items-center space-x-1.5 uppercase tracking-wider">
                    <Shield className="w-3.5 h-3.5" />
                    <span>1. Administrators ({adminList.length})</span>
                  </label>
                  <span className="text-[10px] text-dark-muted">Click profile to select</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {adminList.map(adm => {
                    const isSelected = transferAgentName === adm.full_name || (transferTargetAgentId && transferTargetAgentId === adm.id);
                    return (
                      <button
                        key={adm.id}
                        type="button"
                        onClick={() => {
                          setTransferAgentName(adm.full_name);
                          setTransferAgentEmail(adm.email);
                          setTransferTargetAgentId(adm.id);
                        }}
                        className={`p-2.5 rounded-xl border text-left flex items-center space-x-2.5 transition-all cursor-pointer group ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-400 text-white shadow-lg shadow-amber-500/15 ring-2 ring-amber-400/40'
                            : 'bg-[#12192c] border-dark-border/80 hover:border-amber-500/40 hover:bg-[#162038] text-gray-300'
                        }`}
                      >
                        <div className="relative shrink-0">
                          <AgentAvatar type="male" name={adm.full_name} size="sm" />
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#12192c] ${
                              adm.is_online ? 'bg-emerald-400 ring-1 ring-emerald-400/50' : 'bg-gray-500'
                            }`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-white truncate">{adm.full_name}</span>
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 uppercase shrink-0 border border-amber-500/30">
                              Admin
                            </span>
                          </div>
                          <span className="text-[10px] text-dark-muted truncate block">{adm.email}</span>
                        </div>
                        {isSelected && (
                          <div className="shrink-0 text-amber-400">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Section 2: Working Support Agents */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-blue-400 flex items-center space-x-1.5 uppercase tracking-wider">
                    <Users className="w-3.5 h-3.5" />
                    <span>2. Working Support Agents ({agentList.length})</span>
                  </label>
                  <span className="text-[10px] text-dark-muted">Click profile to select</span>
                </div>
                {agentList.length === 0 ? (
                  <div className="p-3.5 bg-[#12192c] border border-dark-border/60 rounded-xl text-center text-xs text-dark-muted">
                    No active support agents currently registered in system.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {agentList.map(ag => {
                      const isSelected = transferAgentName === ag.full_name || (transferTargetAgentId && transferTargetAgentId === ag.id);
                      return (
                        <button
                          key={ag.id}
                          type="button"
                          onClick={() => {
                            setTransferAgentName(ag.full_name);
                            setTransferAgentEmail(ag.email);
                            setTransferTargetAgentId(ag.id);
                          }}
                          className={`p-2.5 rounded-xl border text-left flex items-center space-x-2.5 transition-all cursor-pointer group ${
                            isSelected
                              ? 'bg-purple-600/25 border-purple-400 text-white shadow-lg shadow-purple-500/15 ring-2 ring-purple-400/40'
                              : 'bg-[#12192c] border-dark-border/80 hover:border-purple-500/40 hover:bg-[#162038] text-gray-300'
                          }`}
                        >
                          <div className="relative shrink-0">
                            <AgentAvatar type="male" name={ag.full_name} size="sm" />
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#12192c] ${
                                ag.is_online ? 'bg-emerald-400 ring-1 ring-emerald-400/50' : 'bg-gray-500'
                              }`}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold text-white truncate">{ag.full_name}</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 shrink-0 border border-blue-500/30">
                                Agent
                              </span>
                            </div>
                            <span className="text-[10px] text-dark-muted truncate block">{ag.email}</span>
                          </div>
                          {isSelected && (
                            <div className="shrink-0 text-purple-400">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected Target Preview */}
              {transferAgentName && (
                <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between">
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className="text-[11px] text-dark-muted">Selected Target:</span>
                    <span className="text-xs font-bold text-purple-200 truncate">{transferAgentName}</span>
                    {transferAgentEmail && (
                      <span className="text-[10px] text-dark-muted truncate">({transferAgentEmail})</span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 shrink-0 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    <span>Ready</span>
                  </span>
                </div>
              )}

              {/* 3. Section 3: Transfer Note / Reason */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-300">
                  3. Transfer Note / Reason <span className="text-dark-muted font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Customer asking for custom discount package / technical inquiry..."
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  className="w-full bg-[#12192c] border border-dark-border rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none"
                />
              </div>

              {/* Footer Actions */}
              <div className="flex items-center space-x-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 text-xs font-bold transition-all cursor-pointer border border-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferring || !transferAgentName.trim()}
                  className="flex-[2] py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-purple-600/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>
                    {transferring
                      ? 'Transferring...'
                      : transferAgentName
                      ? `Transfer Chat to ${transferAgentName}`
                      : 'Select an Admin or Agent Above'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Auto-Claim / Take Over Confirmation Modal */}
      {autoClaimPromptOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0f172a] border border-blue-500/40 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl relative text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Take Over from AI?</h3>
              <p className="text-xs text-dark-muted mt-1.5 leading-relaxed">
                You are about to claim this conversation from AI. The visitor will be connected to a <span className="text-white font-bold">Real Agent</span> and your message will be sent.
              </p>
            </div>
            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setAutoClaimPromptOpen(false)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAutoClaim}
                disabled={claiming}
                className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg disabled:opacity-50 flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>{claiming ? 'Claiming...' : 'Claim & Send'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Chat Confirmation Modal */}
      {chatToDelete && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#11192e] border border-red-500/40 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl relative text-center animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Permanently Delete Chat?</h3>
              <p className="text-xs text-gray-300 mt-2 leading-relaxed">
                Are you sure you want to permanently delete the conversation with <span className="text-white font-bold">{chatToDelete.name}</span>? All messages will be wiped from storage and cannot be restored.
              </p>
            </div>
            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setChatToDelete(null)}
                disabled={isDeletingChat}
                className="flex-1 py-2.5 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold transition-all cursor-pointer border border-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteChatAction}
                disabled={isDeletingChat}
                className="flex-1 py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-lg shadow-red-600/30 disabled:opacity-50 flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingChat ? 'Deleting...' : 'Delete Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      {showBatchDeleteModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#11192e] border border-red-500/40 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl relative text-center animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Delete Selected Chats?</h3>
              <p className="text-xs text-gray-300 mt-2 leading-relaxed">
                Are you sure you want to permanently delete <span className="text-white font-bold">{selectedChatIdsForDelete.size} conversation(s)</span>? All messages will be wiped from storage and cannot be restored.
              </p>
            </div>
            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setShowBatchDeleteModal(false)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold transition-all cursor-pointer border border-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBatchDelete}
                className="flex-1 py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-lg shadow-red-600/30 flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete ({selectedChatIdsForDelete.size})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset All Chats Confirmation Modal */}
      {showResetAllModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#11192e] border border-red-500/40 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl relative text-center animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Reset & Clear All Chats?</h3>
              <p className="text-xs text-gray-300 mt-2 leading-relaxed">
                This will permanently wipe all active customer conversations from server memory and cloud storage. This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setShowResetAllModal(false)}
                disabled={isResettingAll}
                className="flex-1 py-2.5 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold transition-all cursor-pointer border border-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmResetAllChatsAction}
                disabled={isResettingAll}
                className="flex-1 py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-lg shadow-red-600/30 disabled:opacity-50 flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isResettingAll ? 'Resetting...' : 'Reset All Chats'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Pseudo Name Modal */}
      {showSetPseudoModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#11192e] border border-blue-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Set Display (Pseudo) Name</h3>
                  <p className="text-[11px] text-gray-400">Public persona shown to website visitors</p>
                </div>
              </div>
              {currentAgent.pseudo_name && (
                <button
                  type="button"
                  onClick={() => setShowSetPseudoModal(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <p className="text-xs text-gray-300 leading-relaxed bg-[#0b101d] p-3 rounded-xl border border-gray-800">
              Company policy requires agents to use a display name for visitors. Website visitors will <strong>only see your display name</strong> (e.g. Jack) and role. Your real name (<span className="text-blue-400 font-semibold">{currentAgent.full_name}</span>) remains private and only visible internally to Admins.
            </p>

            <form onSubmit={handleSavePseudoName} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-200 mb-1">
                  Display / Pseudo Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={pseudoNameInput}
                  onChange={(e) => setPseudoNameInput(e.target.value)}
                  placeholder="e.g. Jack, Alex, David, Sarah"
                  required
                  className="w-full bg-[#131d33] border border-gray-700 focus:border-blue-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-200 mb-1">
                  Role / Department Title
                </label>
                <input
                  type="text"
                  value={roleTitleInput}
                  onChange={(e) => setRoleTitleInput(e.target.value)}
                  placeholder={isAdmin ? 'Manager' : 'Support Specialist'}
                  className="w-full bg-[#131d33] border border-gray-700 focus:border-blue-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Shown beneath your display name (e.g. "Manager", "Support Specialist", "Account Executive").
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                {currentAgent.pseudo_name && (
                  <button
                    type="button"
                    onClick={() => setShowSetPseudoModal(false)}
                    className="py-2 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold transition-all cursor-pointer border border-gray-700"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!pseudoNameInput.trim()}
                  className="py-2 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/30 cursor-pointer"
                >
                  Save Display Name
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
