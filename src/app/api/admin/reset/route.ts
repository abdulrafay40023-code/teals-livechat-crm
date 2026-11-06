import { NextResponse } from 'next/server';
import { granularStore } from '@/lib/store';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'chats') {
      // 1. Clear all active conversations in memory and both cloud buckets
      await granularStore.clearAllConversations();
      // 2. Clear visitor session caches so new visits are detected as fresh arrivals
      await granularStore.resetTrafficOnly();

      const resetAt = granularStore.getLastResetAt();
      // 3. Broadcast reset to all clients
      await Promise.all([
        broadcastRealtimeEvent('stats_reset', { resetType: 'chats', resetAt }),
        broadcastRealtimeEvent('system_reset', { resetType: 'chats', resetAt })
      ]);

      return NextResponse.json({
        success: true,
        resetAt,
        message: 'All conversations have been reset.'
      });
    }

    // Default: Full reset - live sessions, today's visitors, all-time unique visitors, and pageviews
    await granularStore.resetTrafficOnly();

    // Clear all active conversations and cloud storage
    await granularStore.clearAllConversations();

    const resetAt = granularStore.getLastResetAt();

    // Broadcast stats reset & complete system wipe to all client browsers
    await Promise.all([
      broadcastRealtimeEvent('stats_reset', { resetAt }),
      broadcastRealtimeEvent('system_reset', { resetAt })
    ]);

    return NextResponse.json({
      success: true,
      resetAt,
      message: 'All live traffic, visitors, conversations, and badges reset to 0.'
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
