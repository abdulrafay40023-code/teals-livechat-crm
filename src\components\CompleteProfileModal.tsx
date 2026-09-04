'use client';

import React, { useState } from 'react';
import { User, Phone, Mail, ArrowRight, Sparkles } from 'lucide-react';

interface CompleteProfileModalProps {
  email: string;
  onSubmit: (data: { fullName: string; phone: string }) => void;
  onSignOut: () => void;
}

export const CompleteProfileModal: React.FC<CompleteProfileModalProps> = ({
  email,
  onSubmit,
  onSignOut,
}) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!phone.trim()) {
      setError('Please enter a valid phone number');
      return;
    }
    setError('');
    setLoading(true);
    onSubmit({ fullName, phone });
  };

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center px-4 py-12">
      {/* Brand Icon */}
      <div className="flex items-center space-x-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-primary to-brand-secondary flex items-center justify-center shadow-xl shadow-brand-primary/20">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-dark-text">Teals CRM</span>
      </div>

      {/* Card matching Screenshot 3 */}
      <div className="w-full max-w-md bg-dark-card/95 border border-dark-border rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center mb-6">
          <h2 className="text-xl font-black text-dark-text tracking-tight">Complete Agent Profile</h2>
          <p className="text-xs text-dark-muted mt-2">
            Please enter your details to send an access request to Garry Amelia (Admin).
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-brand-rose/10 border border-brand-rose/30 text-xs text-brand-rose">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-dark-text mb-1.5">
              Full Name <span className="text-brand-rose">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                required
                className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2.5 text-sm text-dark-text placeholder-dark-muted focus:outline-none focus:border-brand-primary transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-dark-text mb-1.5">
              Email Address (Google OAuth)
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full bg-dark-surface/50 border border-dark-border/60 rounded-xl px-4 py-2.5 text-sm text-dark-muted cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-dark-text mb-1.5">
              Phone Number <span className="text-brand-rose">*</span>
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +1 555 019 2834 or your phone number"
              required
              className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2.5 text-sm text-dark-text placeholder-dark-muted focus:outline-none focus:border-brand-primary transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-brand-primary to-brand-primaryHover text-white text-sm font-bold flex items-center justify-center space-x-2 shadow-lg shadow-brand-primary/25 hover:opacity-95 transition-all disabled:opacity-50"
          >
            <span>{loading ? 'Submitting...' : 'Submit for Admin Approval →'}</span>
          </button>
        </form>

        <p className="text-[11px] text-center text-dark-muted mt-4">
          Fill in your full name and phone number to continue.
        </p>

        <div className="mt-6 pt-4 border-t border-dark-border text-center">
          <button
            onClick={onSignOut}
            className="text-xs text-dark-muted hover:text-dark-text transition-colors"
          >
            ← Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};
