'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { EmbedCodeModal } from '@/components/EmbedCodeModal';
import { supabase } from '@/lib/supabase';
import { REALTIME_CHANNEL } from '@/lib/realtime';
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
    let activePingTimer: NodeJS.Timeout | null = null;
    let activeChannel: any = null;

    const setupEvictionAndPing = (agentObj: { id: string; email: string; full_name: string; role: string; status: string; phone?: string }) => {
      const cleanEmail = (agentObj.email || '').toLowerCase().trim();
      const cleanId = (agentObj.id || '').toLowerCase().trim();

      const verifyAndPing = () => {
        fetch('/api/agent/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            status: 'online'
          })
        }).then(async (res) => {
          if (res.status === 403 || !res.ok) {
            const data = await res.json().catch(() => ({}));
            if (data?.status === 'pending') {
              localStorage.setItem('teals_pending_agent', JSON.stringify({
                email: cleanEmail,
                full_name: agentObj.full_name,
                phone: agentObj.phone
              }));
            }
            localStorage.removeItem('teals_agent_session');
            try { supabase.auth.signOut(); } catch {}
            window.location.href = '/login';
          }
        }).catch(() => {});
      };

      verifyAndPing();
      activePingTimer = setInterval(verifyAndPing, 2500);

      // Instant realtime eviction on REALTIME_CHANNEL
      activeChannel = supabase.channel(REALTIME_CHANNEL, {
        config: { broadcast: { self: true } }
      });

      const handleEviction = (payload: any) => {
        const raw = payload?.payload || payload;
        const removedEmail = (raw?.agentEmail || '').toLowerCase().trim();
        const removedId = (raw?.agentId || '').toLowerCase().trim();

        if ((removedEmail && cleanEmail && removedEmail === cleanEmail) ||
            (removedId && cleanId && removedId === cleanId)) {
          localStorage.removeItem('teals_agent_session');
          localStorage.removeItem('teals_pending_agent');
          try { supabase.auth.signOut(); } catch {}
          window.location.href = '/login';
        }
      };

      activeChannel
        .on('broadcast', { event: 'agent_removed' }, handleEviction)
        .on('broadcast', { event: 'agent_rejected' }, handleEviction)
        .subscribe();
    };

    const adminEmails = ['garryamelia6265@gmail.com', 'tzafar04@gmail.com', 'annusraees@gmail.com', 'jennifer.cisternino2027@gmail.com'];
    const preApprovedAgents = ['abdulrafay40023@gmail.com'];

    const initAuth = async () => {
      let resolvedAgent: any = null;

      if (typeof window !== 'undefined') {
        // Enforce CRM embed: if opened standalone in top window, redirect to CRM
        if (window.self === window.top) {
          window.location.replace('https://salesflow-ai-main.vercel.app/livechat');
          return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const ssoEmail = urlParams.get('sso_email');
        const ssoName = urlParams.get('sso_name');
        const ssoRole = urlParams.get('sso_role');

        if (ssoEmail) {
          const cleanEmail = ssoEmail.toLowerCase().trim();
          const isAdm = adminEmails.includes(cleanEmail);
          const isPreApproved = isAdm || preApprovedAgents.includes(cleanEmail);

          if (isPreApproved) {
            resolvedAgent = {
              id: `agent_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
              email: cleanEmail,
              full_name: ssoName || cleanEmail.split('@')[0],
              role: isAdm ? 'admin' : (ssoRole || 'agent'),
              status: 'approved'
            };
          } else {
            try {
              const res = await fetch('/api/agent/ping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: cleanEmail, status: 'online' })
              });
              if (res.ok) {
                const data = await res.json();
                if (data.status === 'approved' || data.agent?.status === 'approved') {
                  resolvedAgent = data.agent || {
                    id: `agent_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
                    email: cleanEmail,
                    full_name: ssoName || cleanEmail.split('@')[0],
                    role: 'agent',
                    status: 'approved'
                  };
                }
              }
            } catch {}

            if (!resolvedAgent) {
              localStorage.removeItem('teals_agent_session');
              window.location.href = '/login';
              return;
            }
          }
        }
      }

      if (!resolvedAgent) {
        const rawSession = localStorage.getItem('teals_agent_session');
        if (!rawSession) {
          router.push('/login');
          return;
        }
        try {
          resolvedAgent = JSON.parse(rawSession);
        } catch {
          localStorage.removeItem('teals_agent_session');
          router.push('/login');
          return;
        }
      }

      const cleanEmail = (resolvedAgent.email || '').toLowerCase().trim();
      const isAdm = resolvedAgent.role === 'admin' || adminEmails.includes(cleanEmail);
      const isPreApproved = isAdm || preApprovedAgents.includes(cleanEmail);

      if (!isPreApproved) {
        try {
          const res = await fetch('/api/agent/ping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail, status: 'online' })
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            if (data?.status === 'pending') {
              localStorage.setItem('teals_pending_agent', JSON.stringify({
                email: cleanEmail,
                full_name: resolvedAgent.full_name,
                phone: resolvedAgent.phone
              }));
            }
            if (res.status === 403) {
              localStorage.removeItem('teals_agent_session');
              window.location.href = '/login';
              return;
            }
          }
          const data = await res.json();
          if (data.status === 'approved' || data.agent?.status === 'approved') {
            resolvedAgent = data.agent || resolvedAgent;
          }
        } catch {}
      }

      if (resolvedAgent.status !== 'approved' && !isAdm) {
        localStorage.removeItem('teals_agent_session');
        window.location.href = '/login';
        return;
      }

      localStorage.setItem('teals_agent_session', JSON.stringify(resolvedAgent));
      setCurrentAgent(resolvedAgent);
      setupEvictionAndPing(resolvedAgent);
    };

    initAuth();

    return () => {
      if (activePingTimer) clearInterval(activePingTimer);
      if (activeChannel) supabase.removeChannel(activeChannel);
    };
  }, [router]);

  const adminEmails = ['garryamelia6265@gmail.com', 'tzafar04@gmail.com', 'annusraees@gmail.com', 'jennifer.cisternino2027@gmail.com'];
  const isAdmin = currentAgent?.role === 'admin' || (currentAgent?.email && adminEmails.includes(currentAgent.email.toLowerCase()));

  useEffect(() => {
    if (!isAdmin) return;

    const fetchApprovals = async () => {
      try {
        const appRes = await fetch(`/api/agent/approvals?_t=${Date.now()}`, {
          cache: 'no-store'
        });
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

    const channel = supabase.channel('teals-layout-approvals-sync', {
      config: { broadcast: { self: true } }
    });

    channel
      .on('broadcast', { event: 'agent_pending_approval' }, () => {
        fetchApprovals();
      })
      .on('broadcast', { event: 'agent_approved' }, () => {
        fetchApprovals();
      })
      .on('broadcast', { event: 'agent_rejected' }, () => {
        fetchApprovals();
      })
      .on('broadcast', { event: 'agent_removed' }, () => {
        fetchApprovals();
      })
      .subscribe();

    const interval = setInterval(fetchApprovals, 2000);
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
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
