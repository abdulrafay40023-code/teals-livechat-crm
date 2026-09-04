'use client';

let ctx: AudioContext | null = null;
let pendingBeeps: Array<{ fn: () => void; timestamp: number }> = [];
let flushing = false;

let lastPlayedTone = '';
let lastPlayedAt = 0;

function canPlay(toneType: string, minIntervalMs = 600) {
  const now = Date.now();
  if (toneType === lastPlayedTone && now - lastPlayedAt < minIntervalMs) {
    return false;
  }
  lastPlayedTone = toneType;
  lastPlayedAt = now;
  return true;
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      ctx = new AC();
    } catch { return null; }
  }
  return ctx;
}

async function ensureRunning() {
  const c = getCtx();
  if (!c) return false;
  if (c.state === 'running') return true;
  try { await c.resume(); return (c.state as string) === 'running'; } catch { return false; }
}

function playTone(c: AudioContext, freq: number, duration: number, volume: number, delay: number) {
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain); gain.connect(c.destination);
    const start = c.currentTime + delay;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.start(start); osc.stop(start + duration + 0.05);
  } catch {}
}

function doPlayArrival() {
  if (!canPlay('arrival', 1000)) return;
  const c = getCtx(); if (!c || c.state !== 'running') return;
  playTone(c, 587.33, 0.14, 0.55, 0.00); // D5
  playTone(c, 880.00, 0.30, 0.60, 0.14); // A5
}

function doPlayMessage() {
  if (!canPlay('message', 600)) return;
  const c = getCtx(); if (!c || c.state !== 'running') return;
  // Instagram / WhatsApp double-pop
  playTone(c, 784.00, 0.08, 0.55, 0.00);  // Pop 1
  playTone(c, 1046.50, 0.20, 0.50, 0.08); // Pop 2
}

function doPlayHandoff() {
  if (!canPlay('handoff', 1500)) return;
  const c = getCtx(); if (!c || c.state !== 'running') return;
  // 2-second rich alert chime sequence for human handoff
  playTone(c, 523.25, 0.14, 0.70, 0.00); // C5
  playTone(c, 659.25, 0.14, 0.70, 0.14); // E5
  playTone(c, 783.99, 0.14, 0.75, 0.28); // G5
  playTone(c, 1046.50, 0.40, 0.85, 0.42); // C6

  // Second wave harmonic resonance extending to ~2.0s
  playTone(c, 880.00, 0.20, 0.60, 0.85);  // A5
  playTone(c, 1174.66, 0.55, 0.70, 1.05); // D6
  playTone(c, 1318.51, 0.75, 0.50, 1.25); // E6
}

export async function flushPending() {
  if (flushing) return; flushing = true;
  try {
    const ok = await ensureRunning();
    if (ok && pendingBeeps.length > 0) {
      const now = Date.now();
      // Drop any stale beeps older than 2000ms
      const valid = pendingBeeps.filter(b => now - b.timestamp <= 2000);
      pendingBeeps = [];
      if (valid.length > 0) {
        const last = valid[valid.length - 1];
        last.fn();
      }
    }
  } finally { flushing = false; }
}

function queueOrPlay(fn: () => void) {
  getCtx();
  if (ctx && ctx.state === 'running') {
    fn(); // play directly
  } else {
    pendingBeeps.push({ fn, timestamp: Date.now() });
    ensureRunning().then(function(ok) {
      if (ok) flushPending();
    });
  }
}

if (typeof window !== 'undefined') {
  // Flush on any user interaction
  var evts = ['click','touchstart','keydown','mousedown','pointerdown'];
  var h = function() { flushPending(); };
  evts.forEach(function(ev) { window.addEventListener(ev, h, { passive: true }); });

  // CRITICAL: flush when tab becomes visible again (Chrome suspends ctx in background)
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      flushPending();
    }
  });

  // Try to unlock on load (works for high Media Engagement Index sites)
  setTimeout(function() { ensureRunning().catch(function() {}); }, 100);
}

export async function initAndUnlockAudio() {
  var c = getCtx();
  if (!c) return false;
  if (c.state !== 'running') {
    try {
      await c.resume();
    } catch (e) {}
  }
  return c.state === 'running';
}

export async function playVisitorAlertSound() {
  queueOrPlay(doPlayArrival);
}

export async function playChatMessageAlertSound() {
  queueOrPlay(doPlayMessage);
}

export async function playHandoffAlertSound() {
  queueOrPlay(doPlayHandoff);
}
