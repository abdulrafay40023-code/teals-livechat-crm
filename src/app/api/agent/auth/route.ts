import { NextRequest, NextResponse } from 'next/server';
import { memoryStore, granularStore, StoreAgent, ADMIN_EMAILS } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { email, fullName, phone, pseudoName, roleTitle, action } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const isAdmin = ADMIN_EMAILS.includes(cleanEmail) || cleanEmail === (process.env.ADMIN_EMAIL || '').toLowerCase();

    // Direct fetch or auto-create with status 'approved'
    let agent = (await granularStore.getAgent(cleanEmail)) || memoryStore.agents.get(cleanEmail) || undefined;

    let agentId = 'agent_' + cleanEmail.replace(/[^a-z0-9]/g, '_');
    let defaultName = cleanEmail.split('@')[0];
    if (cleanEmail === 'garryamelia6265@gmail.com') {
      agentId = 'agent_garry_admin';
      defaultName = 'Garry Amelia';
    } else if (cleanEmail === 'tzafar04@gmail.com') {
      agentId = 'agent_tzafar_admin';
      defaultName = 'T Zafar';
    } else if (cleanEmail === 'annusraees@gmail.com') {
      agentId = 'agent_annus_admin';
      defaultName = 'Annus Raees';
    }

    // Try reading assigned_websites and pseudo_name from profiles table in Supabase
    let assigned_websites: string[] | undefined = undefined;
    let dbPseudo: string | undefined = undefined;
    let dbRoleTitle: string | undefined = undefined;
    try {
      const { crmSupabase } = await import('@/lib/crm-supabase');
      const { data: prof } = await crmSupabase.from('profiles').select('*').eq('email', cleanEmail).maybeSingle();
      if (prof?.avatar_url) {
        const parsed = JSON.parse(prof.avatar_url);
        if (Array.isArray(parsed.assigned_websites)) {
          assigned_websites = parsed.assigned_websites;
        }
        if (parsed.pseudo_name) dbPseudo = parsed.pseudo_name;
        if (parsed.role_title) dbRoleTitle = parsed.role_title;
      }
    } catch {}

    if (!agent) {
      const newAgent: StoreAgent = {
        id: agentId,
        email: cleanEmail,
        full_name: fullName || defaultName,
        pseudo_name: pseudoName || dbPseudo || fullName || defaultName,
        role_title: roleTitle || dbRoleTitle || (isAdmin ? 'Manager' : 'Support Specialist'),
        phone: phone || '+1 (555) 019-2834',
        role: isAdmin ? 'admin' : 'agent',
        assigned_websites: isAdmin ? ['all'] : assigned_websites,
        status: 'approved',
        is_online: true,
        last_seen_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      memoryStore.agents.set(cleanEmail, newAgent);
      try {
        await granularStore.saveAgent(newAgent);
      } catch {}

      return NextResponse.json({
        agent: newAgent,
        status: 'approved',
        isAdmin
      });
    }

    // Existing agent: Ensure they are approved & online
    agent.status = 'approved';
    agent.is_online = true;
    agent.last_seen_at = new Date().toISOString();
    if (isAdmin) agent.role = 'admin';
    if (assigned_websites) agent.assigned_websites = assigned_websites;
    if (fullName && fullName.trim()) agent.full_name = fullName.trim();
    if (phone && phone.trim()) agent.phone = phone.trim();
    if (pseudoName && pseudoName.trim()) agent.pseudo_name = pseudoName.trim();
    else if (!agent.pseudo_name && dbPseudo) agent.pseudo_name = dbPseudo;
    if (roleTitle && roleTitle.trim()) agent.role_title = roleTitle.trim();
    else if (!agent.role_title && dbRoleTitle) agent.role_title = dbRoleTitle;

    memoryStore.agents.set(cleanEmail, agent);
    try {
      await granularStore.saveAgent(agent);
    } catch {}

    return NextResponse.json({
      agent,
      status: 'approved',
      isAdmin
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
