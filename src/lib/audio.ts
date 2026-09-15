'use client';

import { ARRIVAL_WAV, MESSAGE_WAV, HANDOFF_WAV } from './sound-data';

let ctx: AudioContext | null = null;
let keepAliveOsc: OscillatorNode | null = null;
let continuousHandoffInterval: ReturnType<typeof setInterval> | null = null;
const lastTonePlayedAt: Record<string, number> = {};
let lastGlobalToneAt = 0;
let isAudioInitialized = false;

// Global rate limiting to guarantee NO acoustic stutter
function canPlay(toneType: string, minIntervalMs = 350) {
  const now = Date.now();
  if (now - lastGlobalToneAt < 300) {
    return false;
  }
  const prev = lastTonePlayedAt[toneType] || 0;
  if (now - prev < minIntervalMs) {
    return false;
  }
  lastTonePlayedAt[toneType] = now;
  lastGlobalToneAt = now;
  return true;
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    } catch { return null; }
  }
  return ctx;
}

// Keep-alive infrasound node to permanently prevent background tab AudioContext suspension in Chromium/WebKit
function ensureKeepAlive(audioCtx: AudioContext) {
  if (keepAliveOsc) return;
  try {
    const keepAliveGain = audioCtx.createGain();
    // 0.00005 amplitude: mathematically non-zero to prevent Chromium silence detector from suspending, but 100% silent to human ears
    keepAliveGain.gain.value = 0.00005;
    keepAliveGain.connect(audioCtx.destination);

    // 15 Hz infrasound (below 20Hz human hearing range)
    keepAliveOsc = audioCtx.createOscillator();
    keepAliveOsc.type = 'sine';
    keepAliveOsc.frequency.setValueAtTime(15, audioCtx.currentTime);
    keepAliveOsc.connect(keepAliveGain);
    keepAliveOsc.start();
  } catch {}
}

// Pre-synthesized pure single-frequency WAV (strictly 1 single crisp beep)
function createSingleBeepWav(freq: number, durationMs = 700, volume = 0.95): string {
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * (durationMs / 1000));
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const attack = Math.min(1, t / 0.003); // 3ms instant crisp attack

    const bodyDecay = Math.exp(-t * 4.2); // Warm 600ms sustain
    const sparkleDecay = Math.exp(-t * 9.0); // 300ms sparkle decay
    const chimeDecay = Math.exp(-t * 12.0); // 200ms glass strike decay

    // Layer 1: Fundamental (Warm bell strike with triangle warmth)
    const f0 = Math.sin(2 * Math.PI * freq * t);
    const f0_tri = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * freq * t));
    const layer1 = (f0 * 0.45 + f0_tri * 0.25) * bodyDecay;

    // Layer 2: Sub-octave warmth (speaker resonance)
    const f_sub = Math.sin(2 * Math.PI * (freq * 0.5) * t) * 0.20 * bodyDecay;

    // Layer 3: Octave sparkle (crisp presence)
    const f_oct = Math.sin(2 * Math.PI * (freq * 2.0) * t) * 0.25 * sparkleDecay;

    // Layer 4: Crystal bell harmonic (2.756x chime resonance)
    const f_chime = Math.sin(2 * Math.PI * (freq * 2.756) * t) * 0.15 * chimeDecay;

    const sample = (layer1 + f_sub + f_oct + f_chime) * volume * attack;
    const int16 = Math.max(-32767, Math.min(32767, Math.floor(sample * 32767)));
    view.setInt16(44 + i * 2, int16, true);
  }

  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

let ARRIVAL_SINGLE_WAV = '';
let MESSAGE_SINGLE_WAV = '';
let HANDOFF_SINGLE_WAV = '';

if (typeof window !== 'undefined') {
  try {
    ARRIVAL_SINGLE_WAV = createSingleBeepWav(1046.50, 700, 0.95);
    MESSAGE_SINGLE_WAV = createSingleBeepWav(1174.66, 650, 0.95);
    HANDOFF_SINGLE_WAV = createSingleBeepWav(880.00, 750, 0.95);
  } catch {}
}

// Direct Web Audio API synthesis: strictly ONE single rich bell chime (crisp, loud & modern)
function playToneOscillator(audioCtx: AudioContext, type: 'arrival' | 'message' | 'handoff') {
  const freq = type === 'arrival' ? 1046.50 : type === 'message' ? 1174.66 : 880.00;
  const duration = 0.70;
  const volume = 1.0;

  const t = audioCtx.currentTime + 0.015;
  try {
    // Layer 1: Fundamental Warm Chime (Triangle wave for rich acoustic bell resonance)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, t);

    // Layer 2: Shimmering Sparkle Harmonic (2x - crisp high punch)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, t);

    // Layer 3: Crystal Glass Overtones (2.756x - natural physical bell strike overtone)
    const osc3 = audioCtx.createOscillator();
    const gain3 = audioCtx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(freq * 2.756, t);

    // Layer 4: Warm Acoustic Sub-Body (0.5x - speaker resonance)
    const osc4 = audioCtx.createOscillator();
    const gain4 = audioCtx.createGain();
    osc4.type = 'sine';
    osc4.frequency.setValueAtTime(freq * 0.5, t);

    // Master Gain
    const master = audioCtx.createGain();
    master.gain.setValueAtTime(volume * 1.0, t);
    master.connect(audioCtx.destination);

    // Envelopes: 3ms ultra-crisp attack, natural rich bell decay
    gain1.gain.setValueAtTime(0.001, t);
    gain1.gain.linearRampToValueAtTime(0.70, t + 0.003);
    gain1.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    gain2.gain.setValueAtTime(0.001, t);
    gain2.gain.linearRampToValueAtTime(0.30, t + 0.003);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t + duration * 0.65);

    gain3.gain.setValueAtTime(0.001, t);
    gain3.gain.linearRampToValueAtTime(0.18, t + 0.003);
    gain3.gain.exponentialRampToValueAtTime(0.0001, t + duration * 0.45);

    gain4.gain.setValueAtTime(0.001, t);
    gain4.gain.linearRampToValueAtTime(0.22, t + 0.003);
    gain4.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc1.connect(gain1);
    gain1.connect(master);

    osc2.connect(gain2);
    gain2.connect(master);

    osc3.connect(gain3);
    gain3.connect(master);

    osc4.connect(gain4);
    gain4.connect(master);

    osc1.start(t);
    osc1.stop(t + duration + 0.02);

    osc2.start(t);
    osc2.stop(t + duration + 0.02);

    osc3.start(t);
    osc3.stop(t + duration + 0.02);

    osc4.start(t);
    osc4.stop(t + duration + 0.02);
  } catch {}
}

export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {}
  }
}

let silentBgAudio: HTMLAudioElement | null = null;

export function ensureBackgroundAudioStayAlive() {
  if (typeof window === 'undefined') return;
  try {
    const pathname = (window.location.pathname || '').toLowerCase();
    if (pathname.startsWith('/widget')) {
      return;
    }
    if (!silentBgAudio) {
      silentBgAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
      silentBgAudio.loop = true;
      silentBgAudio.volume = 0.001;
    }
    if (silentBgAudio && silentBgAudio.paused) {
      silentBgAudio.play().catch(() => {});
    }
  } catch {}
}

// User gesture unlock: resumes context and enables keep-alive. NEVER PLAYS ANY SOUND!
export async function initAndUnlockAudio() {
  ensureBackgroundAudioStayAlive();
  const c = getCtx();
  if (c) {
    if (c.state !== 'running') {
      try { await c.resume(); } catch {}
    }
    if (c.state === 'running' && !isAudioInitialized) {
      isAudioInitialized = true;
      ensureKeepAlive(c);
    }
  }

  requestNotificationPermission().catch(() => {});
  return c?.state === 'running';
}

// Dual-Engine Playback: Web Audio API primary + HTML5 Audio fallback
export function playCleanSound(type: 'arrival' | 'message' | 'handoff') {
  if (typeof window === 'undefined') return;

  // Strict Guard: Visitor widget (/widget route) MUST NEVER play ANY sound!
  try {
    const pathname = (window.location.pathname || '').toLowerCase();
    if (pathname.startsWith('/widget')) {
      return;
    }
  } catch {}

  const now = Date.now();
  if (now - lastGlobalToneAt < 250) return;
  const prev = lastTonePlayedAt[type] || 0;
  if (now - prev < 500) return;
  lastTonePlayedAt[type] = now;
  lastGlobalToneAt = now;

  let playedWebAudio = false;
  const c = getCtx();
  if (c) {
    if (c.state === 'running') {
      try {
        playToneOscillator(c, type);
        playedWebAudio = true;
      } catch {}
    } else {
      try {
        c.resume().catch(() => {});
      } catch {}
      try {
        const uri = type === 'arrival' ? (ARRIVAL_SINGLE_WAV || ARRIVAL_WAV) : type === 'message' ? (MESSAGE_SINGLE_WAV || MESSAGE_WAV) : (HANDOFF_SINGLE_WAV || HANDOFF_WAV);
        const audio = new Audio(uri);
        audio.volume = 1.0;
        const p = audio.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
        playedWebAudio = true;
      } catch {}
    }
  }

  // Pure single-playback fallback if Web Audio was not initialized
  if (!playedWebAudio) {
    try {
      const uri = type === 'arrival' ? (ARRIVAL_SINGLE_WAV || ARRIVAL_WAV) : type === 'message' ? (MESSAGE_SINGLE_WAV || MESSAGE_WAV) : (HANDOFF_SINGLE_WAV || HANDOFF_WAV);
      const audio = new Audio(uri);
      audio.volume = 1.0;
      const p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {});
      }
    } catch {}
  }
}

// 1. Visitor Arrival (Single clean chime, debounced)
export function playVisitorAlertSound() {
  playCleanSound('arrival');
}

// 2. Chat Message (Single clean message pop, debounced)
export function playChatMessageAlertSound() {
  playCleanSound('message');
}

// 3. Human Agent Handoff Chime (Soft, pleasant 2-tone attention chime)
export function playHandoffAlertSound() {
  playCleanSound('handoff');
}

// Cross-tab synchronization bus via BroadcastChannel API
const SOUND_BUS_NAME = 'teals_sound_bus';
const soundBus: BroadcastChannel | null = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel(SOUND_BUS_NAME)
  : null;

// In-memory set of played event IDs for fast synchronous lookups
const playedEventIds = new Set<string>();

/**
 * Checks if an event ID has already triggered a notification beep across ANY tab within the given scope
 */
export function isEventAlreadyPlayed(eventId: string, scope = 'global'): boolean {
  if (!eventId) return false;
  const key = `${scope}_${eventId}`;
  if (playedEventIds.has(key)) return true;
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('teals_played_event_' + key);
      if (stored) {
        const time = Number(stored);
        if (Date.now() - time < 2000) {
          playedEventIds.add(key);
          return true;
        } else {
          localStorage.removeItem('teals_played_event_' + key);
        }
      }
    } catch {}
  }
  return false;
}

/**
 * Marks an event ID as played both in-memory and in localStorage (persists across tab switches)
 */
export function markEventAsPlayed(eventId: string, scope = 'global'): void {
  if (!eventId) return;
  const key = `${scope}_${eventId}`;
  const now = Date.now();
  playedEventIds.add(key);
  setTimeout(() => {
    playedEventIds.delete(key);
  }, 2000);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('teals_played_event_' + key, String(now));
      cleanupOldPlayedEvents();
    } catch {}
  }
}

/**
 * Completely clears all audio event locks (in memory and browser storage), allowing fresh arrivals and tests
 */
export function clearAudioEventLocks(): void {
  playedEventIds.clear();
  if (typeof window !== 'undefined') {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('teals_played_event_') || k.startsWith('teals_machine_played_') || k.startsWith('teals_visitor_welcomed_'))) {
          localStorage.removeItem(k);
        }
      }
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith('teals_')) {
          sessionStorage.removeItem(k);
        }
      }
    } catch {}
  }
  if (soundBus) {
    try {
      soundBus.postMessage({ type: 'CLEAR_AUDIO_LOCKS' });
    } catch {}
  }
}

/**
 * Prunes played event locks older than 24 hours to keep localStorage lean without replaying on refresh
 */
function cleanupOldPlayedEvents(): void {
  if (typeof window === 'undefined') return;
  try {
    const now = Date.now();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('teals_played_event_')) {
        const time = Number(localStorage.getItem(k) || 0);
        if (now - time > 60 * 1000) {
          localStorage.removeItem(k);
        }
      }
    }
  } catch {}
}

/**
 * Core Cross-Tab Deduplication Sound Player:
 * Guarantees that each unique event ID plays EXACTLY ONCE across browser tabs within the same scope.
 * - 'crm' scope deduplicates multiple CRM dashboard tabs.
 * - 'website' scope deduplicates multiple visitor website tabs.
 */
export function tryPlayDeduplicatedSound(
  eventId: string,
  soundType: 'arrival' | 'message' | 'handoff',
  scope = 'global'
): boolean {
  if (!eventId || typeof window === 'undefined') return false;

  // 1. Check if already played in this scope
  if (isEventAlreadyPlayed(eventId, scope)) {
    return false;
  }

  // 2. Lock event ID immediately across this tab and localStorage
  markEventAsPlayed(eventId, scope);

  // 3. Broadcast to sibling browser tabs with same scope so they stay silent
  if (soundBus) {
    try {
      soundBus.postMessage({
        type: 'EVENT_PLAYED',
        eventId,
        scope,
        soundType,
        timestamp: Date.now()
      });
    } catch {}
  }

  // 4. Play the clean, loud chime exactly once
  if (soundType === 'arrival') {
    playVisitorAlertSound();
  } else if (soundType === 'message') {
    playChatMessageAlertSound();
  } else if (soundType === 'handoff') {
    playHandoffAlertSound();
  }

  return true;
}

// Repeating beep loop manager for "waiting for human"
let waitingBeepInterval: ReturnType<typeof setInterval> | null = null;
let activeWaitingConvId: string | null = null;

/**
 * Starts repeating handoff alert beep loop (every 2.8 seconds) while waiting for a human agent.
 * Keeps ringing persistently until explicitly claimed or stopped.
 * Uses cross-tab deduplication so multiple open CRM tabs ring in unison without doubling/echoing.
 */
export function startWaitingForHumanBeep(conversationId: string, initialEventId?: string): void {
  if (typeof window === 'undefined') return;
  if (activeWaitingConvId === conversationId && waitingBeepInterval) {
    return; // Already actively looping for this conversation
  }

  // Clear any existing local interval directly without broadcasting stop
  if (waitingBeepInterval) {
    clearInterval(waitingBeepInterval);
    waitingBeepInterval = null;
  }
  activeWaitingConvId = conversationId;

  // Ring immediately on start (deduplicated across sibling tabs)
  const initialKey = initialEventId || `handoff_init_${conversationId}_${Math.floor(Date.now() / 2500)}`;
  tryPlayDeduplicatedSound(initialKey, 'handoff', 'global');

  // Loop every 2.8 seconds continuously until claimed
  waitingBeepInterval = setInterval(() => {
    if (!activeWaitingConvId) {
      if (waitingBeepInterval) {
        clearInterval(waitingBeepInterval);
        waitingBeepInterval = null;
      }
      return;
    }
    // Time-bucketed key (2.4s window) ensures exactly 1 tab sounds per 2.8s tick
    const loopKey = `handoff_loop_${activeWaitingConvId}_${Math.floor(Date.now() / 2400)}`;
    tryPlayDeduplicatedSound(loopKey, 'handoff', 'global');
  }, 2800);
}

/**
 * Immediately stops the repeating handoff beep loop.
 * Only stops if conversation matches (or no specific conversation passed by claim handler).
 */
export function stopWaitingForHumanBeep(conversationId?: string): void {
  if (conversationId && activeWaitingConvId && activeWaitingConvId !== conversationId) {
    return; // Different conversation, keep ringing
  }

  if (waitingBeepInterval) {
    clearInterval(waitingBeepInterval);
    waitingBeepInterval = null;
  }
  activeWaitingConvId = null;

  if (soundBus && conversationId) {
    try {
      soundBus.postMessage({ type: 'STOP_WAITING_BEEP', conversationId });
    } catch {}
  }
}

// Cross-tab message listener on the sound bus
if (soundBus) {
  soundBus.onmessage = (e) => {
    const data = e.data;
    if (!data) return;

    if (data.type === 'EVENT_PLAYED' && data.eventId) {
      // Mark event as played in this tab's memory and store for this scope so sibling tabs stay silent
      markEventAsPlayed(data.eventId, data.scope || 'global');
    } else if (data.type === 'STOP_WAITING_BEEP') {
      // An agent claimed the chat — stop if it matches our active conversation
      if (!data.conversationId || data.conversationId === activeWaitingConvId) {
        if (waitingBeepInterval) {
          clearInterval(waitingBeepInterval);
          waitingBeepInterval = null;
        }
        activeWaitingConvId = null;
      }
    } else if (data.type === 'CLEAR_AUDIO_LOCKS') {
      playedEventIds.clear();
    }
  };
}

// 4. Continuous Repeating Ringer (Legacy compatibility - mapped to waiting loop)
export function startContinuousHandoffRinger() {
  stopContinuousHandoffRinger();
}

export function stopContinuousHandoffRinger() {
  stopWaitingForHumanBeep();
}

// Background Desktop Notification
export function showBackgroundNotification(title: string, body: string, icon = '/favicon.ico') {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon,
      tag: 'teals-live-alert',
      silent: true, // Audio chime already handled
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    setTimeout(() => { n.close(); }, 7000);
  } catch {}
}

// Tab Title Flashing
let titleFlashTimer: ReturnType<typeof setInterval> | null = null;
let baseTitle = typeof document !== 'undefined' ? document.title : 'Teals CRM';

export function flashTabTitle(alertTitle: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!document.hidden) return; // Tab is active, no need to flash
  
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

// Global user gesture unlock listeners (resumes AudioContext silently without playing any sound)
if (typeof window !== 'undefined') {
  const unlock = () => {
    initAndUnlockAudio();
  };
  ['click', 'touchstart', 'keydown', 'mousedown', 'pointerdown'].forEach((ev) => {
    window.addEventListener(ev, unlock, { passive: true });
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      stopTabTitleFlash();
    }
  });
  window.addEventListener('focus', () => {
    stopTabTitleFlash();
  });
}

