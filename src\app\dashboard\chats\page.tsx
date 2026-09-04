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

  const getSelectedKey = (email?: string) => {
    const clean = (email || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
    return clean ? `teals_selected_chat_${clean}` : 'teals_selected_chat_id';
  };

  const [selectedChatId, setSelectedChatId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('teals_agent_session');
        const email = raw ? JSON.parse(raw)?.email : '';
        const key = (email || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
        return localStorage.getItem(key ? `teals_selected_chat_${key}` : 'teals_selected_chat_id') || null;
      } catch {}
    }
    return null;
  });

  const { conversations, refreshSync, markConversationAsRead } = useLiveSync();

  useEffect(() => {
    const rawSession = localStorage.getItem('teals_agent_session');
    if (rawSession) {
      try {
        const parsed = JSON.parse(rawSession);
        setCurrentAgent(parsed);
        const key = getSelectedKey(parsed.email);
        const saved = localStorage.getItem(key);
        if (saved) setSelectedChatId(saved);
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
    </div>
  );
}
