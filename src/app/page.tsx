'use client';

import { useEffect } from 'react';

export default function HomePage() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.location.replace('/dashboard/chats');
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#080b11] flex items-center justify-center text-slate-400 text-sm">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
        <p>Redirecting to Teals CRM...</p>
      </div>
    </div>
  );
}
