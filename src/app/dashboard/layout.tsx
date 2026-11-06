'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { crmSupabase } from '@/lib/crm-supabase';
import { REALTIME_CHANNEL } from '@/lib/realtime';
import { LiveSyncProvider, useLiveSync } from '@/context/LiveSyncContext';
import { showBackgroundNotification } from '@/lib/audio';

const ADMIN_EMAILS = ['garryamelia6265@gmail.com', 'jennifer.cisternino2027@gmail.com', 'ashal.raza@teals.co', 'tzafar04@gmail.com', 'annusraees@gmail.com'];

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [currentAgent, setCurrentAgent] = useState<{
    id: string;
    email: string;
    full_name: string;
    role: string;
    status: string;
    phone?: string;
    assigned_websites?: string[];
  }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const ssoEmail = urlParams.get('sso_email');
        const ssoName = urlParams.get('sso_name');
        const ssoRole = urlParams.get('sso_role');
        const ssoWebsitesRaw = urlParams.get('sso_websites');

        let assigned_websites: string[] = [];
        if (!ssoWebsitesRaw || ssoWebsitesRaw === 'all' || ssoWebsitesRaw === 'none') assigned_websites = [];
        else assigned_websites = ssoWebsitesRaw.split(',').map(s => s.trim().toLowerCase()).filter(s => Boolean(s) && s !== '__none__' && s !== 'none' && s !== 'all');

        if (ssoEmail) {
          const cleanEmail = ssoEmail.toLowerCase().trim();
          const isAdm = ADMIN_EMAILS.includes(cleanEmail) || ssoRole === 'admin';
          const ssoAgent = {
            id: `agent_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
            email: cleanEmail,
            full_name: ssoName || cleanEmail.split('@')[0],
            role: isAdm ? 'admin' : (ssoRole || 'agent'),
            status: 'approved',
            assigned_websites: isAdm ? [] : assigned_websites,
          };
          localStorage.setItem('teals_agent_session', JSON.stringify(ssoAgent));
          localStorage.setItem('teals_assigned_websites', JSON.stringify(assigned_websites));
          return ssoAgent;
        }

        const rawSession = localStorage.getItem('teals_agent_session');
        if (rawSession) {
          const parsed = JSON.parse(rawSession);
          if (parsed && parsed.email) {
            const isAdm = ADMIN_EMAILS.includes(parsed.email.toLowerCase()) || parsed.role === 'admin';
            parsed.role = isAdm ? 'admin' : (parsed.role || 'agent');
            parsed.status = 'approved';
            return parsed;
          }
        }
      } catch {}
    }
    return {
      id: 'agent_garry_admin',
      full_name: 'Garry Amelia',
      email: 'garryamelia6265@gmail.com',
      role: 'admin',
      status: 'approved',
      assigned_websites: []
    };
  });

  const [pendingAgentsCount, setPendingAgentsCount] = useState(0);
  const prevPendingCountRef = React.useRef<number | null>(null);

  const { liveCount, chatCount, unreadConversationsCount, soundEnabled, toggleSound, unreadCount } = useLiveSync();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const ssoEmail = urlParams.get('sso_email');
        const ssoName = urlParams.get('sso_name');
        const ssoRole = urlParams.get('sso_role');
        const ssoWebsitesRaw = urlParams.get('sso_websites');

        let assigned_websites: string[] = [];
        if (!ssoWebsitesRaw || ssoWebsitesRaw === 'all' || ssoWebsitesRaw === 'none') assigned_websites = [];
        else assigned_websites = ssoWebsitesRaw.split(',').map(s => s.trim().toLowerCase()).filter(s => Boolean(s) && s !== '__none__' && s !== 'none' && s !== 'all');

        if (ssoEmail) {
          const cleanEmail = ssoEmail.toLowerCase().trim();
          const isAdm = ADMIN_EMAILS.includes(cleanEmail) || ssoRole === 'admin';
          const ssoAgent = {
            id: `agent_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
            email: cleanEmail,
            full_name: ssoName || cleanEmail.split('@')[0],
            role: isAdm ? 'admin' : (ssoRole || 'agent'),
            status: 'approved',
            assigned_websites: isAdm ? [] : assigned_websites,
          };
          localStorage.setItem('teals_agent_session', JSON.stringify(ssoAgent));
          localStorage.setItem('teals_assigned_websites', JSON.stringify(assigned_websites));
          setCurrentAgent(ssoAgent);
        }
      } catch {}
    }

    const cleanEmail = (currentAgent?.email || '').toLowerCase().trim();
    if (cleanEmail && !ADMIN_EMAILS.includes(cleanEmail)) {
      crmSupabase.from('profiles').select('avatar_url, role').eq('email', cleanEmail).maybeSingle().then(({ data: prof }) => {
        if (prof?.avatar_url) {
          try {
            const meta = JSON.parse(prof.avatar_url);
            if (Array.isArray(meta.assigned_websites)) {
              const rawSession = localStorage.getItem('teals_agent_session');
              const u = rawSession ? JSON.parse(rawSession) : { email: cleanEmail };
              u.assigned_websites = meta.assigned_websites;
              localStorage.setItem('teals_agent_session', JSON.stringify(u));
              localStorage.setItem('teals_assigned_websites', JSON.stringify(meta.assigned_websites));
              setCurrentAgent(prev => ({ ...prev, assigned_websites: meta.assigned_websites }));
            }
          } catch {}
        }
      });
    }
    if (!cleanEmail) return;

    let activePingTimer: NodeJS.Timeout | null = null;
    let activeChannel: any = null;

    const verifyAndPing = () => {
      fetch('/api/agent/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          fullName: currentAgent.full_name,
          role: currentAgent.role,
          status: 'online'
        })
      }).catch(() => {});
    };

    verifyAndPing();
    activePingTimer = setInterval(verifyAndPing, 10000);

    return () => {
      if (activePingTimer) clearInterval(activePingTimer);
    };
  }, [currentAgent.email, currentAgent.full_name, currentAgent.role, currentAgent.id]);

  const isAdmin = currentAgent?.role === 'admin' || (currentAgent?.email && ADMIN_EMAILS.includes(currentAgent.email.toLowerCase()));

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
            showBackgroundNotification(
              'New Agent Approval Request',
              `You have ${count} pending agent registration(s) waiting for approval!`,
              '/favicon.ico',
              `pending_approvals_${count}`
            );
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

    const interval = setInterval(fetchApprovals, 5000);
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

  return (
    <div className="fixed inset-0 flex h-full w-full bg-[#070b14] text-dark-text overflow-hidden">
      <Sidebar
        liveCount={liveCount}
        chatCount={unreadConversationsCount}
        pendingAgentsCount={pendingAgentsCount}
        isAdmin={isAdmin}
        unreadCount={isAdmin ? unreadCount : 0}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden">
        <Header
          currentAgent={currentAgent}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
          onSignOut={handleSignOut}
        />

        <main
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2.5 sm:p-4 pb-24 md:pb-6"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
        >
          {children}
        </main>
      </div>
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
