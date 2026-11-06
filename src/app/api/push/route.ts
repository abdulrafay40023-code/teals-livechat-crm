import { NextRequest, NextResponse } from 'next/server';
import {
  VAPID_PUBLIC_KEY,
  savePushSubscription,
  updateSubscriberPermissionsByEmail,
} from '@/lib/web-push';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  return NextResponse.json(
    { publicKey: VAPID_PUBLIC_KEY },
    { headers: corsHeaders }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body?.action === 'update_permissions' && body?.email) {
      await updateSubscriberPermissionsByEmail(
        String(body.email),
        Array.isArray(body.assigned_websites) ? body.assigned_websites : [],
        body.role ? String(body.role) : undefined
      );
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    const sub = body?.subscription || body;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return NextResponse.json(
        { error: 'Invalid push subscription payload' },
        { status: 400, headers: corsHeaders }
      );
    }

    await savePushSubscription({
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      },
      email: body?.email ? String(body.email) : undefined,
      role: body?.role ? String(body.role) : undefined,
      assigned_websites: Array.isArray(body?.assigned_websites)
        ? body.assigned_websites
        : undefined,
    });

    return NextResponse.json(
      { success: true, publicKey: VAPID_PUBLIC_KEY },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Push registration failed' },
      { status: 500, headers: corsHeaders }
    );
  }
}
