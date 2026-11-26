// littleloop plans (keep in sync with supabase/functions/billing/index.ts and
// supabase/migrations/20261124_pricing_tiers.sql).
//
// Sitters: Free up to 3 children; then $7 / $12 / $20 a month (yearly = 10x monthly).
//   Children = children in the families you're connected to. Complimentary plans
//   (founders, grandfathered) are unlimited, and daycare staff get sitter mode free and
//   unlimited while they work at a daycare that's on a plan or in its trial.
// Daycares: 30-day free trial (no card), then Home / Center / Large by enrolled children.
// Parents: always free.
import { supabase } from './supabase';

export const FREE_CHILD_LIMIT = 3;

export const SITTER_TIERS = [
  { id: 's10',       label: 'Up to 10',  children: 10,   monthly: 7,  yearly: 70 },
  { id: 's20',       label: 'Up to 20',  children: 20,   monthly: 12, yearly: 120 },
  { id: 'unlimited', label: 'Unlimited', children: null, monthly: 20, yearly: 200 },
];

export const DAYCARE_TIERS = [
  { id: 'home',   label: 'Home',         children: 12,   monthly: 29,  yearly: 290,  hint: 'Family child care homes' },
  { id: 'center', label: 'Center',       children: 60,   monthly: 79,  yearly: 790,  hint: 'Most centers' },
  { id: 'large',  label: 'Large center', children: null, monthly: 149, yearly: 1490, hint: 'Big or growing centers' },
];
export const DAYCARE_TRIAL_DAYS = 30;

export const sitterTier  = id => SITTER_TIERS.find(t => t.id === id) || null;
export const daycareTier = id => DAYCARE_TIERS.find(t => t.id === id) || null;
export const childrenText = n => (n == null ? 'Unlimited children' : `Up to ${n} children`);
export const money = n => `$${n.toLocaleString()}`;

const PRO_STATUSES = ['active', 'trialing', 'past_due'];
const COMP_PLANS   = ['free_founder', 'grandfathered'];

// Paid sitter features (recurring invoices). The staff perk is added from my_sitter_plan().
export function isProPlan(sub) {
  if (!sub) return false;
  return PRO_STATUSES.includes(sub.subscription_status) || COMP_PLANS.includes(sub.subscription_plan);
}

export function isComplimentary(sub) {
  return !!sub && COMP_PLANS.includes(sub.subscription_plan) && !sub.stripe_subscription_id;
}

// The server's message when adding a family/child would go past the plan.
export function isPlanLimitError(err) {
  return !!err && /PLAN_CHILD_LIMIT|FREE_FAMILY_LIMIT|TRIAL_ENDED|plan covers|free plan includes/i.test(`${err.code || ''} ${err.message || err.error || ''}`);
}
export function planLimitMessage(err) {
  const m = `${err?.message || err?.error || ''}`;
  return m.replace(/^(PLAN_CHILD_LIMIT|TRIAL_ENDED|FREE_FAMILY_LIMIT):\s*/, '') || 'Your plan doesn\'t cover more children. Upgrade to add more.';
}

async function billing(session, action, body) {
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/billing?action=${action}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || 'Something went wrong. Please try again.' };
    return data;
  } catch {
    return { error: 'Something went wrong. Please try again.' };
  }
}

// Start Stripe checkout for a plan and redirect. facilityId = a daycare's plan.
// Returns an error string on failure.
export async function startCheckout(session, { tier, interval = 'month', facilityId = null }) {
  const origin = window.location.origin;
  const data = await billing(session, 'checkout', {
    tier, interval, facilityId,
    successUrl: `${origin}/?subscribed=true`, cancelUrl: `${origin}/`,
  });
  if (data.url) { window.location.href = data.url; return null; }
  return data.error || 'Could not start checkout. Please try again.';
}

// Switch an existing subscription to another tier or interval (prorated).
export async function changePlan(session, { tier, interval = 'month', facilityId = null }) {
  const data = await billing(session, 'change', { tier, interval, facilityId });
  return data.ok ? null : (data.error || 'Could not change the plan.');
}

// Stripe's billing page: card, invoices, cancel.
export async function openBillingPortal(session, facilityId = null) {
  const data = await billing(session, 'portal', { facilityId, returnUrl: window.location.origin });
  if (data.url) { window.location.href = data.url; return null; }
  return data.error || 'Could not open billing.';
}

// Sitter's plan, usage and perks (my_sitter_plan()).
export async function loadSitterPlan() {
  const { data, error } = await supabase.rpc('my_sitter_plan');
  if (error) { console.error('my_sitter_plan:', error); return null; }
  return data;
}

// A daycare's plan as staff see it (facility_plan_summary()).
export async function loadFacilityPlan(facilityId) {
  const { data, error } = await supabase.rpc('facility_plan_summary', { p_facility_id: facilityId });
  if (error) { console.error('facility_plan_summary:', error); return null; }
  return data;
}

