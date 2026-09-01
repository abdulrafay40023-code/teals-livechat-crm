import { NextRequest, NextResponse } from 'next/server';
import { granularStore, StoreVisitorSession } from '@/lib/store';
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, visitorToken, currentPage, isNewPageView, propertySlug = 'teals-crm' } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    let session = await granularStore.getSession(sessionId);

    if (session) {
      // Normal path: session exists, just update last_active_at
      session.is_online = true;
      session.last_active_at = new Date().toISOString();
      if (currentPage && currentPage !== session.current_page) {
        session.current_page = currentPage;
        await broadcastRealtimeEvent('visitor_navigation', { sessionId, currentPage });
      }
      if (isNewPageView) {
        granularStore.incrementPageView();
      }
      await granularStore.saveSession(session);
      return NextResponse.json({ success: true, isOnline: true });
    }

    return NextResponse.json({ success: true, isOnline: false, retrackNeeded: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

