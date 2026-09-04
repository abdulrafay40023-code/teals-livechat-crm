'use client';

let ctx = null;
let pendingBeeps = [];
let flushing = false;

function getCtx() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      var AC = window.AudioContext || (window as any).webkitAudioContext;
      ctx = new AC();
    } catch (e) { return null; }
  }
  return ctx;
}

async function ensureRunning() {
  var c = getCtx();
  if (!c) return false;
  if (c.state === 'running') return true;
  try { await c.resume(); return c.state === 'running'; } catch (e) { return false; }
}

function playTone(c, freq, duration, volume, delay) {
  try {
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.connect(gain); gain.connect(c.destination);
    var start = c.currentTime + delay;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.start(start); osc.stop(start + duration + 0.05);
  } catch (e) {}
}

function doPlayArrival() {
  var c = getCtx(); if (!c || c.state !== 'running') return;
  playTone(c, 587.33, 0.14, 0.55, 0.00); // D5
  playTone(c, 880.00, 0.30, 0.60, 0.14); // A5
}

function doPlayMessage() {
  var c = getCtx(); if (!c || c.state !== 'running') return;
  // Instagram / WhatsApp double-pop
  playTone(c, 784.00, 0.08, 0.55, 0.00);  // Pop 1
  playTone(c, 1046.50, 0.20, 0.50, 0.08); // Pop 2
}

function doPlayHandoff() {
  var c = getCtx(); if (!c || c.state !== 'running') return;
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
    var ok = await ensureRunning();
    if (ok && pendingBeeps.length > 0) {
      var last = pendingBeeps[pendingBeeps.length - 1];
      pendingBeeps = []; last();
    }
  } finally { flushing = false; }
}

function queueOrPlay(fn) {
  getCtx();
  if (ctx && ctx.state === 'running') {
    fn(); // play directly
  } else {
    pendingBeeps.push(fn);
    // Try to resume immediately (works if ctx was previously running - e.g. after tab switch)
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
