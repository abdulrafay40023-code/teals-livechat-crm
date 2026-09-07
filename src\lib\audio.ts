'use client';

let ctx: AudioContext | null = null;
let continuousHandoffInterval: ReturnType<typeof setInterval> | null = null;
let lastPlayedTone = '';
let lastPlayedAt = 0;

function canPlay(toneType: string, minIntervalMs = 400) {
  const now = Date.now();
  if (toneType === lastPlayedTone && now - lastPlayedAt < minIntervalMs) {
    return false;
  }
  lastPlayedTone = toneType;
  lastPlayedAt = now;
  return true;
}

// Generate in-memory 16-bit PCM Mono WAV Data URI
function generateWavDataUri(
  notes: Array<{ freq: number; durationMs: number; volume?: number }>,
  sampleRate = 22050
): string {
  if (typeof window === 'undefined') return '';
  let totalSamples = 0;
  notes.forEach(n => {
    totalSamples += Math.floor((n.durationMs / 1000) * sampleRate);
  });
  const dataSize = totalSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); // 16-bit
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  notes.forEach(n => {
    const samples = Math.floor((n.durationMs / 1000) * sampleRate);
    const vol = n.volume ?? 0.95;
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      // High-punch envelope with fast attack and natural decay
      const env = Math.sin((i / samples) * Math.PI);
      const sample = Math.sin(2 * Math.PI * n.freq * t) * vol * env * 32767;
      view.setInt16(offset, Math.max(-32768, Math.min(32767, sample)), true);
      offset += 2;
    }
  });

  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

// Pre-synthesized loud, fast Data URIs for instant zero-lag background tab playback
const ARRIVAL_WAV = typeof window !== 'undefined' ? generateWavDataUri([
  { freq: 880, durationMs: 90, volume: 1.0 },   // A5
  { freq: 1320, durationMs: 180, volume: 1.0 }, // E6
]) : '';

const MESSAGE_WAV = typeof window !== 'undefined' ? generateWavDataUri([
  { freq: 987.77, durationMs: 70, volume: 0.95 },  // B5
  { freq: 1479.98, durationMs: 150, volume: 0.95 }, // F#6
]) : '';

const HANDOFF_WAV = typeof window !== 'undefined' ? generateWavDataUri([
  { freq: 659.25, durationMs: 80, volume: 1.0 },  // E5
  { freq: 880.00, durationMs: 80, volume: 1.0 },  // A5
  { freq: 1174.66, durationMs: 80, volume: 1.0 }, // D6
  { freq: 1567.98, durationMs: 250, volume: 1.0 },// G6
  { freq: 1760.00, durationMs: 350, volume: 1.0 },// A6
]) : '';

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

export async function initAndUnlockAudio() {
  const c = getCtx();
  if (c && c.state !== 'running') {
    try { await c.resume(); } catch {}
  }
  return c?.state === 'running';
}

function playDualAudio(wavUri: string, webAudioFn: (c: AudioContext) => void) {
  // 1. Play via HTML5 Audio element (works reliably in background tabs once user has interacted)
  if (wavUri) {
    try {
      const audio = new Audio(wavUri);
      audio.volume = 1.0;
      audio.play().catch(() => {});
    } catch {}
  }

  // 2. Also play via WebAudio API for punchy harmonic fidelity
  const c = getCtx();
  if (c) {
    if (c.state !== 'running') {
      c.resume().then(() => {
        if (c.state === 'running') webAudioFn(c);
      }).catch(() => {});
    } else {
      webAudioFn(c);
    }
  }
}

function playLoudTone(c: AudioContext, freq: number, duration: number, volume: number, delay: number, type: OscillatorType = 'triangle') {
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.connect(gain);
    gain.connect(c.destination);

    const start = c.currentTime + delay;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

    osc.start(start);
    osc.stop(start + duration + 0.05);
  } catch {}
}

// 1. Visitor Arrival (Fast, loud & punchy double ping)
export function playVisitorAlertSound() {
  if (!canPlay('arrival', 600)) return;
  playDualAudio(ARRIVAL_WAV, (c) => {
    playLoudTone(c, 880.00, 0.10, 0.9, 0.00, 'triangle'); // A5
    playLoudTone(c, 1320.00, 0.22, 1.0, 0.10, 'sine');    // E6
  });
}

// 2. Chat Message (WhatsApp/iMessage punchy pop)
export function playChatMessageAlertSound() {
  if (!canPlay('message', 400)) return;
  playDualAudio(MESSAGE_WAV, (c) => {
    playLoudTone(c, 987.77, 0.08, 0.85, 0.00, 'sine');    // B5
    playLoudTone(c, 1479.98, 0.18, 0.95, 0.08, 'triangle'); // F#6
  });
}

// 3. Urgent Human Agent Handoff Chime (Fast, high-energy siren sequence)
export function playHandoffAlertSound() {
  playDualAudio(HANDOFF_WAV, (c) => {
    playLoudTone(c, 659.25, 0.09, 0.9, 0.00, 'triangle'); // E5
    playLoudTone(c, 880.00, 0.09, 0.9, 0.09, 'triangle'); // A5
    playLoudTone(c, 1174.66, 0.09, 0.95, 0.18, 'triangle'); // D6
    playLoudTone(c, 1567.98, 0.25, 1.0, 0.27, 'sine');     // G6
    playLoudTone(c, 1760.00, 0.35, 0.95, 0.40, 'triangle'); // A6
  });
}

// 4. Continuous Repeating Ringer for Unclaimed Human Agent Requests
export function startContinuousHandoffRinger() {
  if (continuousHandoffInterval) return; // already ringing
  playHandoffAlertSound();
  continuousHandoffInterval = setInterval(() => {
    playHandoffAlertSound();
  }, 3200); // repeats every 3.2 seconds until claimed
}

export function stopContinuousHandoffRinger() {
  if (continuousHandoffInterval) {
    clearInterval(continuousHandoffInterval);
    continuousHandoffInterval = null;
  }
}

if (typeof window !== 'undefined') {
  const unlock = () => { initAndUnlockAudio(); };
  ['click', 'touchstart', 'keydown', 'mousedown', 'pointerdown'].forEach((ev) => {
    window.addEventListener(ev, unlock, { passive: true, once: false });
  });
}

