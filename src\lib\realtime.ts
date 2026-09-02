const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nyoegrnemmravwqdcqnp.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55b2Vncm5lbW1yYXZ3cWRjcW5wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzg0MzEzMywiZXhwIjoyMTAzNDE5MTMzfQ.Q44BHkMZ_j1HfPLiPkxHNtC5wwEvS72AYOsvjaqQ49Q';

export const REALTIME_CHANNEL = 'teals-live-crm-stream';

export async function broadcastRealtimeEvent(event: string, payload: unknown): Promise<void> {
  try {
    const res = await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          {
            topic: REALTIME_CHANNEL,
            event,
            payload
          }
        ]
      })
    });
    if (!res.ok) {
      console.error('Supabase broadcast returned status:', res.status);
    }
  } catch (err) {
    console.error('Realtime broadcast error:', err);
  }
}
