'use client';

import React from 'react';
import { Clock, RefreshCw, LogOut, Sparkles, ShieldAlert } from 'lucide-react';

interface PendingApprovalScreenProps {
  agent: {
    full_name: string;
    email: string;
    phone: string;
  };
  onRefresh: () => void;
  onSignOut: () => void;
  isChecking?: boolean;
}

export const PendingApprovalScreen: React.FC<PendingApprovalScreenProps> = ({
  agent,
  onRefresh,
  onSignOut,
  isChecking = false,
}) => {
  return (
    <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center px-4 py-12">
      {/* Success Notification Bar (Top Right) */}
      <div className="fixed top-6 right-6 bg-brand-emerald/10 border border-brand-emerald/30 text-brand-emerald px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-2 shadow-lg">
        <span className="w-2 h-2 rounded-full bg-brand-emerald animate-ping" />
        <span>Request submitted to Admin for approval!</span>
      </div>

      {/* Brand Header */}
      <div className="flex items-center space-x-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-primary to-brand-secondary flex items-center justify-center shadow-xl shadow-brand-primary/20">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-dark-text">Teals CRM</span>
      </div>

      {/* Main Card (Matching Screenshot 4) */}
      <div className="w-full max-w-lg bg-dark-card/95 border border-dark-border rounded-2xl p-8 shadow-2xl backdrop-blur-xl text-center">
        {/* Yellow Clock Icon */}
        <div className="w-16 h-16 mx-auto rounded-full bg-brand-amber/10 border border-brand-amber/30 flex items-center justify-center mb-5">
          <Clock className="w-8 h-8 text-brand-amber animate-pulse" />
        </div>

        {/* Badge */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-amber/10 border border-brand-amber/20 mb-3">
          <span className="w-2 h-2 rounded-full bg-brand-amber" />
          <span className="text-xs font-bold text-brand-amber">Account Approval Pending</span>
        </div>

        <h2 className="text-2xl font-black text-dark-text tracking-tight">
          Access Requires Admin Approval
        </h2>
        <p className="text-xs text-dark-muted mt-2 max-w-sm mx-auto leading-relaxed">
          Your request has been submitted. As soon as Garry Amelia (Admin) approves your request in Settings, you will automatically get access to your dashboard.
        </p>

        {/* Applicant Details Box */}
        <div className="bg-dark-surface/90 border border-dark-border rounded-xl p-4 my-6 text-left space-y-2 text-xs">
          <div className="flex justify-between py-1 border-b border-dark-border/50">
            <span className="text-dark-muted">Applicant Name:</span>
            <span className="font-semibold text-dark-text">{agent.full_name}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-dark-border/50">
            <span className="text-dark-muted">Email:</span>
            <span className="font-semibold text-brand-secondary">{agent.email}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-dark-muted">Phone Number:</span>
            <span className="font-semibold text-dark-text">{agent.phone}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={onRefresh}
            disabled={isChecking}
            className="w-full py-3 rounded-xl bg-dark-surface hover:bg-dark-cardHover border border-dark-border text-dark-text text-xs font-bold flex items-center justify-center space-x-2 transition-all shadow-md"
          >
            <RefreshCw className={`w-4 h-4 text-brand-primary ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Checking status...' : 'Check Approval Status'}</span>
          </button>

          <button
            onClick={onSignOut}
            className="text-xs text-dark-muted hover:text-dark-text transition-colors inline-flex items-center space-x-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
