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
  const prevPendingCountRef = React.useRef<number | null>(null);

  const { liveCount, chatCount, unreadConversationsCount, conversations, soundEnabled, toggleSound, unreadCount, resetUnreadCount } = useLiveSync();

  useEffect(() => {
    // 1. Auto Single Sign-On (SSO) when embedded inside CRM
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const ssoEmail = urlParams.get('sso_email');
      const ssoName = urlParams.get('sso_name');
      const ssoRole = urlParams.get('sso_role');

      if (ssoEmail) {
        const adminEmails = ['garryamelia6265@gmail.com', 'tzafar04@gmail.com', 'annusraees@gmail.com'];
        const cleanEmail = ssoEmail.toLowerCase().trim();
        const isAdm = ssoRole === 'admin' || adminEmails.includes(cleanEmail);
        const ssoAgent = {
          id: `agent_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
          email: cleanEmail,
          full_name: ssoName || cleanEmail.split('@')[0],
          role: isAdm ? 'admin' : (ssoRole || 'agent'),
          status: 'approved'
        };
        localStorage.setItem('teals_agent_session', JSON.stringify(ssoAgent));
        setCurrentAgent(ssoAgent);

        fetch('/api/agent/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: ssoAgent.email,
            status: 'online'
          })
        }).catch(() => {});
        return;
      }
    }

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

  const adminEmails = ['garryamelia6265@gmail.com', 'tzafar04@gmail.com', 'annusraees@gmail.com'];
  const isAdmin = currentAgent?.role === 'admin' || (currentAgent?.email && adminEmails.includes(currentAgent.email.toLowerCase()));

  useEffect(() => {
    if (!isAdmin) return;

    const fetchApprovals = async () => {
      try {
        const appRes = await fetch('/api/agent/approvals');
        if (appRes.ok) {
          const appData = await appRes.json();
          const count = appData.pendingAgents ? appData.pendingAgents.length : 0;
          if (prevPendingCountRef.current !== null && count > prevPendingCountRef.current) {
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              new Notification('New Agent Approval Request', {
                body: `You have ${count} pending agent registration(s) waiting for approval!`,
                icon: '/favicon.ico'
              });
            }
          }
          prevPendingCountRef.current = count;
          setPendingAgentsCount(count);
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
