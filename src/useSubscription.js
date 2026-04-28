import { useState, useEffect, useCallback } from 'react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
import { supabase } from './lib/supabase';

export function useSubscription(session) {
  const [status, setStatus] = useState(null); // null = loading
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/billing?action=status`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      console.error('useSubscription error:', e);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const isActive = ['active', 'trialing'].includes(status?.subscription_status);
  const isTrialing = status?.subscription_status === 'trialing';
  const isPastDue = status?.subscription_status === 'past_due';
  const isCanceled = status?.subscription_status === 'canceled';
  const hasNeverSubscribed = !status?.subscription_status || status?.subscription_status === 'trialing';

  const trialDaysLeft = isTrialing && status?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(status.trial_ends_at) - Date.now()) / 86400000))
    : null;

  return { status, loading, isActive, isTrialing, isPastDue, isCanceled, trialDaysLeft, refresh: fetchStatus };
}
