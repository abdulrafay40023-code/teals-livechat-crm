import { NextRequest, NextResponse } from 'next/server';
import { granularStore, StoreAgent } from '@/lib/store';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CRM_SUPABASE_URL = "https://nyjhbeqpjfdhhvqvjzyy.supabase.co";
const CRM_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTAyMTgsImV4cCI6MjEwMTU4NjIxOH0.dng1sTshSzApFQia9YPkGsaBiiwWSJYduX_bAl5asPM";

const crmSupabase = createClient(CRM_SUPABASE_URL, CRM_SUPABASE_KEY);

const ADMIN_EMAILS = [
  'garryamelia6265@gmail.com',
  'tzafar04@gmail.com',
  'annusraees@gmail.com'
];

export async function GET(req: NextRequest) {
  try {
    // 1. Fetch live registered profiles directly from CRM Supabase
    const { data: crmProfiles } = await crmSupabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });

    // Seed default 3 main Admins
    const adminMap = new Map<string, StoreAgent>([
      ['garryamelia6265@gmail.com', {
        id: 'agent_garry_admin',
        full_name: 'Garry Amelia',
        email: 'garryamelia6265@gmail.com',
        role: 'admin',
        status: 'approved',
        is_online: true,
        last_seen_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }],
      ['tzafar04@gmail.com', {
        id: 'agent_tzafar_admin',
        full_name: 'T Zafar',
        email: 'tzafar04@gmail.com',
        role: 'admin',
        status: 'approved',
        is_online: true,
        last_seen_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }],
      ['annusraees@gmail.com', {
        id: 'agent_annus_admin',
        full_name: 'Annus Raees',
        email: 'annusraees@gmail.com',
        role: 'admin',
        status: 'approved',
        is_online: true,
        last_seen_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }]
    ]);

    const workingAgentMap = new Map<string, StoreAgent>();

    if (Array.isArray(crmProfiles)) {
      crmProfiles.forEach(p => {
        if (!p.email) return;
        const cleanEmail = p.email.toLowerCase().trim();
        const isAdm = ADMIN_EMAILS.includes(cleanEmail) || p.role === 'admin';

        let isApproved = isAdm;
        if (p.avatar_url) {
          try {
            const parsed = typeof p.avatar_url === 'string' ? JSON.parse(p.avatar_url) : p.avatar_url;
            if (typeof parsed?.approved === 'boolean') {
              isApproved = parsed.approved;
            }
          } catch {}
        }

        // Only include approved agents
        if (!isApproved) return;

        const agentObj: StoreAgent = {
          id: p.id || `agent_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
          full_name: p.full_name || cleanEmail.split('@')[0],
          email: cleanEmail,
          role: isAdm ? 'admin' : 'agent',
          status: 'approved',
          is_online: true,
          last_seen_at: p.created_at || new Date().toISOString(),
          created_at: p.created_at || new Date().toISOString()
        };

        if (isAdm) {
          adminMap.set(cleanEmail, agentObj);
        } else {
          workingAgentMap.set(cleanEmail, agentObj);
        }
      });
    }

    const approvedAgents = [
      ...Array.from(adminMap.values()),
      ...Array.from(workingAgentMap.values())
    ];
    const onlineAgents = approvedAgents.filter(a => a.is_online);

    return NextResponse.json({
      pendingAgents: [],
      approvedAgents,
      onlineAgents,
      totalAgents: approvedAgents.length
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { agentId, agentEmail, action } = await req.json();
    const cleanId = (agentId || '').trim();
    const cleanEmail = (agentEmail || '').toLowerCase().trim();

    let targetAgent = (cleanEmail ? await granularStore.getAgent(cleanEmail) : null) || 
                      (cleanId ? await granularStore.getAgent(cleanId) : null);

    if (!targetAgent) {
      const allAgents = await granularStore.getAllAgents();
      targetAgent = allAgents.find(a => 
        (cleanEmail && a.email && a.email.toLowerCase() === cleanEmail) ||
        (cleanId && a.id && a.id === cleanId) || 
        (cleanId && a.email && a.email.toLowerCase() === cleanId.toLowerCase())
      );
    }

    const { ADMIN_EMAILS } = await import('@/lib/store');

    if (action === 'remove' || action === 'reject') {
      if (targetAgent) {
        const isTargetAdmin = ADMIN_EMAILS.includes(targetAgent.email.toLowerCase()) || targetAgent.role === 'admin';
        if (isTargetAdmin) {
          return NextResponse.json({ error: 'Administrators cannot be removed' }, { status: 400 });
        }
      }

      // Delete by email and id from memory and Supabase storage
      const emailToDelete = targetAgent?.email || cleanEmail;
      const idToDelete = targetAgent?.id || cleanId;

      if (emailToDelete) await granularStore.deleteAgent(emailToDelete);
      if (idToDelete && idToDelete !== emailToDelete) await granularStore.deleteAgent(idToDelete);

      try {
        const { supabaseAdmin } = await import('@/lib/supabase');
        if (emailToDelete) await supabaseAdmin.from('agents').delete().eq('email', emailToDelete);
        if (idToDelete) await supabaseAdmin.from('agents').delete().eq('id', idToDelete);
      } catch {}

      await Promise.all([
        broadcastRealtimeEvent('agent_rejected', {
          agentId: idToDelete,
          agentEmail: emailToDelete
        }),
        broadcastRealtimeEvent('agent_removed', {
          agentId: idToDelete,
          agentEmail: emailToDelete
        })
      ]).catch(() => {});

      return NextResponse.json({
        success: true,
        message: 'Agent removed/rejected successfully',
        agentId: idToDelete,
        agentEmail: emailToDelete
      });
    }

    if (action === 'approve') {
      if (!targetAgent) {
        if (cleanEmail) {
          targetAgent = {
            id: cleanId || `agent_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
            email: cleanEmail,
            full_name: cleanEmail.split('@')[0],
            role: 'agent',
            status: 'approved',
            is_online: true,
            last_seen_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          };
        } else {
          return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }
      }

      targetAgent.status = 'approved';
      targetAgent.is_online = true;
      targetAgent.last_seen_at = new Date().toISOString();
      await granularStore.saveAgent(targetAgent);

      broadcastRealtimeEvent('agent_approved', {
        agentId: targetAgent.id,
        agentEmail: targetAgent.email,
        agent: targetAgent
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        agent: targetAgent
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
