// Sitter plans.
//   Free — every sitter, no card needed. Full features for up to FREE_FAMILY_LIMIT families.
//   Pro  — paid (or complimentary) subscription. Unlimited families.

export const FREE_FAMILY_LIMIT = 2;

export const PRO_PRICE = { monthly: '$5', yearly: '$50' };

const PRO_STATUSES = ['active', 'trialing'];
const COMP_PLANS   = ['free_founder', 'grandfathered'];

export function isProPlan(sub) {
  if (!sub) return false;
  return PRO_STATUSES.includes(sub.subscription_status) || COMP_PLANS.includes(sub.subscription_plan);
}

export function isComplimentary(sub) {
  return !!sub && COMP_PLANS.includes(sub.subscription_plan) && !sub.stripe_subscription_id;
}

// family_sitters rows that count against the free limit (invited or connected).
// Enforced server-side by the enforce_free_family_limit() trigger and the create-family function.
export const COUNTED_LINK_STATUSES = ['active', 'pending'];

export const FREE_LIMIT_MESSAGE = `The free plan includes ${FREE_FAMILY_LIMIT} families. Upgrade to Pro for unlimited families.`;

// True when a Supabase/edge error is the server rejecting a link over the free limit.
export function isFreeLimitError(err) {
  return !!err && /FREE_FAMILY_LIMIT|free plan includes/i.test(`${err.code || ''} ${err.message || err.error || ''}`);
}

// Starts Stripe checkout for Pro and redirects. Returns an error string on failure.
export async function startProCheckout(session, plan = 'monthly') {
  try {
    const origin = window.location.origin;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/billing?action=checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, successUrl: `${origin}/?subscribed=true`, cancelUrl: `${origin}/` }),
    });
    const data = await res.json();
    if (data.url) { window.location.href = data.url; return null; }
    return 'Could not start checkout. Please try again.';
  } catch {
    return 'Something went wrong. Please try again.';
  }
}
