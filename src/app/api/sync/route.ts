import { NextRequest, NextResponse } from 'next/server';
import { granularStore } from '@/lib/store';
import { getAllWebsites } from '@/lib/websites-config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const propertySlug = searchParams.get('property') || 'teals-crm';

    const data = await granularStore.getAllActiveData(propertySlug);

    const headers = {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': '*'
    };

    return NextResponse.json({
      visitors: data.liveVisitors,
      liveVisitorsCount: data.liveVisitors.length,
      todayVisitorsCount: data.todayVisitorsCount,
      totalUniqueCount: data.totalUniqueCount,
      conversations: data.conversations,
      deletedConvIds: Array.from(granularStore.getDeletedConvIds()),
      pageViews: data.pageViews,
      websiteStats: data.websiteStats || {},
      customWebsites: data.customWebsites || [],
      removedWebsites: data.removedWebsites || [],
      serverResetAt: granularStore.getLastResetAt()
    }, { headers });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, name, domain, slug, category } = body || {};

    if (action === 'remove_website') {
      if (!slug || !String(slug).trim()) {
        return NextResponse.json({ error: 'Website slug is required' }, { status: 400 });
      }
      await granularStore.removeWebsite(String(slug).trim());
      return NextResponse.json({
        success: true,
        removedSlug: String(slug).trim(),
        customWebsites: granularStore.getCustomWebsites(),
        removedWebsites: granularStore.getRemovedWebsites(),
        allWebsites: getAllWebsites(),
      });
    }

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Website name is required' }, { status: 400 });
    }

    const website = await granularStore.saveCustomWebsite({
      name: String(name).trim(),
      domain: String(domain || '').trim(),
      slug: slug ? String(slug).trim() : undefined,
      category: category === 'publishing' ? 'publishing' : 'ecommerce',
    });

    return NextResponse.json({
      success: true,
      website,
      customWebsites: granularStore.getCustomWebsites(),
      removedWebsites: granularStore.getRemovedWebsites(),
      allWebsites: getAllWebsites(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug') || '';
    if (!slug.trim()) {
      return NextResponse.json({ error: 'Website slug is required' }, { status: 400 });
    }
    await granularStore.removeWebsite(slug.trim());
    return NextResponse.json({
      success: true,
      removedSlug: slug.trim(),
      customWebsites: granularStore.getCustomWebsites(),
      removedWebsites: granularStore.getRemovedWebsites(),
      allWebsites: getAllWebsites(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
