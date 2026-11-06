import { NextRequest, NextResponse } from 'next/server';
import { granularStore, StoreMessage, StoreConversation, isStaffOrAdmin, isStaffOrAdminAsync } from '@/lib/store';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { dispatchWebPushForRealtimeEvent } from '@/lib/web-push';
import { isHumanHandoffRequested, generateAIChatResponse, sanitizeEmDashes } from '@/lib/gemini';
import { getWebsiteConfig, detectWebsiteSlugFromUrl } from '@/lib/websites-config';

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
  const visitorToken = searchParams.get('visitorToken');
  const email = searchParams.get('email');

  const headers = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Access-Control-Allow-Origin': '*'
  };

  const serverResetAt = await granularStore.getLastResetAtAsync();

  // 1. If conversationId is specified, ALWAYS return that exact conversation
  if (conversationId) {
    await granularStore.ensureStorageLoaded();
    const isDeleted = granularStore.isConversationDeleted(conversationId);
    const conv = await granularStore.getConversation(conversationId);
    return NextResponse.json({
      conversation: conv,
      messages: conv?.messages || [],
      isDeleted: Boolean(isDeleted || (!conv && granularStore.isConversationDeleted(conversationId))),
      serverResetAt: granularStore.getLastResetAt() || serverResetAt
    }, { headers });
  }

  // 2. Only if no conversationId was provided, query conversations list for visitor
  if (visitorToken || email) {
    const list = await granularStore.getConversationsByVisitor(visitorToken || '', email || undefined);
    return NextResponse.json({
      conversations: list,
      count: list.length,
      serverResetAt: granularStore.getLastResetAt() || serverResetAt
    }, { headers });
  }

  return NextResponse.json({ error: 'Missing conversationId or visitorToken', serverResetAt }, { status: 400, headers });
}

export async function POST(req: NextRequest) {
  try {
    const {
      id: clientMsgId,
      conversationId,
      visitorToken,
      propertySlug,
      pageUrl,
      referrerUrl,
      senderType,
      senderName,
      senderEmail,
      senderPhone,
      senderPseudoName,
      senderRoleTitle,
      assignedAgentName,
      assignedAgentPseudoName,
      assignedAgentRoleTitle,
      content,
      isWhisper = false,
      isHumanConnected = false,
      chatNumber,
      is_form = false,
      form_type,
      form_data
    } = await req.json();

    if (!content || !senderType) {
      return NextResponse.json({ error: 'Missing content or senderType' }, { status: 400 });
    }

    // Allow all visitors and test users to chat freely

    const refererHeader = req.headers.get('referer');
    const effectiveSlug = (propertySlug && propertySlug !== 'teals-crm')
      ? propertySlug
      : detectWebsiteSlugFromUrl(pageUrl || refererHeader);
    const siteConfig = getWebsiteConfig(effectiveSlug);

    const hasExplicitConvId = Boolean(conversationId && !conversationId.startsWith('vis_'));
    const convId = hasExplicitConvId 
      ? conversationId! 
      : (visitorToken && visitorToken.startsWith('conv_') ? visitorToken : ('conv_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36)));

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
    // ONLY fall back to existing conversations if client DID NOT specify an explicit conversationId (or if conversationId was a visitor token)
    if (!conv && !hasExplicitConvId && visitorToken) {
      const existingConvs = await granularStore.getConversationsByVisitor(visitorToken, undefined);
      if (existingConvs.length > 0) {
        if (chatNumber === 2 || chatNumber === '2') {
          conv = existingConvs.find((c: any) => c.chat_number === 2) || undefined;
        } else {
          conv = existingConvs.find((c: any) => c.chat_number !== 2) || existingConvs[0];
        }
      }
    }
    const now = new Date().toISOString();

    // STRICT HUMAN CONVERSATION CHECK: If claimed, has agent, or agent ever replied, it is 100% HUMAN!
    const hasAgentAssigned = !!(conv?.assigned_agent_id || conv?.assigned_agent_name || assignedAgentName || (senderType === 'agent'));
    const hasAgentMessages = (conv?.messages || []).some(m => m.sender_type === 'agent') || (senderType === 'agent');
    const hasClaimSystemMsg = (conv?.messages || []).some(m => m.sender_type === 'system' && m.content.includes('claimed and joined'));
    const isHumanMode = conv?.mode === 'human' || isHumanConnected || hasAgentAssigned || hasAgentMessages || hasClaimSystemMsg;

    let isBrandNewConv = false;

    if (!conv) {
      isBrandNewConv = true;
      let inheritedName = '';
      let inheritedEmail = '';
      let inheritedPhone = '';

      // Strict 2-chat limit per visitor session to prevent spam & abuse
      let existingList: any[] = [];
      if (visitorToken) {
        existingList = await granularStore.getConversationsByVisitor(visitorToken, undefined);
        if (existingList.length >= 2) {
          return NextResponse.json({
            error: 'Maximum 2 conversations allowed per visitor.',
            limitReached: true,
            serverResetAt: granularStore.getLastResetAt()
          }, { status: 400 });
        }
        if (existingList.length > 0) {
          const prev = existingList[0];
          if (prev.visitor_name && prev.visitor_name !== 'Visitor' && prev.visitor_name !== 'System' && prev.visitor_name !== 'Live Visitor') {
            inheritedName = prev.visitor_name;
          }
          if (prev.visitor_email) {
            inheritedEmail = prev.visitor_email;
          }
          if (prev.visitor_phone) {
            inheritedPhone = prev.visitor_phone;
          }
        }
      }

      const explicitChatNum = (chatNumber === 2 || chatNumber === '2') ? 2 : (chatNumber === 1 || chatNumber === '1') ? 1 : undefined;
      const initialVisitorName = senderType === 'visitor' 
        ? (senderName && senderName !== 'System' && senderName !== 'Visitor' ? senderName : (inheritedName || 'Visitor'))
        : (inheritedName || 'Live Visitor');

      const initialVisitorEmail = senderType === 'visitor' 
        ? (senderEmail || inheritedEmail || undefined)
        : (inheritedEmail || undefined);

      const initialVisitorPhone = senderType === 'visitor'
        ? (senderPhone || inheritedPhone || undefined)
        : (inheritedPhone || undefined);

      conv = {
        id: convId,
        property_slug: effectiveSlug,
        visitor_id: visitorToken || convId,
        visitor_name: initialVisitorName,
        visitor_email: initialVisitorEmail,
        visitor_phone: initialVisitorPhone,
        chat_number: explicitChatNum || 1,
        mode: isHumanMode ? 'human' : 'ai',
        status: isHumanMode ? (hasAgentAssigned ? 'active' : 'pending_agent') : 'active',
        assigned_agent_name: assignedAgentName || (senderType === 'agent' ? senderName : undefined),
        created_at: now,
        updated_at: now,
        messages: [
          {
            id: 'init-greet',
            conversation_id: convId,
            sender_type: 'ai',
            sender_name: `${siteConfig.shortName} AI Assistant`,
            content: 'Hey how can i help you ?',
            is_whisper: false,
            seq: 1,
            created_at: now
          }
        ]
      };
    } else {
      if (chatNumber === 2 || chatNumber === '2') {
        (conv as any).chat_number = 2;
      } else if (chatNumber === 1 || chatNumber === '1') {
        if (!(conv as any).chat_number) {
          (conv as any).chat_number = 1;
        }
      }
      if (!conv.property_slug || conv.property_slug === 'teals-crm') {
        if (effectiveSlug && effectiveSlug !== 'teals-crm') {
          conv.property_slug = effectiveSlug;
        }
      }
      if (isHumanMode) {
        conv.mode = 'human';
        if (assignedAgentName && !conv.assigned_agent_name) conv.assigned_agent_name = assignedAgentName;
        if (!conv.status) conv.status = hasAgentAssigned ? 'active' : 'pending_agent';
      }
      if (senderType === 'visitor') {
        if (senderName && senderName !== 'Visitor' && senderName !== 'You' && senderName !== 'System') {
          conv.visitor_name = senderName;
        }
        if (senderEmail) conv.visitor_email = senderEmail;
        if (senderPhone) conv.visitor_phone = senderPhone;
      } else if (senderType === 'agent') {
        if (assignedAgentName || senderName) {
          conv.assigned_agent_name = assignedAgentName || senderName;
        }
        if (assignedAgentPseudoName || senderPseudoName) {
          conv.assigned_agent_pseudo_name = assignedAgentPseudoName || senderPseudoName;
        }
        if (assignedAgentRoleTitle || senderRoleTitle) {
          conv.assigned_agent_role_title = assignedAgentRoleTitle || senderRoleTitle;
        }
        if (!conv.visitor_name || conv.visitor_name === 'Garry Amelia' || conv.visitor_name === 'System') {
          conv.visitor_name = 'Live Visitor';
        }
      }
    }

    // Resolve client IP and bind visitor session info (IP, city, country, flag) strictly to conversation
    let clientIp =
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-real-ip') ||
      req.headers.get('x-client-ip') ||
      req.headers.get('x-forwarded-for') ||
      req.headers.get('fastly-client-ip') ||
      req.headers.get('true-client-ip') ||
      '';
    if (clientIp.includes(',')) clientIp = clientIp.split(',')[0].trim();
    clientIp = clientIp.trim();
    if (clientIp === '::1' || clientIp === '127.0.0.1') clientIp = '';

    const session = conv.visitor || 
      (visitorToken ? await granularStore.getSession(visitorToken) : null) ||
      (conv.visitor_id ? await granularStore.getSession(conv.visitor_id) : null) ||
      (conv.id ? await granularStore.getSession(conv.id) : null) ||
      Array.from(granularStore.sessionCache.values()).find(s => 
        (visitorToken && (s.visitor_token === visitorToken || s.id === visitorToken)) ||
        (conv.visitor_id && (s.visitor_token === conv.visitor_id || s.id === conv.visitor_id)) ||
        s.id === conv.id ||
        s.visitor_token === conv.id ||
        (clientIp && s.ip_address === clientIp)
      );

    if (session) {
      conv.visitor = session;
      conv.visitor_ip = session.ip_address;
    } else if (clientIp && !conv.visitor_ip) {
      conv.visitor_ip = clientIp;
    }

    const isFirstVisitorMsg = senderType === 'visitor' && (!conv.messages || conv.messages.filter(m => m.sender_type === 'visitor').length === 0);

    const maxSeq = (conv.messages || []).reduce((max, m) => Math.max(max, m.seq || 0), 0);
    const newMsg: StoreMessage = {
      id: clientMsgId || ('msg_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36)),
      conversation_id: conv.id,
      sender_type: senderType,
      sender_name: senderName || (senderType === 'visitor' ? 'Visitor' : 'Agent'),
      sender_pseudo_name: senderPseudoName || (senderType === 'agent' ? conv.assigned_agent_pseudo_name : undefined),
      sender_role_title: senderRoleTitle || (senderType === 'agent' ? conv.assigned_agent_role_title : undefined),
      sender_real_name: senderType === 'agent' ? (senderName || conv.assigned_agent_name) : undefined,
      content: content,
      is_whisper: isWhisper,
      seq: maxSeq + 1,
      created_at: now,
      is_form: Boolean(is_form),
      form_type: form_type || undefined,
      form_data: form_data || undefined
    };

    if (!conv.messages) conv.messages = [];
    const exists = conv.messages.some(m => m.id === newMsg.id);
    if (!exists) {
      conv.messages.push(newMsg);
    }
    conv.updated_at = now;
    conv.typing_preview = '';

    const isAlreadyHandledByHuman = isHumanMode || hasAgentAssigned || hasAgentMessages || hasClaimSystemMsg;
    const humanRequested = senderType === 'visitor' && isHumanHandoffRequested(content) && !isAlreadyHandledByHuman;

    // CASE 1: Visitor requested fresh human handoff (AI -> Human transition)
    if (humanRequested && !isAlreadyHandledByHuman) {
      console.log('[CHAT_DEBUG] Visitor explicitly requested human handoff:', content);
      conv.mode = 'human';
      conv.status = 'pending_agent';
      conv.assigned_agent_id = undefined;
      conv.assigned_agent_name = undefined;
      conv.assigned_agent_email = undefined;
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

      const handoffPayload = {
        conversationId: conv.id,
        message: newMsg,
        systemMessage: handoffSystemMsg,
        conversation: conv,
        isHandoffRequested: true
      };
      await Promise.all([
        broadcastRealtimeEvent('chat_message', handoffPayload),
        dispatchWebPushForRealtimeEvent('chat_message', handoffPayload),
        broadcastRealtimeEvent('new_conversation', {
          conversationId: conv.id,
          conversation: conv
        }),
        granularStore.saveConversation(conv)
      ]);

      return NextResponse.json({
        success: true,
        message: newMsg,
        conversation: conv,
        conversationId: conv.id,
        serverResetAt: granularStore.getLastResetAt()
      });
    }

    // CASE 2: AI Mode with Visitor message - STRICTLY ONLY IF NO HUMAN AGENT IS INVOLVED!
    const isStrictlyAi = conv.mode === 'ai' && !isHumanMode && !hasAgentAssigned && !hasAgentMessages && !hasClaimSystemMsg && conv.status !== 'pending_agent';

    if (isStrictlyAi && senderType === 'visitor') {
      conv.last_visitor_message_at = now;

      const aiVisitorPayload = {
        conversationId: conv.id,
        message: newMsg,
        conversation: conv,
        isHandoffRequested: false
      };
      // 1. Broadcast visitor message instantly in parallel with storage
      await Promise.all([
        broadcastRealtimeEvent('chat_message', aiVisitorPayload),
        dispatchWebPushForRealtimeEvent('chat_message', aiVisitorPayload),
        (isFirstVisitorMsg || isBrandNewConv) ? broadcastRealtimeEvent('new_conversation', {
          conversationId: conv.id,
          conversation: conv
        }) : Promise.resolve(),
        granularStore.saveConversation(conv)
      ]);

      // 2. Generate AI response in background
      const historyForAI = conv.messages
        .filter(m => m.sender_type === 'visitor' || m.sender_type === 'ai')
        .map(m => ({
          role: (m.sender_type === 'visitor' ? 'user' : 'model') as 'user' | 'model',
          content: m.content
        }));

      const activeSlug = conv.property_slug || effectiveSlug || 'teals-crm';
      const activeSiteConfig = getWebsiteConfig(activeSlug);

      const aiRes = await generateAIChatResponse({
        messages: historyForAI,
        visitorName: conv.visitor_name,
        property: activeSlug
      });

      // Reload fresh conversation state from store
      const freshConv = await granularStore.getConversation(conv.id) || conv;

      // If user switched to human or handoff occurred while AI was computing, discard stale AI message
      if (
        freshConv.mode === 'human' ||
        freshConv.status === 'pending_agent' ||
        !!freshConv.assigned_agent_id ||
        !!freshConv.assigned_agent_name ||
        (freshConv.messages || []).some(m => m.sender_type === 'agent') ||
        (freshConv.messages || []).some(m => m.sender_type === 'system' && (
          m.content.includes('claimed') ||
          m.content.includes('Transferring to a live support agent') ||
          m.content.includes('Real Agent')
        ))
      ) {
        return NextResponse.json({
          success: true,
          message: newMsg,
          conversation: freshConv,
          conversationId: freshConv.id
        });
      }

      const replyItems: Array<{ text: string; isForm?: boolean; formType?: 'booking' }> =
        (aiRes.messages && aiRes.messages.length > 0)
          ? aiRes.messages
          : [{ text: aiRes.text, isForm: aiRes.isForm, formType: aiRes.formType }];

      const baseSeq = (freshConv.messages || []).reduce((max, m) => Math.max(max, m.seq || 0), 0);
      const baseTime = Date.now();
      const createdAiMsgs: StoreMessage[] = [];

      for (let i = 0; i < replyItems.length; i++) {
        const item = replyItems[i];
        const aiMsgId = 'msg_' + Math.random().toString(36).substring(2, 10) + '_' + (baseTime + i * 500).toString(36) + '_' + i;
        const aiMsg: StoreMessage = {
          id: aiMsgId,
          conversation_id: freshConv.id,
          sender_type: 'ai',
          sender_name: `${activeSiteConfig.shortName} AI Assistant`,
          content: sanitizeEmDashes(item.text),
          is_whisper: false,
          seq: baseSeq + i + 1,
          created_at: new Date(baseTime + i * 500).toISOString(),
          is_form: Boolean(item.isForm),
          form_type: item.formType || undefined
        };
        freshConv.messages.push(aiMsg);
        createdAiMsgs.push(aiMsg);
      }
      freshConv.updated_at = new Date(baseTime + (replyItems.length - 1) * 500).toISOString();

      let handoffSysMsg: StoreMessage | undefined;
      if (aiRes.handoffRequired) {
        freshConv.mode = 'human';
        freshConv.status = 'pending_agent';
        handoffSysMsg = {
          id: 'msg_sys_handoff_' + freshConv.id,
          conversation_id: freshConv.id,
          sender_type: 'system',
          sender_name: 'System',
          content: 'Transferring to a live support agent. Please hold on...',
          is_whisper: false,
          seq: baseSeq + replyItems.length + 1,
          created_at: new Date(baseTime + replyItems.length * 500).toISOString()
        };
        freshConv.messages.push(handoffSysMsg);
      }

      await Promise.all([
        ...createdAiMsgs.map((m, idx) => {
          const isLast = idx === createdAiMsgs.length - 1;
          const aiReplyPayload = {
            conversationId: freshConv.id,
            message: m,
            systemMessage: isLast ? handoffSysMsg : undefined,
            conversation: freshConv,
            isHandoffRequested: Boolean(isLast && aiRes.handoffRequired)
          };
          return broadcastRealtimeEvent('chat_message', aiReplyPayload);
        }),
        aiRes.handoffRequired ? dispatchWebPushForRealtimeEvent('chat_message', {
          conversationId: freshConv.id,
          message: createdAiMsgs[createdAiMsgs.length - 1],
          systemMessage: handoffSysMsg,
          conversation: freshConv,
          isHandoffRequested: true
        }) : Promise.resolve(),
        broadcastRealtimeEvent('new_conversation', {
          conversationId: freshConv.id,
          conversation: freshConv
        }),
        granularStore.saveConversation(freshConv)
      ]);

      return NextResponse.json({
        success: true,
        message: newMsg,
        aiMessage: createdAiMsgs[0],
        aiMessages: createdAiMsgs,
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

    const msgPayload = {
      conversationId: conv.id,
      message: newMsg,
      conversation: conv,
      isHandoffRequested: false
    };
    await Promise.all([
      broadcastRealtimeEvent('chat_message', msgPayload),
      senderType === 'visitor' ? dispatchWebPushForRealtimeEvent('chat_message', msgPayload) : Promise.resolve(),
      (isFirstVisitorMsg || isBrandNewConv) ? broadcastRealtimeEvent('new_conversation', {
        conversationId: conv.id,
        conversation: conv
      }) : Promise.resolve(),
      granularStore.saveConversation(conv)
    ]);

    return NextResponse.json({
      success: true,
      message: newMsg,
      conversation: conv,
      conversationId: conv.id,
      serverResetAt: granularStore.getLastResetAt()
    });
  } catch (err: unknown) {
    console.error('[CHAT_DEBUG] Error in /api/chat/message:', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    let ids: string[] = [];

    if (conversationId) {
      ids = [conversationId];
    } else {
      try {
        const body = await request.json();
        if (Array.isArray(body?.conversationIds)) {
          ids = body.conversationIds.filter((id: any) => typeof id === 'string' && id.trim().length > 0);
        }
      } catch {}
    }

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Missing conversationId or conversationIds' }, { status: 400 });
    }

    if (ids.length === 1) {
      const conv = await granularStore.getConversation(ids[0]);
      const visitorToken = conv?.visitor_id || conv?.id;
      await granularStore.deleteConversation(ids[0]);
      await broadcastRealtimeEvent('chat_deleted', {
        conversationId: ids[0],
        visitorToken,
        visitorId: conv?.visitor_id
      });
    } else {
      for (const id of ids) {
        const conv = await granularStore.getConversation(id);
        const visitorToken = conv?.visitor_id || conv?.id;
        await broadcastRealtimeEvent('chat_deleted', {
          conversationId: id,
          visitorToken,
          visitorId: conv?.visitor_id
        });
      }
      await granularStore.deleteConversations(ids);
    }

    return NextResponse.json({ success: true, count: ids.length, deletedIds: ids });
  } catch (err: unknown) {
    console.error('[CHAT_DEBUG] Error in DELETE /api/chat/message:', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
