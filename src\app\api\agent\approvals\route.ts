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
    const { agentId, action } = await req.json();

    const allAgents = await granularStore.getAllAgents();
    const targetAgent = allAgents.find(a => a.id === agentId || a.email.toLowerCase() === (agentId || '').toLowerCase());
    if (!targetAgent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const { ADMIN_EMAILS } = await import('@/lib/store');
    const isTargetAdmin = ADMIN_EMAILS.includes(targetAgent.email.toLowerCase()) || targetAgent.role === 'admin';

    if (action === 'remove') {
      if (isTargetAdmin) {
        return NextResponse.json({ error: 'Administrators cannot be removed' }, { status: 400 });
      }
      targetAgent.status = 'rejected';
      targetAgent.is_online = false;
      await granularStore.saveAgent(targetAgent);

      broadcastRealtimeEvent('agent_removed', {
        agentId: targetAgent.id,
        agentEmail: targetAgent.email
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: `${targetAgent.full_name} removed. Re-approval required to rejoin.`,
        agent: targetAgent
      });
    }

    if (action === 'approve') {
      targetAgent.status = 'approved';
      targetAgent.is_online = true;
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

    if (action === 'reject') {
      targetAgent.status = 'rejected';
      targetAgent.is_online = false;
      await granularStore.saveAgent(targetAgent);

      broadcastRealtimeEvent('agent_rejected', {
        agentId: targetAgent.id,
        agentEmail: targetAgent.email
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        agent: targetAgent
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
