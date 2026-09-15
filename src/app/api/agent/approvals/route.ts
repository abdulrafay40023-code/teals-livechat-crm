import { NextRequest, NextResponse } from 'next/server';
import { granularStore } from '@/lib/store';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const allAgents = await granularStore.getAllAgents();
    const pendingAgents = allAgents.filter(a => a.status === 'pending');
    const approvedAgents = allAgents.filter(a => a.status === 'approved');
    const onlineAgents = approvedAgents.filter(a => a.is_online);

    return NextResponse.json({
      pendingAgents,
      approvedAgents,
      onlineAgents,
      totalAgents: allAgents.length
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
