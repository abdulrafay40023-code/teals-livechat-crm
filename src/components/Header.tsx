'use client';

import React from 'react';
import { Volume2, VolumeX, LogOut, Bell } from 'lucide-react';
import { playTestSound, initAndUnlockAudio, showBackgroundNotification } from '@/lib/audio';

interface HeaderProps {
  currentAgent: {
    id: string;
    email: string;
    full_name: string;
    role: string;
  } | null;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentAgent,
  soundEnabled,
  onToggleSound,
  onSignOut,
}) => {
  return (
    <header className="h-12 sm:h-16 border-b border-dark-border bg-[#080d1a]/90 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between gap-2 sticky top-0 z-40 shrink-0">
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
        <img
          src="/icon-192.png"
          alt="Teals"
          className="md:hidden w-7 h-7 rounded-lg object-cover border border-dark-border shrink-0"
        />
        <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider text-dark-muted">Workspace</span>
        <span className="hidden sm:inline text-xs text-dark-border">/</span>
        <span className="text-[11px] sm:text-xs font-bold text-white bg-brand-primary/10 border border-brand-primary/20 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg truncate">
          Teals CRM
        </span>
      </div>

      <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
        {/* Test Beep Sound Button */}
        <button
          onClick={async () => {
            await initAndUnlockAudio();
            playTestSound();
            showBackgroundNotification('🔔 Notification Test', 'Audio notification is working perfectly!', '/favicon.ico', `test_${Date.now()}`, true);
          }}
          title="Test Notification Sound"
          className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/30 text-brand-secondary text-[11px] sm:text-xs font-semibold transition-all"
        >
          <Bell className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Test Sound 🔊</span>
        </button>

        {/* Sound Toggle */}
        <button
          onClick={onToggleSound}
          title={soundEnabled ? 'Beep Alerts ON' : 'Beep Alerts OFF'}
          className={`flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border text-[11px] sm:text-xs font-semibold transition-all ${
            soundEnabled
              ? 'bg-brand-emerald/10 border-brand-emerald/30 text-brand-emerald shadow-sm'
              : 'bg-dark-card border-dark-border text-dark-muted hover:text-white'
          }`}
        >
          {soundEnabled ? <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          <span>{soundEnabled ? 'Beep ON' : 'Beep OFF'}</span>
        </button>

        {/* User Info */}
        {currentAgent && (
          <div className="flex items-center space-x-2 sm:space-x-3 pl-2 sm:pl-3 border-l border-dark-border">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-brand-primary/20 border border-brand-primary/40 flex items-center justify-center text-xs font-bold text-brand-secondary shrink-0">
              {currentAgent.full_name?.charAt(0) || 'G'}
            </div>
            <div className="text-left hidden sm:block">
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-white">{currentAgent.full_name}</span>
                {(currentAgent.role === 'admin' || ['garryamelia6265@gmail.com', 'tzafar04@gmail.com', 'annusraees@gmail.com', 'jennifer.cisternino2027@gmail.com'].includes(currentAgent.email?.toLowerCase() || '')) && (
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
