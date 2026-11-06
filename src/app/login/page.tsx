'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { REALTIME_CHANNEL } from '@/lib/realtime';
import { PendingApprovalScreen } from '@/components/PendingApprovalScreen';
import { CompleteProfileModal } from '@/components/CompleteProfileModal';

export default function LoginPage() {
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [profileData, setProfileData] = useState<{ email: string; full_name?: string } | null>(null);
  const [pendingAgent, setPendingAgent] = useState<{ full_name: string; email: string; phone: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAgentStatus = useCallback(async (targetEmail: string, targetName?: string) => {
    const cleanEmail = targetEmail.toLowerCase().trim();
    const adminEmails = ['garryamelia6265@gmail.com', 'tzafar04@gmail.com', 'annusraees@gmail.com'];
    const isAdm = adminEmails.includes(cleanEmail);

    const defaultAgent = {
      id: `agent_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
      email: cleanEmail,
      full_name: targetName || cleanEmail.split('@')[0],
      role: isAdm ? 'admin' : 'agent',
      status: 'approved'
    };

    localStorage.setItem('teals_agent_session', JSON.stringify(defaultAgent));
    localStorage.removeItem('teals_pending_agent');

    try {
      const res = await fetch('/api/agent/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, fullName: targetName })
      });

      if (res.ok) {
        const d = await res.json();
        if (d.agent) {
          localStorage.setItem('teals_agent_session', JSON.stringify({ ...d.agent, status: 'approved' }));
        }
      }
    } catch {}

    router.push('/dashboard/chats');
  }, [router]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.self === window.top) {
      const isAuthCallback = window.location.hash || window.location.search.includes('code=') || window.location.search.includes('access_token=');
      if (!isAuthCallback) {
        window.location.replace('/dashboard/chats');
        return;
      }
    }

    const init = async () => {
      // 1. Check URL search parameters (SSO from CRM iframe)
      let ssoEmail: string | null = null;
      let ssoName: string | null = null;

      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        ssoEmail = params.get('sso_email');
        ssoName = params.get('sso_name');

        if (ssoEmail) {
          localStorage.setItem('teals_sso_email', ssoEmail);
          if (ssoName) localStorage.setItem('teals_sso_name', ssoName);
        } else {
          ssoEmail = localStorage.getItem('teals_sso_email');
          ssoName = localStorage.getItem('teals_sso_name');
        }
      }

      if (ssoEmail) {
        await checkAgentStatus(ssoEmail, ssoName || undefined);
        return;
      }

      // 2. Check pending agent from localStorage
      const cachedPending = typeof window !== 'undefined' ? localStorage.getItem('teals_pending_agent') : null;
      if (cachedPending) {
        try {
          const parsed = JSON.parse(cachedPending);
          if (parsed?.email) {
            setPendingAgent(parsed);
            setLoading(false);
            await checkAgentStatus(parsed.email, parsed.full_name);
            return;
          }
        } catch {}
      }

      // 3. Check Supabase auth session
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email;
      if (userEmail) {
        const userName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || '';
        await checkAgentStatus(userEmail, userName);
        return;
      }

      // 4. Default: Show login button
      setLoading(false);
    };

    init();

    // Listen for realtime admin approval and removal
    const channel = supabase.channel(REALTIME_CHANNEL, {
      config: { broadcast: { self: true } }
    });

    channel
      .on('broadcast', { event: 'agent_approved' }, async (payload: any) => {
        const raw = payload?.payload || payload;
        const approvedEmail = (raw?.agentEmail || '').toLowerCase().trim();
        const approvedAgent = raw?.agent;

        const currentPendingStr = localStorage.getItem('teals_pending_agent');
        const currentSsoEmail = (localStorage.getItem('teals_sso_email') || '').toLowerCase().trim();
        let targetEmail = currentSsoEmail;
        if (currentPendingStr) {
          try {
            const p = JSON.parse(currentPendingStr);
            if (p?.email) targetEmail = p.email.toLowerCase().trim();
          } catch {}
        }

        if (targetEmail && approvedEmail && (approvedEmail === targetEmail || approvedEmail.includes(targetEmail))) {
          localStorage.removeItem('teals_pending_agent');
          if (approvedAgent) {
            localStorage.setItem('teals_agent_session', JSON.stringify(approvedAgent));
          }
          router.push('/dashboard');
        }
      })
      .on('broadcast', { event: 'agent_rejected' }, async (payload: any) => {
        const raw = payload?.payload || payload;
        const rejectedEmail = (raw?.agentEmail || '').toLowerCase().trim();
        const currentPendingStr = localStorage.getItem('teals_pending_agent');
        const currentSsoEmail = (localStorage.getItem('teals_sso_email') || '').toLowerCase().trim();
        let targetEmail = currentSsoEmail;
        if (currentPendingStr) {
          try {
            const p = JSON.parse(currentPendingStr);
            if (p?.email) targetEmail = p.email.toLowerCase().trim();
          } catch {}
        }

        if (!rejectedEmail || (targetEmail && rejectedEmail === targetEmail)) {
          localStorage.removeItem('teals_pending_agent');
          localStorage.removeItem('teals_agent_session');
          setPendingAgent(null);
          if (targetEmail) {
            setProfileData({ email: targetEmail });
          }
          try { await supabase.auth.signOut(); } catch {}
        }
      })
      .on('broadcast', { event: 'agent_removed' }, async (payload: any) => {
        const raw = payload?.payload || payload;
        const removedEmail = (raw?.agentEmail || '').toLowerCase().trim();
        const currentSsoEmail = (localStorage.getItem('teals_sso_email') || '').toLowerCase().trim();
        if (!removedEmail || (currentSsoEmail && removedEmail === currentSsoEmail)) {
          localStorage.removeItem('teals_pending_agent');
          localStorage.removeItem('teals_agent_session');
          setPendingAgent(null);
          if (currentSsoEmail) {
            setProfileData({ email: currentSsoEmail });
          }
          try { await supabase.auth.signOut(); } catch {}
        }
      })
      .subscribe();

    // 1.5-second polling check while in pending state
    const interval = setInterval(async () => {
      const pendingStr = localStorage.getItem('teals_pending_agent');
      const ssoEm = localStorage.getItem('teals_sso_email');
      let targetEm: string | null = null;
      let targetName: string | null = null;
      let targetPhone: string | null = null;

      if (pendingStr) {
        try {
          const p = JSON.parse(pendingStr);
          if (p?.email) {
            targetEm = p.email;
            targetName = p.full_name;
            targetPhone = p.phone;
          }
        } catch {}
      } else if (ssoEm) {
        targetEm = ssoEm;
      }

      if (targetEm) {
        try {
          const res = await fetch('/api/agent/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: targetEm,
              fullName: targetName,
              phone: targetPhone
            })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'approved' && data.agent) {
              localStorage.removeItem('teals_pending_agent');
              localStorage.setItem('teals_agent_session', JSON.stringify(data.agent));
              router.push('/dashboard');
            } else if (data.status === 'rejected') {
              localStorage.removeItem('teals_pending_agent');
              localStorage.removeItem('teals_agent_session');
              setPendingAgent(null);
              setProfileData({ email: targetEm });
              try { await supabase.auth.signOut(); } catch {}
            }
          }
        } catch {}
      }
    }, 1500);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [router, checkAgentStatus]);

  const handleProfileSubmit = async ({ fullName, phone }: { fullName: string; phone: string }) => {
    if (!profileData?.email) return;
    setError('');
    try {
      const res = await fetch('/api/agent/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: profileData.email,
          fullName,
          phone,
          action: 'complete_profile'
        })
      });

      const data = await res.json();
      if (res.ok) {
        if (data.status === 'approved' && data.agent) {
          localStorage.removeItem('teals_pending_agent');
          localStorage.setItem('teals_agent_session', JSON.stringify(data.agent));
          router.push('/dashboard');
        } else {
          const pAgent = data.agent || { email: profileData.email, full_name: fullName, phone };
          setPendingAgent(pAgent);
          localStorage.setItem('teals_pending_agent', JSON.stringify(pAgent));
          setProfileData(null);
        }
      } else {
        setError(data.error || 'Failed to submit profile request');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error submitting profile request');
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://teals-livechat-saas.vercel.app';
      const { error: authErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback`
        }
      });
      if (authErr) {
        setError(authErr.message);
        setGoogleLoading(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign-in error');
      setGoogleLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut().catch(() => {});
    localStorage.removeItem('teals_agent_session');
    localStorage.removeItem('teals_pending_agent');
    localStorage.removeItem('teals_sso_email');
    localStorage.removeItem('teals_sso_name');
    setPendingAgent(null);
    setProfileData(null);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b12] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        <span className="text-xs font-semibold text-white/80">Checking authentication & permissions...</span>
      </div>
    );
  }

  if (pendingAgent) {
    return (
      <PendingApprovalScreen
        agent={pendingAgent}
        onRefresh={async () => {
          try {
            const res = await fetch('/api/agent/auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: pendingAgent.email })
            });
            const data = await res.json();
            if (data.status === 'approved' && data.agent) {
              localStorage.removeItem('teals_pending_agent');
              localStorage.setItem('teals_agent_session', JSON.stringify(data.agent));
              router.push('/dashboard');
            }
          } catch {}
        }}
        onSignOut={handleSignOut}
      />
    );
  }

  if (profileData) {
    return (
      <CompleteProfileModal
        email={profileData.email}
        initialName={profileData.full_name}
        onSubmit={handleProfileSubmit}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#070b12] flex flex-col items-center justify-center p-6 relative select-none">
      {/* Glow Effect */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[450px] h-[250px] bg-brand-primary/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md text-center z-10 space-y-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Welcome back
          </h1>
          <p className="text-xs text-dark-muted mt-2">
            Sign in with your Google account to access your CRM & LiveChat.
          </p>
        </div>

        <div className="bg-[#0e1626]/90 border border-dark-border/80 rounded-3xl p-8 shadow-2xl backdrop-blur-2xl text-left space-y-6">
          <div>
            <h2 className="text-base font-bold text-white">Sign In</h2>
            <p className="text-xs text-dark-muted mt-0.5">Continue with Google account</p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-brand-rose/10 border border-brand-rose/30 text-xs text-brand-rose">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-gray-100 text-gray-900 text-xs font-bold shadow-xl transition-all flex items-center justify-center space-x-3 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {googleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-800" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
            )}
            <span className="text-sm font-semibold text-gray-800">
              {googleLoading ? 'Connecting to Google...' : 'Sign in with Google'}
            </span>
          </button>

          <div className="py-2.5 px-4 rounded-xl bg-dark-bg/60 border border-dark-border/60 flex items-center justify-center space-x-2 text-xs text-brand-emerald">
            <ShieldCheck className="w-4 h-4 text-brand-emerald" />
            <span className="font-medium text-[11px]">Multi-Agent Sync & Live Database Active</span>
          </div>
        </div>

        <p className="text-[11px] text-dark-muted/80">
          By signing in, you agree to our terms and privacy policy.
        </p>
      </div>
    </div>
  );
}
