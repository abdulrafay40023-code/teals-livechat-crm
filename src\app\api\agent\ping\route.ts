import { NextRequest, NextResponse } from 'next/server';
import { granularStore, StoreAgent } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const { email, fullName, phone, role = 'agent' } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const isAdmin = cleanEmail === 'garryamelia6265@gmail.com' || role === 'admin';
    const nowIso = new Date().toISOString();

    let agent = granularStore.agents.get(cleanEmail);
    if (!agent) {
      agent = {
        id: 'agent_' + Math.random().toString(36).substring(2, 9),
        email: cleanEmail,
        full_name: fullName || (cleanEmail === 'garryamelia6265@gmail.com' ? 'Garry Amelia' : 'Abdul Rafay'),
        phone: phone || '+1 (555) 019-2834',
        role: isAdmin ? 'admin' : 'agent',
        status: 'approved',
        is_online: true,
        last_seen_at: nowIso,
        created_at: nowIso
      };
    } else {
      agent.is_online = true;
      agent.last_seen_at = nowIso;
      if (fullName) agent.full_name = fullName;
    }

    await granularStore.saveAgent(agent);

    return NextResponse.json({ success: true, agent });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
