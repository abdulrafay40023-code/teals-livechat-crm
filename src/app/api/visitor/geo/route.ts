import { NextRequest, NextResponse } from 'next/server';
import { lookupGeoAsync } from '@/lib/geo';

export async function GET(req: NextRequest) {
  try {
    let ip = '';
    const rawXForwarded = req.headers.get('x-forwarded-for') || '';
    ip = rawXForwarded.includes(',') ? rawXForwarded.split(',')[0].trim() : rawXForwarded.trim();
    if (ip === '::1' || ip === '127.0.0.1') ip = '';

    const edgeCountryCode = req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry') || undefined;
    const rawEdgeCity = req.headers.get('x-vercel-ip-city');
    const edgeCity = rawEdgeCity ? decodeURIComponent(rawEdgeCity) : undefined;
    const edgeRegion = req.headers.get('x-vercel-ip-country-region') || undefined;
    const edgeTimezone = req.headers.get('x-vercel-ip-timezone') || req.headers.get('cf-timezone') || undefined;

    const geo = await lookupGeoAsync(ip, {
      countryCode: edgeCountryCode,
      city: edgeCity,
      region: edgeRegion,
      timezone: edgeTimezone
    });

    const timezone = edgeTimezone || geo.timezone || 'America/New_York';

    return NextResponse.json({
      ip: ip || '127.0.0.1',
      city: geo.city,
      country: geo.country,
      countryCode: geo.countryCode,
      timezone
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    return NextResponse.json({ timezone: 'America/New_York' });
  }
}
