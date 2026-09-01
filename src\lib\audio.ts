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
  playTone(c, 523.25, 0.12, 0.7, 0.00); playTone(c, 659.25, 0.12, 0.7, 0.12);
  playTone(c, 783.99, 0.12, 0.7, 0.24); playTone(c, 1046.50, 0.35, 0.85, 0.36);
}
function doPlayMessage() {
  var c = getCtx(); if (!c || c.state !== 'running') return;
  playTone(c, 880, 0.14, 0.65, 0.00); playTone(c, 1108, 0.30, 0.65, 0.14);
}
function doPlayHandoff() {
  var c = getCtx(); if (!c || c.state !== 'running') return;
  playTone(c, 440, 0.09, 0.7, 0.00); playTone(c, 554, 0.09, 0.7, 0.09);
  playTone(c, 659, 0.09, 0.75, 0.18); playTone(c, 880, 0.09, 0.8, 0.27);
  playTone(c, 1108, 0.38, 0.9, 0.36);
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
  return false;
}
export async function playVisitorAlertSound() {
  // Beeps disabled
}
export async function playChatMessageAlertSound() {
  // Beeps disabled
}
export async function playHandoffAlertSound() {
  // Beeps disabled
}
