'use client';

import React, { useState, useEffect } from 'react';
import { LiveChatConsole, ChatSession } from '@/components/LiveChatConsole';
import { useLiveSync } from '@/context/LiveSyncContext';

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

  const { conversations, refreshSync, resetUnreadCount, markConversationAsRead } = useLiveSync();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  useEffect(() => {
    const rawSession = localStorage.getItem('teals_agent_session');
    if (rawSession) {
      try {
        setCurrentAgent(JSON.parse(rawSession));
      } catch {}
    }
  }, []);

  const handleClaimSuccess = async () => {
    await refreshSync();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Active Chats & AI Handoff</h1>
        <p className="text-xs text-dark-muted mt-0.5">Real-time messaging inbox with Gemini AI auto-support and instant agent takeover</p>
      </div>

      <LiveChatConsole
        currentAgent={currentAgent || { id: 'agent_garry_admin', full_name: 'Garry Amelia', email: 'garryamelia6265@gmail.com', role: 'admin' }}
        selectedChatId={selectedChatId}
        conversations={conversations as unknown as ChatSession[]}
        onSelectChat={(id) => {
          setSelectedChatId(id || null);
          if (id) markConversationAsRead(id);
        }}
        onClaimSuccess={handleClaimSuccess}
        onMarkRead={markConversationAsRead}
      />
    </div>
  );
}
