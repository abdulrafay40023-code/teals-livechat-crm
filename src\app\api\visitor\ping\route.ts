import { NextRequest, NextResponse } from 'next/server';
import { granularStore, StoreVisitorSession } from '@/lib/store';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { isPrivateIp, lookupGeoAsync } from '@/lib/geo';

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
    const { sessionId, visitorToken, currentPage, isNewPageView, propertySlug = 'teals-crm', sessionStartTime, pageTitle } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    let ip =
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-real-ip') ||
      req.headers.get('x-client-ip') ||
      req.headers.get('x-forwarded-for') ||
      req.headers.get('fastly-client-ip') ||
      req.headers.get('true-client-ip') ||
      '';

    if (ip.includes(',')) {
      ip = ip.split(',')[0].trim();
    }
    ip = ip.trim();

    let session = await granularStore.getSession(sessionId);

    if (session) {
      // Normal path: session exists, update last_active_at and keep online
      session.is_online = true;
      session.last_active_at = new Date().toISOString();

      // Ensure created_at is preserved
      if (!session.created_at && sessionStartTime) {
        session.created_at = sessionStartTime;
      }

      if (pageTitle) {
        session.page_title = pageTitle;
      }

      // If network changed (e.g. mobile WiFi to 4G), update real IP & Geo
      if (ip && !isPrivateIp(ip) && ip !== session.ip_address) {
        session.ip_address = ip;
        const edgeCountryCode = req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry') || undefined;
        const rawEdgeCity = req.headers.get('x-vercel-ip-city');
        const edgeCity = rawEdgeCity ? decodeURIComponent(rawEdgeCity) : undefined;
        const edgeRegion = req.headers.get('x-vercel-ip-country-region') || undefined;
        const geo = await lookupGeoAsync(ip, {
          countryCode: edgeCountryCode,
          city: edgeCity,
          region: edgeRegion
        });
        session.country = geo.country;
        session.country_code = geo.countryCode;
        session.city = geo.city;
        session.flag = geo.flag;
      }

      if (currentPage && (currentPage !== session.current_page || (pageTitle && pageTitle !== session.page_title))) {
        session.current_page = currentPage;
        session.page_title = pageTitle || session.page_title;
        await broadcastRealtimeEvent('visitor_navigation', { sessionId, currentPage, pageTitle: session.page_title });
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

