/** US-088 · The signed-in session (null when signed out or when the cloud isn't configured), kept live. */
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '@/services/supabase';

export function useSession(): { session: Session | null; loading: boolean } {
  const client = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!client);
  useEffect(() => {
    if (!client) return;
    let live = true;
    void client.auth.getSession().then(({ data }) => {
      if (!live) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = client.auth.onAuthStateChange((_event, s) => {
      if (live) setSession(s);
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, [client]);
  return { session, loading };
}
