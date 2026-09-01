'use client';

import React from 'react';
import { Volume2, VolumeX, Code2, LogOut, Bell } from 'lucide-react';
import { playVisitorAlertSound, initAndUnlockAudio } from '@/lib/audio';

interface HeaderProps {
  currentAgent: {
    id: string;
    email: string;
    full_name: string;
    role: string;
  } | null;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenEmbedModal: () => void;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentAgent,
  soundEnabled,
  onToggleSound,
  onOpenEmbedModal,
  onSignOut,
}) => {
  return (
    <header className="h-16 border-b border-dark-border bg-[#080d1a]/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center space-x-3">
        <span className="text-xs font-bold uppercase tracking-wider text-dark-muted">Workspace</span>
        <span className="text-xs text-dark-border">/</span>
        <span className="text-xs font-bold text-white bg-brand-primary/10 border border-brand-primary/20 px-2.5 py-1 rounded-lg">
          Teals CRM
        </span>
      </div>

      <div className="flex items-center space-x-3">
        {/* Test Beep Sound Button */}
        <button
          onClick={async () => {
            await initAndUnlockAudio();
            playVisitorAlertSound();
          }}
          title="Test 4-Tone Beep Chime"
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/30 text-brand-secondary text-xs font-semibold transition-all"
        >
          <Bell className="w-3.5 h-3.5 animate-bounce" />
          <span>Test Beep 🔊</span>
        </button>

        {/* Sound Toggle */}
        <button
          onClick={onToggleSound}
          title={soundEnabled ? 'Sound Alerts Active' : 'Sound Alerts Muted'}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
            soundEnabled
              ? 'bg-brand-emerald/10 border-brand-emerald/30 text-brand-emerald shadow-sm'
              : 'bg-dark-card border-dark-border text-dark-muted hover:text-white'
          }`}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          <span>{soundEnabled ? 'Alerts ON' : 'Muted'}</span>
        </button>

        {/* Get Widget Code */}
        <button
          onClick={onOpenEmbedModal}
          className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-dark-card hover:bg-dark-cardHover border border-dark-border text-white text-xs font-semibold transition-all"
        >
          <Code2 className="w-4 h-4 text-brand-secondary" />
          <span>Get Code</span>
        </button>

        {/* User Info */}
        {currentAgent && (
          <div className="flex items-center space-x-3 pl-3 border-l border-dark-border">
            <div className="w-8 h-8 rounded-full bg-brand-primary/20 border border-brand-primary/40 flex items-center justify-center text-xs font-bold text-brand-secondary">
              {currentAgent.full_name?.charAt(0) || 'G'}
            </div>
            <div className="text-left hidden sm:block">
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-white">{currentAgent.full_name}</span>
                {currentAgent.role === 'admin' && (
                  <span className="text-[10px] bg-brand-amber/15 text-brand-amber px-1.5 py-0.2 rounded font-bold border border-brand-amber/30">
                    Admin
                  </span>
                )}
              </div>
              <p className="text-[10px] text-dark-muted truncate max-w-[140px]">{currentAgent.email}</p>
            </div>
            <button
              onClick={onSignOut}
              title="Sign Out"
              className="p-1.5 rounded-xl text-dark-muted hover:text-brand-rose hover:bg-dark-card transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
