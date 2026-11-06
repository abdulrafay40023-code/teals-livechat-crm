import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase';

export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BDTKuV_i82zNSjdvc7nbNWFCKdNWXMS9MJzfyicFf92CU125xnYAY8eAsn_gCvZHsR6bgYxNcXhXRtLTjhfa9Ks';

const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  'wsZCX-Tm11G6aLwltsosUUtyHXKcMN_1gUuXaJIeiWA';

try {
  webpush.setVapidDetails(
    'mailto:admin@teals.co',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
} catch (err) {
  console.error('Failed to initialize VAPID details:', err);
}

const BUCKET = 'teals-live-store';
const SUBS_FILE = 'push-subscriptions.json';

export interface StoredPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  email?: string;
  role?: string;
  assigned_websites?: string[];
  updatedAt: string;
}

const g = globalThis as unknown as {
  __tealsPushSubs?: Map<string, StoredPushSubscription>;
  __tealsPushLoadedAt?: number;
  __tealsPushDedup?: Map<string, number>;
};

if (!g.__tealsPushSubs) {
  g.__tealsPushSubs = new Map<string, StoredPushSubscription>();
}
if (!g.__tealsPushDedup) {
  g.__tealsPushDedup = new Map<string, number>();
}

const ADMIN_EMAILS = new Set([
  'garryamelia6265@gmail.com',
  'tzafar04@gmail.com',
  'annusraees@gmail.com',
  'jennifer.cisternino2027@gmail.com',
  'ashal.raza@teals.co',
]);

export function normalizeWebsiteSlug(raw?: string | null): string {
  if (!raw) return '';
  const str = String(raw).toLowerCase().trim();
  if (str.includes('solutions') || str.includes('amz-solutions') || str.includes('amzsolutions')) return 'amz-solutions-hub';
  if (str.includes('innovators') || str.includes('amz-innovators') || str.includes('amzinnovators')) return 'amz-innovators';
  if (str.includes('breeze') || str.includes('authors-breeze') || str.includes('authorsbreeze')) return 'authors-breeze';
  if (str.includes('pro-book') || str.includes('probook') || str.includes('publishing')) return 'pro-book-publishing';
  if (str.includes('writers') || str.includes('amz-writers') || str.includes('amzwriters')) return 'amz-writers-hub';
  if (str.includes('patch') || str.includes('promos') || str.includes('patchandpromos')) return 'patch-and-promos';
  return str;
}

function isSubscriberAllowedForProperty(sub: StoredPushSubscription, propertySlug?: string): boolean {
  if (!propertySlug) return true;
  const email = (sub.email || '').toLowerCase().trim();
  const isAdmin = sub.role === 'admin' || ADMIN_EMAILS.has(email);
  if (isAdmin) return true;

  // If subscriber has no email recorded yet, only allow if they explicitly registered as admin
  if (!email) return false;

  const assigned = Array.isArray(sub.assigned_websites) ? sub.assigned_websites : [];
  if (assigned.length === 0) return false;

  const target = normalizeWebsiteSlug(propertySlug);
  return assigned.map(normalizeWebsiteSlug).includes(target);
}

async function loadSubscriptionsFromStorage(force = false): Promise<Map<string, StoredPushSubscription>> {
  const now = Date.now();
  if (!force && g.__tealsPushLoadedAt && now - g.__tealsPushLoadedAt < 25000 && g.__tealsPushSubs && g.__tealsPushSubs.size > 0) {
    return g.__tealsPushSubs;
  }
  try {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(SUBS_FILE);
    if (!error && data) {
      const text = await data.text();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        const map = new Map<string, StoredPushSubscription>();
        for (const item of parsed) {
          if (item && item.endpoint && item.keys?.p256dh && item.keys?.auth) {
            map.set(item.endpoint, item);
          }
        }
        // Merge any newer in-memory entries
        if (g.__tealsPushSubs) {
          for (const [k, v] of g.__tealsPushSubs.entries()) {
            map.set(k, v);
          }
        }
        g.__tealsPushSubs = map;
        g.__tealsPushLoadedAt = now;
      }
    }
  } catch {}
  return g.__tealsPushSubs!;
}

async function persistSubscriptionsToStorage(): Promise<void> {
  try {
    const arr = Array.from((g.__tealsPushSubs || new Map()).values());
    const blob = new Blob([JSON.stringify(arr)], { type: 'application/json' });
    await supabaseAdmin.storage.from(BUCKET).upload(SUBS_FILE, blob, {
      upsert: true,
      contentType: 'application/json',
    });
  } catch (err) {
    console.error('Failed to persist push subscriptions:', err);
  }
}

export async function savePushSubscription(sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  email?: string;
  role?: string;
  assigned_websites?: string[];
}): Promise<void> {
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return;
  await loadSubscriptionsFromStorage();

  const existing = g.__tealsPushSubs!.get(sub.endpoint);
  const record: StoredPushSubscription = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
    email: sub.email ? String(sub.email).toLowerCase().trim() : existing?.email,
    role: sub.role || existing?.role || 'agent',
    assigned_websites: Array.isArray(sub.assigned_websites)
      ? sub.assigned_websites
      : existing?.assigned_websites || [],
    updatedAt: new Date().toISOString(),
  };

  g.__tealsPushSubs!.set(sub.endpoint, record);
  await persistSubscriptionsToStorage();
}

export async function updateSubscriberPermissionsByEmail(
  email: string,
  assigned_websites: string[],
  role?: string
): Promise<void> {
  const cleanEmail = (email || '').toLowerCase().trim();
  if (!cleanEmail) return;
  await loadSubscriptionsFromStorage(true);
  let changed = false;
  for (const [endpoint, sub] of g.__tealsPushSubs!.entries()) {
    if ((sub.email || '').toLowerCase().trim() === cleanEmail) {
      sub.assigned_websites = Array.isArray(assigned_websites) ? assigned_websites : [];
      if (role) sub.role = role;
      sub.updatedAt = new Date().toISOString();
      g.__tealsPushSubs!.set(endpoint, sub);
      changed = true;
    }
  }
  if (changed) {
    await persistSubscriptionsToStorage();
  }
}

export async function dispatchWebPushForRealtimeEvent(event: string, rawPayload: any): Promise<void> {
  try {
    if (event === 'agent_permissions_updated') {
      const p = rawPayload?.payload || rawPayload || {};
      if (p.email && Array.isArray(p.assigned_websites)) {
        await updateSubscriberPermissionsByEmail(p.email, p.assigned_websites, p.role);
      }
      return;
    }

    if (event !== 'visitor_arrival' && event !== 'chat_message') {
      return;
    }

    const payload = rawPayload?.payload || rawPayload || {};
    let title = 'Teals CRM Alert';
    let body = 'You have a new update in Teals CRM.';
    let tag = `teals_push_${Date.now()}`;
    let url = 'https://salesflow-ai-main.vercel.app/livechat';
    let propertySlug = '';
    let pushType: 'visitor' | 'message' | 'handoff' = 'visitor';

    const now = Date.now();
    const dedupMap = g.__tealsPushDedup!;

    if (event === 'visitor_arrival') {
      const session = payload.session || payload || {};
      propertySlug =
        payload.propertySlug ||
        payload.property_slug ||
        session.propertySlug ||
        session.property_slug ||
        'website';
      const token =
        session.visitor_token ||
        session.visitorToken ||
        payload.visitor_token ||
        session.id ||
        session.ip_address ||
        '';
      const dedupKey = `arr_${propertySlug}_${token}`;
      const lastSent = dedupMap.get(dedupKey) || 0;
      if (token && now - lastSent < 15000) {
        return; // Prevent duplicate visitor arrival push within 15s
      }
      if (token) dedupMap.set(dedupKey, now);

      const propName = String(propertySlug).replace(/-/g, ' ').toUpperCase();
      const loc = [session.city || payload.city, session.country || payload.country]
        .filter(Boolean)
        .join(', ');
      const flag = session.flag || payload.flag || '';

      title = `🟢 Live Visitor: ${propName}`;
      body = loc
        ? `${flag ? flag + ' ' : ''}Visitor active from ${loc}.`
        : `A new visitor is actively browsing ${propName}.`;
      tag = `visitor_${propertySlug}_${token || now}`;
      url = 'https://salesflow-ai-main.vercel.app/livechat?view=monitoring';
      pushType = 'visitor';
    } else if (event === 'chat_message') {
      const msg = payload.message;
      const isHandoff = Boolean(payload.isHandoffRequested);
      propertySlug =
        payload.propertySlug ||
        payload.property_slug ||
        payload.conversation?.property_slug ||
        msg?.property_slug ||
        '';

      if (isHandoff) {
        const cId = payload.conversationId || payload.conversation?.id || 'handoff';
        const dedupKey = `handoff_${cId}`;
        const lastSent = dedupMap.get(dedupKey) || 0;
        if (now - lastSent < 12000) return;
        dedupMap.set(dedupKey, now);

        const propName = propertySlug ? String(propertySlug).replace(/-/g, ' ').toUpperCase() : 'LIVECHAT';
        title = `🚨 Live Agent Requested (${propName})`;
        body = 'A customer is waiting to speak with a human support agent!';
        tag = `handoff_${cId}_${now}`;
        url = 'https://salesflow-ai-main.vercel.app/livechat?view=chats';
        pushType = 'handoff';
      } else if (msg && msg.sender_type === 'visitor') {
        const msgId = msg.id || `${msg.conversation_id}_${msg.content}`;
        const dedupKey = `msg_${msgId}`;
        if (dedupMap.has(dedupKey)) return;
        dedupMap.set(dedupKey, now);

        const sender = msg.sender_name || 'Visitor';
        const rawContent = String(msg.content || '').trim();
        const snippet =
          rawContent.length > 80
            ? rawContent.substring(0, 80) + '...'
            : rawContent || 'Sent a new message.';

        title = `💬 ${sender}`;
        body = snippet;
        tag = `msg_${msgId}`;
        url = 'https://salesflow-ai-main.vercel.app/livechat?view=chats';
        pushType = 'message';
      } else {
        return;
      }
    }

    const subsMap = await loadSubscriptionsFromStorage();
    if (!subsMap || subsMap.size === 0) return;

    const notificationPayload = JSON.stringify({
      title,
      body,
      tag,
      url,
      type: pushType,
      propertySlug,
      timestamp: now,
    });

    const staleEndpoints: string[] = [];

    await Promise.allSettled(
      Array.from(subsMap.values()).map(async (sub) => {
        if (!isSubscriberAllowedForProperty(sub, propertySlug)) {
          return;
        }
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys,
            },
            notificationPayload,
            {
              TTL: 120,
              urgency: 'high',
            }
          );
        } catch (err: any) {
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            staleEndpoints.push(sub.endpoint);
          }
        }
      })
    );

    if (staleEndpoints.length > 0) {
      staleEndpoints.forEach((ep) => g.__tealsPushSubs?.delete(ep));
      await persistSubscriptionsToStorage();
    }
  } catch (err) {
    console.error('dispatchWebPushForRealtimeEvent error:', err);
  }
}
