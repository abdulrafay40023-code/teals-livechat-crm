'use client';

import { ARRIVAL_WAV, MESSAGE_WAV, HANDOFF_WAV } from './sound-data';

let sharedAudioCtx: AudioContext | null = null;
let cachedArrivalBuffer: AudioBuffer | null = null;
let cachedHandoffBuffer: AudioBuffer | null = null;
let isDecodingBuffers = false;

function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!sharedAudioCtx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        sharedAudioCtx = new AC();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

async function decodeWavToBuffer(ctx: AudioContext, base64Wav: string): Promise<AudioBuffer | null> {
  try {
    const base64 = base64Wav.includes(',') ? base64Wav.split(',')[1] : base64Wav;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return await ctx.decodeAudioData(bytes.buffer.slice(0));
  } catch {
    return null;
  }
}

async function ensureAudioBufferDecoded() {
  if (isDecodingBuffers || typeof window === 'undefined') return;
  const ctx = getSharedAudioContext();
  if (!ctx) return;
  isDecodingBuffers = true;
  try {
    if (!cachedArrivalBuffer) {
      cachedArrivalBuffer = await decodeWavToBuffer(ctx, ARRIVAL_WAV);
    }
    if (!cachedHandoffBuffer) {
      cachedHandoffBuffer = await decodeWavToBuffer(ctx, HANDOFF_WAV);
    }
  } catch {} finally {
    isDecodingBuffers = false;
  }
}

// Global Mute Check: returns true if user has toggled Beep OFF
export function isSoundMutedGlobally(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem('teals_sound_enabled') === 'false';
  } catch {
    return false;
  }
}

// Instant Web Audio Oscillator chime (zero-latency synthesized bell)
function playOscillatorChime(freq = 880, duration = 0.3) {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    const play = () => {
      try {
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq, now);
        osc1.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.08);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(freq * 2, now);

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + duration);
        osc2.stop(now + duration);
      } catch {}
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(play).catch(() => {});
    } else {
      play();
    }
  } catch {}
}

function isRunningInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

let activeAudio: HTMLAudioElement | null = null;

// Core Sound Player: Pure Single-Stream Playback (Zero echo, zero distortion)
export function playSoundDirect(dataUri: string = ARRIVAL_WAV, fallbackFreq = 880, force = false) {
  if (typeof window === 'undefined') return;
  if (!force && isSoundMutedGlobally()) return;
  if (!force && isRunningInIframe()) return;

  try {
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    }
    activeAudio = new Audio(dataUri);
    activeAudio.volume = 1.0;
    const p = activeAudio.play();
    if (p !== undefined) {
      p.catch(() => {
        playOscillatorChime(fallbackFreq, 0.3);
      });
    }
  } catch {
    playOscillatorChime(fallbackFreq, 0.3);
  }
}

// Anti-acoustic overlap timer (prevents double-stutter across rapid events)
let lastBeepTimestamp = 0;

// Universal Core Beep Function
export function playCleanSound(type: 'arrival' | 'message' | 'handoff' = 'arrival', force = false) {
  if (typeof window === 'undefined') return;
  if (!force && isSoundMutedGlobally()) return;
  // If embedded in CRM iframe, let the parent CRM window handle global real-time alerts
  if (!force && isRunningInIframe()) return;

  const now = Date.now();
  if (!force && now - lastBeepTimestamp < 2500) return; // Strict 2.5s anti-duplicate lock
  lastBeepTimestamp = now;

  const wav = (type === 'handoff' ? HANDOFF_WAV : ARRIVAL_WAV) || ARRIVAL_WAV;
  const freq = type === 'handoff' ? 660 : 880;
  playSoundDirect(wav, freq, force);
}

// Named Aliases
export const playVisitorAlertSound = () => playCleanSound('arrival');
export const playChatMessageAlertSound = () => playCleanSound('message');
export const playHandoffAlertSound = () => playCleanSound('handoff');

// Explicit Test Sound trigger: ALWAYS plays on user click
export async function playTestSound(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    await initAndUnlockAudio();
    playCleanSound('arrival', true); // force = true
    return true;
  } catch {
    return false;
  }
}

// Compatibility deduplication helper
export function tryPlayDeduplicatedSound(
  _eventId: string,
  soundType: 'arrival' | 'message' | 'handoff' = 'arrival',
  _scope = 'global'
): boolean {
  if (typeof window === 'undefined') return false;
  if (isSoundMutedGlobally()) return false;
  if (isRunningInIframe()) return false;

  playCleanSound(soundType);
  return true;
}

export function isEventAlreadyPlayed(_eventId: string, _scope = 'global'): boolean {
  return false;
}

export function markEventAsPlayed(_eventId: string, _scope = 'global'): void {}

export function clearAudioEventLocks(): void {}

// Web Worker Interval for background tabs
export function createWorkerInterval(callback: () => void, intervalMs: number): () => void {
  if (typeof window === 'undefined') return () => {};
  try {
    const workerScript = `
      var timer = null;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          if (timer) clearInterval(timer);
          timer = setInterval(function() { postMessage('tick'); }, ${intervalMs});
        } else if (e.data === 'stop') {
          if (timer) clearInterval(timer);
          timer = null;
        }
      };
    `;
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = () => callback();
    worker.postMessage('start');
    return () => {
      try {
        worker.postMessage('stop');
        worker.terminate();
      } catch {}
    };
  } catch {
    const timer = setInterval(callback, intervalMs);
    return () => clearInterval(timer);
  }
}

// Continuous Repeating Handoff Alert Loop
let stopHandoffWorker: (() => void) | null = null;
let activeHandoffConvId: string | null = null;
let lastHandoffRingTimestamp = 0;

export function startWaitingForHumanBeep(conversationId?: string, _initialEventId?: string): void {
  if (typeof window === 'undefined') return;
  if (isRunningInIframe()) return;
  if (isSoundMutedGlobally()) {
    stopWaitingForHumanBeep();
    return;
  }

  const targetId = conversationId || 'global';
  if (stopHandoffWorker && activeHandoffConvId === targetId) return;

  const now = Date.now();
  if (stopHandoffWorker) {
    stopHandoffWorker();
    stopHandoffWorker = null;
  }
  activeHandoffConvId = targetId;

  // Single clean beep on start with 2.2s debounce guard (prevents double acoustic beep)
  if (now - lastHandoffRingTimestamp > 2200) {
    lastHandoffRingTimestamp = now;
    playCleanSound('handoff');
  }

  // Repeat every 3 seconds continuously until claimed or stopped
  stopHandoffWorker = createWorkerInterval(() => {
    if (isSoundMutedGlobally()) {
      stopWaitingForHumanBeep();
      return;
    }
    lastHandoffRingTimestamp = Date.now();
    playCleanSound('handoff');
  }, 3000);
}

export function stopWaitingForHumanBeep(conversationId?: string, force = false): void {
  // If no conversationId or force is true, stop unconditionally!
  if (!force && conversationId && activeHandoffConvId && activeHandoffConvId !== conversationId) return;
  if (stopHandoffWorker) {
    try {
      stopHandoffWorker();
    } catch {}
    stopHandoffWorker = null;
  }
  activeHandoffConvId = null;
  lastHandoffRingTimestamp = 0;
}

export const startContinuousHandoffRinger = startWaitingForHumanBeep;
export const stopContinuousHandoffRinger = stopWaitingForHumanBeep;

// Desktop Background Notification (Silent Windows Popup - ZERO OS Sound)
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  try {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      const p = await Notification.requestPermission();
      return p === 'granted';
    }
    return false;
  } catch {
    return false;
  }
}

let lastGlobalNotificationTimestamp = 0;

export function showBackgroundNotification(
  title: string,
  body: string,
  icon = '/favicon.ico',
  eventKey?: string,
  _soundAlertsEnabled?: boolean,
  targetUrl = '/dashboard/chats'
) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  // When embedded inside the CRM iframe, the parent CRM window handles OS notifications and Web Push
  try {
    if (window.self !== window.top) return;
  } catch {
    return;
  }
  if (Notification.permission !== 'granted') {
    requestNotificationPermission().catch(() => {});
    return;
  }

  const now = Date.now();
  // Absolute Rate-Limiter: No 2 Windows notifications can ever pop up within 2.5 seconds of each other
  if (now - lastGlobalNotificationTimestamp < 2500) {
    return;
  }

  // Cross-tab lock: ensure this exact notification only shows ONCE across all open tabs within 3 seconds
  const lockKey = eventKey || `notif_${title}_${(body || '').slice(0, 30)}`;
  try {
    const storageKey = `teals_notif_fired_${lockKey}`;
    const lastFired = localStorage.getItem(storageKey);
    if (lastFired && now - Number(lastFired) < 3000) {
      return; // Already notified recently in this or another tab
    }
    localStorage.setItem(storageKey, String(now));
  } catch {}

  lastGlobalNotificationTimestamp = now;

  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  const isHidden = typeof document !== 'undefined' && document.hidden;

  const notifOptions = {
    body,
    icon,
    silent: !(isMobile && isHidden),
    tag: eventKey || `teals_livechat_${now}`,
    renotify: true,
    vibrate: [250, 100, 250],
    data: { url: targetUrl },
  };

  try {
    const notif = new Notification(title, notifOptions as any);

    notif.onclick = (e) => {
      try { e.preventDefault(); } catch {}
      window.focus();
      const currentPath = window.location.pathname + window.location.search;
      if (currentPath !== targetUrl) {
        window.location.href = targetUrl;
      }
      notif.close();
    };

    setTimeout(() => {
      try { notif.close(); } catch {}
    }, 6000);
  } catch (err) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, notifOptions as any).catch(() => {});
      }).catch(() => {});
    }
  }
}

// Tab Title Flashing
let titleFlashTimer: ReturnType<typeof setInterval> | null = null;
let baseTitle = typeof document !== 'undefined' ? document.title : 'Teals CRM';

export function flashTabTitle(alertTitle: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!document.hidden) return;

  if (titleFlashTimer) clearInterval(titleFlashTimer);
  if (!baseTitle || baseTitle.includes('!') || baseTitle.includes('(')) {
    baseTitle = 'Teals CRM - Live Chat Console';
  }

  let toggle = false;
  titleFlashTimer = setInterval(() => {
    if (!document.hidden) {
      stopTabTitleFlash();
      return;
    }
    document.title = toggle ? alertTitle : baseTitle;
    toggle = !toggle;
  }, 1000);
}

export function stopTabTitleFlash() {
  if (titleFlashTimer) {
    clearInterval(titleFlashTimer);
    titleFlashTimer = null;
  }
  if (typeof document !== 'undefined' && baseTitle) {
    document.title = baseTitle;
  }
}

// User Interaction Unlocker
export async function initAndUnlockAudio(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const ctx = getSharedAudioContext();
  if (ctx && ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {}
  }
  ensureAudioBufferDecoded().catch(() => {});
  return true;
}

// Attach global event listeners to auto-unlock audio on any page interaction
if (typeof window !== 'undefined') {
  const unlock = () => {
    initAndUnlockAudio().catch(() => {});
  };
  ['click', 'touchstart', 'keydown', 'mousedown', 'pointerdown'].forEach((ev) => {
    window.addEventListener(ev, unlock, { passive: true, once: false });
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      stopTabTitleFlash();
      initAndUnlockAudio().catch(() => {});
    }
  });
  window.addEventListener('focus', () => {
    stopTabTitleFlash();
    initAndUnlockAudio().catch(() => {});
  });
}

