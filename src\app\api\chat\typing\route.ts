import { NextRequest, NextResponse } from 'next/server';
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
    const { conversationId, typingText, isTyping, senderType, senderName } = await req.json();
    if (!conversationId) {
      return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 });
    }

    // Instant WebSocket broadcast for sub-millisecond character-by-character live preview
    await broadcastRealtimeEvent('typing_event', {
      conversationId,
      typingText: isTyping ? (typingText || '') : '',
      isTyping,
      senderType,
      senderName
    });

    return new NextResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return new NextResponse(JSON.stringify({ error: message }), { status: 500 });
  }
}
