import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { memoryStore, granularStore, StoreAgent, ADMIN_EMAILS } from '@/lib/store';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { email, fullName, phone, action } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const isAdmin = ADMIN_EMAILS.includes(cleanEmail) || cleanEmail === (process.env.ADMIN_EMAIL || '').toLowerCase();

    // Check Cloud Storage & Memory Store (fresh check so Admin approvals are reflected immediately)
    let agent = (await granularStore.getAgent(cleanEmail)) || memoryStore.agents.get(cleanEmail) || undefined;

    if (action === 'complete_profile') {
      if (!fullName || !phone) {
        return NextResponse.json({ error: 'Full name and phone number required' }, { status: 400 });
      }

      let adminId = 'agent_' + Math.random().toString(36).substring(2, 9);
      if (cleanEmail === 'garryamelia6265@gmail.com') adminId = 'agent_garry_admin';
      else if (cleanEmail === 'tzafar04@gmail.com') adminId = 'agent_tzafar_admin';
      else if (cleanEmail === 'annusraees@gmail.com') adminId = 'agent_annus_admin';
      else if (cleanEmail === 'jennifer.cisternino2027@gmail.com') adminId = 'agent_25mowqm';

      const newAgent: StoreAgent = {
        id: adminId,
        email: cleanEmail,
        full_name: fullName,
        phone: phone,
        role: isAdmin ? 'admin' : 'agent',
        status: isAdmin ? 'approved' : 'pending',
        is_online: true,
        last_seen_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      memoryStore.agents.set(cleanEmail, newAgent);
      try {
        await granularStore.saveAgent(newAgent);
      } catch {}
      try {
        await supabaseAdmin.from('agents').upsert(newAgent);
      } catch {
        // Fallback
      }

      // Broadcast realtime notification to Admin if pending approval
      if (!isAdmin) {
        broadcastRealtimeEvent('agent_pending_approval', {
          agentName: newAgent.full_name,
          agentEmail: newAgent.email,
          agentPhone: newAgent.phone
        }).catch(() => {});
      }

      return NextResponse.json({
        agent: newAgent,
        status: newAgent.status,
        isAdmin: newAgent.role === 'admin'
      });
    }

    if (!agent) {
      if (isAdmin) {
        let name = 'Admin';
        let id = 'agent_admin';
        if (cleanEmail === 'garryamelia6265@gmail.com') {
          name = 'Garry Amelia';
          id = 'agent_garry_admin';
        } else if (cleanEmail === 'tzafar04@gmail.com') {
          name = 'T Zafar';
          id = 'agent_tzafar_admin';
        } else if (cleanEmail === 'annusraees@gmail.com') {
          name = 'Annus Raees';
          id = 'agent_annus_admin';
        } else if (cleanEmail === 'jennifer.cisternino2027@gmail.com') {
          name = 'Murtuza Mehdi';
          id = 'agent_25mowqm';
        }

        const adminAgent: StoreAgent = {
          id,
          email: cleanEmail,
          full_name: name,
          phone: '+1 (555) 019-2834',
          role: 'admin',
          status: 'approved',
          is_online: true,
          last_seen_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        };
        memoryStore.agents.set(cleanEmail, adminAgent);
        try {
          await granularStore.saveAgent(adminAgent);
        } catch {}

        return NextResponse.json({
          agent: adminAgent,
          status: 'approved',
          isAdmin: true
        });
      }

      return NextResponse.json({
        status: 'needs_profile',
        email: cleanEmail
      });
    }

    if (isAdmin) {
      agent.role = 'admin';
      agent.status = 'approved';
      agent.is_online = true;
      agent.last_seen_at = new Date().toISOString();
      await granularStore.saveAgent(agent);
      return NextResponse.json({
        agent,
        status: 'approved',
        isAdmin: true
      });
    }

    // If agent was removed/rejected or is pending, they cannot enter without Admin approval!
    if (agent.status === 'rejected' || agent.status === 'pending') {
      agent.status = 'pending';
      agent.is_online = false;
      agent.last_seen_at = new Date().toISOString();
      await granularStore.saveAgent(agent);

      broadcastRealtimeEvent('agent_pending_approval', {
        agentName: agent.full_name,
        agentEmail: agent.email,
        agentPhone: agent.phone
      }).catch(() => {});

      return NextResponse.json({
        agent,
        status: 'pending',
        isAdmin: false
      });
    }

    agent.is_online = true;
    agent.last_seen_at = new Date().toISOString();
    await granularStore.saveAgent(agent);

    return NextResponse.json({
      agent,
      status: agent.status,
      isAdmin: false
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
