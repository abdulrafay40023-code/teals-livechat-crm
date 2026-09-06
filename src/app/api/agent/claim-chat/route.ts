import { NextRequest, NextResponse } from 'next/server';
import { granularStore, StoreMessage } from '@/lib/store';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export async function POST(req: NextRequest) {
  try {
    const { conversationId, agentId: rawAgentId, agentName: rawAgentName, agentEmail, force = false } = await req.json();

    const agentName = rawAgentName || 'Support Agent';
    const agentId = rawAgentId || `agent_${(agentEmail || agentName).toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    if (!conversationId) {
      return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 });
    }

    let conv = await granularStore.getConversation(conversationId);
    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // ATOMIC RACE CONDITION CHECK: If already claimed by another agent, reject with 409 Conflict
    if (!force && conv.assigned_agent_id && conv.assigned_agent_id !== agentId) {
      return NextResponse.json({
        success: false,
        error: `This chat was just claimed by ${conv.assigned_agent_name}`,
        claimedBy: conv.assigned_agent_name,
        assignedAgentId: conv.assigned_agent_id
      }, { status: 409 });
    }

    const isTransfer = (!!conv.assigned_agent_name && conv.assigned_agent_name !== agentName) || force;
    const now = new Date().toISOString();
    conv.assigned_agent_id = agentId;
    conv.assigned_agent_name = agentName;
    conv.assigned_agent_email = agentEmail;
    conv.assigned_at = now;
    conv.mode = 'human';
    conv.status = 'active';
    const maxSeq = (conv.messages || []).reduce((max, m) => Math.max(max, m.seq || 0), 0);
    const sysMsg: StoreMessage = {
      id: 'msg_sys_claim_' + conv.id + '_' + Date.now(),
      conversation_id: conv.id,
      sender_type: 'system',
      sender_name: 'System',
      content: isTransfer
        ? `Chat transferred to Live Support Agent ${agentName}.`
        : `Live Support Agent ${agentName} has claimed and joined the conversation.`,
      is_whisper: false,
      seq: maxSeq + 1,
      created_at: now
    };

    if (!conv.messages) conv.messages = [];
    conv.messages = conv.messages.filter(m => !(m.sender_type === 'system' && (
      m.content.includes('has claimed and joined') ||
      m.content.includes('transferred to Live Support Agent') ||
      m.content.includes('Transferring to a live support agent') ||
      m.content.includes('taken over')
    )));
    conv.messages.push(sysMsg);

    await granularStore.saveConversation(conv);

    // Broadcast claim event to all connected dashboards
    await broadcastRealtimeEvent('chat_claimed', {
      conversationId: conv.id,
      agentId,
      agentName,
      conversation: conv
    });

    return NextResponse.json({
      success: true,
      conversation: conv
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
