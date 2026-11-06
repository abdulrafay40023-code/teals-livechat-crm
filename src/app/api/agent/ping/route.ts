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

    let defaultName = cleanEmail.split('@')[0];
    let defaultId = 'agent_' + cleanEmail.replace(/[^a-z0-9]/g, '_');
    if (cleanEmail === 'garryamelia6265@gmail.com') {
      defaultName = 'Garry Amelia';
      defaultId = 'agent_garry_admin';
    } else if (cleanEmail === 'tzafar04@gmail.com') {
      defaultName = 'T Zafar';
      defaultId = 'agent_tzafar_admin';
    } else if (cleanEmail === 'annusraees@gmail.com') {
      defaultName = 'Annus Raees';
      defaultId = 'agent_annus_admin';
    }

    let agent = (await granularStore.getAgent(cleanEmail)) || granularStore.agents.get(cleanEmail) || undefined;

    if (!agent) {
      agent = {
        id: defaultId,
        email: cleanEmail,
        full_name: fullName || defaultName,
        phone: phone || '+1 (555) 019-2834',
        role: isAdmin ? 'admin' : (role || 'agent'),
        status: 'approved',
        is_online: true,
        last_seen_at: nowIso,
        created_at: nowIso
      };
    } else {
      agent.status = 'approved';
      agent.is_online = true;
      agent.last_seen_at = nowIso;
      if (isAdmin) {
        agent.role = 'admin';
      }
      if (fullName && fullName.trim()) agent.full_name = fullName.trim();
    }

    await granularStore.saveAgent(agent);

    return NextResponse.json({ success: true, agent, status: 'approved' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
