import { NextRequest, NextResponse } from 'next/server';
import { granularStore, StoreAgent, ADMIN_EMAILS } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const { email, fullName, phone, role = 'agent' } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const isAdmin = ADMIN_EMAILS.includes(cleanEmail);
    const nowIso = new Date().toISOString();

    let defaultName = 'Abdul Rafay';
    let defaultId = 'agent_' + Math.random().toString(36).substring(2, 9);
    if (cleanEmail === 'garryamelia6265@gmail.com') {
      defaultName = 'Garry Amelia';
      defaultId = 'agent_garry_admin';
    } else if (cleanEmail === 'tzafar04@gmail.com') {
      defaultName = 'T Zafar';
      defaultId = 'agent_tzafar_admin';
    } else if (cleanEmail === 'annusraees@gmail.com') {
      defaultName = 'Annus Raees';
      defaultId = 'agent_annus_admin';
    } else if (cleanEmail === 'jennifer.cisternino2027@gmail.com') {
      defaultName = 'Murtuza Mehdi';
      defaultId = 'agent_25mowqm';
    }

    // Check if agent was explicitly rejected/removed
    const isRejected = await granularStore.isAgentRejected(cleanEmail);
    if (isRejected && !isAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Agent access revoked by administrator',
        status: 'rejected'
      }, { status: 403 });
    }

    let agent = (await granularStore.getAgent(cleanEmail)) || granularStore.agents.get(cleanEmail) || undefined;

    if (!agent) {
      agent = {
        id: defaultId,
        email: cleanEmail,
        full_name: fullName || defaultName || cleanEmail.split('@')[0],
        phone: phone || '+1 (555) 019-2834',
        role: isAdmin ? 'admin' : (role || 'agent'),
        status: 'approved',
        is_online: true,
        last_seen_at: nowIso,
        created_at: nowIso
      };
    } else {
      agent.is_online = true;
      agent.last_seen_at = nowIso;
      if (isAdmin) {
        agent.role = 'admin';
        agent.status = 'approved';
      } else if (agent.status !== 'rejected') {
        agent.status = 'approved';
      }
      if (fullName) agent.full_name = fullName;
    }

    await granularStore.saveAgent(agent);

    return NextResponse.json({ success: true, agent, status: agent.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
