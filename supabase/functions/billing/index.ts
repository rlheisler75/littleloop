// littleloop billing (Stripe). Two kinds of customer:
//   sitter  — the sitter's own row in `sitters`
//   daycare — a daycare's row in `facility_billing` (director or office manage it)
// Plans (keep in sync with src/lib/plan.js and 20261124_pricing_tiers.sql):
//   sitter : s10 $7/mo (up to 10 children), s20 $12/mo (up to 20), unlimited $20/mo
//   daycare: home $29/mo (up to 12), center $79/mo (up to 60), large $149/mo (unlimited)
//   yearly = 10x monthly.
// Prices are found by lookup key (littleloop_<kind>_<tier>_<interval>) and created here the
// first time they're needed, so nothing has to be set up by hand in Stripe.
//
// Actions: status, checkout, change (switch tier/interval on an existing subscription),
// portal, and the webhook (customer.subscription.*, invoice.payment_failed).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CATALOG: Record<string, Record<string, { cents: number; name: string }>> = {
  sitter: {
    s10:       { cents: 700,   name: 'littleloop Sitter · up to 10 children' },
    s20:       { cents: 1200,  name: 'littleloop Sitter · up to 20 children' },
    unlimited: { cents: 2000,  name: 'littleloop Sitter · unlimited children' },
  },
  daycare: {
    home:   { cents: 2900,  name: 'littleloop Daycare Home · up to 12 children' },
    center: { cents: 7900,  name: 'littleloop Daycare Center · up to 60 children' },
    large:  { cents: 14900, name: 'littleloop Daycare Large · unlimited children' },
  },
};
const SITTER_TRIAL_DAYS = 90;   // first sitter subscription (unchanged from the $5 Pro plan)

async function stripeReq(path: string, method = 'GET', body?: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });
  const data = await res.json();
  if (!res.ok) console.error(`Stripe ${method} ${path} =>`, res.status, JSON.stringify(data));
  return { ok: res.ok, status: res.status, data };
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const iso = (secs?: number | null) => (secs ? new Date(secs * 1000).toISOString() : null);
const periodEnd = (sub: any) => iso(sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end);

// Price id for kind/tier/interval, created (product + price) the first time.
async function priceFor(kind: string, tier: string, interval: string): Promise<string | null> {
  const item = CATALOG[kind]?.[tier];
  if (!item || !['month', 'year'].includes(interval)) return null;
  const key = `littleloop_${kind}_${tier}_${interval}`;
  const found = await stripeReq(`/prices?active=true&limit=1&lookup_keys[]=${encodeURIComponent(key)}`);
  const existing = found.data?.data?.[0];
  if (existing?.id) return existing.id;

  const prod = await stripeReq('/products', 'POST', {
    name: item.name, 'metadata[app]': 'littleloop', 'metadata[kind]': kind, 'metadata[tier]': tier,
  });
  if (!prod.ok) return null;
  const price = await stripeReq('/prices', 'POST', {
    product: prod.data.id, currency: 'usd', unit_amount: String(interval === 'year' ? item.cents * 10 : item.cents),
    'recurring[interval]': interval, lookup_key: key, transfer_lookup_key: 'true',
    nickname: `${item.name} (${interval === 'year' ? 'yearly' : 'monthly'})`,
  });
  return price.ok ? price.data.id : null;
}

// Write a subscription's state to the right row.
async function saveSubscription(sb: any, sub: any) {
  const kind = sub.metadata?.kind === 'daycare' ? 'daycare' : 'sitter';
  const interval = sub.items?.data?.[0]?.price?.recurring?.interval || (sub.metadata?.plan === 'yearly' ? 'year' : 'month');
  const gone = sub.status === 'canceled' || sub.status === 'incomplete_expired';
  if (kind === 'daycare') {
    const row = gone
      ? { subscription_status: 'canceled', stripe_subscription_id: null, plan_tier: null, plan_interval: null, current_period_end: null }
      : { subscription_status: sub.status, stripe_subscription_id: sub.id, plan_tier: sub.metadata?.tier || null,
          plan_interval: interval, current_period_end: periodEnd(sub) };
    await sb.from('facility_billing').update({ ...row, updated_at: new Date().toISOString() }).eq('stripe_customer_id', sub.customer);
  } else {
    const row = gone
      ? { subscription_status: 'canceled', stripe_subscription_id: null, plan_tier: null }
      : { stripe_subscription_id: sub.id, subscription_status: sub.status,
          subscription_plan: interval === 'year' ? 'yearly' : 'monthly',
          plan_tier: ['s10', 's20', 'unlimited'].includes(sub.metadata?.tier) ? sub.metadata.tier : null,
          current_period_end: periodEnd(sub), trial_ends_at: iso(sub.trial_end) };
    await sb.from('sitters').update(row).eq('stripe_customer_id', sub.customer);
  }
}

// The webhook body is untrusted: anyone can POST to this URL. We only use it to learn
// WHICH subscription or invoice changed, then read the real state from Stripe's API.
async function handleWebhook(req: Request) {
  let event: any;
  try { event = JSON.parse(await req.text()); } catch { return json({ error: 'Bad payload' }, 400); }
  const type = String(event?.type || '');
  const objId = String(event?.data?.object?.id || '');
  if (!/^(sub|in)_[A-Za-z0-9]+$/.test(objId)) return json({ received: true });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (type.startsWith('customer.subscription.')) {
    const { ok, data: sub } = await stripeReq(`/subscriptions/${objId}`);
    if (!ok || !sub?.customer) return json({ error: 'Unknown subscription' }, 400);
    await saveSubscription(sb, sub);
    return json({ received: true });
  }

  if (type === 'invoice.payment_failed') {
    const { ok, data: inv } = await stripeReq(`/invoices/${objId}`);
    if (!ok || !inv?.customer) return json({ error: 'Unknown invoice' }, 400);
    if (inv.status !== 'paid' && inv.attempt_count > 0) {
      await sb.from('sitters').update({ subscription_status: 'past_due' }).eq('stripe_customer_id', inv.customer);
      await sb.from('facility_billing').update({ subscription_status: 'past_due', updated_at: new Date().toISOString() })
        .eq('stripe_customer_id', inv.customer);
    }
    return json({ received: true });
  }

  return json({ received: true });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const url    = new URL(req.url);
  const action = url.searchParams.get('action');

  // WEBHOOK
  if (req.headers.get('stripe-signature') || action === 'webhook') {
    try {
      return await handleWebhook(req);
    } catch (err) {
      console.error('Webhook error:', err);
      return json({ error: 'Webhook error' }, 500);
    }
  }

  // AUTH
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: cors });
  const userSb = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userSb.auth.getUser();
  if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: cors });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const body = req.method !== 'GET' ? await req.json().catch(() => ({})) : {};
  const facilityId = String(body.facilityId || url.searchParams.get('facility') || '');
  const kind = facilityId ? 'daycare' : 'sitter';

  // Only allow redirects back to littleloop after checkout / portal.
  const safeReturn = (u: unknown, fallback: string) => {
    try {
      const parsed = new URL(String(u));
      return ['littleloop.xyz', 'www.littleloop.xyz', 'localhost'].includes(parsed.hostname) ? parsed.toString() : fallback;
    } catch { return fallback; }
  };

  // ── Who is paying: the sitter, or a daycare the caller manages ──
  let account: { customer: string | null; subscription: string | null; email: string; trialEnds: string | null; status: string | null } | null = null;
  if (kind === 'daycare') {
    const { data: me } = await sb.from('facility_staff').select('role')
      .eq('facility_id', facilityId).eq('user_id', user.id).eq('status', 'active').maybeSingle();
    if (!me || !['director', 'office'].includes(me.role)) return json({ error: 'Only the director or office can manage the plan.' }, 403);
    const { data: b } = await sb.from('facility_billing').select('*').eq('facility_id', facilityId).maybeSingle();
    if (!b) return json({ error: 'Daycare not found' }, 404);
    if (b.complimentary) return json({ error: 'This daycare is on a complimentary plan.' }, 409);
    account = { customer: b.stripe_customer_id, subscription: b.stripe_subscription_id, email: user.email ?? '', trialEnds: b.trial_ends_at, status: b.subscription_status };
  } else {
    const { data: sitter } = await sb.from('sitters').select('id, email, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_plan')
      .eq('id', user.id).maybeSingle();
    if (!sitter) return json({ error: 'Sitter not found' }, 404);
    account = { customer: sitter.stripe_customer_id, subscription: sitter.stripe_subscription_id, email: user.email ?? sitter.email ?? '', trialEnds: null, status: sitter.subscription_status };
  }

  // STATUS — re-sync from Stripe when we have a customer but lost track of the subscription
  if (action === 'status') {
    if (account.customer && (!account.status || account.status === 'none')) {
      const { data: subs } = await stripeReq(`/subscriptions?customer=${account.customer}&limit=1`);
      const live = subs?.data?.[0];
      if (live) await saveSubscription(sb, live);
    }
    if (kind === 'daycare') {
      const { data } = await sb.from('facility_billing').select('plan_tier, plan_interval, subscription_status, trial_ends_at, current_period_end, complimentary').eq('facility_id', facilityId).single();
      return json(data);
    }
    const { data } = await sb.from('sitters').select('subscription_status, subscription_plan, plan_tier, trial_ends_at, current_period_end, stripe_customer_id').eq('id', user.id).single();
    return json(data);
  }

  // CHECKOUT — a new subscription
  if (action === 'checkout') {
    if (!STRIPE_SECRET_KEY) return json({ error: 'Stripe not configured' }, 500);
    const tier = String(body.tier || ''), interval = body.interval === 'year' ? 'year' : 'month';
    if (!CATALOG[kind][tier]) return json({ error: 'Unknown plan' }, 400);
    if (account.subscription && ['active', 'trialing', 'past_due'].includes(account.status || '')) {
      return json({ error: 'You already have a plan. Use Change plan instead.' }, 409);
    }
    const priceId = await priceFor(kind, tier, interval);
    if (!priceId) return json({ error: 'Could not set up that plan. Please try again.' }, 500);

    let customerId = account.customer;
    if (!customerId) {
      const meta: Record<string, string> = kind === 'daycare'
        ? { 'metadata[facility_id]': facilityId, 'metadata[app]': 'littleloop', 'metadata[kind]': 'daycare' }
        : { 'metadata[sitter_id]': user.id, 'metadata[app]': 'littleloop', 'metadata[kind]': 'sitter' };
      if (kind === 'daycare') {
        const { data: f } = await sb.from('facilities').select('name').eq('id', facilityId).single();
        if (f?.name) meta.name = f.name;
      }
      const { ok, data: customer } = await stripeReq('/customers', 'POST', { email: account.email, ...meta });
      if (!ok || !customer.id) return json({ error: 'Failed to create Stripe customer' }, 500);
      customerId = customer.id;
      if (kind === 'daycare') await sb.from('facility_billing').update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() }).eq('facility_id', facilityId);
      else await sb.from('sitters').update({ stripe_customer_id: customerId }).eq('id', user.id);
    }

    const params: Record<string, string> = {
      customer: customerId!, mode: 'subscription', allow_promotion_codes: 'true',
      'line_items[0][price]': priceId, 'line_items[0][quantity]': '1',
      'subscription_data[metadata][app]': 'littleloop', 'subscription_data[metadata][kind]': kind,
      'subscription_data[metadata][tier]': tier, 'subscription_data[metadata][plan]': interval === 'year' ? 'yearly' : 'monthly',
      success_url: safeReturn(body.successUrl, 'https://littleloop.xyz/?subscribed=true'),
      cancel_url:  safeReturn(body.cancelUrl, 'https://littleloop.xyz/'),
    };
    if (kind === 'daycare') {
      params['subscription_data[metadata][facility_id]'] = facilityId;
      // Keep the rest of the free trial: billing starts when it would have ended
      // (Stripe needs at least 48 hours of trial left to do that).
      const ends = account.trialEnds ? new Date(account.trialEnds).getTime() : 0;
      if (ends > Date.now() + 49 * 3600 * 1000) params['subscription_data[trial_end]'] = String(Math.floor(ends / 1000));
    } else {
      params['subscription_data[metadata][sitter_id]'] = user.id;
      if (!account.subscription) params['subscription_data[trial_period_days]'] = String(SITTER_TRIAL_DAYS);
    }
    const { ok, data: session } = await stripeReq('/checkout/sessions', 'POST', params);
    if (!ok || !session?.url) return json({ error: 'Failed to create checkout session' }, 500);
    return json({ url: session.url });
  }

  // CHANGE — move an existing subscription to another tier / interval (prorated)
  if (action === 'change') {
    const tier = String(body.tier || ''), interval = body.interval === 'year' ? 'year' : 'month';
    if (!CATALOG[kind][tier]) return json({ error: 'Unknown plan' }, 400);
    if (!account.subscription) return json({ error: 'No plan to change yet.' }, 409);
    const { ok: subOk, data: sub } = await stripeReq(`/subscriptions/${account.subscription}`);
    const itemId = sub?.items?.data?.[0]?.id;
    if (!subOk || !itemId) return json({ error: 'Could not find your subscription.' }, 404);
    const priceId = await priceFor(kind, tier, interval);
    if (!priceId) return json({ error: 'Could not set up that plan. Please try again.' }, 500);
    const { ok, data: updated } = await stripeReq(`/subscriptions/${account.subscription}`, 'POST', {
      'items[0][id]': itemId, 'items[0][price]': priceId, proration_behavior: 'create_prorations',
      'metadata[tier]': tier, 'metadata[plan]': interval === 'year' ? 'yearly' : 'monthly', 'metadata[kind]': kind,
      ...(kind === 'daycare' ? { 'metadata[facility_id]': facilityId } : { 'metadata[sitter_id]': user.id }),
    });
    if (!ok) return json({ error: 'Could not change the plan. Please try again.' }, 500);
    await saveSubscription(sb, updated);
    return json({ ok: true });
  }

  // PORTAL — card, invoices, cancel
  if (action === 'portal') {
    if (!account.customer) return json({ error: 'No subscription found' }, 400);
    const { data: session } = await stripeReq('/billing_portal/sessions', 'POST', {
      customer: account.customer, return_url: safeReturn(body.returnUrl, 'https://littleloop.xyz/'),
    });
    return json({ url: session.url });
  }

  return json({ error: 'Unknown action', action }, 400);
});
