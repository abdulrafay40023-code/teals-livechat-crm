'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Check, X, Mail, Phone, Users, Code2, UserCheck, Activity, Laptop } from 'lucide-react';
import { PendingAgent } from '@/components/ApprovalBanner';
import { AgentAvatar } from '@/components/AgentAvatar';

interface StoreAgent {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: 'admin' | 'agent';
  status: 'approved' | 'pending' | 'rejected';
  is_online: boolean;
  last_seen_at: string;
  created_at: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [currentAgent, setCurrentAgent] = useState<{
    id: string;
    email: string;
    full_name: string;
    role: string;
  } | null>(null);

  const [pendingAgents, setPendingAgents] = useState<PendingAgent[]>([]);
  const [approvedAgents, setApprovedAgents] = useState<StoreAgent[]>([]);
  const [onlineAgents, setOnlineAgents] = useState<StoreAgent[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const rawSession = localStorage.getItem('teals_agent_session');
    if (!rawSession) {
      router.push('/login');
      return;
    }
    try {
      const agent = JSON.parse(rawSession);
      if (agent.role !== 'admin' && agent.email !== 'garryamelia6265@gmail.com') {
        router.push('/dashboard');
        return;
      }
      setCurrentAgent(agent);
    } catch {
      router.push('/login');
    }
  }, [router]);

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agent/approvals');
      if (res.ok) {
        const data = await res.json();
        setPendingAgents(data.pendingAgents || []);
        setApprovedAgents(data.approvedAgents || []);
        setOnlineAgents(data.onlineAgents || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (agentId: string) => {
    try {
      const res = await fetch('/api/agent/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, action: 'approve' })
      });
      if (res.ok) fetchAgents();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (agentId: string) => {
    try {
      const res = await fetch('/api/agent/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, action: 'reject' })
      });
      if (res.ok) fetchAgents();
    } catch (err) {
      console.error(err);
    }
  };

  const scriptTag = `<!-- Teals CRM Live Chat Widget -->
<script 
  src="https://teals-livechat-saas.vercel.app/widget.js" 
  data-property="teals-crm" 
  async>
</script>`;

  if (!currentAgent) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Administration & Team Management</h1>
        <p className="text-xs text-dark-muted mt-0.5">Manage working agents, approve onboarding requests, and monitor live team roster</p>
      </div>

      {/* 1. Live Working Agents Logged In Section */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-brand-emerald" />
            <h3 className="text-sm font-bold text-white">
              Working Agents Online & Logged In ({approvedAgents.length})
            </h3>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-brand-emerald/15 text-brand-emerald border border-brand-emerald/30">
            Live Support Team
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {approvedAgents.map((agent) => {
            const isAdminAgent = agent.role === 'admin' || agent.email === 'garryamelia6265@gmail.com';

            return (
              <div
                key={agent.id}
                className="bg-dark-surface border border-dark-border rounded-xl p-4 flex items-start space-x-3 hover:border-brand-primary/40 transition-all"
              >
                <AgentAvatar
                  type={isAdminAgent ? 'male' : 'male'}
                  name={agent.full_name}
                  size="lg"
                  className="mt-0.5"
                />
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white truncate">{agent.full_name}</h4>
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                      isAdminAgent
                        ? 'bg-brand-amber/20 text-brand-amber border border-brand-amber/30'
                        : 'bg-brand-primary/20 text-brand-secondary border border-brand-primary/30'
                    }`}>
                      {isAdminAgent ? 'Admin' : 'Working Agent'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1 text-[11px] text-dark-muted truncate">
                    <Mail className="w-3 h-3 text-brand-secondary flex-shrink-0" />
                    <span className="truncate">{agent.email}</span>
                  </div>

                  {agent.phone && (
                    <div className="flex items-center space-x-1 text-[11px] text-dark-muted">
                      <Phone className="w-3 h-3 text-brand-emerald flex-shrink-0" />
                      <span>{agent.phone}</span>
                    </div>
                  )}

                  <div className="pt-1 flex items-center space-x-1.5 text-[10px] text-brand-emerald">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-emerald animate-pulse" />
                    <span>Logged In & Active</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Pending Approvals Section */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-brand-amber" />
            <h3 className="text-sm font-bold text-white">Pending Agent Approvals ({pendingAgents.length})</h3>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-brand-amber/15 text-brand-amber border border-brand-amber/30">
            Admin Action Required
          </span>
        </div>

        {pendingAgents.length === 0 ? (
          <div className="py-8 text-center text-dark-muted text-xs">
            <UserCheck className="w-8 h-8 mx-auto mb-2 text-dark-border" />
            <p>No pending agent requests. All signed-in agents are approved!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingAgents.map((agent) => (
              <div
                key={agent.id}
                className="bg-dark-surface border border-dark-border rounded-xl p-4 flex items-center justify-between hover:border-brand-amber/40 transition-all"
              >
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white">{agent.full_name}</h4>
                  <div className="flex items-center space-x-1 text-[11px] text-dark-muted">
                    <Mail className="w-3 h-3 text-brand-secondary" />
                    <span>{agent.email}</span>
                  </div>
                  {agent.phone && (
                    <div className="flex items-center space-x-1 text-[11px] text-brand-amber">
                      <Phone className="w-3 h-3" />
                      <span>{agent.phone}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleApprove(agent.id)}
                    title="Approve Agent Access"
                    className="w-8 h-8 rounded-xl bg-brand-emerald text-white flex items-center justify-center hover:opacity-90 transition-all shadow-md"
                  >
                    <Check className="w-4 h-4 font-bold" />
                  </button>
                  <button
                    onClick={() => handleReject(agent.id)}
                    title="Reject"
                    className="w-8 h-8 rounded-xl bg-brand-rose text-white flex items-center justify-center hover:opacity-90 transition-all shadow-md"
                  >
                    <X className="w-4 h-4 font-bold" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Embed Script Card */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-2 mb-3">
          <Code2 className="w-5 h-5 text-brand-secondary" />
          <h3 className="text-sm font-bold text-white">Embed Script for Teals CRM</h3>
        </div>
        <p className="text-xs text-dark-muted mb-4">
          Paste this script tag right before the closing <code className="text-brand-secondary font-mono">&lt;/body&gt;</code> tag on your CRM or website:
        </p>
        <div className="relative bg-dark-bg border border-dark-border rounded-xl p-4 font-mono text-xs text-brand-secondary">
          <pre className="overflow-x-auto">{scriptTag}</pre>
          <button
            onClick={() => {
              navigator.clipboard.writeText(scriptTag);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="absolute top-3 right-3 px-3 py-1.5 bg-brand-primary hover:bg-brand-primaryHover text-white rounded-lg text-xs font-bold transition-all"
          >
            {copied ? 'Copied!' : 'Copy Snippet'}
          </button>
        </div>
      </div>
    </div>
  );
}
