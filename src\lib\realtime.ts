import { supabaseAdmin } from '@/lib/supabase';

export const REALTIME_CHANNEL = 'teals-live-crm-stream';

export async function broadcastRealtimeEvent(event: string, payload: unknown): Promise<void> {
  return new Promise((resolve) => {
    try {
      const channel = supabaseAdmin.channel(REALTIME_CHANNEL, {
        config: { broadcast: { self: true } }
      });

      let finished = false;
      const cleanup = () => {
        if (!finished) {
          finished = true;
          resolve();
        }
      };

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            await channel.send({
              type: 'broadcast',
              event,
              payload
            });
          } catch (e) {
            console.error('Error sending broadcast:', e);
          } finally {
            cleanup();
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          cleanup();
        }
      });

      setTimeout(cleanup, 1200);
    } catch (err) {
      console.error('Realtime broadcast error:', err);
      resolve();
    }
  });
}
