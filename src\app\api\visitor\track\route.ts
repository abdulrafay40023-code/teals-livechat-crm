import { NextRequest, NextResponse } from 'next/server';
import { granularStore, StoreVisitorSession, StoreMessage, isStaffOrAdmin, isStaffOrAdminAsync } from '@/lib/store';
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

    // Strict block: Agents and Admins cannot enter/chat as a client/visitor
    if (await isStaffOrAdminAsync(visitorEmail, visitorName)) {
      return NextResponse.json({
        success: false,
        error: 'Agents and Admins cannot initiate chats as clients. Aapko as a client aana hoga.',
        isStaffBlocked: true
      }, { status: 403 });
    }

    const refererHeader = req.headers.get('referer');
    const effectiveSlug = (propertySlug && propertySlug !== 'teals-crm')
      ? propertySlug
      : detectWebsiteSlugFromUrl(currentPage || refererHeader);

    // Completely ignore CRM traffic (salesflow-ai, teals-crm, etc.) as requested
    const isCrmTraffic = !effectiveSlug || effectiveSlug === 'teals-crm' ||
      (currentPage && (currentPage.includes('salesflow-ai') || currentPage.includes('teals-livechat'))) ||
      (refererHeader && (refererHeader.includes('salesflow-ai') || refererHeader.includes('teals-livechat')));

    if (isCrmTraffic) {
      return NextResponse.json({
        success: true,
        tracked: false,
        message: 'CRM traffic ignored'
      });
    }

    const sid = sessionId || ('tab_' + Math.random().toString(36).substring(2, 10));
    const token = visitorToken || sid;

    // 1. Resolve real client IP with full CDN / Proxy header priority
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

    if (!ip || ip === '::1' || ip === '127.0.0.1') {
      ip = req.headers.get('x-forwarded-for') || '182.188.238.155';
      if (ip.includes(',')) ip = ip.split(',')[0].trim();
      if (ip === '::1' || ip === '127.0.0.1') ip = '182.188.238.155';
    }

    // 2. Extract edge geolocation hints provided directly by Vercel Edge / Cloudflare
    const edgeCountryCode = req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry') || undefined;
    const rawEdgeCity = req.headers.get('x-vercel-ip-city');
    const edgeCity = rawEdgeCity ? decodeURIComponent(rawEdgeCity) : undefined;
    const edgeRegion = req.headers.get('x-vercel-ip-country-region') || undefined;

    // 3. Multi-tier Geo IP lookup
    const geo = await lookupGeoAsync(ip, {
      countryCode: edgeCountryCode,
      city: edgeCity,
      region: edgeRegion
    });

    const userAgent = req.headers.get('user-agent') || '';
    const dev = parseUserAgent(userAgent);
    const nowIso = new Date().toISOString();

    // Preserve session created_at for this tab so page navigation and tab reactivation never reset duration.
    // When a user closes the site and opens a new tab, sid is brand new so a fresh visit starts from nowIso.
    const existingSession = await granularStore.getSession(sid);
    const createdAt = existingSession?.created_at || body.sessionStartTime || nowIso;

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
      page_title: body.pageTitle || existingSession?.page_title || '',
      browser: dev.browser,
      os: dev.os,
      device: dev.device,
      is_online: true,
      last_active_at: nowIso,
      created_at: createdAt
    };

    if (isNewPageView) {
      granularStore.incrementPageView();
    }

    // Save session in memory (cloud upload is backgrounded)
    await granularStore.saveSession(session);

    // Broadcast instant arrival IMMEDIATELY (0ms delay!)
    broadcastRealtimeEvent('visitor_arrival', {
      session,
      propertySlug: effectiveSlug,
      isNew: true,
      currentPage
    }).catch(() => {});

    let conv = await granularStore.getConversation(token);
    if (conv) {
      if (visitorName) conv.visitor_name = visitorName;
      if (visitorEmail) conv.visitor_email = visitorEmail;
      if (!conv.property_slug || conv.property_slug === 'teals-crm') {
        conv.property_slug = effectiveSlug;
      }
      conv.visitor_ip = ip;
      conv.updated_at = nowIso;
      granularStore.saveConversation(conv).catch(() => {});
    }

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
