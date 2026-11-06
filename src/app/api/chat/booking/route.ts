import { NextRequest, NextResponse } from 'next/server';
import { granularStore, StoreMessage } from '@/lib/store';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { dispatchWebPushForRealtimeEvent } from '@/lib/web-push';
import { getWebsiteConfig } from '@/lib/websites-config';
import { sendBookingConfirmationToVisitor, sendBookingAlertToAdmin } from '@/lib/email';
import { crmSupabase } from '@/lib/crm-supabase';

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

function getExactDateInTimezone(dateStr: string, timeStr: string, timeZone: string): Date {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hour, minute] = timeStr.split(':').map(Number);
    let target = new Date(Date.UTC(year, month - 1, day, hour || 0, minute || 0, 0));
    const targetMs = target.getTime();
    for (let i = 0; i < 3; i++) {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).formatToParts(target);
      const p: Record<string, string> = {};
      parts.forEach((pt) => { p[pt.type] = pt.value; });
      let h = parseInt(p.hour, 10);
      if (h === 24) h = 0;
      const localAsUtc = Date.UTC(
        parseInt(p.year, 10),
        parseInt(p.month, 10) - 1,
        parseInt(p.day, 10),
        h,
        parseInt(p.minute, 10),
        parseInt(p.second, 10)
      );
      const offset = localAsUtc - targetMs;
      target = new Date(target.getTime() - offset);
    }
    return target;
  } catch {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hour, minute] = timeStr.split(':').map(Number);
    return new Date(year, month - 1, day, hour || 0, minute || 0, 0);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      conversationId,
      visitorToken,
      propertySlug,
      name,
      email,
      phone,
      date,
      time,
      service = 'Amazon FBA & E-commerce Consultation',
      visitorTimezone = 'America/New_York',
      scheduledIso,
      pktTime: reqPktTime,
      pktDate: reqPktDate,
      clientTime: reqClientTime,
      clientDate: reqClientDate,
    } = body;

    if (!name || !email || !date || !time) {
      return NextResponse.json({ error: 'Missing required booking fields (name, email, date, time)' }, { status: 400 });
    }

    const finalClientTime = reqClientTime || time;
    const finalClientDate = reqClientDate || date;
    let finalScheduledIso = scheduledIso;
    let finalPktTime = reqPktTime;
    let finalPktDate = reqPktDate;

    // Ensure scheduledIso and accurate PKT conversion
    if (!finalScheduledIso && date && finalClientTime) {
      try {
        const timeVal = rawTime || (finalClientTime.includes(':') ? finalClientTime.split(' ')[0] : '13:00');
        const exactDate = getExactDateInTimezone(date, timeVal, visitorTimezone || 'America/New_York');
        finalScheduledIso = exactDate.toISOString();
      } catch {}
    }

    if (!finalPktTime && finalScheduledIso) {
      try {
        const dObj = new Date(finalScheduledIso);
        finalPktTime = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Karachi',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }).format(dObj);

        finalPktDate = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Karachi'
        }).format(dObj);
      } catch {}
    }

    finalPktTime = finalPktTime || finalClientTime;
    finalPktDate = finalPktDate || finalClientDate;

    const convId = conversationId || visitorToken;
    if (!convId) {
      return NextResponse.json({ error: 'Missing conversationId or visitorToken' }, { status: 400 });
    }

    let conv = await granularStore.getConversation(convId);
    if (!conv && visitorToken) {
      const list = await granularStore.getConversationsByVisitor(visitorToken);
      if (list && list.length > 0) conv = list[0];
    }

    const now = new Date().toISOString();
    const effectiveSlug = propertySlug || conv?.property_slug || 'amz-solutions-hub';
    const siteConfig = getWebsiteConfig(effectiveSlug);

    if (!conv) {
      conv = {
        id: convId,
        property_slug: effectiveSlug,
        visitor_id: visitorToken || convId,
        visitor_name: name,
        visitor_email: email,
        visitor_phone: phone,
        chat_number: 1,
        mode: 'ai',
        status: 'active',
        created_at: now,
        updated_at: now,
        messages: []
      };
    } else {
      conv.visitor_name = name;
      conv.visitor_email = email;
      if (phone) conv.visitor_phone = phone;
      conv.updated_at = now;
    }

    // Keep session updated
    if (visitorToken) {
      try {
        const session = await granularStore.getSession(visitorToken);
        if (session) {
          session.visitor_name = name;
          session.visitor_email = email;
          if (phone) session.visitor_phone = phone;
          session.last_active_at = now;
          await granularStore.saveSession(session);
        }
      } catch {}
    }

    if (!conv.messages) conv.messages = [];
    const maxSeq = conv.messages.reduce((max, m) => Math.max(max, m.seq || 0), 0);

    // 1. Visitor Form Submission Message
    const visitorSubmissionMsg: StoreMessage = {
      id: 'msg_form_sub_' + Math.random().toString(36).substring(2, 9),
      conversation_id: conv.id,
      sender_type: 'visitor',
      sender_name: name,
      content: `Form Submitted: Consultation Booking requested for ${finalPktDate} at ${finalPktTime} [PKT / Pakistan Time] (Client: ${finalClientDate} at ${finalClientTime} [${visitorTimezone.replace('_', ' ')}]) - ${service}`,
      seq: maxSeq + 1,
      created_at: now,
      form_data: {
        name,
        email,
        phone,
        date: finalClientDate,
        time: finalClientTime,
        service,
        visitorTimezone,
        pktDate: finalPktDate,
        pktTime: finalPktTime,
        scheduledIso: finalScheduledIso
      }
    };
    conv.messages.push(visitorSubmissionMsg);

    // 2. Automated AI / System Booking Confirmation Message
    const aiConfirmationMsg: StoreMessage = {
      id: 'msg_ai_confirm_' + Math.random().toString(36).substring(2, 9),
      conversation_id: conv.id,
      sender_type: 'ai',
      sender_name: `${siteConfig.shortName} AI Assistant`,
      content: `Thank you, ${name}! We have successfully received your booking details and dispatched a confirmation email to ${email}. Closer to your scheduled consultation time (${finalClientDate} at ${finalClientTime} [${visitorTimezone.replace('_', ' ')}]), our senior specialist will email your private Zoom meeting link where we will discuss your store goals and provide a custom quote. We look forward to speaking with you!`,
      seq: maxSeq + 2,
      created_at: new Date(Date.now() + 500).toISOString()
    };
    conv.messages.push(aiConfirmationMsg);
    conv.updated_at = new Date().toISOString();

    // 3. Save conversation & Broadcast realtime updates
    await granularStore.saveConversation(conv);

    const payloadVisitor = {
      conversationId: conv.id,
      message: visitorSubmissionMsg,
      conversation: conv,
      isHandoffRequested: false
    };
    const payloadAI = {
      conversationId: conv.id,
      message: aiConfirmationMsg,
      conversation: conv,
      isHandoffRequested: false
    };

    await Promise.all([
      broadcastRealtimeEvent('chat_message', payloadVisitor),
      broadcastRealtimeEvent('chat_message', payloadAI),
      broadcastRealtimeEvent('conversation_updated', { conversationId: conv.id, conversation: conv }),
      dispatchWebPushForRealtimeEvent('chat_message', payloadVisitor)
    ]);

    // 4. Send Emails in parallel
    const assignedAgentEmail = conv?.assigned_agent_email?.trim() || undefined;
    const assignedAgentName = conv?.assigned_agent_pseudo_name || conv?.assigned_agent_name || undefined;

    const emailParams = {
      visitorName: name,
      visitorEmail: email,
      visitorPhone: phone,
      date: finalClientDate,
      time: finalClientTime,
      clientDate: finalClientDate,
      clientTime: finalClientTime,
      visitorTimezone: visitorTimezone.replace('_', ' '),
      pktDate: finalPktDate,
      pktTime: finalPktTime,
      service,
      websiteName: siteConfig.name,
      websiteUrl: siteConfig.url,
      adminEmail: siteConfig.email || 'garryamelia6265@gmail.com',
      agentEmail: assignedAgentEmail,
      agentName: assignedAgentName,
      conversationId: conv.id
    };

    Promise.allSettled([
      sendBookingConfirmationToVisitor(emailParams),
      sendBookingAlertToAdmin(emailParams),
      // Attempt CRM lead & meeting sync
      (async () => {
        try {
          const leadInsertRes = await crmSupabase.from('leads').insert({
            name,
            email,
            phone: phone || '',
            company: `${siteConfig.shortName} Consultation Lead`,
            status: 'booked',
            booked_at: now,
            value: 0,
            assigned_agent_name: assignedAgentEmail || null,
            notes: [`Consultation Booked for ${finalPktDate} at ${finalPktTime} [PKT] (Client Local Time: ${finalClientDate} at ${finalClientTime} [${visitorTimezone.replace('_', ' ')}]). Service: ${service}. Handled by: ${assignedAgentName || 'AI Assistant'}. Conversation ID: ${conv.id}`],
            created_at: now
          }).select('id').maybeSingle();

          const createdLeadId = leadInsertRes.data?.id || null;

          // Insert into meetings table so dashboard notifications & automated 24h/1h/5m reminders trigger seamlessly
          const meetingTitle = `1-on-1 Strategy Session with ${name} (${email}) - ${service} [${siteConfig.shortName} || ${effectiveSlug}]`;
          await crmSupabase.from('meetings').insert({
            lead_id: createdLeadId,
            agent_email: assignedAgentEmail || null,
            title: meetingTitle,
            scheduled_time: finalScheduledIso,
            completed: false,
            reminder_24h_sent: false,
            reminder_1h_sent: false,
            reminder_5m_sent: false
          });
        } catch (crmErr) {
          console.warn('[CRM_SYNC] Lead/Meeting insert error:', crmErr);
        }
      })()
    ]).catch(err => console.error('[BOOKING_POST_ASYNC_ERR]', err));

    return NextResponse.json({
      success: true,
      conversation: conv,
      visitorMessage: visitorSubmissionMsg,
      aiMessage: aiConfirmationMsg
    });
  } catch (err: unknown) {
    console.error('[BOOKING_ROUTE_ERR]', err);
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
