import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MONTHLY_PRICE_ID = 'price_1TRfyBIWdNp2pEQKH5z9ACS8';
const YEARLY_PRICE_ID  = 'price_1TRfyBIWdNp2pEQKMvZUw6wr';

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
    if (sub.status === 'canceled' || sub.status === 'incomplete_expired') {
      await sb.from('sitters').update({ subscription_status: 'canceled', stripe_subscription_id: null })
        .eq('stripe_customer_id', sub.customer);
    } else {
      await sb.from('sitters').update({
        stripe_subscription_id: sub.id,
        subscription_status:    sub.status,
        subscription_plan:      sub.metadata?.plan || 'monthly',
        current_period_end:     iso(sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end),
        trial_ends_at:          iso(sub.trial_end),
      }).eq('stripe_customer_id', sub.customer);
    }
    return json({ received: true });
  }

  if (type === 'invoice.payment_failed') {
    const { ok, data: inv } = await stripeReq(`/invoices/${objId}`);
    if (!ok || !inv?.customer) return json({ error: 'Unknown invoice' }, 400);
    if (inv.status !== 'paid' && inv.attempt_count > 0) {
      await sb.from('sitters').update({ subscription_status: 'past_due' }).eq('stripe_customer_id', inv.customer);
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
  const { data: sitter, error: sitterErr } = await sb
    .from('sitters')
    .select('id, email, stripe_customer_id, subscription_status')
    .eq('id', user.id)
    .single();
  if (sitterErr || !sitter) {
    console.error('Sitter not found:', sitterErr);
    return json({ error: 'Sitter not found' }, 404);
  }

  const body = req.method !== 'GET' ? await req.json().catch(() => ({})) : {};

  // STATUS
  if (action === 'status') {
    const { data } = await sb
      .from('sitters')
      .select('subscription_status, subscription_plan, trial_ends_at, current_period_end, stripe_customer_id')
      .eq('id', sitter.id)
      .single();
    if (data?.stripe_customer_id && (!data?.subscription_status || data?.subscription_status === 'none')) {
      const { data: subs } = await stripeReq(`/subscriptions?customer=${data.stripe_customer_id}&limit=1`);
      const liveSub = subs?.data?.[0];
      if (liveSub) {
        const update = {
          stripe_subscription_id: liveSub.id,
          subscription_status:    liveSub.status,
          subscription_plan:      liveSub.metadata?.plan || 'monthly',
          current_period_end:     iso(liveSub.current_period_end ?? liveSub.items?.data?.[0]?.current_period_end),
          trial_ends_at:          iso(liveSub.trial_end),
        };
        await sb.from('sitters').update(update).eq('id', sitter.id);
        return json({ ...update, stripe_customer_id: data.stripe_customer_id });
      }
    }
    return json(data);
  }

  // Only allow redirects back to littleloop after checkout / portal.
  const safeReturn = (u: unknown, fallback: string) => {
    try {
      const parsed = new URL(String(u));
      return ['littleloop.xyz', 'www.littleloop.xyz', 'localhost'].includes(parsed.hostname) ? parsed.toString() : fallback;
    } catch { return fallback; }
  };

  // CHECKOUT
  if (action === 'checkout') {
    const { plan, successUrl, cancelUrl } = body;
    if (!STRIPE_SECRET_KEY) return json({ error: 'Stripe not configured' }, 500);

    const priceId = plan === 'yearly' ? YEARLY_PRICE_ID : MONTHLY_PRICE_ID;
    let customerId = sitter.stripe_customer_id;

    if (!customerId) {
      const { ok, data: customer } = await stripeReq('/customers', 'POST', {
        email:                 user.email ?? sitter.email ?? '',
        'metadata[sitter_id]': user.id,
        'metadata[app]':       'littleloop',
      });
      if (!ok || !customer.id) return json({ error: 'Failed to create Stripe customer' }, 500);
      customerId = customer.id;
      await sb.from('sitters').update({ stripe_customer_id: customerId }).eq('id', sitter.id);
    }

    const { ok, data: session } = await stripeReq('/checkout/sessions', 'POST', {
      customer:                                 customerId,
      mode:                                     'subscription',
      allow_promotion_codes:                    'true',
      'line_items[0][price]':                   priceId,
      'line_items[0][quantity]':                '1',
      'subscription_data[trial_period_days]':   '90',
      'subscription_data[metadata][sitter_id]': sitter.id,
      'subscription_data[metadata][plan]':      plan === 'yearly' ? 'yearly' : 'monthly',
      'subscription_data[metadata][app]':       'littleloop',
      success_url: safeReturn(successUrl, 'https://littleloop.xyz/?subscribed=true'),
      cancel_url:  safeReturn(cancelUrl, 'https://littleloop.xyz/'),
    });
    if (!ok || !session?.url) return json({ error: 'Failed to create checkout session' }, 500);
    return json({ url: session.url });
  }

  // PORTAL
  if (action === 'portal') {
    if (!sitter.stripe_customer_id) return json({ error: 'No subscription found' }, 400);
    const { data: session } = await stripeReq('/billing_portal/sessions', 'POST', {
      customer:   sitter.stripe_customer_id,
      return_url: safeReturn(body.returnUrl, 'https://littleloop.xyz/'),
    });
    return json({ url: session.url });
  }

  return json({ error: 'Unknown action', action }, 400);
});
