import { NextResponse } from 'next/server';
import { granularStore } from '@/lib/store';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export async function POST() {
  try {
    // 1. Reset all live sessions, today's visitors, all-time unique visitors, and pageviews
    await granularStore.resetTrafficOnly();

    // 2. Clear all active conversations and cloud storage
    await granularStore.clearAllConversations();

    // 3. Broadcast stats reset to all dashboards
    await broadcastRealtimeEvent('stats_reset', {});

    return NextResponse.json({
      success: true,
      message: 'All live traffic, visitors, conversations, and badges reset to 0.'
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
