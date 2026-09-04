import { supabaseAdmin } from '@/lib/supabase';

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
  browser: string;
  os: string;
  device: string;
  is_online: boolean;
  last_active_at: string;
  created_at: string;
}

export interface StoreMessage {
  id: string;
  conversation_id: string;
  sender_type: 'visitor' | 'agent' | 'ai' | 'system';
  sender_name: string;
  content: string;
  is_whisper?: boolean;
  seq?: number;
  status?: 'sent' | 'delivered' | 'read';
  created_at: string;
}

export interface StoreConversation {
  id: string;
  property_slug: string;
  visitor_id: string;
  visitor_name: string;
  visitor_email?: string;
  visitor_ip?: string;
  visitor?: StoreVisitorSession;
  assigned_agent_id?: string;
  assigned_agent_name?: string;
  assigned_agent_email?: string;
  assigned_at?: string;
  mode: 'ai' | 'human';
  status: 'active' | 'pending_agent' | 'closed';
  typing_preview?: string;
  last_visitor_message_at?: string;
  last_agent_reply_at?: string;
  last_read_by_agent_at?: string;
  last_read_by_visitor_at?: string;
  created_at: string;
  updated_at: string;
  messages: StoreMessage[];
}

export interface StoreAgent {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: 'admin' | 'agent';
  status: 'pending' | 'approved' | 'rejected';
  is_online: boolean;
  last_seen_at: string;
  created_at: string;
}

export const ADMIN_EMAILS: string[] = [
  'garryamelia6265@gmail.com',
  'tzafar04@gmail.com',
  'annusraees@gmail.com'
];

export function isUserAdmin(email?: string | null, role?: string | null): boolean {
  if (role === 'admin') return true;
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

function sanitizeKey(k: string): string {
  return (k || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function parseStorageData(data: unknown): Promise<string> {
  if (!data) return '';
  const anyData = data as { arrayBuffer?: () => Promise<ArrayBuffer>; text?: () => Promise<string> };
  if (typeof anyData.arrayBuffer === 'function') {
    try {
      const buf = Buffer.from(await anyData.arrayBuffer());
      return buf.toString('utf-8');
    } catch {}
  }
  if (typeof anyData.text === 'function') {
    try {
      return await anyData.text();
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
    const isAiGreetA = a.id === 'init-greet' || (a.sender_type === 'ai' && (a.seq === 1 || (a.content || '').includes('Hey! How can I help') || (a.content || '').includes('Welcome to')));
    const isAiGreetB = b.id === 'init-greet' || (b.sender_type === 'ai' && (b.seq === 1 || (b.content || '').includes('Hey! How can I help') || (b.content || '').includes('Welcome to')));
    if (isAiGreetA && !isAiGreetB) return -1;
    if (!isAiGreetA && isAiGreetB) return 1;

    // 2. Strict chronological order by timestamp
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    if (timeA !== timeB) {
      return timeA - timeB;
    }

    // 3. Fallback to sequence number if timestamps are identical
    const seqA = typeof a.seq === 'number' ? a.seq : 999999;
    const seqB = typeof b.seq === 'number' ? b.seq : 999999;
    return seqA - seqB;
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
  allTimeIps = new Set<string>();
  readonly todayIps = new Map<string, Set<string>>();
  private totalViews = 0;
  private storageLoaded = false;

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
    const agent: StoreAgent = {
      id: 'agent_abdul_rafay',
      email: 'abdulrafay40023@gmail.com',
      full_name: 'Abdul Rafay',
      phone: '+92 300 1234567',
      role: 'agent',
      status: 'approved',
      is_online: true,
      last_seen_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    this.agents.set(adminGarry.email.toLowerCase(), adminGarry);
    this.agents.set(adminTzafar.email.toLowerCase(), adminTzafar);
    this.agents.set(adminAnnus.email.toLowerCase(), adminAnnus);
    this.agents.set(agent.email.toLowerCase(), agent);
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
    this.sessionCache.set(session.id, session);
    
    const key = `sessions/${sanitizeKey(session.id)}.json`;
    try {
      await supabaseAdmin.storage.from(BUCKET).upload(key, JSON.stringify(session), {
        upsert: true,
        contentType: 'application/json'
      });
    } catch (e) {
      console.error('Cloud save session error:', e);
    }

    return session;
  }

  async removeSession(sessionId: string): Promise<void> {
    this.sessionCache.delete(sessionId);
    const key = `sessions/${sanitizeKey(sessionId)}.json`;
    try {
      await supabaseAdmin.storage.from(BUCKET).remove([key]);
    } catch {}
  }

  async getConversation(convId: string): Promise<StoreConversation | null> {
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

          const merged: StoreConversation = {
            ...cloudConv,
            ...(conv || {}),
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

    return allConvs.filter(c => {
      if (c.id === visitorToken || c.visitor_id === visitorToken) return true;
      if (cleanEmail && c.visitor_email && c.visitor_email.toLowerCase() === cleanEmail) return true;
      return false;
    }).sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime());
  }

  async saveConversation(conv: StoreConversation): Promise<StoreConversation> {
    const existing = this.convCache.get(conv.id);
    const msgMap = new Map<string, StoreMessage>();

    if (existing?.messages) {
      existing.messages.forEach(m => msgMap.set(m.id, m));
    }
    (conv.messages || []).forEach(m => msgMap.set(m.id, m));

    const mergedMessages = sortMessagesChronologically(Array.from(msgMap.values()));
    const isClaimed = !!(conv.assigned_agent_id || existing?.assigned_agent_id || conv.assigned_agent_name || existing?.assigned_agent_name);

    const mergedConv: StoreConversation = {
      ...(existing || {}),
      ...conv,
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

    // Persist to Supabase Storage
    const key = `conversations/${sanitizeKey(conv.id)}.json`;
    try {
      await supabaseAdmin.storage.from(BUCKET).upload(key, JSON.stringify(mergedConv), {
        upsert: true,
        contentType: 'application/json'
      });
    } catch (e) {
      console.error('Cloud save conversation error:', e);
    }

    return mergedConv;
  }

  private async ensureStorageLoaded(): Promise<void> {
    try {
      // 1. Sync conversations from bucket
      const { data: cFiles } = await supabaseAdmin.storage.from(BUCKET).list('conversations', { limit: 1000 });
      const currentConvNames = new Set((cFiles || []).map(f => f.name.replace('.json', '')));
      
      // Prune deleted conversations from cache
      for (const id of Array.from(this.convCache.keys())) {
        if (!currentConvNames.has(sanitizeKey(id))) {
          this.convCache.delete(id);
        }
      }

      if (cFiles && cFiles.length > 0) {
        await Promise.all(cFiles.map(async (f) => {
          try {
            const id = f.name.replace('.json', '');
            const { data } = await supabaseAdmin.storage.from(BUCKET).download(`conversations/${f.name}`);
            if (data) {
              const text = await parseStorageData(data);
              if (text) {
                const c: StoreConversation = JSON.parse(text);
                const existing = this.convCache.get(c.id) || this.convCache.get(id);
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
                } else {
                  c.messages = sortMessagesChronologically(c.messages || []);
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
            if (!this.sessionCache.has(id)) {
              const { data } = await supabaseAdmin.storage.from(BUCKET).download(`sessions/${f.name}`);
              if (data) {
                const text = await parseStorageData(data);
                if (text) {
                  const s: StoreVisitorSession = JSON.parse(text);
                  this.sessionCache.set(s.id, s);
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
  }> {
    await this.ensureStorageLoaded();

    const now = Date.now();
    const HEARTBEAT_TIMEOUT = 25 * 1000;
    const allSessions = Array.from(this.sessionCache.values());
    const allConvs = Array.from(this.convCache.values());

    const isGlobal = !propertySlug || propertySlug === 'all' || propertySlug === 'teals-crm';
    const filteredSessions = isGlobal ? allSessions : allSessions.filter(s => s.property_slug === propertySlug);
    const rawLiveSessions = filteredSessions.filter(s => {
      const lastActive = new Date(s.last_active_at).getTime();
      return s.is_online && (now - lastActive < HEARTBEAT_TIMEOUT);
    });

    // Deduplicate strictly by IP address: 1 IP = 1 Live Visitor
    const liveVisitorsMap = new Map<string, StoreVisitorSession>();
    rawLiveSessions.forEach(s => {
      const key = s.ip_address || s.id;
      const existing = liveVisitorsMap.get(key);
      if (!existing || new Date(s.last_active_at).getTime() > new Date(existing.last_active_at).getTime()) {
        liveVisitorsMap.set(key, s);
      }
    });
    const liveVisitors = Array.from(liveVisitorsMap.values());

    const today = getTodayKey();
    const currentTodaySet = new Set<string>();
    const currentAllTimeSet = new Set<string>();
    
    filteredSessions.forEach(s => {
      const ip = s.ip_address || s.id;
      if (ip) {
        currentAllTimeSet.add(ip);
        try {
          const sDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Karachi',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).format(new Date(s.created_at || s.last_active_at));
          if (sDate === today) {
            currentTodaySet.add(ip);
          }
        } catch {
          currentTodaySet.add(ip);
        }
      }
    });

    this.todayIps.set(today, currentTodaySet);
    this.allTimeIps = currentAllTimeSet;

    const filteredConvs = isGlobal ? allConvs : allConvs.filter(c => c.property_slug === propertySlug);
    const activeConversations = filteredConvs.filter(c => {
      return (c.messages && c.messages.length > 0) || !!c.visitor_name || c.mode === 'human' || c.status === 'pending_agent' || !!c.assigned_agent_id;
    });

    return {
      liveVisitors,
      todayVisitorsCount: this.todayIps.get(today)?.size || 0,
      totalUniqueCount: this.allTimeIps.size,
      conversations: activeConversations,
      pageViews: this.totalViews
    };
  }

  async getAllAgents(): Promise<StoreAgent[]> {
    try {
      const { data: aFiles } = await supabaseAdmin.storage.from(BUCKET).list('agents');
      if (aFiles && aFiles.length > 0) {
        await Promise.all(aFiles.map(async (f) => {
          try {
            const { data } = await supabaseAdmin.storage.from(BUCKET).download(`agents/${f.name}`);
            if (data) {
              const text = await parseStorageData(data);
              if (text) {
                const a: StoreAgent = JSON.parse(text);
                if (ADMIN_EMAILS.includes(a.email.toLowerCase())) {
                  a.role = 'admin';
                  a.status = 'approved';
                }
                this.agents.set(a.email.toLowerCase(), a);
              }
            }
          } catch {}
        }));
      }
    } catch {}

    // Ensure all 3 admins are always present and approved as admin
    for (const email of ADMIN_EMAILS) {
      const existing = this.agents.get(email.toLowerCase());
      if (existing) {
        existing.role = 'admin';
        existing.status = 'approved';
      }
    }

    return Array.from(this.agents.values());
  }

  async getAgent(agentId: string): Promise<StoreAgent | null> {
    const all = await this.getAllAgents();
    const found = all.find(a => a.id === agentId || a.email.toLowerCase() === agentId.toLowerCase()) || null;
    if (found && ADMIN_EMAILS.includes(found.email.toLowerCase())) {
      found.role = 'admin';
      found.status = 'approved';
    }
    return found;
  }

  async saveAgent(agent: StoreAgent): Promise<void> {
    if (ADMIN_EMAILS.includes(agent.email.toLowerCase())) {
      agent.role = 'admin';
      agent.status = 'approved';
    }
    this.agents.set(agent.email.toLowerCase(), agent);
    try {
      const key = `agents/${sanitizeKey(agent.id)}.json`;
      await supabaseAdmin.storage.from(BUCKET).upload(key, JSON.stringify(agent), {
        upsert: true,
        contentType: 'application/json'
      });
    } catch (e) {
      console.error('Error saving agent:', e);
    }
  }

  incrementPageView(): void {
    this.totalViews += 1;
  }

  async deleteConversation(id: string): Promise<boolean> {
    if (!id) return false;
    const cleanId = sanitizeKey(id);
    this.convCache.delete(id);
    this.convCache.delete(cleanId);
    try {
      const key = `conversations/${cleanId}.json`;
      await supabaseAdmin.storage.from(BUCKET).remove([key]);
      return true;
    } catch (e) {
      console.error('Error deleting conversation from storage:', e);
      return false;
    }
  }
  
  async clearAllConversations(): Promise<void> {
    this.convCache.clear();
    try {
      const { data: cFiles } = await supabaseAdmin.storage.from(BUCKET).list('conversations', { limit: 1000 });
      if (cFiles && cFiles.length > 0) {
        const paths = cFiles.map(f => 'conversations/' + f.name);
        await supabaseAdmin.storage.from(BUCKET).remove(paths);
      }
    } catch {}
  }

  async resetTrafficOnly(): Promise<void> {
    this.sessionCache.clear();
    this.allTimeIps.clear();
    this.todayIps.clear();
    this.totalViews = 0;
    this.storageLoaded = false;

    try {
      const { data: sFiles } = await supabaseAdmin.storage.from(BUCKET).list('sessions', { limit: 1000 });
      if (sFiles && sFiles.length > 0) {
        const paths = sFiles.map(f => 'sessions/' + f.name);
        await supabaseAdmin.storage.from(BUCKET).remove(paths);
      }
    } catch {}
  }
}

const globalStore = global as unknown as { __tealsGranularStore?: GranularStore };
if (!globalStore.__tealsGranularStore) {
  globalStore.__tealsGranularStore = new GranularStore();
}

export const granularStore = globalStore.__tealsGranularStore;
export const memoryStore = granularStore;
