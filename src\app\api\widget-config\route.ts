import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const propertySlug = searchParams.get('property') || 'teals-crm';

    // Fetch property settings from DB or default
    const { data: property } = await supabaseAdmin
      .from('properties')
      .select('*')
      .eq('slug', propertySlug)
      .maybeSingle();

    const config = property || {
      name: propertySlug === 'leadzmaker' ? 'Leadzmaker' : 'Teals CRM',
      slug: propertySlug,
      widget_color: propertySlug === 'leadzmaker' ? '#06b6d4' : '#6366f1',
      greeting_message: propertySlug === 'leadzmaker' 
        ? 'Welcome to Leadzmaker Support! Looking for targeted B2B leads?'
        : 'Welcome to Teals CRM AI Assistant! How can we assist your sales team today?'
    };

    return NextResponse.json({ config });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
