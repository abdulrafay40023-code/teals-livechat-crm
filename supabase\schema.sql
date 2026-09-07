-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Properties (Multi-tenant company channels: Teals CRM, Leadzmaker)
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    domain TEXT,
    widget_color TEXT DEFAULT '#6366f1',
    greeting_message TEXT DEFAULT 'Hello! How can we help you with Teals CRM today?',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert Default Properties
INSERT INTO properties (name, slug, domain, widget_color, greeting_message)
VALUES 
    ('Teals CRM', 'teals-crm', 'salesflow-ai-main.vercel.app', '#6366f1', 'Welcome to Teals CRM AI Support! How can we assist your sales team today?'),
    ('Leadzmaker', 'leadzmaker', 'leadzmaker.com', '#06b6d4', 'Welcome to Leadzmaker Support! Looking to scale B2B lead generation?')
ON CONFLICT (slug) DO NOTHING;

-- 2. Agents Table (Garry Amelia = Admin, others = Agents)
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'agent', -- 'admin' or 'agent'
    status TEXT NOT NULL DEFAULT 'pending', -- 'approved', 'pending', 'rejected'
    is_online BOOLEAN DEFAULT false,
    last_seen_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Pre-seed Super Admin
INSERT INTO agents (email, full_name, phone, role, status, is_online)
VALUES ('garryamelia6265@gmail.com', 'Garry Amelia', '+1 (555) 019-2834', 'admin', 'approved', true)
ON CONFLICT (email) DO UPDATE SET role = 'admin', status = 'approved';

-- 3. Live Visitors Tracking Table
CREATE TABLE IF NOT EXISTS visitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_slug TEXT NOT NULL DEFAULT 'teals-crm',
    visitor_token TEXT UNIQUE NOT NULL,
    ip_address TEXT,
    country TEXT DEFAULT 'Unknown',
    country_code TEXT DEFAULT 'UN',
    city TEXT DEFAULT 'Unknown',
    referrer TEXT DEFAULT 'Direct',
    current_page TEXT DEFAULT '/',
    browser TEXT DEFAULT 'Chrome',
    os TEXT DEFAULT 'Windows',
    device TEXT DEFAULT 'Desktop',
    is_online BOOLEAN DEFAULT true,
    last_active_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Conversations (Chat Sessions)
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_slug TEXT NOT NULL DEFAULT 'teals-crm',
    visitor_id UUID REFERENCES visitors(id) ON DELETE CASCADE,
    visitor_name TEXT DEFAULT 'Visitor',
    visitor_email TEXT,
    visitor_phone TEXT,
    assigned_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    assigned_agent_name TEXT,
    mode TEXT NOT NULL DEFAULT 'ai', -- 'ai' or 'human'
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'pending_agent', 'resolved', 'closed'
    typing_preview TEXT DEFAULT '',
    unread_agent_count INTEGER DEFAULT 0,
    unread_visitor_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL, -- 'visitor', 'ai', 'agent', 'system'
    sender_name TEXT NOT NULL,
    content TEXT NOT NULL,
    is_whisper BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for high-speed queries
CREATE INDEX IF NOT EXISTS idx_visitors_property ON visitors(property_slug);
CREATE INDEX IF NOT EXISTS idx_visitors_online ON visitors(is_online, last_active_at);
CREATE INDEX IF NOT EXISTS idx_conversations_visitor ON conversations(visitor_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

-- Enable Realtime publication for live socket updates
ALTER PUBLICATION supabase_realtime ADD TABLE visitors;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE agents;
