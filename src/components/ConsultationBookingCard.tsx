'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, Clock, User, Mail, Phone, CheckCircle2, Sparkles, Send, ArrowRight } from 'lucide-react';

interface ConsultationBookingCardProps {
  conversationId: string;
  visitorToken?: string;
  propertySlug?: string;
  initialName?: string;
  initialEmail?: string;
  initialPhone?: string;
  availableServices?: string[];
  alreadySubmittedData?: {
    name?: string;
    email?: string;
    phone?: string;
    date?: string;
    time?: string;
    service?: string;
  };
  onBookingSubmitted?: (data: {
    name: string;
    email: string;
    phone: string;
    date: string;
    time: string;
    service: string;
  }) => void;
}

const DEFAULT_SERVICES = [
  'Amazon FBA Automation & Management',
  'Shopify Dropshipping & Store Setup',
  'Walmart Dropshipping & Automation',
  'TikTok Shop Automation',
  'Etsy & eBay Store Scaling',
  'E-book Publishing & Author Services',
  '1-on-1 E-commerce Consultation'
];

function generate24HourTimeSlots() {
  const slots: { value: string; label: string }[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let min = 0; min < 60; min += 5) {
      const hStr = hour.toString().padStart(2, '0');
      const mStr = min.toString().padStart(2, '0');
      const value = `${hStr}:${mStr}`;

      const period = hour >= 12 ? 'PM' : 'AM';
      let displayHour = hour % 12;
      if (displayHour === 0) displayHour = 12;
      const displayHStr = displayHour.toString().padStart(2, '0');

      let tag = '';
      if (hour === 0 && min === 0) tag = ' (Midnight)';
      else if (hour === 12 && min === 0) tag = ' (Noon)';

      const label = `${displayHStr}:${mStr} ${period}${tag}`;
      slots.push({ value, label });
    }
  }
  return slots;
}

const TIME_SLOTS = generate24HourTimeSlots();

const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (New York, FL, Atlanta · EST/EDT)' },
  { value: 'America/Chicago', label: 'Central Time (Chicago, Wisconsin, Texas · CST/CDT)' },
  { value: 'America/Denver', label: 'Mountain Time (Denver, Colorado, Utah · MST/MDT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (LA, San Francisco, Seattle · PST/PDT)' },
  { value: 'America/Phoenix', label: 'Arizona Time (Phoenix · MST)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKST/AKDT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
  { value: 'Europe/London', label: 'London / UK Time (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central Europe (Paris, Berlin, Rome · CET)' },
  { value: 'Asia/Dubai', label: 'Dubai / UAE Time (GST)' },
  { value: 'Asia/Karachi', label: 'Pakistan Time (PKT)' },
  { value: 'Asia/Kolkata', label: 'India Time (IST)' },
  { value: 'Australia/Sydney', label: 'Sydney, Australia (AEST/AEDT)' },
];

export const ConsultationBookingCard: React.FC<ConsultationBookingCardProps> = ({
  conversationId,
  visitorToken,
  propertySlug = 'amz-solutions-hub',
  initialName = '',
  initialEmail = '',
  initialPhone = '',
  availableServices = DEFAULT_SERVICES,
  alreadySubmittedData,
  onBookingSubmitted,
}) => {
  const [name, setName] = useState(alreadySubmittedData?.name || initialName || '');
  const [email, setEmail] = useState(alreadySubmittedData?.email || initialEmail || '');
  const [phone, setPhone] = useState(alreadySubmittedData?.phone || initialPhone || '');
  const [service, setService] = useState(alreadySubmittedData?.service || availableServices[0] || DEFAULT_SERVICES[0]);
  
  // Detect visitor local timezone (auto-detected from browser, enhanced by GeoIP)
  const [visitorTimezone, setVisitorTimezone] = useState<string>(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
    } catch {
      return 'America/New_York';
    }
  });

  // Automatically fetch exact IP timezone from server edge
  useEffect(() => {
    let active = true;
    fetch('/api/visitor/geo')
      .then(res => res.json())
      .then(data => {
        if (active && data?.timezone && typeof data.timezone === 'string') {
          try {
            new Intl.DateTimeFormat('en-US', { timeZone: data.timezone });
            setVisitorTimezone(data.timezone);
          } catch {}
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const currentVisitorLocalTime = React.useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: visitorTimezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(new Date());
    } catch {
      return '';
    }
  }, [visitorTimezone]);

  // Calculate local date YYYY-MM-DD for any timezone with optional day offset
  const getVisitorLocalDate = (tz: string, dayOffset = 0) => {
    try {
      const d = new Date();
      if (dayOffset !== 0) d.setDate(d.getDate() + dayOffset);
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
    } catch {
      const d = new Date();
      if (dayOffset !== 0) d.setDate(d.getDate() + dayOffset);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  };

  // Minimum allowed date: visitor's exact local date onwards!
  // Past dates (yesterday, day before yesterday) are strictly disabled and unselectable!
  const minDateStr = getVisitorLocalDate(visitorTimezone, 0);
  const defaultDateStr = getVisitorLocalDate(visitorTimezone, 0);

  // Helper to get visitor's current minutes from midnight in their local timezone
  const getVisitorMinutesFromMidnight = React.useCallback((tz: string) => {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      }).formatToParts(new Date());
      let h = 0, m = 0;
      for (const p of parts) {
        if (p.type === 'hour') h = parseInt(p.value, 10) % 24;
        if (p.type === 'minute') m = parseInt(p.value, 10);
      }
      return h * 60 + m;
    } catch {
      const now = new Date();
      return now.getHours() * 60 + now.getMinutes();
    }
  }, []);

  // Compute next available upcoming slot (current local time + 15 mins buffer, rounded to next 5 mins)
  const getNextAvailableSlot = React.useCallback((tz: string) => {
    try {
      const currentMins = getVisitorMinutesFromMidnight(tz);
      const targetMins = Math.ceil((currentMins + 15) / 5) * 5;
      if (targetMins < 24 * 60) {
        const slotH = Math.floor(targetMins / 60);
        const slotM = targetMins % 60;
        return `${String(slotH).padStart(2, '0')}:${String(slotM).padStart(2, '0')}`;
      }
    } catch {}
    return '14:00';
  }, [getVisitorMinutesFromMidnight]);

  const currentVisitorLocalMins = React.useMemo(() => {
    return getVisitorMinutesFromMidnight(visitorTimezone);
  }, [visitorTimezone, getVisitorMinutesFromMidnight]);

  const [date, setDate] = useState(alreadySubmittedData?.date || defaultDateStr);
  const [time, setTime] = useState(() => {
    if (alreadySubmittedData?.time) {
      const matched = TIME_SLOTS.find(
        (s) => s.value === alreadySubmittedData.time || s.label.startsWith(alreadySubmittedData.time!)
      );
      if (matched) return matched.value;
    }
    return getNextAvailableSlot(visitorTimezone);
  });
  const [submitted, setSubmitted] = useState(Boolean(alreadySubmittedData));
  const [submittedData, setSubmittedData] = useState(alreadySubmittedData || null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Exact timezone date-time parser
  const getExactDateInTimezone = (dateStr: string, timeStr: string, timeZone: string): Date => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hour, minute] = timeStr.split(':').map(Number);
      let target = new Date(Date.UTC(year, month - 1, day, hour || 0, minute || 0, 0));
      const targetMs = target.getTime();
      for (let i = 0; i < 3; i++) {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).formatToParts(target);
        const p: Record<string, string> = {};
        parts.forEach((pt) => { p[pt.type] = pt.value; });
        let h = parseInt(p.hour, 10);
        if (h === 24) h = 0;
        const localAsUtc = Date.UTC(
          parseInt(p.year, 10),
          parseInt(p.month, 10) - 1,
          parseInt(p.day, 10),
          h,
          parseInt(p.minute, 10),
          parseInt(p.second, 10)
        );
        const offset = localAsUtc - targetMs;
        target = new Date(target.getTime() - offset);
      }
      return target;
    } catch {
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hour, minute] = timeStr.split(':').map(Number);
      return new Date(year, month - 1, day, hour || 0, minute || 0, 0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    if (!phone.trim()) {
      setError('Please provide a contact phone number');
      return;
    }
    if (!date) {
      setError('Please select a preferred date');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const selectedSlot = TIME_SLOTS.find((s) => s.value === time) || { value: time, label: time };
      const timeLabel = selectedSlot.label.replace(/\s*\((Midnight|Noon)\)/i, '');

      // Parse selected date and time in visitor's local timezone
      const exactDate = getExactDateInTimezone(date, selectedSlot.value || time, visitorTimezone);
      const scheduledIso = exactDate.toISOString();

      // Convert accurately to Pakistan Time [PKT] (Asia/Karachi)
      let pktTime = timeLabel;
      let pktDate = date;
      try {
        pktTime = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Karachi',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }).format(exactDate);

        pktDate = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Karachi'
        }).format(exactDate); // Format: YYYY-MM-DD
      } catch (tzErr) {
        console.warn('PKT conversion error in browser:', tzErr);
      }

      const payload = {
        conversationId,
        visitorToken,
        propertySlug,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        date,
        time: timeLabel,
        rawTime: selectedSlot.value,
        service,
        visitorTimezone,
        scheduledIso,
        pktTime,
        pktDate,
        clientTime: timeLabel,
        clientDate: date
      };

      const res = await fetch('/api/chat/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to submit booking');
      }

      setSubmitted(true);
      setSubmittedData(payload);
      if (onBookingSubmitted) {
        onBookingSubmitted(payload);
      }
    } catch (err: unknown) {
      console.error('[BOOKING_SUBMIT_ERR]', err);
      const msg = err instanceof Error ? err.message : 'Error submitting booking';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted && submittedData) {
    const displayClientDate = (submittedData as any).clientDate || submittedData.date;
    const displayClientTime = (submittedData as any).clientTime || submittedData.time;
    const displayTz = (submittedData as any).visitorTimezone || visitorTimezone;

    return (
      <div className="mt-2.5 p-3.5 rounded-xl bg-gradient-to-br from-emerald-950/60 to-[#0e1726] border border-emerald-500/40 text-left shadow-lg">
        <div className="flex items-center space-x-2 text-emerald-400 mb-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-xs font-bold tracking-tight">Consultation Booking Confirmed!</span>
        </div>
        <div className="text-[11px] text-gray-300 space-y-1 bg-black/30 p-2.5 rounded-lg border border-emerald-500/20">
          <div><span className="text-gray-400">Date:</span> <strong className="text-white">{displayClientDate}</strong></div>
          <div><span className="text-gray-400">Time:</span> <strong className="text-white">{displayClientTime}</strong> <span className="text-emerald-400 text-[10px]">({(displayTz || 'America/New_York').replace(/_/g, ' ')})</span></div>
          <div><span className="text-gray-400">Service:</span> <span className="text-emerald-300 font-medium">{submittedData.service}</span></div>
          <div><span className="text-gray-400">Confirmation Sent To:</span> <span className="text-blue-300">{submittedData.email}</span></div>
        </div>
        <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
          Zoom meeting link has been dispatched to your email. Our team is excited to speak with you at your scheduled local time!
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2.5 p-3.5 rounded-xl bg-[#0b1222] border border-blue-500/30 text-left shadow-xl max-w-full">
      <div className="flex items-center space-x-2 mb-2 pb-2 border-b border-gray-800">
        <div className="w-6 h-6 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
          <Calendar className="w-3.5 h-3.5" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-white tracking-tight">Free Consultation & Estimate</h4>
          <p className="text-[10px] text-gray-400">Select your preferred date & time for a Zoom call</p>
        </div>
      </div>

      {error && (
        <div className="mb-2.5 p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-[11px] text-rose-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <label className="block text-[10px] font-semibold text-gray-300 mb-0.5">
            Full Name <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
              required
              className="w-full bg-[#131d33] border border-gray-700 focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-gray-300 mb-0.5">
              Email <span className="text-rose-400">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full bg-[#131d33] border border-gray-700 focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-300 mb-0.5">
              Phone <span className="text-rose-400">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              required
              className="w-full bg-[#131d33] border border-gray-700 focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-gray-300 mb-0.5">
            Service Required
          </label>
          <select
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="w-full bg-[#131d33] border border-gray-700 focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none transition-colors"
          >
            {availableServices.map((svc) => (
              <option key={svc} value={svc} className="bg-[#0b1222] text-white">
                {svc}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-gray-300 mb-0.5">
              Preferred Date <span className="text-rose-400">*</span>
            </label>
            <input
              type="date"
              min={minDateStr}
              value={date}
              onChange={(e) => {
                const newDate = e.target.value;
                setDate(newDate);
                if (newDate === minDateStr) {
                  const [curH, curM] = (time || '00:00').split(':').map(Number);
                  const curMins = (curH || 0) * 60 + (curM || 0);
                  if (curMins <= currentVisitorLocalMins) {
                    setTime(getNextAvailableSlot(visitorTimezone));
                  }
                }
              }}
              required
              className="w-full bg-[#131d33] border border-gray-700 focus:border-blue-500 rounded-lg px-2 py-1 text-xs text-white focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-300 mb-0.5">
              Time Slot <span className="text-rose-400">*</span>
              <span className="ml-1 text-[9px] font-normal text-blue-400">
                ({currentVisitorLocalTime ? `Now: ${currentVisitorLocalTime}` : ''})
              </span>
            </label>
            <select
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-[#131d33] border border-gray-700 focus:border-blue-500 rounded-lg px-2 py-1 text-xs text-white focus:outline-none transition-colors"
            >
              {TIME_SLOTS.map((slot) => {
                const [sH, sM] = slot.value.split(':').map(Number);
                const slotMins = sH * 60 + sM;
                const isPast = date === minDateStr && slotMins <= currentVisitorLocalMins;
                return (
                  <option
                    key={slot.value}
                    value={slot.value}
                    disabled={isPast}
                    className={isPast ? "bg-[#0b1222] text-gray-500 line-through" : "bg-[#0b1222] text-white"}
                  >
                    {slot.label}{isPast ? ' (Passed)' : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-0.5">
            <label className="text-[10px] font-semibold text-gray-300">
              Timezone (Auto-Detected from IP)
            </label>
            <span className="text-[9px] font-semibold text-emerald-400">
              {currentVisitorLocalTime ? `Local Time: ${currentVisitorLocalTime}` : ''}
            </span>
          </div>
          <select
            value={visitorTimezone}
            onChange={(e) => {
              const newTz = e.target.value;
              setVisitorTimezone(newTz);
              setTime(getNextAvailableSlot(newTz));
            }}
            className="w-full bg-[#131d33] border border-gray-700 focus:border-blue-500 rounded-lg px-2 py-1 text-xs text-white focus:outline-none transition-colors"
          >
            {!COMMON_TIMEZONES.some(t => t.value === visitorTimezone) && (
              <option value={visitorTimezone} className="bg-[#0b1222] text-white">
                {(visitorTimezone || 'America/New_York').replace(/_/g, ' ')} (Detected)
              </option>
            )}
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value} className="bg-[#0b1222] text-white">
                {tz.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full mt-2 py-2 px-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer"
        >
          {submitting ? (
            <span>Scheduling Consultation...</span>
          ) : (
            <>
              <Calendar className="w-3.5 h-3.5" />
              <span>Confirm Consultation Booking</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
