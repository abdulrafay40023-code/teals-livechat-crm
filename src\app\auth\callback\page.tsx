'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CompleteProfileModal } from '@/components/CompleteProfileModal';
import { PendingApprovalScreen } from '@/components/PendingApprovalScreen';
import { Sparkles, Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'loading' | 'needs_profile' | 'pending' | 'approved'>('loading');
  const [agentData, setAgentData] = useState<{ id?: string; full_name: string; email: string; phone: string; role?: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleAuth = async () => {
      try {
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();

        if (sessionErr || !session?.user?.email) {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user?.email) {
            router.push('/login');
            return;
          }
          await processUser(user.email, user.user_metadata?.full_name || '');
          return;
        }

        const email = session.user.email;
        const fullName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || '';
        await processUser(email, fullName);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Authentication failed');
        setLoading(false);
      }
    };

    const processUser = async (email: string, initialName: string) => {
      const res = await fetch('/api/agent/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to authenticate');
        setLoading(false);
        return;
      }

      if (data.status === 'needs_profile') {
        setAgentData({ full_name: initialName, email, phone: '' });
        setStep('needs_profile');
      } else if (data.status === 'pending') {
        setAgentData(data.agent);
        setStep('pending');
      } else if (data.status === 'approved') {
        localStorage.setItem('teals_agent_session', JSON.stringify(data.agent));
        router.push('/dashboard');
      }
      setLoading(false);
    };

    handleAuth();
  }, [router]);

  const handleProfileSubmit = async ({ fullName, phone }: { fullName: string; phone: string }) => {
    if (!agentData?.email) return;
    try {
      const res = await fetch('/api/agent/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: agentData.email,
          fullName,
          phone,
          action: 'complete_profile'
        })
      });

      const data = await res.json();
      if (res.ok) {
        if (data.status === 'approved') {
          localStorage.setItem('teals_agent_session', JSON.stringify(data.agent));
          router.push('/dashboard');
        } else {
          setAgentData(data.agent);
          setStep('pending');
        }
      } else {
        setError(data.error || 'Failed to submit profile');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error submitting profile');
    }
  };

  const handleRefreshPending = async () => {
    if (!agentData?.email) return;
    try {
      const res = await fetch('/api/agent/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: agentData.email })
      });
      const data = await res.json();
      if (data.status === 'approved') {
        localStorage.setItem('teals_agent_session', JSON.stringify(data.agent));
        router.push('/dashboard');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('teals_agent_session');
    router.push('/login');
  };

  if (loading || step === 'loading') {
    return (
      <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-primary to-brand-secondary flex items-center justify-center shadow-xl shadow-brand-primary/25">
          <Sparkles className="w-6 h-6 text-white animate-pulse" />
        </div>
        <div className="flex items-center space-x-2 text-xs font-semibold text-dark-text">
          <Loader2 className="w-4 h-4 animate-spin text-brand-secondary" />
          <span>Verifying Google Authentication...</span>
        </div>
      </div>
    );
  }

  if (step === 'needs_profile' && agentData) {
    return (
      <CompleteProfileModal
        email={agentData.email}
        onSubmit={handleProfileSubmit}
        onSignOut={handleSignOut}
      />
    );
  }

  if (step === 'pending' && agentData) {
    return (
      <PendingApprovalScreen
        agent={agentData}
        onRefresh={handleRefreshPending}
        onSignOut={handleSignOut}
      />
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center p-6">
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 max-w-sm text-center">
          <p className="text-xs text-brand-rose mb-4">{error}</p>
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-brand-primary rounded-xl text-xs text-white font-bold"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return null;
}
