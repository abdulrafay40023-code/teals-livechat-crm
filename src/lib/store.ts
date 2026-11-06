import { supabaseAdmin } from '@/lib/supabase';
import { WEBSITES, WebsiteConfig, buildCustomWebsiteConfig, getWebsiteConfig, REMOVED_WEBSITE_SLUGS } from '@/lib/websites-config';

const BUCKET = 'teals-live-store';

export interface StoreVisitorSession {
  id: string;
  visitor_token: string;
  property_slug: string;
  ip_address: string;
  country: string;
  country_code: string;
  city: string;
  flag: string;
  referrer: string;
  current_page: string;
  page_title?: string;
  browser: string;
  os: string;
  device: string;
  is_online: boolean;
  visit_count?: number;
  last_active_at: string;
  created_at: string;
}

export interface StoreMessage {
  id: string;
  conversation_id: string;
  sender_type: 'visitor' | 'agent' | 'ai' | 'system';
  sender_name: string;
  sender_pseudo_name?: string;
  sender_role_title?: string;
  sender_real_name?: string;
  content: string;
  is_whisper?: boolean;
  seq?: number;
  status?: 'sent' | 'delivered' | 'read';
  created_at: string;
  is_form?: boolean;
  form_type?: 'booking';
  form_data?: any;
}

export interface StoreConversation {
  id: string;
  property_slug: string;
  visitor_id: string;
  visitor_name: string;
  visitor_email?: string;
  visitor_phone?: string;
  visitor_ip?: string;
  visitor?: StoreVisitorSession;
  assigned_agent_id?: string;
  assigned_agent_name?: string;
  assigned_agent_email?: string;
  assigned_agent_pseudo_name?: string;
  assigned_agent_role_title?: string;
  assigned_at?: string;
  transferred_from_name?: string;
  transferred_from_role?: string;
  transferred_to_name?: string;
  transfer_note?: string;
  is_transferred?: boolean;
  mode: 'ai' | 'human';
  status: 'active' | 'pending_agent' | 'closed';
  typing_preview?: string;
  last_visitor_message_at?: string;
  last_agent_reply_at?: string;
  last_read_by_agent_at?: string;
  last_read_by_visitor_at?: string;
  created_at: string;
  updated_at: string;
  chat_number?: number;
  messages: StoreMessage[];
}

export interface StoreAgent {
  id: string;
  email: string;
  full_name: string;
  pseudo_name?: string;
  role_title?: string;
  phone?: string;
  role: 'admin' | 'agent';
  assigned_websites?: string[];
  status: 'pending' | 'approved' | 'rejected';
  is_online: boolean;
  last_seen_at: string;
  created_at: string;
}

export const ADMIN_EMAILS: string[] = [
  'garryamelia6265@gmail.com',
  'tzafar04@gmail.com',
  'annusraees@gmail.com',
  'jennifer.cisternino2027@gmail.com'
];

export const STAFF_EMAILS: string[] = [
  'garryamelia6265@gmail.com',
  'tzafar04@gmail.com',
  'annusraees@gmail.com',
  'jennifer.cisternino2027@gmail.com'
];

export const STAFF_NAMES: string[] = [
  'garry amelia',
  't zafar',
  'annus raees'
];

export function isUserAdmin(email?: string | null, role?: string | null): boolean {
  if (role === 'admin') return true;
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

export function isStaffOrAdmin(email?: string | null, name?: string | null): boolean {
  const cleanEmail = (email || '').toLowerCase().trim();
  const cleanName = (name || '').toLowerCase().trim();

  if (cleanEmail) {
    if (STAFF_EMAILS.includes(cleanEmail) || ADMIN_EMAILS.includes(cleanEmail)) return true;
    if (typeof granularStore !== 'undefined' && granularStore.agents.has(cleanEmail)) return true;
  }
  if (cleanName) {
    if (STAFF_NAMES.includes(cleanName)) return true;
    if (typeof granularStore !== 'undefined') {
      const allAgents = Array.from(granularStore.agents.values());
      for (const a of allAgents) {
        if (a.full_name && a.full_name.toLowerCase().trim() === cleanName) return true;
      }
    }
  }
  return false;
}

export async function isStaffOrAdminAsync(email?: string | null, name?: string | null): Promise<boolean> {
  const cleanEmail = (email || '').toLowerCase().trim();
  const cleanName = (name || '').toLowerCase().trim();

  if (cleanEmail) {
    if (STAFF_EMAILS.includes(cleanEmail) || ADMIN_EMAILS.includes(cleanEmail)) return true;
  }
  if (cleanName) {
    if (STAFF_NAMES.includes(cleanName)) return true;
  }

  if (typeof granularStore !== 'undefined') {
    const allAgents = await granularStore.getAllAgents();
    for (const a of allAgents) {
      if (cleanEmail && a.email && a.email.toLowerCase().trim() === cleanEmail) return true;
      if (cleanName && a.full_name && a.full_name.toLowerCase().trim() === cleanName) return true;
    }
  }
  return false;
}

function sanitizeKey(k: string): string {
  return (k || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function parseStorageData(data: unknown): Promise<string> {
  if (!data) return '';
  const anyData = data as { text?: () => Promise<string>; arrayBuffer?: () => Promise<ArrayBuffer> };
  if (typeof anyData.text === 'function') {
    try {
      const res = await anyData.text();
      if (res && res !== '[object Blob]') return res;
    } catch {}
  }
  if (typeof anyData.arrayBuffer === 'function') {
    try {
      const buf = Buffer.from(await anyData.arrayBuffer());
      return buf.toString('utf-8');
    } catch {}
  }
  return String(data);
}

// Strictly resets at 12:00 AM Pakistan Standard Time (PKT = Asia/Karachi)
function getTodayKey(): string {
  const now = new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now); // Returns 'YYYY-MM-DD' strictly in PKT
}

export const sortMessagesChronologically = <T extends { id?: string; created_at?: string; seq?: number; sender_type?: string; content?: string }>(messages: T[]): T[] => {
  const map = new Map<string, T>();
  messages.forEach(m => {
    if (!m || !m.id) return;
    map.set(m.id, m);
  });

  const list = Array.from(map.values());

  const sorted = list.sort((a, b) => {
    // 1. Initial AI Greeting always comes first
    const isAiGreetA = a.id === 'init-greet' || (a.sender_type === 'ai' && a.seq === 1 && a.created_at === '1970-01-01T00:00:00.000Z');
    const isAiGreetB = b.id === 'init-greet' || (b.sender_type === 'ai' && b.seq === 1 && b.created_at === '1970-01-01T00:00:00.000Z');
    if (isAiGreetA && !isAiGreetB) return -1;
    if (!isAiGreetA && isAiGreetB) return 1;

    // 2. Strict chronological order by real physical creation timestamp
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    if (timeA !== timeB) {
      return timeA - timeB;
    }

    // 3. Tie-breakers if identical millisecond timestamp:
    // A visitor trigger message comes before a system handoff/claim response
    if (a.sender_type === 'visitor' && b.sender_type === 'system') return -1;
    if (a.sender_type === 'system' && b.sender_type === 'visitor') return 1;

    const seqA = typeof a.seq === 'number' ? a.seq : null;
    const seqB = typeof b.seq === 'number' ? b.seq : null;
    if (seqA !== null && seqB !== null && seqA !== seqB) {
      return seqA - seqB;
    }

    return (a.id || '').localeCompare(b.id || '');
  });

  return sorted.map((m, idx) => ({
    ...m,
    seq: idx + 1
  }));
};

class GranularStore {
  readonly sessionCache = new Map<string, StoreVisitorSession>();
  readonly convCache = new Map<string, StoreConversation>();
  readonly agents = new Map<string, StoreAgent>();
  readonly customWebsites = new Map<string, WebsiteConfig>();
  readonly removedWebsites = new Set<string>();
  allTimeIps = new Set<string>();
  readonly todayIps = new Map<string, Set<string>>();
  private totalViews = 0;
  private storageLoaded = false;
  private sessionFileTimestamps = new Map<string, string>();
  private lastResetAt = 0;
  private deletedConvIds = new Set<string>();

  getLastResetAt(): number {
    return this.lastResetAt;
  }

  getDeletedConvIds(): Set<string> {
    return this.deletedConvIds;
  }

  isConversationDeleted(id: string): boolean {
    if (!id) return false;
    const cleanId = sanitizeKey(id);
    return this.deletedConvIds.has(id) || this.deletedConvIds.has(cleanId);
  }

  async getLastResetAtAsync(): Promise<number> {
    await this.ensureStorageLoaded();
    return this.lastResetAt;
  }

  setLastResetAt(ts: number): void {
    this.lastResetAt = ts;
  }

  getCustomWebsites(): WebsiteConfig[] {
    return Array.from(this.customWebsites.values());
  }

  getRemovedWebsites(): string[] {
    return Array.from(this.removedWebsites.values());
  }

  async saveCustomWebsite(input: {
    name: string;
    domain: string;
    slug?: string;
    category?: 'ecommerce' | 'publishing' | 'crm';
  }): Promise<WebsiteConfig> {
    await this.ensureStorageLoaded();
    const cfg = buildCustomWebsiteConfig(input);
    this.removedWebsites.delete(cfg.slug);
    REMOVED_WEBSITE_SLUGS.delete(cfg.slug);
    this.customWebsites.set(cfg.slug, cfg);
    WEBSITES[cfg.slug] = cfg;

    const payload = JSON.stringify(Array.from(this.customWebsites.values()));
    const removedPayload = JSON.stringify(Array.from(this.removedWebsites.values()));
    try {
      await Promise.allSettled([
        supabaseAdmin.storage.from('teals-live-store').upload('meta/custom_websites.json', payload, { upsert: true, contentType: 'application/json', cacheControl: '0' }),
        supabaseAdmin.storage.from('teals-livechat').upload('meta/custom_websites.json', payload, { upsert: true, contentType: 'application/json', cacheControl: '0' }),
        supabaseAdmin.storage.from('teals-live-store').upload('meta/removed_websites.json', removedPayload, { upsert: true, contentType: 'application/json', cacheControl: '0' }),
        supabaseAdmin.storage.from('teals-livechat').upload('meta/removed_websites.json', removedPayload, { upsert: true, contentType: 'application/json', cacheControl: '0' }),
      ]);
    } catch (e) {
      console.error('Error saving custom websites to storage:', e);
    }

    return cfg;
  }

  async removeWebsite(slug: string): Promise<void> {
    await this.ensureStorageLoaded();
    const cleanSlug = (slug || '').trim().toLowerCase();
    if (!cleanSlug) return;

    this.removedWebsites.add(cleanSlug);
    REMOVED_WEBSITE_SLUGS.add(cleanSlug);
    this.customWebsites.delete(cleanSlug);
    delete WEBSITES[cleanSlug];

    const payload = JSON.stringify(Array.from(this.customWebsites.values()));
    const removedPayload = JSON.stringify(Array.from(this.removedWebsites.values()));
    try {
      await Promise.allSettled([
        supabaseAdmin.storage.from('teals-live-store').upload('meta/custom_websites.json', payload, { upsert: true, contentType: 'application/json', cacheControl: '0' }),
        supabaseAdmin.storage.from('teals-livechat').upload('meta/custom_websites.json', payload, { upsert: true, contentType: 'application/json', cacheControl: '0' }),
        supabaseAdmin.storage.from('teals-live-store').upload('meta/removed_websites.json', removedPayload, { upsert: true, contentType: 'application/json', cacheControl: '0' }),
        supabaseAdmin.storage.from('teals-livechat').upload('meta/removed_websites.json', removedPayload, { upsert: true, contentType: 'application/json', cacheControl: '0' }),
      ]);
    } catch (e) {
      console.error('Error removing website from storage:', e);
    }
  }

  constructor() {
    const adminGarry: StoreAgent = {
      id: 'agent_garry_admin',
      email: 'garryamelia6265@gmail.com',
      full_name: 'Garry Amelia',
      phone: '+1 (555) 019-2834',
      role: 'admin',
      status: 'approved',
      is_online: true,
      last_seen_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    const adminTzafar: StoreAgent = {
      id: 'agent_tzafar_admin',
      email: 'tzafar04@gmail.com',
      full_name: 'T Zafar',
      phone: '+1 (555) 019-2835',
      role: 'admin',
      status: 'approved',
      is_online: true,
      last_seen_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    const adminAnnus: StoreAgent = {
      id: 'agent_annus_admin',
      email: 'annusraees@gmail.com',
      full_name: 'Annus Raees',
      phone: '+1 (555) 019-2836',
      role: 'admin',
      status: 'approved',
      is_online: true,
      last_seen_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    this.agents.set(adminGarry.email.toLowerCase(), adminGarry);
    this.agents.set(adminTzafar.email.toLowerCase(), adminTzafar);
    this.agents.set(adminAnnus.email.toLowerCase(), adminAnnus);
  }

  async getSession(sessionId: string): Promise<StoreVisitorSession | null> {
    const cached = this.sessionCache.get(sessionId);
    if (cached) return cached;
    try {
      const key = `sessions/${sanitizeKey(sessionId)}.json`;
      const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(key);
      if (!error && data) {
        const text = await parseStorageData(data);
        if (text) {
          const session: StoreVisitorSession = JSON.parse(text);
          this.sessionCache.set(sessionId, session);
          return session;
        }
      }
    } catch {}
    return null;
  }

  async saveSession(session: StoreVisitorSession): Promise<StoreVisitorSession> {
    if (session.property_slug === 'teals-crm' || session.property_slug === 'salesflow-ai-main' || !session.property_slug) {
      return session;
    }

    const existing = this.sessionCache.get(session.id);
    // Only preserve created_at if the existing session is ALREADY online in the same active visit
    if (existing && existing.is_online && existing.created_at) {
      const existingTime = new Date(existing.created_at).getTime();
      const newTime = new Date(session.created_at).getTime();
      if (!isNaN(existingTime) && (!isNaN(newTime) ? existingTime < newTime : true)) {
        session.created_at = existing.created_at;
      }
    }

    this.sessionCache.set(session.id, session);
    
    const key = `sessions/${sanitizeKey(session.id)}.json`;
    supabaseAdmin.storage.from(BUCKET).upload(key, JSON.stringify(session), {
      upsert: true,
      contentType: 'application/json'
    }).catch(e => console.error('Cloud save session error:', e));

    return session;
  }

  async markSessionOffline(sessionId: string): Promise<StoreVisitorSession | null> {
    const cleanId = sanitizeKey(sessionId);
    let session = this.sessionCache.get(sessionId) || this.sessionCache.get(cleanId);
    if (!session) {
      session = await this.getSession(sessionId);
    }
    if (session) {
      session.is_online = false;
      session.last_active_at = new Date().toISOString();
      this.sessionCache.set(session.id, session);
      const key = `sessions/${sanitizeKey(session.id)}.json`;
      supabaseAdmin.storage.from(BUCKET).upload(key, JSON.stringify(session), {
        upsert: true,
        contentType: 'application/json'
      }).catch(() => {});
      return session;
    }
    return null;
  }

  async removeSession(sessionId: string): Promise<void> {
    this.sessionCache.delete(sessionId);
    const key = `sessions/${sanitizeKey(sessionId)}.json`;
    try {
      await supabaseAdmin.storage.from(BUCKET).remove([key]);
    } catch {}
  }

  async getConversation(convId: string): Promise<StoreConversation | null> {
    if (!convId) return null;
    await this.ensureStorageLoaded();
    if (this.deletedConvIds.has(convId) || this.deletedConvIds.has(sanitizeKey(convId))) {
      return null;
    }
    let conv = this.convCache.get(convId) || null;

    try {
      const key = `conversations/${sanitizeKey(convId)}.json`;
      const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(key);
      if (!error && data) {
        const text = await parseStorageData(data);
        if (text) {
          const cloudConv: StoreConversation = JSON.parse(text);
          const isHuman = conv?.mode === 'human' || cloudConv.mode === 'human' || !!conv?.assigned_agent_id || !!cloudConv.assigned_agent_id || !!conv?.assigned_agent_name || !!cloudConv.assigned_agent_name;
          const assignedId = conv?.assigned_agent_id || cloudConv.assigned_agent_id;
          const assignedName = conv?.assigned_agent_name || cloudConv.assigned_agent_name;
          const assignedEmail = conv?.assigned_agent_email || cloudConv.assigned_agent_email;
          const status = isHuman && assignedId ? 'active' : (conv?.status === 'pending_agent' || cloudConv.status === 'pending_agent' ? 'pending_agent' : (conv?.status || cloudConv.status || 'active'));

          const session = conv?.visitor || cloudConv.visitor || 
                          this.sessionCache.get(conv?.visitor_id || cloudConv.visitor_id || '') || 
                          this.sessionCache.get(convId) || 
                          Array.from(this.sessionCache.values()).find(s => 
                            s.visitor_token === (conv?.visitor_id || cloudConv.visitor_id) || 
                            s.id === (conv?.visitor_id || cloudConv.visitor_id) || 
                            s.visitor_token === convId ||
                            s.id === convId ||
                            ((conv?.visitor_ip || cloudConv.visitor_ip) && s.ip_address === (conv?.visitor_ip || cloudConv.visitor_ip))
                          );

          const merged: StoreConversation = {
            ...cloudConv,
            ...(conv || {}),
            visitor: session || conv?.visitor || cloudConv.visitor,
            visitor_ip: conv?.visitor_ip || cloudConv.visitor_ip || session?.ip_address,
            mode: isHuman ? 'human' : 'ai',
            status,
            assigned_agent_id: assignedId,
            assigned_agent_name: assignedName,
            assigned_agent_email: assignedEmail,
          };
          if (conv) {
            const msgMap = new Map<string, StoreMessage>();
            (cloudConv.messages || []).forEach(m => msgMap.set(m.id, m));
            (conv.messages || []).forEach(m => msgMap.set(m.id, m));
            merged.messages = sortMessagesChronologically(Array.from(msgMap.values()));
          } else {
            merged.messages = sortMessagesChronologically(cloudConv.messages || []);
          }
          this.convCache.set(convId, merged);
          return merged;
        }
      }
    } catch {}

    return conv;
  }

  async getConversationsByVisitor(visitorToken: string, email?: string): Promise<StoreConversation[]> {
    await this.ensureStorageLoaded();
    const cleanEmail = (email || '').trim().toLowerCase();
    const allConvs = Array.from(this.convCache.values());

    const associatedTokens = new Set<string>();
    if (visitorToken) {
      associatedTokens.add(visitorToken);
      const session = this.sessionCache.get(visitorToken);
      if (session) {
        if (session.visitor_token) associatedTokens.add(session.visitor_token);
        if (session.id) associatedTokens.add(session.id);
      }
      for (const s of Array.from(this.sessionCache.values())) {
        if (s.visitor_token === visitorToken || s.id === visitorToken) {
          if (s.visitor_token) associatedTokens.add(s.visitor_token);
          if (s.id) associatedTokens.add(s.id);
        }
      }
    }

    const matchingConvs = allConvs.filter(c => {
      if (this.deletedConvIds.has(c.id) || this.deletedConvIds.has(sanitizeKey(c.id))) return false;
      const isAssociated = (associatedTokens.size > 0 && (associatedTokens.has(c.id) || associatedTokens.has(c.visitor_id || ''))) ||
                           Boolean(cleanEmail && c.visitor_email && c.visitor_email.toLowerCase() === cleanEmail);
      if (!isAssociated) return false;

      // Filter out empty chats with NO real visitor or agent messages
      const realMsgs = (c.messages || []).filter(m => m && m.id !== 'init-greet' && m.seq !== 1 && (m.sender_type === 'visitor' || m.sender_type === 'agent'));
      return realMsgs.length > 0;
    });

    // Chronological order: earliest created first
    matchingConvs.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

    // Deterministic chat_number: if already has explicit chat_number === 2, preserve it; otherwise first is 1, second is 2
    if (matchingConvs.length === 1) {
      matchingConvs[0].chat_number = (matchingConvs[0].chat_number === 2) ? 2 : 1;
    } else if (matchingConvs.length >= 2) {
      const hasChat2 = matchingConvs.some(c => c.chat_number === 2);
      if (hasChat2) {
        matchingConvs.forEach(c => {
          c.chat_number = (c.chat_number === 2) ? 2 : 1;
        });
      } else {
        matchingConvs[0].chat_number = 1;
        matchingConvs[1].chat_number = 2;
      }
    }

    // Return with Chat #1 first, Chat #2 (if any) second
    const orderedConvs = [...matchingConvs].sort((a, b) => (a.chat_number || 1) - (b.chat_number || 1));

    return orderedConvs.map(c => {
      const session = c.visitor || 
                      this.sessionCache.get(c.visitor_id || '') || 
                      this.sessionCache.get(c.id) || 
                      Array.from(this.sessionCache.values()).find(s => 
                        s.visitor_token === c.visitor_id || 
                        s.id === c.visitor_id || 
                        s.visitor_token === c.id ||
                        (c.visitor_ip && s.ip_address === c.visitor_ip)
                      );
      return {
        ...c,
        visitor: session || c.visitor,
        visitor_ip: c.visitor_ip || session?.ip_address
      };
    });
  }

  async saveConversation(conv: StoreConversation): Promise<StoreConversation> {
    const existing = this.convCache.get(conv.id);
    const msgMap = new Map<string, StoreMessage>();

    // Cloud safety: merge existing messages from storage to guarantee NO message is ever lost in serverless race conditions!
    try {
      const key = `conversations/${sanitizeKey(conv.id)}.json`;
      const { data } = await supabaseAdmin.storage.from(BUCKET).download(key);
      if (data) {
        const text = await parseStorageData(data);
        if (text) {
          const cloudConv: StoreConversation = JSON.parse(text);
          if (cloudConv?.messages && Array.isArray(cloudConv.messages)) {
            cloudConv.messages.forEach(m => {
              if (m && m.id) msgMap.set(m.id, m);
            });
          }
        }
      }
    } catch {}

    if (existing?.messages) {
      existing.messages.forEach(m => {
        if (m && m.id) msgMap.set(m.id, m);
      });
    }
    (conv.messages || []).forEach(m => {
      if (m && m.id) msgMap.set(m.id, m);
    });

    const mergedMessages = sortMessagesChronologically(Array.from(msgMap.values()));
    const isClaimed = !!(conv.assigned_agent_id || existing?.assigned_agent_id || conv.assigned_agent_name || existing?.assigned_agent_name);

    const session = conv.visitor || 
                    existing?.visitor || 
                    this.sessionCache.get(conv.visitor_id || '') || 
                    this.sessionCache.get(conv.id) || 
                    Array.from(this.sessionCache.values()).find(s => 
                      s.visitor_token === conv.visitor_id || 
                      s.id === conv.visitor_id || 
                      s.visitor_token === conv.id ||
                      ((conv.visitor_ip || existing?.visitor_ip) && s.ip_address === (conv.visitor_ip || existing?.visitor_ip))
                    );

    const mergedConv: StoreConversation = {
      ...(existing || {}),
      ...conv,
      visitor: session || conv.visitor || existing?.visitor,
      visitor_ip: conv.visitor_ip || existing?.visitor_ip || session?.ip_address,
      mode: isClaimed || conv.mode === 'human' || existing?.mode === 'human' ? 'human' : 'ai',
      status: isClaimed ? 'active' : (conv.status === 'pending_agent' || existing?.status === 'pending_agent' ? 'pending_agent' : 'active'),
      assigned_agent_id: conv.assigned_agent_id || existing?.assigned_agent_id,
      assigned_agent_name: conv.assigned_agent_name || existing?.assigned_agent_name,
      assigned_agent_email: conv.assigned_agent_email || existing?.assigned_agent_email,
      messages: mergedMessages,
      updated_at: new Date().toISOString()
    };

    // 0ms instant in-memory update
    this.convCache.set(conv.id, mergedConv);

    // Persist to Supabase Storage (both buckets for redundancy)
    const key = `conversations/${sanitizeKey(conv.id)}.json`;
    const payload = JSON.stringify(mergedConv);
    try {
      await Promise.allSettled([
        supabaseAdmin.storage.from('teals-live-store').upload(key, payload, { upsert: true, contentType: 'application/json' }),
        supabaseAdmin.storage.from('teals-livechat').upload(key, payload, { upsert: true, contentType: 'application/json' })
      ]);
    } catch (e) {
      console.error('Cloud save conversation error:', e);
    }

    return mergedConv;
  }

  private async ensureStorageLoaded(): Promise<void> {
    try {
      try {
        const { data: removedFile } = await supabaseAdmin.storage.from(BUCKET).download('meta/removed_websites.json');
        if (removedFile) {
          const removedText = await parseStorageData(removedFile);
          if (removedText) {
            const parsedRemoved = JSON.parse(removedText);
            if (Array.isArray(parsedRemoved)) {
              parsedRemoved.forEach((slug: string) => {
                if (slug) {
                  const cleanSlug = String(slug).trim().toLowerCase();
                  this.removedWebsites.add(cleanSlug);
                  REMOVED_WEBSITE_SLUGS.add(cleanSlug);
                  this.customWebsites.delete(cleanSlug);
                  delete WEBSITES[cleanSlug];
                }
              });
            }
          }
        }
      } catch {}

      try {
        const { data: customSitesFile } = await supabaseAdmin.storage.from(BUCKET).download('meta/custom_websites.json');
        if (customSitesFile) {
          const customText = await parseStorageData(customSitesFile);
          if (customText) {
            const parsedSites = JSON.parse(customText);
            if (Array.isArray(parsedSites)) {
              parsedSites.forEach((site: any) => {
                if (site && site.slug && site.name && !this.removedWebsites.has(String(site.slug).toLowerCase())) {
                  const cfg: WebsiteConfig = site.systemPrompt
                    ? (site as WebsiteConfig)
                    : buildCustomWebsiteConfig({
                        name: site.name,
                        domain: site.domain || site.url || site.slug,
                        slug: site.slug,
                        category: site.category
                      });
                  this.customWebsites.set(cfg.slug, cfg);
                  if (!WEBSITES[cfg.slug]) {
                    WEBSITES[cfg.slug] = cfg;
                  }
                }
              });
            }
          }
        }
      } catch {}

      try {
        const { data: resetFile } = await supabaseAdmin.storage.from(BUCKET).download('meta/system_reset.json');
        if (resetFile) {
          const resetText = await parseStorageData(resetFile);
          if (resetText) {
            const parsed = JSON.parse(resetText);
            if (parsed && typeof parsed.resetAt === 'number') {
              this.lastResetAt = parsed.resetAt;
            }
          }
        }
      } catch {}

      try {
        const { data: delFile } = await supabaseAdmin.storage.from(BUCKET).download('meta/deleted_conversations.json');
        if (delFile) {
          const delText = await parseStorageData(delFile);
          if (delText) {
            const parsedDel = JSON.parse(delText);
            if (Array.isArray(parsedDel)) {
              this.deletedConvIds.clear();
              parsedDel.forEach((id: string) => {
                if (id) {
                  this.deletedConvIds.add(id);
                  this.deletedConvIds.add(sanitizeKey(id));
                }
              });
            }
          }
        }
      } catch {}

      // Clear any cached conversations created before lastResetAt or marked as deleted
      if (this.lastResetAt > 0) {
        for (const [id, c] of Array.from(this.convCache.entries())) {
          const t = new Date(c.updated_at || c.created_at || 0).getTime();
          if (t < this.lastResetAt) {
            this.convCache.delete(id);
          }
        }
      }

      if (this.deletedConvIds.size > 0) {
        for (const [id] of Array.from(this.convCache.entries())) {
          if (this.deletedConvIds.has(id) || this.deletedConvIds.has(sanitizeKey(id))) {
            this.convCache.delete(id);
          }
        }
      }

      // 1. Sync conversations from bucket
      const { data: cFiles } = await supabaseAdmin.storage.from(BUCKET).list('conversations', { limit: 1000 });
      if (Array.isArray(cFiles)) {
        const currentConvNames = new Set(cFiles.map(f => f.name.replace('.json', '')));
        for (const id of Array.from(this.convCache.keys())) {
          if (!currentConvNames.has(sanitizeKey(id)) && !currentConvNames.has(id)) {
            this.convCache.delete(id);
          }
        }
      }

      if (cFiles && cFiles.length > 0) {
        await Promise.all(cFiles.map(async (f) => {
          try {
            const id = f.name.replace('.json', '');
            if (this.deletedConvIds.has(id) || this.deletedConvIds.has(sanitizeKey(id))) {
              return;
            }
            const { data } = await supabaseAdmin.storage.from(BUCKET).download(`conversations/${f.name}`);
            if (data) {
              const text = await parseStorageData(data);
              if (text) {
                const c: StoreConversation = JSON.parse(text);
                const existing = this.convCache.get(c.id) || this.convCache.get(id);
                const session = c.visitor || existing?.visitor ||
                                this.sessionCache.get(c.visitor_id || '') || 
                                this.sessionCache.get(c.id) || 
                                Array.from(this.sessionCache.values()).find(s => 
                                  s.visitor_token === c.visitor_id || 
                                  s.id === c.visitor_id || 
                                  s.visitor_token === c.id ||
                                  ((c.visitor_ip || existing?.visitor_ip) && s.ip_address === (c.visitor_ip || existing?.visitor_ip))
                                );
                if (existing) {
                  const msgMap = new Map<string, StoreMessage>();
                  (existing.messages || []).forEach(m => msgMap.set(m.id, m));
                  (c.messages || []).forEach(m => msgMap.set(m.id, m));
                  c.messages = sortMessagesChronologically(Array.from(msgMap.values()));
                  c.assigned_agent_id = c.assigned_agent_id || existing.assigned_agent_id;
                  c.assigned_agent_name = c.assigned_agent_name || existing.assigned_agent_name;
                  c.assigned_agent_email = c.assigned_agent_email || existing.assigned_agent_email;
                  c.mode = (c.assigned_agent_id || existing.assigned_agent_id || c.mode === 'human' || existing.mode === 'human') ? 'human' : 'ai';
                  c.status = (c.assigned_agent_id || existing.assigned_agent_id) ? 'active' : (c.status === 'pending_agent' || existing.status === 'pending_agent' ? 'pending_agent' : c.status);
                  c.visitor = session || c.visitor || existing.visitor;
                  c.visitor_ip = c.visitor_ip || existing.visitor_ip || session?.ip_address;
                } else {
                  c.messages = sortMessagesChronologically(c.messages || []);
                  c.visitor = session || c.visitor;
                  c.visitor_ip = c.visitor_ip || session?.ip_address;
                }
                this.convCache.set(c.id, c);
              }
            }
          } catch {}
        }));
      }

      // 2. Sync sessions from bucket
      const { data: sFiles } = await supabaseAdmin.storage.from(BUCKET).list('sessions', { limit: 1000 });
      const currentSessNames = new Set((sFiles || []).map(f => f.name.replace('.json', '')));

      // Prune deleted sessions from cache
      for (const id of Array.from(this.sessionCache.keys())) {
        if (!currentSessNames.has(sanitizeKey(id))) {
          this.sessionCache.delete(id);
        }
      }

      if (sFiles && sFiles.length > 0) {
        await Promise.all(sFiles.map(async (f) => {
          try {
            const id = f.name.replace('.json', '');
            const lastLoaded = this.sessionFileTimestamps.get(id);
            const isStaleOrMissing = !this.sessionCache.has(id) || !lastLoaded || (f.updated_at && lastLoaded !== f.updated_at);
            if (isStaleOrMissing) {
              const { data } = await supabaseAdmin.storage.from(BUCKET).download(`sessions/${f.name}`);
              if (data) {
                const text = await parseStorageData(data);
                if (text) {
                  const s: StoreVisitorSession = JSON.parse(text);
                  if (s.property_slug === 'teals-crm' || s.property_slug === 'salesflow-ai-main' || !s.property_slug) {
                    supabaseAdmin.storage.from(BUCKET).remove([`sessions/${f.name}`]).catch(() => {});
                  } else {
                    this.sessionCache.set(s.id, s);
                    if (f.updated_at) {
                      this.sessionFileTimestamps.set(id, f.updated_at);
                    }
                  }
                }
              }
            }
          } catch {}
        }));
      }
    } catch (e) {
      console.error('Storage sync error:', e);
    }
  }

  async getAllActiveData(propertySlug = 'teals-crm'): Promise<{
    liveVisitors: StoreVisitorSession[];
    todayVisitorsCount: number;
    totalUniqueCount: number;
    conversations: StoreConversation[];
    pageViews: number;
    websiteStats: Record<string, {
      liveCount: number;
      todayCount: number;
      totalUniqueCount: number;
      chatCount: number;
    }>;
    customWebsites: WebsiteConfig[];
    removedWebsites: string[];
  }> {
    await this.ensureStorageLoaded();

    const now = Date.now();
    // Robust Session Activity Checker:
    // Pings are sent every 10 seconds. If no ping is received for 45 seconds, the visitor tab is closed and drops cleanly.
    const isSessionActive = (s: StoreVisitorSession): boolean => {
      if (!s.is_online) return false;
      const lastActive = new Date(s.last_active_at).getTime();
      if (isNaN(lastActive)) return false;

      // 45-second timeout prevents premature IP drop during tab switching
      return (now - lastActive) < 45 * 1000;
    };

    // Exclude any internal Teals CRM sessions or explicitly removed websites from visitor monitoring
    const allSessions = Array.from(this.sessionCache.values()).filter(s => {
      const p = (s.property_slug || '').toLowerCase().trim();
      const page = (s.current_page || '').toLowerCase();
      if (p === 'teals-crm' || p === 'salesflow-ai-main' || p === 'localhost') return false;
      if (this.removedWebsites.has(p)) return false;
      if (page.includes('salesflow-ai-main.vercel.app') || page.includes('teals-livechat-saas.vercel.app')) return false;
      return true;
    });
    const allConvs = Array.from(this.convCache.values()).filter(c => {
      const id = (c.id || '').toLowerCase();
      if (id.startsWith('test_verify_') || id.startsWith('test_live_backup_')) return false;
      const p = (c.property_slug || '').toLowerCase().trim();
      return !this.removedWebsites.has(p);
    });

    // Ensure any custom property_slug in sessions or conversations is registered in WEBSITES
    allSessions.forEach(s => {
      const slug = (s.property_slug || '').toLowerCase().trim();
      if (slug && slug !== 'teals-crm' && slug !== 'all' && slug !== 'localhost' && slug !== 'salesflow-ai-main' && !this.removedWebsites.has(slug) && !WEBSITES[slug]) {
        const cfg = getWebsiteConfig(slug, s.current_page || s.referrer);
        if (cfg && cfg.slug !== 'teals-crm') {
          this.customWebsites.set(cfg.slug, cfg);
        }
      }
    });
    allConvs.forEach(c => {
      const slug = (c.property_slug || '').toLowerCase().trim();
      if (slug && slug !== 'teals-crm' && slug !== 'all' && slug !== 'localhost' && slug !== 'salesflow-ai-main' && !this.removedWebsites.has(slug) && !WEBSITES[slug]) {
        const cfg = getWebsiteConfig(slug);
        if (cfg && cfg.slug !== 'teals-crm') {
          this.customWebsites.set(cfg.slug, cfg);
        }
      }
    });

    // Deduplicate by unique IP address (or token/id if IP is unknown)
    const getVisitorIdentityKey = (s: { ip_address?: string; visitor_token?: string; id?: string }): string => {
      const ip = (s.ip_address || '').trim().replace(/^::ffff:/, '');
      if (ip && ip !== '::1' && ip !== '127.0.0.1' && ip !== 'localhost' && ip !== 'unknown') {
        return `ip_${ip}`;
      }
      return s.visitor_token || s.id || 'unknown';
    };

    // Calculate total visit count per unique visitor IP
    const visitCountMap = new Map<string, number>();
    allSessions.forEach(s => {
      const key = getVisitorIdentityKey(s);
      visitCountMap.set(key, (visitCountMap.get(key) || 0) + 1);
    });

    const isGlobal = !propertySlug || propertySlug === 'all' || propertySlug === 'teals-crm';
    const filteredSessions = isGlobal ? allSessions : allSessions.filter(s => s.property_slug === propertySlug);
    const rawLiveSessions = filteredSessions.filter(isSessionActive);

    // Deduplicate by IP: multiple tabs or windows from the same IP appear as one live visitor row
    const liveVisitorsMap = new Map<string, StoreVisitorSession>();
    rawLiveSessions.forEach(s => {
      const key = getVisitorIdentityKey(s);
      const existing = liveVisitorsMap.get(key);
      const visits = visitCountMap.get(key) || 1;
      const enrichedSession: StoreVisitorSession = {
        ...s,
        visit_count: visits
      };
      if (!existing) {
        liveVisitorsMap.set(key, enrichedSession);
      } else {
        // Keep the session with latest activity, but preserve earliest created_at so duration doesn't jump
        const oldestCreatedAt = new Date(existing.created_at).getTime() < new Date(s.created_at).getTime()
          ? existing.created_at
          : s.created_at;
        const latestActiveSession = new Date(s.last_active_at).getTime() > new Date(existing.last_active_at).getTime()
          ? s
          : existing;
        liveVisitorsMap.set(key, {
          ...latestActiveSession,
          created_at: oldestCreatedAt,
          visit_count: Math.max(existing.visit_count || 1, visits)
        });
      }
    });
    const liveVisitors = Array.from(liveVisitorsMap.values());

    const today = getTodayKey();
    const currentTodaySet = new Set<string>();
    const currentAllTimeSet = new Set<string>();
    
    filteredSessions.forEach(s => {
      const ipKey = getVisitorIdentityKey(s);
      if (ipKey) {
        currentAllTimeSet.add(ipKey);
        try {
          const sDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Karachi',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).format(new Date(s.created_at || s.last_active_at));
          if (sDate === today) {
            currentTodaySet.add(ipKey);
          }
        } catch {
          currentTodaySet.add(ipKey);
        }
      }
    });

    this.todayIps.set(today, currentTodaySet);
    this.allTimeIps = currentAllTimeSet;

    const filteredConvs = (isGlobal ? allConvs : allConvs.filter(c => c.property_slug === propertySlug))
      .filter(c => {
        if (this.deletedConvIds.has(c.id) || this.deletedConvIds.has(sanitizeKey(c.id))) return false;
        return true;
      });
    const activeConversations = filteredConvs.filter(c => {
      return (c.messages && c.messages.length > 0) || !!c.visitor_name || c.mode === 'human' || c.status === 'pending_agent' || !!c.assigned_agent_id;
    }).map(c => {
      const session = this.sessionCache.get(c.id) || 
                      this.sessionCache.get(c.visitor_id || '') || 
                      Array.from(this.sessionCache.values()).find(s => 
                        s.visitor_token === c.visitor_id || 
                        s.id === c.visitor_id || 
                        s.visitor_token === c.id
                      );
      const isUnclaimedPending =
        !c.assigned_agent_id &&
        !c.assigned_agent_name &&
        (c.status === 'pending_agent' || c.mode === 'human');
      const lastUpdatedMs = new Date(c.updated_at || c.created_at || 0).getTime();
      const isStalePending = isUnclaimedPending && (now - lastUpdatedMs > 90 * 1000) && (!session || !isSessionActive(session));

      return {
        ...c,
        mode: isStalePending ? 'ai' : c.mode,
        status: isStalePending ? 'active' : c.status,
        visitor_ip: c.visitor_ip || session?.ip_address,
        visitor: session || undefined
      };
    });

    // Calculate per-website statistics for all configured websites
    const websiteStats: Record<string, {
      liveCount: number;
      todayCount: number;
      totalUniqueCount: number;
      chatCount: number;
    }> = {};

    const isSessionForWebsite = (s: StoreVisitorSession, slug: string): boolean => {
      const cfg = WEBSITES[slug];
      if (!cfg) return false;
      const sProp = (s.property_slug || '').toLowerCase();
      const sPage = (s.current_page || '').toLowerCase();
      const sRef = (s.referrer || '').toLowerCase();

      if (sProp === slug || sProp === cfg.domain || cfg.hostnames.some(h => sProp.includes(h))) return true;
      if (sPage && (sPage.includes(cfg.domain) || cfg.hostnames.some(h => sPage.includes(h)))) return true;
      if (sRef && (sRef.includes(cfg.domain) || cfg.hostnames.some(h => sRef.includes(h)))) return true;
      return false;
    };

    const isConvForWebsite = (c: StoreConversation, slug: string): boolean => {
      const cfg = WEBSITES[slug];
      if (!cfg) return false;
      const cProp = (c.property_slug || '').toLowerCase();
      return cProp === slug || cProp === cfg.domain || cfg.hostnames.some(h => cProp.includes(h));
    };

    Object.keys(WEBSITES).forEach(slug => {
      if (this.removedWebsites.has(slug)) return;
      const siteSessions = allSessions.filter(s => isSessionForWebsite(s, slug));

      const siteLiveSessions = siteSessions.filter(isSessionActive);
      const siteLiveMap = new Map<string, StoreVisitorSession>();
      siteLiveSessions.forEach(s => {
        const key = getVisitorIdentityKey(s);
        const existing = siteLiveMap.get(key);
        if (!existing) {
          siteLiveMap.set(key, s);
        } else {
          const isNewer = new Date(s.last_active_at).getTime() > new Date(existing.last_active_at).getTime();
          if (isNewer) {
            siteLiveMap.set(key, {
              ...s,
              created_at: new Date(existing.created_at).getTime() < new Date(s.created_at).getTime() ? existing.created_at : s.created_at
            });
          }
        }
      });

      const siteTodaySet = new Set<string>();
      const siteAllTimeSet = new Set<string>();
      siteSessions.forEach(s => {
        const uniqueIpKey = getVisitorIdentityKey(s);
        if (uniqueIpKey) {
          siteAllTimeSet.add(uniqueIpKey);
          try {
            const sDate = new Intl.DateTimeFormat('en-CA', {
              timeZone: 'Asia/Karachi',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            }).format(new Date(s.created_at || s.last_active_at));
            if (sDate === today) {
              siteTodaySet.add(uniqueIpKey);
            }
          } catch {
            siteTodaySet.add(uniqueIpKey);
          }
        }
      });

      const siteConvs = allConvs.filter(c => {
        return isConvForWebsite(c, slug) &&
          ((c.messages && c.messages.length > 0) || !!c.visitor_name || c.mode === 'human' || c.status === 'pending_agent' || !!c.assigned_agent_id);
      });

      websiteStats[slug] = {
        liveCount: siteLiveMap.size,
        todayCount: siteTodaySet.size,
        totalUniqueCount: siteAllTimeSet.size,
        chatCount: siteConvs.length
      };
    });

    return {
      liveVisitors,
      todayVisitorsCount: this.todayIps.get(today)?.size || 0,
      totalUniqueCount: this.allTimeIps.size,
      conversations: activeConversations,
      pageViews: this.totalViews,
      websiteStats,
      customWebsites: Array.from(this.customWebsites.values()),
      removedWebsites: Array.from(this.removedWebsites.values())
    };
  }

  async getAllAgents(): Promise<StoreAgent[]> {
    const defaultAgentEmails = new Set([
      'garryamelia6265@gmail.com',
      'tzafar04@gmail.com',
      'annusraees@gmail.com',
      'jennifer.cisternino2027@gmail.com'
    ]);

    const validStorageEmails = new Set<string>();

    try {
      const { data: aFiles } = await supabaseAdmin.storage.from(BUCKET).list('agents', { limit: 1000 });
      if (aFiles && aFiles.length > 0) {
        await Promise.all(aFiles.map(async (f) => {
          try {
            const { data } = await supabaseAdmin.storage.from(BUCKET).download(`agents/${f.name}`);
            if (data) {
              const text = await parseStorageData(data);
              if (text) {
                const a: StoreAgent = JSON.parse(text);
                const em = (a.email || '').toLowerCase().trim();
                if (em) {
                  // If this agent was rejected/removed, prune and do not include
                  const isRej = await this.isAgentRejected(em);
                  if (isRej) {
                    await supabaseAdmin.storage.from(BUCKET).remove([`agents/${f.name}`, f.name]).catch(() => {});
                    this.agents.delete(em);
                    if (a.id) this.agents.delete(a.id.toLowerCase());
                    return;
                  }

                  validStorageEmails.add(em);
                  if (ADMIN_EMAILS.includes(em)) {
                    a.role = 'admin';
                  }
                  a.status = 'approved';
                  this.agents.set(em, a);
                }
              }
            }
          } catch {}
        }));
      }
    } catch {}

    // Prune any non-default agent from memory if they were deleted from storage
    for (const [key, a] of Array.from(this.agents.entries())) {
      const cleanEm = (a.email || '').toLowerCase().trim();
      if (!defaultAgentEmails.has(cleanEm) && !validStorageEmails.has(cleanEm)) {
        this.agents.delete(key);
      }
    }

    // Ensure all 4 admins are always present and approved as admin
    for (const email of ADMIN_EMAILS) {
      const existing = this.agents.get(email.toLowerCase());
      if (existing) {
        existing.role = 'admin';
        existing.status = 'approved';
      }
    }

    const seenEmails = new Set<string>();
    const seenNames = new Set<string>();
    const uniqueAgents: StoreAgent[] = [];

    for (const a of Array.from(this.agents.values())) {
      const cleanEmail = (a.email || '').toLowerCase().trim();
      const cleanName = (a.full_name || '').toLowerCase().trim();
      if (!cleanEmail || seenEmails.has(cleanEmail)) continue;
      if (cleanName && seenNames.has(cleanName)) continue;

      a.status = 'approved';
      seenEmails.add(cleanEmail);
      if (cleanName) seenNames.add(cleanName);
      uniqueAgents.push(a);
    }

    return uniqueAgents;
  }

  async getAgent(agentIdOrEmail: string): Promise<StoreAgent | null> {
    const clean = (agentIdOrEmail || '').toLowerCase().trim();
    if (!clean) return null;

    // 1. Direct storage lookup by sanitized key (ensures fresh status across all serverless lambdas)
    try {
      const emailKey = `agents/${sanitizeKey(clean)}.json`;
      const { data } = await supabaseAdmin.storage.from(BUCKET).download(emailKey);
      if (data) {
        const text = await parseStorageData(data);
        if (text) {
          const a: StoreAgent = JSON.parse(text);
          const em = (a.email || '').toLowerCase().trim();
          if (em) {
            if (ADMIN_EMAILS.includes(em)) {
              a.role = 'admin';
            }
            a.status = 'approved';
            this.agents.set(em, a);
            if (a.id) this.agents.set(a.id.toLowerCase(), a);
            return a;
          }
        }
      }
    } catch {}

    // 2. In-memory check
    const inMem = this.agents.get(clean);
    if (inMem) {
      if (ADMIN_EMAILS.includes(inMem.email.toLowerCase())) {
        inMem.role = 'admin';
        inMem.status = 'approved';
      }
      return inMem;
    }
    for (const a of Array.from(this.agents.values())) {
      if ((a.id && a.id.toLowerCase() === clean) || (a.email && a.email.toLowerCase() === clean)) {
        if (ADMIN_EMAILS.includes(a.email.toLowerCase())) {
          a.role = 'admin';
          a.status = 'approved';
        }
        return a;
      }
    }

    // 3. Fallback to all agents list
    const all = await this.getAllAgents();
    const found = all.find(a => (a.id && a.id.toLowerCase() === clean) || (a.email && a.email.toLowerCase() === clean)) || null;
    if (found && ADMIN_EMAILS.includes(found.email.toLowerCase())) {
      found.role = 'admin';
      found.status = 'approved';
    }
    return found;
  }

  async saveAgent(agent: StoreAgent): Promise<void> {
    const cleanEmail = (agent.email || '').toLowerCase().trim();
    if (ADMIN_EMAILS.includes(cleanEmail)) {
      agent.role = 'admin';
      agent.status = 'approved';
    }
    this.agents.set(cleanEmail, agent);
    if (agent.id) {
      this.agents.set(agent.id.toLowerCase(), agent);
    }
    try {
      const emailKey = `agents/${sanitizeKey(cleanEmail)}.json`;
      await supabaseAdmin.storage.from(BUCKET).upload(emailKey, JSON.stringify(agent), {
        upsert: true,
        contentType: 'application/json',
        cacheControl: '0'
      });
      // Also save by id if distinct
      if (agent.id && sanitizeKey(agent.id) !== sanitizeKey(cleanEmail)) {
        await supabaseAdmin.storage.from(BUCKET).upload(`agents/${sanitizeKey(agent.id)}.json`, JSON.stringify(agent), {
          upsert: true,
          contentType: 'application/json',
          cacheControl: '0'
        }).catch(() => {});
      }
    } catch (e) {
      console.error('Error saving agent:', e);
    }
  }

  async deleteAgent(emailOrId: string): Promise<void> {
    const clean = (emailOrId || '').toLowerCase().trim();
    if (!clean) return;

    // Delete from in-memory map
    this.agents.delete(clean);
    for (const [e, a] of Array.from(this.agents.entries())) {
      if (
        e.toLowerCase() === clean ||
        (a.id && a.id.toLowerCase() === clean) ||
        (a.email && a.email.toLowerCase() === clean)
      ) {
        this.agents.delete(e);
      }
    }

    // Save as explicitly rejected in storage so auto-restore NEVER revives them
    const buckets = ['teals-live-store', 'teals-livechat'];
    const rejectKey = `rejected/${sanitizeKey(clean)}.json`;
    const rejectPayload = JSON.stringify({ email: clean, rejected_at: new Date().toISOString() });
    
    for (const b of buckets) {
      try {
        await supabaseAdmin.storage.from(b).upload(rejectKey, rejectPayload, {
          upsert: true,
          contentType: 'application/json'
        });
      } catch {}
    }

    // Delete from Supabase storage buckets
    for (const b of buckets) {
      try {
        const { data: aFiles } = await supabaseAdmin.storage.from(b).list('agents', { limit: 1000 });
        const { data: pFiles } = await supabaseAdmin.storage.from(b).list('pending', { limit: 1000 });
        const filesToDelete: string[] = [
          `agents/${sanitizeKey(clean)}.json`,
          `agents/${sanitizeKey(emailOrId)}.json`,
          `pending/${sanitizeKey(clean)}.json`,
          `pending/${sanitizeKey(emailOrId)}.json`
        ];

        const cleanSanitized = sanitizeKey(clean).toLowerCase();
        const cleanAlphanum = clean.replace(/[^a-z0-9]/g, '');

        if (aFiles && aFiles.length > 0) {
          for (const f of aFiles) {
            const fname = f.name.toLowerCase();
            if (
              fname === `${cleanSanitized}.json` ||
              fname.includes(cleanSanitized) ||
              (cleanAlphanum.length > 3 && fname.includes(cleanAlphanum))
            ) {
              filesToDelete.push(`agents/${f.name}`);
            }
          }
        }

        if (pFiles && pFiles.length > 0) {
          for (const f of pFiles) {
            const fname = f.name.toLowerCase();
            if (
              fname === `${cleanSanitized}.json` ||
              fname.includes(cleanSanitized) ||
              (cleanAlphanum.length > 3 && fname.includes(cleanAlphanum))
            ) {
              filesToDelete.push(`pending/${f.name}`);
            }
          }
        }

        const uniqueFiles = Array.from(new Set(filesToDelete));
        await supabaseAdmin.storage.from(b).remove(uniqueFiles);
      } catch (e) {
        console.error(`Error deleting agent files from bucket ${b}:`, e);
      }
    }
  }

  async isAgentRejected(email: string): Promise<boolean> {
    const clean = (email || '').toLowerCase().trim();
    if (!clean) return false;
    const buckets = ['teals-live-store', 'teals-livechat'];
    const rejectKey = `rejected/${sanitizeKey(clean)}.json`;
    for (const b of buckets) {
      try {
        const { data } = await supabaseAdmin.storage.from(b).download(rejectKey);
        if (data) return true;
      } catch {}
    }
    return false;
  }

  async getAllSavedConversations(): Promise<StoreConversation[]> {
    await this.ensureStorageLoaded();
    const all = Array.from(this.convCache.values());
    return all.sort((a, b) => {
      const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
      const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
      return timeB - timeA;
    });
  }

  incrementPageView(): void {
    this.totalViews += 1;
  }

  async deleteConversation(id: string): Promise<boolean> {
    if (!id) return false;
    const cleanId = sanitizeKey(id);
    this.convCache.delete(id);
    this.convCache.delete(cleanId);
    this.deletedConvIds.add(id);
    this.deletedConvIds.add(cleanId);

    const keysToRemove = new Set<string>([
      `conversations/${cleanId}.json`,
      `conversations/${id}.json`
    ]);

    // Only purge the specific conversation matching id (DO NOT wipe visitor_id as visitor is shared across Chat 1 and Chat 2)
    for (const [key, c] of Array.from(this.convCache.entries())) {
      if (c.id === id || c.id === cleanId) {
        this.convCache.delete(key);
        this.deletedConvIds.add(c.id);
        this.deletedConvIds.add(sanitizeKey(c.id));
        keysToRemove.add(`conversations/${sanitizeKey(c.id)}.json`);
        keysToRemove.add(`conversations/${c.id}.json`);
      }
    }

    const buckets = ['teals-live-store', 'teals-livechat'];
    const pathsToRemove = Array.from(keysToRemove);

    try {
      const payload = JSON.stringify(Array.from(this.deletedConvIds));
      await Promise.all([
        ...buckets.map(b => supabaseAdmin.storage.from(b).remove(pathsToRemove).catch(() => {})),
        ...buckets.map(b => supabaseAdmin.storage.from(b).upload('meta/deleted_conversations.json', payload, {
          upsert: true,
          contentType: 'application/json'
        }).catch(() => {}))
      ]);
      return true;
    } catch (e) {
      console.error('Error deleting conversation from storage:', e);
      return false;
    }
  }

  async deleteConversations(ids: string[]): Promise<boolean> {
    if (!ids || ids.length === 0) return true;
    const keysToRemove = new Set<string>();
    const idSet = new Set(ids);

    for (const id of ids) {
      const cleanId = sanitizeKey(id);
      this.convCache.delete(id);
      this.convCache.delete(cleanId);
      this.deletedConvIds.add(id);
      this.deletedConvIds.add(cleanId);
      keysToRemove.add(`conversations/${cleanId}.json`);
      keysToRemove.add(`conversations/${id}.json`);
    }

    for (const [key, c] of Array.from(this.convCache.entries())) {
      if (idSet.has(c.id) || idSet.has(sanitizeKey(c.id))) {
        this.convCache.delete(key);
        this.deletedConvIds.add(c.id);
        this.deletedConvIds.add(sanitizeKey(c.id));
        keysToRemove.add(`conversations/${sanitizeKey(c.id)}.json`);
        keysToRemove.add(`conversations/${c.id}.json`);
      }
    }

    const buckets = ['teals-live-store', 'teals-livechat'];
    const pathsToRemove = Array.from(keysToRemove);
    try {
      const payload = JSON.stringify(Array.from(this.deletedConvIds));
      await Promise.all([
        ...buckets.map(b => supabaseAdmin.storage.from(b).remove(pathsToRemove).catch(() => {})),
        ...buckets.map(b => supabaseAdmin.storage.from(b).upload('meta/deleted_conversations.json', payload, {
          upsert: true,
          contentType: 'application/json'
        }).catch(() => {}))
      ]);
      return true;
    } catch {
      return false;
    }
  }
  
  async clearAllConversations(): Promise<void> {
    this.convCache.clear();
    this.deletedConvIds.clear();
    this.lastResetAt = Date.now();
    const buckets = ['teals-live-store', 'teals-livechat'];
    const payload = JSON.stringify({ resetAt: this.lastResetAt });
    for (const b of buckets) {
      try {
        const { data: cFiles } = await supabaseAdmin.storage.from(b).list('conversations', { limit: 1000 });
        if (cFiles && cFiles.length > 0) {
          const paths = cFiles.map(f => 'conversations/' + f.name);
          await supabaseAdmin.storage.from(b).remove(paths);
        }
        await supabaseAdmin.storage.from(b).upload('meta/system_reset.json', payload, { upsert: true, contentType: 'application/json' });
        await supabaseAdmin.storage.from(b).remove(['meta/deleted_conversations.json']);
      } catch (e) {
        console.error(`Error clearing conversations from bucket ${b}:`, e);
      }
    }
  }

  async resetTrafficOnly(): Promise<void> {
    this.sessionCache.clear();
    this.allTimeIps.clear();
    this.todayIps.clear();
    this.totalViews = 0;
    this.storageLoaded = false;

    const buckets = ['teals-live-store', 'teals-livechat'];
    for (const b of buckets) {
      try {
        const { data: sFiles } = await supabaseAdmin.storage.from(b).list('sessions', { limit: 1000 });
        if (sFiles && sFiles.length > 0) {
          const paths = sFiles.map(f => 'sessions/' + f.name);
          await supabaseAdmin.storage.from(b).remove(paths);
        }
      } catch (e) {
        console.error(`Error clearing sessions from bucket ${b}:`, e);
      }
    }
  }
}

const globalStore = global as unknown as { __tealsGranularStore?: GranularStore };
if (!globalStore.__tealsGranularStore) {
  globalStore.__tealsGranularStore = new GranularStore();
}

export const granularStore = globalStore.__tealsGranularStore;
export const memoryStore = granularStore;
