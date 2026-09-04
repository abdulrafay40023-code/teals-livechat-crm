import { NextRequest, NextResponse } from 'next/server';
import { granularStore } from '@/lib/store';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export async function POST(req: NextRequest) {
  try {
    let body;
    const text = await req.text();
    try {
      body = JSON.parse(text);
    } catch {
      body = {};
    }

    const sessionId = body.sessionId;
    if (sessionId) {
      // Get session before removing so we can broadcast the IP
      const session = await granularStore.getSession(sessionId);
      const sessionIp = session?.ip_address;
      await granularStore.removeSession(sessionId);
      await broadcastRealtimeEvent('visitor_offline', { sessionId, ip: sessionIp });
    }

    return new NextResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch {
    return NextResponse.json({ success: true });
  }
}
