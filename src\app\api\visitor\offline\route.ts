import { NextRequest, NextResponse } from 'next/server';
import { granularStore } from '@/lib/store';
import { broadcastRealtimeEvent } from '@/lib/realtime';

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
  return POST(req);
}

export async function POST(req: NextRequest) {
  try {
    let sessionId: string | null = req.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
      try {
        const text = await req.text();
        if (text) {
          try {
            const body = JSON.parse(text);
            sessionId = body.sessionId || body.id || body.visitorToken;
          } catch {
            const params = new URLSearchParams(text);
            sessionId = params.get('sessionId') || params.get('id');
          }
        }
      } catch {}
    }

    if (sessionId) {
      const session = await granularStore.getSession(sessionId);
      const sessionIp = session?.ip_address;
      await granularStore.markSessionOffline(sessionId);
      await broadcastRealtimeEvent('visitor_offline', {
        sessionId,
        visitorToken: session?.visitor_token,
        ip: sessionIp
      });
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
