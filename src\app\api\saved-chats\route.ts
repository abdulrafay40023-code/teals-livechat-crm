 import { NextRequest, NextResponse } from 'next/server';
import { granularStore } from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const website = searchParams.get('website');
    const query = (searchParams.get('query') || '').toLowerCase().trim();
    const date = searchParams.get('date'); // YYYY-MM-DD

    const conversations = await granularStore.getAllSavedConversations();

    let filtered = conversations;

    if (website && website !== 'all') {
      filtered = filtered.filter(c => {
        const p = (c.property_slug || '').toLowerCase();
        return p === website.toLowerCase();
      });
    }

    if (date) {
      filtered = filtered.filter(c => {
        const created = c.created_at || c.updated_at || '';
        try {
          const sDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Karachi',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).format(new Date(created));
          return sDate === date;
        } catch {
          return created.startsWith(date);
        }
      });
    }

    if (query) {
      filtered = filtered.filter(c => {
        const name = (c.visitor_name || '').toLowerCase();
        const email = (c.visitor_email || '').toLowerCase();
        const ip = (c.visitor_ip || '').toLowerCase();
        const id = (c.id || '').toLowerCase();
        const msgMatch = (c.messages || []).some(m => (m.content || '').toLowerCase().includes(query));
        return name.includes(query) || email.includes(query) || ip.includes(query) || id.includes(query) || msgMatch;
      });
    }

    return NextResponse.json({
      success: true,
      totalCount: filtered.length,
      conversations: filtered
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
