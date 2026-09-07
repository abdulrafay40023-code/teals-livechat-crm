'use client';

import React from 'react';
import { Check, X, Phone, Mail, Clock, UserCheck } from 'lucide-react';

export interface PendingAgent {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  created_at: string;
}

interface ApprovalBannerProps {
  pendingAgents: PendingAgent[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export const ApprovalBanner: React.FC<ApprovalBannerProps> = ({
  pendingAgents,
  onApprove,
  onReject,
}) => {
  if (!pendingAgents || pendingAgents.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-r from-brand-amber/10 via-dark-card to-dark-card border border-brand-amber/30 p-5 shadow-lg relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 rounded-full bg-brand-amber animate-ping" />
          <h2 className="text-sm font-bold text-dark-text flex items-center">
            Pending Approval Requests ({pendingAgents.length})
          </h2>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-brand-amber text-dark-bg font-mono">
          New Agent Waiting
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pendingAgents.map((agent) => (
          <div
            key={agent.id}
            className="bg-dark-surface/90 border border-dark-border rounded-xl p-4 flex items-center justify-between hover:border-brand-amber/50 transition-all"
          >
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-dark-text">{agent.full_name}</h4>
              <div className="flex items-center space-x-1.5 text-xs text-dark-muted">
                <Mail className="w-3.5 h-3.5 text-brand-secondary" />
                <span className="truncate max-w-[180px]">{agent.email}</span>
              </div>
              {agent.phone && (
                <div className="flex items-center space-x-1.5 text-xs text-brand-amber">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{agent.phone}</span>
                </div>
              )}
              <div className="flex items-center space-x-1 text-[10px] text-dark-muted/80 pt-1">
                <Clock className="w-3 h-3" />
                <span>Requested: {new Date(agent.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            {/* Accept / Reject Buttons */}
            <div className="flex items-center space-x-2 pl-3">
              <button
                onClick={() => onApprove(agent.id)}
                title="Approve Agent Access"
                className="w-9 h-9 rounded-xl bg-brand-emerald text-white flex items-center justify-center hover:opacity-90 hover:scale-105 transition-all shadow-md shadow-brand-emerald/20"
              >
                <Check className="w-5 h-5 font-bold" />
              </button>
              <button
                onClick={() => onReject(agent.id)}
                title="Reject Request"
                className="w-9 h-9 rounded-xl bg-brand-rose text-white flex items-center justify-center hover:opacity-90 hover:scale-105 transition-all shadow-md shadow-brand-rose/20"
              >
                <X className="w-5 h-5 font-bold" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
