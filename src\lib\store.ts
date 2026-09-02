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

function sanitizeKey(k: string): string {
  return k.replace(/[^a-zA-Z0-9_-]/g, '_');
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
    const isAiGreetA = a.id === 'init-greet' || (a.sender_type === 'ai' && (a.seq === 1 || (a.content || '').includes('Hey! How can I help')));
    const isAiGreetB = b.id === 'init-greet' || (b.sender_type === 'ai' && (b.seq === 1 || (b.content || '').includes('Hey! How can I help')));
    if (isAiGreetA && !isAiGreetB) return -1;
    if (!isAiGreetA && isAiGreetB) return 1;

    const isTransferA = a.sender_type === 'system' && (a.content || '').includes('Transferring to a live support agent');
    const isTransferB = b.sender_type === 'system' && (b.content || '').includes('Transferring to a live support agent');
    const isClaimA = a.sender_type === 'system' && (a.content || '').includes('has claimed and joined');
    const isClaimB = b.sender_type === 'system' && (b.content || '').includes('has claimed and joined');

    if (isTransferA && isClaimB) return -1;
    if (isClaimA && isTransferB) return 1;

    if (isTransferA && b.sender_type === 'agent') return -1;
    if (isTransferB && a.sender_type === 'agent') return 1;

    if (isClaimA && b.sender_type === 'agent') return -1;
    if (isClaimB && a.sender_type === 'agent') return 1;

    const seqA = typeof a.seq === 'number' ? a.seq : 999999;
    const seqB = typeof b.seq === 'number' ? b.seq : 999999;
    if (seqA !== seqB) {
      return seqA - seqB;
    }

    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    return timeA - timeB;
  });

  return sorted.map((m, idx) => ({
    ...m,
    seq: idx + 1
  }));
};

class GranularStore {
  private sessionCache = new Map<string, StoreVisitorSession>();
  private convCache = new Map<string, StoreConversation>();
  public agents = new Map<string, StoreAgent>();
  private todayIps = new Map<string, Set<string>>();
  private allTimeIps = new Set<string>();
  private totalViews = 0;
  private lastActiveSyncTime = 0;

  constructor() {
    const admin: StoreAgent = {
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
    this.agents.set(admin.email.toLowerCase(), admin);
    this.agents.set(agent.email.toLowerCase(), agent);
  }

  async getSession(sessionId: string): Promise<StoreVisitorSession | null> {
    const cached = this.sessionCache.get(sessionId);
    if (cached) return cached;
    try {
      const key = `sessions/${sanitizeKey(sessionId)}.json`;
      const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(key);
      if (!error && data) {
        const session: StoreVisitorSession = JSON.parse(await data.text());
        this.sessionCache.set(sessionId, session);
        return session;
      }
    } catch {}
    this.sessionCache.delete(sessionId);
    return null;
  }

  async saveSession(session: StoreVisitorSession): Promise<StoreVisitorSession> {
    this.sessionCache.set(session.id, session);
    this.lastActiveSyncTime = 0;
    
    try {
      const key = `sessions/${sanitizeKey(session.id)}.json`;
      await supabaseAdmin.storage.from(BUCKET).upload(key, JSON.stringify(session), {
        upsert: true,
        contentType: 'application/json'
      });
    } catch (e) {
      console.error('Error saving session:', e);
    }
    return session;
  }

  async removeSession(sessionId: string): Promise<void> {
    this.sessionCache.delete(sessionId);
    this.lastActiveSyncTime = 0;
    try {
      const key = `sessions/${sanitizeKey(sessionId)}.json`;
      await supabaseAdmin.storage.from(BUCKET).remove([key]);
    } catch {}
  }

  async getConversation(convId: string): Promise<StoreConversation | null> {
    try {
      const key = `conversations/${sanitizeKey(convId)}.json`;
      const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(key);
      if (!error && data) {
        const cloudConv: StoreConversation = JSON.parse(await data.text());
        cloudConv.messages = sortMessagesChronologically(cloudConv.messages || []);
        this.convCache.set(convId, cloudConv);
        return cloudConv;
      }
    } catch {}
    const cached = this.convCache.get(convId);
    if (cached) return cached;
    return null;
  }

  async saveConversation(conv: StoreConversation): Promise<StoreConversation> {
    const key = `conversations/${sanitizeKey(conv.id)}.json`;
    let cloudConv: StoreConversation | null = null;

    try {
      const { data } = await supabaseAdmin.storage.from(BUCKET).download(key);
      if (data) {
        cloudConv = JSON.parse(await data.text());
      }
    } catch {}

    const msgMap = new Map<string, StoreMessage>();
    if (cloudConv?.messages) {
      cloudConv.messages.forEach(m => msgMap.set(m.id, m));
    }
    (conv.messages || []).forEach(m => msgMap.set(m.id, m));

    const mergedMessages = sortMessagesChronologically(Array.from(msgMap.values()));

    const isClaimed = !!(conv.assigned_agent_id || cloudConv?.assigned_agent_id || conv.assigned_agent_name || cloudConv?.assigned_agent_name);
    const mergedConv: StoreConversation = {
      ...(cloudConv || {}),
      ...conv,
      mode: isClaimed || conv.mode === 'human' || cloudConv?.mode === 'human' ? 'human' : 'ai',
      status: isClaimed ? 'active' : (conv.status === 'pending_agent' || cloudConv?.status === 'pending_agent' ? 'pending_agent' : 'active'),
      assigned_agent_id: conv.assigned_agent_id || cloudConv?.assigned_agent_id,
      assigned_agent_name: conv.assigned_agent_name || cloudConv?.assigned_agent_name,
      assigned_agent_email: conv.assigned_agent_email || cloudConv?.assigned_agent_email,
      messages: mergedMessages,
      updated_at: new Date().toISOString()
    };

    this.convCache.set(conv.id, mergedConv);

    try {
      await supabaseAdmin.storage.from(BUCKET).upload(key, JSON.stringify(mergedConv), {
        upsert: true,
        contentType: 'application/json'
      });
    } catch (e) {
      console.error('Error saving merged conversation:', e);
    }
    return mergedConv;
  }

  async getAllActiveData(propertySlug = 'teals-crm'): Promise<{
    liveVisitors: StoreVisitorSession[];
    todayVisitorsCount: number;
    totalUniqueCount: number;
    conversations: StoreConversation[];
    pageViews: number;
  }> {
    const now = Date.now();
    const HEARTBEAT_TIMEOUT = 25 * 1000;
    const allSessions: StoreVisitorSession[] = [];
    const allConvs: StoreConversation[] = [];

    try {
      // 1. Download all sessions
      const { data: sFiles } = await supabaseAdmin.storage.from(BUCKET).list('sessions', { limit: 100 });
      if (sFiles && sFiles.length > 0) {
        await Promise.all(sFiles.map(async (f) => {
          try {
            const { data } = await supabaseAdmin.storage.from(BUCKET).download(`sessions/${f.name}`);
            if (data) {
              const s: StoreVisitorSession = JSON.parse(await data.text());
              allSessions.push(s);
              this.sessionCache.set(s.id, s);
            }
          } catch {}
        }));
      }

      // 2. Download all conversations
      const { data: cFiles } = await supabaseAdmin.storage.from(BUCKET).list('conversations', { limit: 100 });
      if (cFiles && cFiles.length > 0) {
        await Promise.all(cFiles.map(async (f) => {
          try {
            const { data } = await supabaseAdmin.storage.from(BUCKET).download(`conversations/${f.name}`);
            if (data) {
              const c: StoreConversation = JSON.parse(await data.text());
              c.messages = sortMessagesChronologically(c.messages || []);
              allConvs.push(c);
              this.convCache.set(c.id, c);
            }
          } catch {}
        }));
      }
    } catch (e) {
      console.error('Sync error:', e);
    }

    const filteredSessions = allSessions.filter(s => s.property_slug === propertySlug);
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

    const filteredConvs = allConvs.filter(c => !c.property_slug || c.property_slug === propertySlug);
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
              const a: StoreAgent = JSON.parse(await data.text());
              this.agents.set(a.email.toLowerCase(), a);
            }
          } catch {}
        }));
      }
    } catch {}
    return Array.from(this.agents.values());
  }

  async getAgent(agentId: string): Promise<StoreAgent | null> {
    const all = await this.getAllAgents();
    return all.find(a => a.id === agentId || a.email.toLowerCase() === agentId.toLowerCase()) || null;
  }

  async saveAgent(agent: StoreAgent): Promise<void> {
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
  
  async clearAllConversations(): Promise<void> {
    this.convCache.clear();
    try {
      const { data: cFiles } = await supabaseAdmin.storage.from(BUCKET).list('conversations');
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

    try {
      const { data: sFiles } = await supabaseAdmin.storage.from(BUCKET).list('sessions');
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
