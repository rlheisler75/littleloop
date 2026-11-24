import { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { isProPlan, loadSitterPlan } from './lib/plan';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const FIELDS = 'subscription_status, subscription_plan, trial_ends_at, current_period_end, stripe_customer_id, stripe_subscription_id';

export function useSubscription(session) {
  const [status,  setStatus]  = useState(null);
  const [plan,    setPlan]    = useState(null);   // my_sitter_plan(): limit, children, staff perk
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    if (!session) return;
    // Fast path: the sitter's own row.
    const { data: row } = await supabase.from('sitters').select(FIELDS).eq('id', session.user.id).maybeSingle();
    if (row) setStatus(row);
    setPlan(await loadSitterPlan());
    setLoading(false);

    // Background sync with Stripe (the billing function also writes the row back).
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/billing?action=status`,
        { headers: { Authorization: `Bearer ${session.access_token}` } });
      const data = await res.json();
      // Ignore 'none' so a complimentary plan stored on the row isn't overwritten.
      if (data?.subscription_status && data.subscription_status !== 'none') setStatus(s => ({ ...(s || {}), ...data }));
    } catch (e) {
      console.error('useSubscription sync error:', e);
    }
  }, [session]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Paid features: a paid or complimentary plan, or free sitter mode as daycare staff
  const isPro      = isProPlan(status) || !!plan?.staff_perk;
  const isTrialing = status?.subscription_status === 'trialing';
  const isPastDue  = status?.subscription_status === 'past_due';

  const trialDaysLeft = isTrialing && status?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(status.trial_ends_at) - Date.now()) / 86400000))
    : null;

  return { status, plan, loading, isPro, isTrialing, isPastDue, trialDaysLeft, refresh: fetchStatus };
}
