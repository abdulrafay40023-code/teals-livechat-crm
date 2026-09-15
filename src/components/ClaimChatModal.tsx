'use client';

import React, { useState, useEffect } from 'react';
import { UserPlus, X, User, Mail, ShieldCheck } from 'lucide-react';

interface ClaimChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, email: string) => Promise<void>;
  defaultName: string;
  defaultEmail: string;
  visitorName: string;
}

export const ClaimChatModal: React.FC<ClaimChatModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  defaultName,
  defaultEmail,
  visitorName,
}) => {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(defaultName || '');
      setEmail(defaultEmail || '');
    }
  }, [isOpen, defaultName, defaultEmail]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(name.trim(), email.trim());
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0e1628] border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-blue-900/40 via-[#111c33] to-[#111c33] border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Claim Live Conversation</h3>
              <p className="text-[11px] text-gray-400">Assign yourself to assist {visitorName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Your Agent Name</label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Abdul Rafay"
                className="w-full bg-[#131f38] border border-gray-700 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Your Work Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. agent@teals.ai"
                className="w-full bg-[#131f38] border border-gray-700 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim() || !email.trim()}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg flex items-center space-x-1.5 disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{submitting ? 'Claiming...' : 'Confirm & Claim'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
