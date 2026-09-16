'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { REALTIME_CHANNEL } from '@/lib/realtime';
import { PendingApprovalScreen } from '@/components/PendingApprovalScreen';

export default function LoginPage() {
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingAgent, setPendingAgent] = useState<{ full_name: string; email: string; phone: string } | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cachedPending = localStorage.getItem('teals_pending_agent');
        if (cachedPending) {
          const parsed = JSON.parse(cachedPending);
          if (parsed?.email) return parsed;
        }
        const rawSession = localStorage.getItem('teals_agent_session');
        if (rawSession) {
          const parsed = JSON.parse(rawSession);
          if (parsed?.status === 'pending' && parsed?.email) return parsed;
        }
      } catch {}
    }
    return null;
  });

  // Check if already authenticated or pending
  useEffect(() => {
    // If opened directly outside CRM iframe, redirect to CRM
    if (typeof window !== 'undefined' && window.self === window.top) {
      window.location.replace('https://salesflow-ai-main.vercel.app/livechat');
      return;
    }

    // Check pending state in localStorage
    const cachedPending = typeof window !== 'undefined' ? localStorage.getItem('teals_pending_agent') : null;
    let pendingCandidate: { full_name: string; email: string; phone: string } | null = null;

    if (cachedPending) {
      try {
        const parsed = JSON.parse(cachedPending);
        if (parsed?.email) pendingCandidate = parsed;
      } catch {}
    } else {
      const rawSession = typeof window !== 'undefined' ? localStorage.getItem('teals_agent_session') : null;
      if (rawSession) {
        try {
          const parsed = JSON.parse(rawSession);
          if (parsed?.status === 'pending' && parsed?.email) pendingCandidate = parsed;
        } catch {}
      }
    }

    if (pendingCandidate?.email) {
      const pEmail = pendingCandidate.email;
      setPendingAgent(pendingCandidate);

      // Verify status against server (also sending cached fullName and phone so server preserves pending state)
      fetch('/api/agent/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: pEmail,
          fullName: pendingCandidate.full_name,
          phone: pendingCandidate.phone
        })
      })
        .then(r => r.json())
        .then(d => {
          if (d.status === 'rejected') {
            localStorage.removeItem('teals_pending_agent');
            localStorage.removeItem('teals_agent_session');
            setPendingAgent(null);
            supabase.auth.signOut().catch(() => {});
          } else if (d.status === 'approved') {
            localStorage.removeItem('teals_pending_agent');
            localStorage.setItem('teals_agent_session', JSON.stringify(d.agent));
            router.push('/dashboard');
          }
        })
        .catch(() => {});
    }

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email;
      if (userEmail) {
        const cleanEmail = userEmail.toLowerCase().trim();
        const adminEmails = ['garryamelia6265@gmail.com', 'tzafar04@gmail.com', 'annusraees@gmail.com', 'jennifer.cisternino2027@gmail.com'];
        const preApprovedAgents = ['abdulrafay40023@gmail.com'];
        if (adminEmails.includes(cleanEmail) || preApprovedAgents.includes(cleanEmail)) {
          router.push('/dashboard');
          return;
        }

        try {
          const res = await fetch('/api/agent/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail })
          });
          if (res.ok) {
            const d = await res.json();
            if (d.status === 'approved') {
              localStorage.removeItem('teals_pending_agent');
              localStorage.setItem('teals_agent_session', JSON.stringify(d.agent));
              router.push('/dashboard');
              return;
            } else if (d.status === 'pending') {
              setPendingAgent(d.agent);
              localStorage.setItem('teals_pending_agent', JSON.stringify(d.agent));
              return;
            }
          }
        } catch {}

        const rawSession = localStorage.getItem('teals_agent_session');
        if (rawSession) {
          try {
            const parsed = JSON.parse(rawSession);
            if (parsed?.status === 'approved' || parsed?.role === 'admin' || (parsed?.email && adminEmails.includes(parsed.email.toLowerCase()))) {
              router.push('/dashboard');
              return;
            }
          } catch {
            // ignore
          }
        }
      }
    };
    checkSession();

    // Listen for realtime admin approval
    const channel = supabase.channel(REALTIME_CHANNEL, {
      config: { broadcast: { self: true } }
    });
    channel
      .on('broadcast', { event: 'agent_approved' }, async (payload: any) => {
        const raw = payload?.payload || payload;
        const approvedEmail = raw?.agentEmail;
        const approvedAgent = raw?.agent;

        const { data: { session } } = await supabase.auth.getSession();
        const sessionEmail = session?.user?.email;
        const cached = localStorage.getItem('teals_pending_agent') || localStorage.getItem('teals_agent_session');
        let myEmail = sessionEmail;
        if (cached) {
          try {
            const p = JSON.parse(cached);
            if (p?.email) myEmail = p.email;
          } catch {}
        }
        if (myEmail && approvedEmail && approvedEmail.toLowerCase() === myEmail.toLowerCase()) {
          localStorage.removeItem('teals_pending_agent');
          if (approvedAgent) {
            localStorage.setItem('teals_agent_session', JSON.stringify(approvedAgent));
          }
          router.push('/dashboard');
        }
      })
      .on('broadcast', { event: 'agent_rejected' }, async (payload: any) => {
        const raw = payload?.payload || payload;
        const rejectedEmail = raw?.agentEmail;
        const cached = localStorage.getItem('teals_pending_agent') || localStorage.getItem('teals_agent_session');
        if (cached) {
          try {
            const p = JSON.parse(cached);
            if (!rejectedEmail || (p?.email && rejectedEmail.toLowerCase() === p.email.toLowerCase())) {
              localStorage.removeItem('teals_pending_agent');
              localStorage.removeItem('teals_agent_session');
              setPendingAgent(null);
              try { await supabase.auth.signOut(); } catch {}
            }
          } catch {}
        }
      })
      .subscribe();

    const interval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const currentEmail = session?.user?.email;
      const pendingStr = localStorage.getItem('teals_pending_agent');
      let targetEmail = currentEmail;
      let pAgent: any = null;
      if (pendingStr) {
        try {
          pAgent = JSON.parse(pendingStr);
          if (pAgent?.email) targetEmail = pAgent.email;
        } catch {}
      }

      if (targetEmail) {
        try {
          const res = await fetch('/api/agent/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: targetEmail,
              fullName: pAgent?.full_name,
              phone: pAgent?.phone
            })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'approved') {
              localStorage.removeItem('teals_pending_agent');
              localStorage.setItem('teals_agent_session', JSON.stringify(data.agent));
              router.push('/dashboard');
            } else if (data.status === 'rejected') {
              localStorage.removeItem('teals_pending_agent');
              localStorage.removeItem('teals_agent_session');
              setPendingAgent(null);
              try { await supabase.auth.signOut(); } catch {}
            }
          }
        } catch {}
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [router]);

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
            if (data.status === 'approved') {
              localStorage.removeItem('teals_pending_agent');
              localStorage.setItem('teals_agent_session', JSON.stringify(data.agent));
              router.push('/dashboard');
            }
          } catch {}
        }}
        onSignOut={async () => {
          await supabase.auth.signOut();
          localStorage.removeItem('teals_agent_session');
          localStorage.removeItem('teals_pending_agent');
          setPendingAgent(null);
        }}
      />
    );
  }

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      // If embedded in an iframe (e.g. CRM), open in clean top window/tab so Google never blocks with 403!
      const isIframe = typeof window !== 'undefined' && window.self !== window.top;
      if (isIframe) {
        window.open('https://teals-livechat-saas.vercel.app/login', '_blank');
        setGoogleLoading(false);
        return;
      }

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

  return (
    <div className="min-h-screen bg-[#070b12] flex flex-col items-center justify-center p-6 relative select-none">
      {/* Glow Effect */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[450px] h-[250px] bg-brand-primary/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md text-center z-10 space-y-6">
        {/* Heading matching Screenshot 3 */}
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Welcome back
          </h1>
          <p className="text-xs text-dark-muted mt-2">
            Sign in with your Google account to access your CRM & LiveChat.
          </p>
        </div>

        {/* Card matching Screenshot 3 */}
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

          {/* Pure Google Sign-in Button */}
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

          {/* Badge matching Screenshot 3 */}
          <div className="py-2.5 px-4 rounded-xl bg-dark-bg/60 border border-dark-border/60 flex items-center justify-center space-x-2 text-xs text-brand-emerald">
            <ShieldCheck className="w-4 h-4 text-brand-emerald" />
            <span className="font-medium text-[11px]">Multi-Agent Sync & Live Database Active</span>
          </div>
        </div>

        {/* Footer Terms */}
        <p className="text-[11px] text-dark-muted/80">
          By signing in, you agree to our terms and privacy policy.
        </p>
      </div>
    </div>
  );
}
