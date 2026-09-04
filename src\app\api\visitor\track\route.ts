import { NextRequest, NextResponse } from 'next/server';
import { granularStore, StoreVisitorSession, StoreMessage } from '@/lib/store';
import { lookupGeoAsync } from '@/lib/geo';
import { parseUserAgent } from '@/lib/device';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { detectWebsiteSlugFromUrl } from '@/lib/websites-config';

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
    const {
      sessionId,
      visitorToken,
      propertySlug = 'teals-crm',
      currentPage = '/',
      referrer = 'Direct',
      isNewPageView = false,
      visitorName,
      visitorEmail
    } = body;

    const refererHeader = req.headers.get('referer');
    const effectiveSlug = (propertySlug && propertySlug !== 'teals-crm')
      ? propertySlug
      : detectWebsiteSlugFromUrl(currentPage || refererHeader);

    const sid = sessionId || ('tab_' + Math.random().toString(36).substring(2, 10));
    const token = visitorToken || sid;

    let ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '182.188.238.155';
    if (ip.includes(',')) ip = ip.split(',')[0].trim();
    if (ip === '::1' || ip === '127.0.0.1') ip = '182.188.238.155';

    const geo = await lookupGeoAsync(ip);
    const userAgent = req.headers.get('user-agent') || '';
    const dev = parseUserAgent(userAgent);
    const nowIso = new Date().toISOString();

    const session: StoreVisitorSession = {
      id: sid,
      visitor_token: token,
      property_slug: effectiveSlug,
      ip_address: ip,
      country: geo.country,
      country_code: geo.countryCode,
      city: geo.city,
      flag: geo.flag,
      referrer: referrer || refererHeader || 'Direct',
      current_page: currentPage,
      browser: dev.browser,
      os: dev.os,
      device: dev.device,
      is_online: true,
      last_active_at: nowIso,
      created_at: nowIso
    };

    if (isNewPageView) {
      granularStore.incrementPageView();
    }

    // Save session in memory/cloud
    await granularStore.saveSession(session);

    let conv = await granularStore.getConversation(token);
    if (conv) {
      if (visitorName) conv.visitor_name = visitorName;
      if (visitorEmail) conv.visitor_email = visitorEmail;
      if (!conv.property_slug || conv.property_slug === 'teals-crm') {
        conv.property_slug = effectiveSlug;
      }
      conv.visitor_ip = ip;
      conv.updated_at = nowIso;
      await granularStore.saveConversation(conv);
    }

    // Fetch authoritative unique analytics
    const activeData = await granularStore.getAllActiveData(effectiveSlug);

    // Broadcast instant arrival with authoritative counts
    await broadcastRealtimeEvent('visitor_arrival', {
      session,
      propertySlug: effectiveSlug,
      todayCount: activeData.todayVisitorsCount,
      totalUniqueCount: activeData.totalUniqueCount,
      isNew: true,
      currentPage
    });

    return new NextResponse(JSON.stringify({
      success: true,
      session,
      conversation: conv
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
