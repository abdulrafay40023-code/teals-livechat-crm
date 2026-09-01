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

export const sortMessagesChronologically = <T extends { created_at?: string; seq?: number }>(messages: T[]): T[] => {
  return messages.sort((a, b) => {
    if (typeof a.seq === 'number' && typeof b.seq === 'number' && a.seq !== b.seq) {
      return a.seq - b.seq;
    }
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    return timeA - timeB;
  });
};

class GranularStore {
  private sessionCache = new Map<string, StoreVisitorSession>();
  private convCache = new Map<string, StoreConversation>();
  public agents = new Map<string, StoreAgent>();
  private todayIps = new Map<string, Set<string>>();
  private allTimeIps = new Set<string>();
  private totalViews = 0;

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

  async saveSession(session: StoreVisitorSession): Promise<void> {
    this.sessionCache.set(session.id, session);
    
    const today = getTodayKey();
    if (!this.todayIps.has(today)) {
      this.todayIps.set(today, new Set());
    }
    this.todayIps.get(today)!.add(session.ip_address);
    this.allTimeIps.add(session.ip_address);

    try {
      const key = `sessions/${sanitizeKey(session.id)}.json`;
      await supabaseAdmin.storage.from(BUCKET).upload(key, JSON.stringify(session), {
        upsert: true,
        contentType: 'application/json'
      });
    } catch (e) {
      console.error('Error saving session:', e);
    }
  }

  async removeSession(sessionId: string): Promise<void> {
    this.sessionCache.delete(sessionId);
    try {
      const key = `sessions/${sanitizeKey(sessionId)}.json`;
      await supabaseAdmin.storage.from(BUCKET).remove([key]);
    } catch {}
  }

  async getConversation(convId: string): Promise<StoreConversation | null> {
    const cached = this.convCache.get(convId);
    try {
      const key = `conversations/${sanitizeKey(convId)}.json`;
      const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(key);
      if (!error && data) {
        const cloudConv: StoreConversation = JSON.parse(await data.text());
        if (cached) {
          const msgMap = new Map<string, StoreMessage>();
          (cloudConv.messages || []).forEach(m => msgMap.set(m.id, m));
          (cached.messages || []).forEach(m => msgMap.set(m.id, m));

          const mergedMessages = sortMessagesChronologically(Array.from(msgMap.values()));

          const isClaimed = !!(cached.assigned_agent_id || cloudConv.assigned_agent_id || cached.assigned_agent_name || cloudConv.assigned_agent_name);
          const merged: StoreConversation = {
            ...cloudConv,
            ...cached,
            mode: isClaimed || cached.mode === 'human' || cloudConv.mode === 'human' ? 'human' : 'ai',
            status: isClaimed ? 'active' : (cached.status === 'pending_agent' || cloudConv.status === 'pending_agent' ? 'pending_agent' : 'active'),
            assigned_agent_id: cached.assigned_agent_id || cloudConv.assigned_agent_id,
            assigned_agent_name: cached.assigned_agent_name || cloudConv.assigned_agent_name,
            assigned_agent_email: cached.assigned_agent_email || cloudConv.assigned_agent_email,
            messages: mergedMessages
          };
          this.convCache.set(convId, merged);
          return merged;
        }
        this.convCache.set(convId, cloudConv);
        return cloudConv;
      }
    } catch {}
    // If download failed or file doesn't exist yet, return cached in-memory instance
    if (cached) return cached;
    return null;
  }

  async saveConversation(conv: StoreConversation): Promise<void> {
    const key = `conversations/${sanitizeKey(conv.id)}.json`;
    const cached = this.convCache.get(conv.id);

    const msgMap = new Map<string, StoreMessage>();
    if (cached?.messages) {
      cached.messages.forEach(m => msgMap.set(m.id, m));
    }
    (conv.messages || []).forEach(m => msgMap.set(m.id, m));

    const mergedMessages = sortMessagesChronologically(Array.from(msgMap.values()));

    const isClaimed = !!(conv.assigned_agent_id || cached?.assigned_agent_id || conv.assigned_agent_name || cached?.assigned_agent_name);
    const mergedConv: StoreConversation = {
      ...(cached || {}),
      ...conv,
      mode: isClaimed || conv.mode === 'human' || cached?.mode === 'human' ? 'human' : 'ai',
      status: isClaimed ? 'active' : (conv.status === 'pending_agent' || cached?.status === 'pending_agent' ? 'pending_agent' : 'active'),
      messages: mergedMessages,
      updated_at: new Date().toISOString()
    };

    // Immediately update memory cache so all concurrent requests see new messages instantly
    this.convCache.set(conv.id, mergedConv);

    try {
      await supabaseAdmin.storage.from(BUCKET).upload(key, JSON.stringify(mergedConv), {
        upsert: true,
        contentType: 'application/json'
      });
    } catch (e) {
      console.error('Error saving merged conversation:', e);
    }
  }

  async getAllActiveData(propertySlug = 'teals-crm'): Promise<{
    liveVisitors: StoreVisitorSession[];
    todayVisitorsCount: number;
    totalUniqueCount: number;
    conversations: StoreConversation[];
    pageViews: number;
  }> {
    const now = Date.now();
    // 25-second heartbeat timeout - widget pings every 3.5s, so 25s allows ~7 missed pings before dropout
    const HEARTBEAT_TIMEOUT = 25 * 1000;

    try {
      // 1. Sync Sessions with Storage
      const validSessionIds = new Set<string>();
      const { data: sFiles } = await supabaseAdmin.storage.from(BUCKET).list('sessions', { limit: 100 });
      if (sFiles && sFiles.length > 0) {
        await Promise.all(sFiles.map(async (f) => {
          try {
            const { data } = await supabaseAdmin.storage.from(BUCKET).download(`sessions/${f.name}`);
            if (data) {
              const s: StoreVisitorSession = JSON.parse(await data.text());
              validSessionIds.add(s.id);
              this.sessionCache.set(s.id, s);
            }
          } catch {}
        }));
      }
      // Purge sessions from memory that are no longer in storage
      Array.from(this.sessionCache.keys()).forEach((id) => {
        if (!validSessionIds.has(id)) {
          this.sessionCache.delete(id);
        }
      });

      // 2. Sync Conversations with Storage with Non-Destructive Message Union
      const validConvIds = new Set<string>();
      const { data: cFiles } = await supabaseAdmin.storage.from(BUCKET).list('conversations', { limit: 100 });
      if (cFiles && cFiles.length > 0) {
        await Promise.all(cFiles.map(async (f) => {
          try {
            const { data } = await supabaseAdmin.storage.from(BUCKET).download(`conversations/${f.name}`);
            if (data) {
              const c: StoreConversation = JSON.parse(await data.text());
              validConvIds.add(c.id);
              
              const existing = this.convCache.get(c.id);
              if (existing) {
                const msgMap = new Map<string, StoreMessage>();
                (c.messages || []).forEach(m => msgMap.set(m.id, m));
                (existing.messages || []).forEach(m => msgMap.set(m.id, m));
                const isClaimed = !!(existing.assigned_agent_id || c.assigned_agent_id || existing.assigned_agent_name || c.assigned_agent_name);
                const mergedMessages = sortMessagesChronologically(Array.from(msgMap.values()));

                this.convCache.set(c.id, {
                  ...c,
                  ...existing,
                  mode: isClaimed || existing.mode === 'human' || c.mode === 'human' ? 'human' : 'ai',
                  status: isClaimed ? 'active' : (existing.status === 'pending_agent' || c.status === 'pending_agent' ? 'pending_agent' : 'active'),
                  assigned_agent_id: existing.assigned_agent_id || c.assigned_agent_id,
                  assigned_agent_name: existing.assigned_agent_name || c.assigned_agent_name,
                  assigned_agent_email: existing.assigned_agent_email || c.assigned_agent_email,
                  messages: mergedMessages
                });
              } else {
                this.convCache.set(c.id, c);
              }
            }
          } catch {}
        }));
      }
      // Purge conversations from memory that are no longer in storage
      Array.from(this.convCache.keys()).forEach((id) => {
        if (!validConvIds.has(id)) {
          this.convCache.delete(id);
        }
      });
    } catch (e) {
      console.error('Sync error:', e);
    }

    const allSessions = Array.from(this.sessionCache.values()).filter(s => s.property_slug === propertySlug);
    const rawLiveSessions = allSessions.filter(s => {
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
    
    allSessions.forEach(s => {
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

    const allConvs = Array.from(this.convCache.values()).filter(c => c.property_slug === propertySlug);
    // Show conversations where visitor has sent at least one message, OR human agent is involved
    const activeConversations = allConvs.filter(c => {
      const hasVisitorMessage = c.messages && c.messages.some(m => m.sender_type === 'visitor');
      return hasVisitorMessage || c.mode === 'human' || c.status === 'pending_agent' || !!c.assigned_agent_id;
    });

    return {
      liveVisitors,
      todayVisitorsCount: currentTodaySet.size,
      totalUniqueCount: currentAllTimeSet.size,
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
