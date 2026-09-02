import { NextRequest, NextResponse } from 'next/server';
import { granularStore, StoreMessage, StoreConversation } from '@/lib/store';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { isHumanHandoffRequested, generateAIChatResponse } from '@/lib/gemini';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get('conversationId');

  if (!conversationId) {
    return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 });
  }

  const conv = await granularStore.getConversation(conversationId);
  return NextResponse.json({
    conversation: conv,
    messages: conv?.messages || []
  });
}

export async function POST(req: NextRequest) {
  try {
    const {
      id: clientMsgId,
      conversationId,
      visitorToken,
      propertySlug = 'teals-crm',
      senderType,
      senderName,
      senderEmail,
      content,
      isWhisper = false
    } = await req.json();

    if (!content || !senderType) {
      return NextResponse.json({ error: 'Missing content or senderType' }, { status: 400 });
    }

    const convId = conversationId || visitorToken || ('conv_' + Math.random().toString(36).substring(2, 9));

    // Keep visitor session alive when they send a message (prevents live count drop)
    if (senderType === 'visitor' && visitorToken) {
      try {
        const session = await granularStore.getSession(visitorToken);
        if (session) {
          session.last_active_at = new Date().toISOString();
          session.is_online = true;
          await granularStore.saveSession(session);
        }
      } catch {}
    }
    let conv = await granularStore.getConversation(convId);
    const now = new Date().toISOString();

    if (!conv) {
      conv = {
        id: convId,
        property_slug: propertySlug,
        visitor_id: visitorToken || convId,
        visitor_name: senderName || 'Visitor',
        visitor_email: senderEmail || undefined,
        mode: 'ai',
        status: 'active',
        created_at: now,
        updated_at: now,
        messages: [
          {
            id: 'init-greet',
            conversation_id: convId,
            sender_type: 'ai',
            sender_name: 'Teals AI Agent',
            content: "Hey! How can I help you with Teals CRM today?",
            is_whisper: false,
            seq: 1,
            created_at: now
          }
        ]
      };
    } else {
      if (senderName && senderName !== 'Visitor' && senderName !== 'You') conv.visitor_name = senderName;
      if (senderEmail) conv.visitor_email = senderEmail;
    }

    const isFirstVisitorMsg = senderType === 'visitor' && (!conv.messages || conv.messages.filter(m => m.sender_type === 'visitor').length === 0);

    const maxSeq = (conv.messages || []).reduce((max, m) => Math.max(max, m.seq || 0), 0);
    const newMsg: StoreMessage = {
      id: clientMsgId || ('msg_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36)),
      conversation_id: conv.id,
      sender_type: senderType,
      sender_name: senderName || (senderType === 'visitor' ? 'Visitor' : 'Agent'),
      content: content,
      is_whisper: isWhisper,
      seq: maxSeq + 1,
      created_at: now
    };

    if (!conv.messages) conv.messages = [];
    const exists = conv.messages.some(m => m.id === newMsg.id);
    if (!exists) {
      conv.messages.push(newMsg);
    }
    conv.updated_at = now;
    conv.typing_preview = '';

    const isAlreadyHandledByHuman = conv.mode === 'human' && (!!conv.assigned_agent_id || !!conv.assigned_agent_name);
    const humanRequested = senderType === 'visitor' && isHumanHandoffRequested(content) && !isAlreadyHandledByHuman;

    // CASE 1: Visitor requested fresh human handoff (AI -> Human transition)
    if (humanRequested) {
      console.log('[CHAT_DEBUG] Visitor explicitly requested human handoff:', content);
      conv.mode = 'human';
      conv.status = 'pending_agent';
      conv.last_visitor_message_at = now;

      const handoffSystemMsg: StoreMessage = {
        id: 'msg_sys_handoff_' + conv.id,
        conversation_id: conv.id,
        sender_type: 'system',
        sender_name: 'System',
        content: 'Transferring to a live support agent. Please hold on...',
        is_whisper: false,
        seq: newMsg.seq! + 1,
        created_at: new Date().toISOString()
      };
      
      conv.messages = conv.messages.filter(m => !(m.sender_type === 'system' && m.content.includes('Transferring to a live support agent')));
      conv.messages.push(handoffSystemMsg);

      await granularStore.saveConversation(conv);

      await Promise.all([
        broadcastRealtimeEvent('chat_message', {
          conversationId: conv.id,
          message: newMsg,
          systemMessage: handoffSystemMsg,
          conversation: conv,
          isHandoffRequested: true
        }),
        broadcastRealtimeEvent('new_conversation', {
          conversationId: conv.id,
          conversation: conv
        })
      ]);

      return NextResponse.json({
        success: true,
        message: newMsg,
        conversation: conv,
        conversationId: conv.id
      });
    }

    // CASE 2: AI Mode with Visitor message (Immediate visitor broadcast, background AI)
    if (conv.mode === 'ai' && senderType === 'visitor') {
      conv.last_visitor_message_at = now;

      // 1. Save visitor message to DB and broadcast immediately (sub-5ms)
      await granularStore.saveConversation(conv);

      await broadcastRealtimeEvent('chat_message', {
        conversationId: conv.id,
        message: newMsg,
        conversation: conv,
        isHandoffRequested: false
      });

      if (isFirstVisitorMsg) {
        await broadcastRealtimeEvent('new_conversation', {
          conversationId: conv.id,
          conversation: conv
        });
      }

      // 2. Generate AI response in background
      const historyForAI = conv.messages
        .filter(m => m.sender_type === 'visitor' || m.sender_type === 'ai')
        .map(m => ({
          role: (m.sender_type === 'visitor' ? 'user' : 'model') as 'user' | 'model',
          content: m.content
        }));

      const aiRes = await generateAIChatResponse({
        messages: historyForAI,
        visitorName: conv.visitor_name,
        property: 'Teals CRM'
      });

      // Reload fresh conversation state from store
      const freshConv = await granularStore.getConversation(conv.id) || conv;

      // If user switched to human while AI was computing, discard stale AI message
      if (freshConv.mode === 'human') {
        return NextResponse.json({
          success: true,
          message: newMsg,
          conversation: freshConv,
          conversationId: freshConv.id
        });
      }

      const freshMaxSeq = (freshConv.messages || []).reduce((max, m) => Math.max(max, m.seq || 0), 0);
      const aiMsg: StoreMessage = {
        id: 'msg_ai_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36),
        conversation_id: freshConv.id,
        sender_type: 'ai',
        sender_name: 'Teals AI Agent',
        content: aiRes.text,
        is_whisper: false,
        seq: freshMaxSeq + 1,
        created_at: new Date().toISOString()
      };

      freshConv.messages.push(aiMsg);
      freshConv.updated_at = new Date().toISOString();

      if (aiRes.handoffRequired) {
        freshConv.mode = 'human';
        freshConv.status = 'pending_agent';
      }

      await granularStore.saveConversation(freshConv);

      await broadcastRealtimeEvent('chat_message', {
        conversationId: freshConv.id,
        message: aiMsg,
        conversation: freshConv,
        isHandoffRequested: aiRes.handoffRequired
      });

      return NextResponse.json({
        success: true,
        message: newMsg,
        aiMessage: aiMsg,
        conversation: freshConv,
        conversationId: freshConv.id
      });
    }

    // CASE 3: Agent message or human mode visitor message
    if (senderType === 'agent') {
      conv.last_agent_reply_at = now;
      conv.mode = 'human';
    } else {
      conv.last_visitor_message_at = now;
    }

    await granularStore.saveConversation(conv);

    await broadcastRealtimeEvent('chat_message', {
      conversationId: conv.id,
      message: newMsg,
      conversation: conv,
      isHandoffRequested: false
    });

    if (isFirstVisitorMsg) {
      await broadcastRealtimeEvent('new_conversation', {
        conversationId: conv.id,
        conversation: conv
      });
    }

    return NextResponse.json({
      success: true,
      message: newMsg,
      conversation: conv,
      conversationId: conv.id
    });
  } catch (err: unknown) {
    console.error('[CHAT_DEBUG] Error in /api/chat/message:', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
