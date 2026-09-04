import { NextRequest, NextResponse } from 'next/server';
import { granularStore } from '@/lib/store';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export async function GET() {
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
    const targetAgent = allAgents.find(a => a.id === agentId);
    if (targetAgent) {
      targetAgent.status = action === 'approve' ? 'approved' : 'rejected';
      await granularStore.saveAgent(targetAgent);

      if (action === 'approve') {
        broadcastRealtimeEvent('agent_approved', {
          agentId: targetAgent.id,
          agentEmail: targetAgent.email,
          agent: targetAgent
        }).catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      agent: targetAgent
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
