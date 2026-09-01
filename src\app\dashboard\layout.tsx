'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { EmbedCodeModal } from '@/components/EmbedCodeModal';
import { supabase } from '@/lib/supabase';
import { LiveSyncProvider, useLiveSync } from '@/context/LiveSyncContext';

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [currentAgent, setCurrentAgent] = useState<{
    id: string;
    email: string;
    full_name: string;
    role: string;
    status: string;
    phone?: string;
  } | null>(null);

  const [isEmbedModalOpen, setIsEmbedModalOpen] = useState(false);
  const [pendingAgentsCount, setPendingAgentsCount] = useState(0);

  const { liveCount, chatCount, unreadConversationsCount, conversations, soundEnabled, toggleSound, unreadCount, resetUnreadCount } = useLiveSync();

  useEffect(() => {
    const rawSession = localStorage.getItem('teals_agent_session');
    if (!rawSession) {
      router.push('/login');
      return;
    }
    try {
      const agent = JSON.parse(rawSession);
      if (agent.status !== 'approved' && agent.role !== 'admin') {
        router.push('/login');
        return;
      }
      setCurrentAgent(agent);

      fetch('/api/agent/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: agent.email,
          status: 'online'
        })
      }).catch(() => {});
    } catch {
      router.push('/login');
    }
  }, [router]);

  const isAdmin = currentAgent?.role === 'admin' || currentAgent?.email === 'garryamelia6265@gmail.com';

  useEffect(() => {
    if (!isAdmin) return;

    const fetchApprovals = async () => {
      try {
        const appRes = await fetch('/api/agent/approvals');
        if (appRes.ok) {
          const appData = await appRes.json();
          setPendingAgentsCount(appData.pendingAgents ? appData.pendingAgents.length : 0);
        }
      } catch {}
    };
    fetchApprovals();
    const interval = setInterval(fetchApprovals, 2000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('teals_agent_session');
    router.push('/login');
  };

  if (!currentAgent) return null;

  return (
    <div className="flex h-screen bg-[#070b14] text-dark-text overflow-hidden">
      <Sidebar
        liveCount={liveCount}
        chatCount={unreadConversationsCount}
        pendingAgentsCount={pendingAgentsCount}
        isAdmin={isAdmin}
        unreadCount={isAdmin ? unreadCount : 0}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          currentAgent={currentAgent}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
          onOpenEmbedModal={() => setIsEmbedModalOpen(true)}
          onSignOut={handleSignOut}
        />

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      <EmbedCodeModal
        isOpen={isEmbedModalOpen}
        onClose={() => setIsEmbedModalOpen(false)}
        propertySlug="teals-crm"
      />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <LiveSyncProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </LiveSyncProvider>
  );
}
