import { NextRequest, NextResponse } from 'next/server';
import { granularStore } from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const propertySlug = searchParams.get('property') || 'teals-crm';

    const data = await granularStore.getAllActiveData(propertySlug);

    return NextResponse.json({
      visitors: data.liveVisitors,
      liveVisitorsCount: data.liveVisitors.length,
      todayVisitorsCount: data.todayVisitorsCount,
      totalUniqueCount: data.totalUniqueCount,
      conversations: data.conversations,
      pageViews: data.pageViews
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
