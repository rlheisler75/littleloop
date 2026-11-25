// Daycare online payments (phase 4C): Stripe Connect with standard accounts and direct charges.
// Each daycare connects its own Stripe account; parents pay on Stripe Checkout created ON that
// account, so the money goes straight to the daycare and Stripe charges the daycare its fees.
// littleloop's platform fee (daycare_payment_accounts.fee_bps, 25 = 0.25%) is the application fee.
// littleloop never sees card or bank details and never holds the money.
//
// Actions (POST JSON { action, ... }, signed-in user unless noted):
//   connect   { facilityId, returnUrl }  director/office: create the daycare's Stripe account the
//             first time, then return a Stripe onboarding link (also used to finish onboarding).
//   status    { facilityId }             director/office: refresh the account from Stripe.
//   checkout  { facilityId, familyId, amount, returnUrl }  a parent on the family: Stripe Checkout.
//   confirm   { paymentId }              the parent or director/office: re-check one payment.
//   reconcile                            pg_cron (x-cron-secret) or the service key: re-check open
//             payments and unfinished accounts (bank payments clear in about 4 business days).
// Webhook (a Stripe Connect endpoint, header stripe-signature): the body is untrusted. It only says
// WHICH account or payment changed; the real state is always read back from Stripe.
// Keys: STRIPE_SECRET_KEY (live); STRIPE_TEST_SECRET_KEY for accounts with test_mode (demo daycares).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LIVE_KEY     = Deno.env.get("STRIPE_SECRET_KEY") || "";
const TEST_KEY     = Deno.env.get("STRIPE_TEST_SECRET_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n) || 0);
const nowIso = () => new Date().toISOString();
const iso = (secs?: number | null) => (secs ? new Date(secs * 1000).toISOString() : null);

async function stripe(test: boolean, path: string, method = "GET", body?: Record<string, string>, account?: string) {
  const key = test ? TEST_KEY : LIVE_KEY;
  if (!key) return { ok: false, status: 500, data: { error: { message: test ? "Stripe test mode isn't set up yet." : "Stripe isn't set up yet." } } };
  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" };
  if (account) headers["Stripe-Account"] = account;
  const res = await fetch(`https://api.stripe.com/v1${path}`, { method, headers, body: body ? new URLSearchParams(body).toString() : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) console.error(`Stripe ${method} ${path} =>`, res.status, JSON.stringify(data?.error || data));
  return { ok: res.ok, status: res.status, data };
}
const stripeMsg = (r: any) => r?.data?.error?.message || "Stripe didn't answer. Please try again.";

// Only send people back to littleloop
function baseUrl(u: unknown) {
  try {
    const p = new URL(String(u));
    if (["littleloop.xyz", "www.littleloop.xyz", "localhost"].includes(p.hostname)) return `${p.origin}/`;
  } catch { /* fall through */ }
  return "https://www.littleloop.xyz/";
}
const withParams = (base: string, params: Record<string, string>) => {
  const u = new URL(base);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
};

async function parentIds(sb: any, familyId: string) {
  const { data } = await sb.from("members").select("user_id").eq("family_id", familyId)
    .in("role", ["admin", "member"]).eq("status", "active").not("user_id", "is", null);
  return [...new Set((data || []).map((m: any) => m.user_id))] as string[];
}
async function managerIds(sb: any, facilityId: string) {
  const { data } = await sb.from("facility_staff").select("user_id").eq("facility_id", facilityId)
    .eq("status", "active").in("role", ["director", "office"]).not("user_id", "is", null);
  return [...new Set((data || []).map((m: any) => m.user_id))] as string[];
}
async function notify(sb: any, userIds: string[], title: string, body: string, data: Record<string, unknown>) {
  if (!userIds.length) return;
  await sb.from("notifications").insert(userIds.map((uid) => ({ user_id: uid, type: "daycare_payment", title, body, read: false, data })));
  await sb.functions.invoke("send-push", { body: { userIds, title, body, url: "/", tag: "daycare_billing" } })
    .catch((e: any) => console.error("daycare-payments push:", e));
}

// Tell the family and the director/office what happened to a payment
async function announce(sb: any, p: any, kind: "paid" | "failed" | "refunded" | "disputed", refunded = 0) {
  const [{ data: fac }, { data: fam }] = await Promise.all([
    sb.from("facilities").select("name").eq("id", p.facility_id).maybeSingle(),
    sb.from("families").select("name").eq("id", p.family_id).maybeSingle(),
  ]);
  const facName = fac?.name || "the daycare", famName = fam?.name ? `The ${fam.name} family` : "A family";
  const data = { facility_id: p.facility_id, family_id: p.family_id, payment_id: p.id };
  const [parents, managers] = await Promise.all([parentIds(sb, p.family_id), managerIds(sb, p.facility_id)]);
  const amt = money(p.amount);
  if (kind === "paid") {
    await notify(sb, parents, "Payment received", `${amt} paid to ${facName}. Thank you!`, data);
    await notify(sb, managers, `${famName} paid ${amt} online`, p.method === "bank" ? "The bank payment cleared. It's on their account." : "Card payment. It's on their account.", data);
  } else if (kind === "failed") {
    const why = p.failure_reason || "The payment didn't go through.";
    await notify(sb, parents, "Your payment didn't go through", `${amt} to ${facName}: ${why} Your balance hasn't changed.`, data);
    await notify(sb, managers, `${famName}'s ${amt} online payment didn't go through`, why, data);
  } else if (kind === "refunded") {
    await notify(sb, parents, `Refund from ${facName}`, `${money(refunded)} of your ${amt} payment was refunded.`, data);
    await notify(sb, managers, `Refund recorded for ${famName.replace(/^The /, "the ")}`, `${money(refunded)} of ${amt} refunded in Stripe. Their balance is updated.`, data);
  } else {
    await notify(sb, managers, `${famName} disputed a ${amt} card payment`, "Respond in your Stripe dashboard before Stripe's deadline. The payment stays on their account until it's settled.", data);
  }
}

async function refreshAccount(sb: any, acct: any) {
  if (!acct?.stripe_account_id) return acct;
  const r = await stripe(acct.test_mode, `/accounts/${acct.stripe_account_id}`);
  if (!r.ok) return acct;
  const a = r.data;
  const due = [...(a.requirements?.currently_due || []), ...(a.requirements?.past_due || [])];
  const ach = a.capabilities?.us_bank_account_ach_payments;
  const upd = {
    charges_enabled: !!a.charges_enabled, payouts_enabled: !!a.payouts_enabled, details_submitted: !!a.details_submitted,
    bank_available: ach === undefined ? acct.bank_available : ach === "active",
    requirements: due.length ? "Stripe needs a few more details." : a.requirements?.disabled_reason ? "Stripe is reviewing the account." : null,
    updated_at: nowIso(),
  };
  await sb.from("daycare_payment_accounts").update(upd).eq("facility_id", acct.facility_id);
  return { ...acct, ...upd };
}

// Bring one payment in step with Stripe; record it, follow refunds, and tell people once
async function syncPayment(sb: any, row: any) {
  if (!row?.checkout_session_id) return row;
  const r = await stripe(row.test_mode, `/checkout/sessions/${row.checkout_session_id}?expand[]=payment_intent.latest_charge`, "GET", undefined, row.stripe_account_id);
  if (!r.ok) return row;
  const s = r.data;
  const pi = s.payment_intent && typeof s.payment_intent === "object" ? s.payment_intent : null;
  const ch = pi && pi.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null;

  let status = row.status;
  if (s.status === "expired") { if (row.status === "started") status = "expired"; }
  else if (s.status === "complete") {
    if (s.payment_status === "paid" || pi?.status === "succeeded") status = "paid";
    else if (pi && ["requires_payment_method", "canceled"].includes(pi.status)) status = "failed";
    else status = "processing";
  }
  if (["refunded", "partially_refunded"].includes(row.status) && status === "paid") status = row.status;

  const type = ch?.payment_method_details?.type;
  const upd: Record<string, unknown> = {
    method: type === "us_bank_account" ? "bank" : type === "card" ? "card" : row.method,
    payment_intent_id: pi?.id || row.payment_intent_id,
    failure_reason: status === "failed" ? (pi?.last_payment_error?.message || ch?.failure_message || "The payment didn't go through.") : row.failure_reason,
    paid_at: row.paid_at || (status === "paid" ? (iso(ch?.created) || nowIso()) : null),
    disputed: row.disputed || !!ch?.disputed,
    updated_at: nowIso(),
  };
  await sb.from("daycare_online_payments").update(upd).eq("id", row.id);
  let next = { ...row, ...upd };

  // Status changes only from what we read, so two checks at once announce it once
  if (status !== row.status) {
    const { data: moved } = await sb.from("daycare_online_payments").update({ status, updated_at: nowIso() })
      .eq("id", row.id).eq("status", row.status).select("id");
    next = { ...next, status };
    if (moved?.length) {
      if (status === "paid") {
        const { error } = await sb.rpc("daycare_record_online_payment", { p_id: row.id });
        if (error) console.error("record payment:", error.message);
        else await announce(sb, next, "paid");
      } else if (status === "failed") {
        await announce(sb, next, "failed");
      }
    }
  } else if (status === "paid" && !row.ledger_id) {
    const { error } = await sb.rpc("daycare_record_online_payment", { p_id: row.id });   // a retry after a hiccup
    if (error) console.error("record payment:", error.message);
  }

  const refunded = (Number(ch?.amount_refunded) || 0) / 100;
  if (refunded > Number(row.refunded_amount || 0) + 0.004 && ["paid", "refunded", "partially_refunded"].includes(next.status)) {
    const { data: changed, error } = await sb.rpc("daycare_online_payment_refunded", { p_id: row.id, p_refunded: refunded });
    if (error) console.error("refund:", error.message);
    else if (changed) await announce(sb, next, "refunded", refunded);
  }
  if (upd.disputed && !row.disputed) await announce(sb, next, "disputed");
  return next;
}

async function handleWebhook(sb: any, text: string) {
  let event: any;
  try { event = JSON.parse(text); } catch { return reply({ error: "Bad payload" }, 400); }
  const type = String(event?.type || "");
  const obj = event?.data?.object || {};
  const fromAcct = String(event?.account || "");
  const id = String(obj?.id || "");

  if (type.startsWith("account.") || type.startsWith("capability.")) {
    const acctId = type.startsWith("account.") ? id : fromAcct;
    if (!/^acct_[A-Za-z0-9]+$/.test(acctId)) return reply({ received: true });
    const { data: acct } = await sb.from("daycare_payment_accounts").select("*").eq("stripe_account_id", acctId).maybeSingle();
    if (acct) await refreshAccount(sb, acct);
    return reply({ received: true });
  }
  let row: any = null;
  if (type.startsWith("checkout.session.") && /^cs_[A-Za-z0-9_]+$/.test(id)) {
    ({ data: row } = await sb.from("daycare_online_payments").select("*").eq("checkout_session_id", id).maybeSingle());
  } else if (type.startsWith("payment_intent.") && /^pi_[A-Za-z0-9]+$/.test(id)) {
    ({ data: row } = await sb.from("daycare_online_payments").select("*").eq("payment_intent_id", id).maybeSingle());
  } else if (type.startsWith("charge.")) {   // charges, refunds and disputes all carry the payment intent
    const piId = String(obj?.payment_intent || "");
    if (/^pi_[A-Za-z0-9]+$/.test(piId) && /^acct_[A-Za-z0-9]+$/.test(fromAcct)) {
      ({ data: row } = await sb.from("daycare_online_payments").select("*").eq("payment_intent_id", piId).eq("stripe_account_id", fromAcct).maybeSingle());
    }
  }
  if (row) await syncPayment(sb, row);
  return reply({ received: true });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  try {
    if (req.headers.get("stripe-signature")) return await handleWebhook(sb, await req.text());

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");

    // ── Scheduler ──
    if (action === "reconcile") {
      let allowed = bearer === SERVICE_KEY;
      const secret = req.headers.get("x-cron-secret") || "";
      if (!allowed && secret) { const { data } = await sb.rpc("check_cron_secret", { p_secret: secret }); allowed = data === true; }
      if (!allowed) return reply({ error: "Forbidden" }, 403);
      const since = new Date(Date.now() - 21 * 86400000).toISOString();
      const { data: open } = await sb.from("daycare_online_payments").select("*").in("status", ["started", "processing"])
        .gte("created_at", since).order("created_at").limit(60);
      for (const p of open || []) await syncPayment(sb, p);
      const { data: accts } = await sb.from("daycare_payment_accounts").select("*").not("stripe_account_id", "is", null)
        .eq("charges_enabled", false).gte("updated_at", new Date(Date.now() - 30 * 86400000).toISOString()).limit(30);
      for (const a of accts || []) await refreshAccount(sb, a);
      return reply({ payments: (open || []).length, accounts: (accts || []).length });
    }

    // ── Signed-in people ──
    const { data: auth } = bearer ? await sb.auth.getUser(bearer) : { data: null };
    const user = auth?.user;
    if (!user) return reply({ error: "Unauthorized" }, 401);
    const isManager = async (facilityId: string) => {
      const { data } = await sb.from("facility_staff").select("role").eq("facility_id", facilityId)
        .eq("user_id", user.id).eq("status", "active").maybeSingle();
      return !!data && ["director", "office"].includes(data.role);
    };
    const isParentOf = async (familyId: string) => {
      const { data } = await sb.from("members").select("role").eq("family_id", familyId).eq("user_id", user.id)
        .eq("status", "active").in("role", ["admin", "member"]).maybeSingle();
      return !!data;
    };
    const facilityId = String(body.facilityId || "");

    if (action === "connect" || action === "status") {
      if (!/^[0-9a-f-]{36}$/.test(facilityId) || !(await isManager(facilityId))) return reply({ error: "Only the director or office can set up online payments." }, 403);
      let { data: acct } = await sb.from("daycare_payment_accounts").select("*").eq("facility_id", facilityId).maybeSingle();
      if (action === "status") return reply({ account: acct ? await refreshAccount(sb, acct) : null });

      if (!acct) {
        await sb.from("daycare_payment_accounts").upsert({ facility_id: facilityId }, { onConflict: "facility_id", ignoreDuplicates: true });
        ({ data: acct } = await sb.from("daycare_payment_accounts").select("*").eq("facility_id", facilityId).maybeSingle());
      }
      if (!acct.stripe_account_id) {
        const { data: fac } = await sb.from("facilities").select("name").eq("id", facilityId).maybeSingle();
        const params: Record<string, string> = {
          type: "standard", country: "US",
          "business_profile[name]": fac?.name || "Daycare", "business_profile[mcc]": "8351",
          "business_profile[product_description]": "Child care tuition and fees",
          "metadata[facility_id]": facilityId, "metadata[app]": "littleloop",
        };
        if (user.email) params.email = user.email;
        const r = await stripe(acct.test_mode, "/accounts", "POST", params);
        if (!r.ok || !r.data?.id) return reply({ error: `Couldn't start Stripe setup: ${stripeMsg(r)}` }, 502);
        const { data: saved } = await sb.from("daycare_payment_accounts").update({ stripe_account_id: r.data.id, updated_at: nowIso() })
          .eq("facility_id", facilityId).is("stripe_account_id", null).select("*").maybeSingle();
        if (saved) acct = saved;
        else ({ data: acct } = await sb.from("daycare_payment_accounts").select("*").eq("facility_id", facilityId).maybeSingle());
      }
      const base = baseUrl(body.returnUrl);
      const link = await stripe(acct.test_mode, "/account_links", "POST", {
        account: acct.stripe_account_id, type: "account_onboarding",
        refresh_url: withParams(base, { daycare_connect: "retry" }), return_url: withParams(base, { daycare_connect: "done" }),
      });
      if (!link.ok || !link.data?.url) return reply({ error: `Couldn't open Stripe: ${stripeMsg(link)}` }, 502);
      return reply({ url: link.data.url });
    }

    if (action === "checkout") {
      const familyId = String(body.familyId || "");
      if (!/^[0-9a-f-]{36}$/.test(facilityId) || !/^[0-9a-f-]{36}$/.test(familyId)) return reply({ error: "Missing daycare or family." }, 400);
      if (!(await isParentOf(familyId))) return reply({ error: "Only a parent on this family's account can pay." }, 403);
      const { data: link } = await sb.from("facility_families").select("status").eq("facility_id", facilityId).eq("family_id", familyId).maybeSingle();
      if (!link || link.status !== "active") return reply({ error: "Your family isn't connected to this daycare." }, 403);
      const { data: acct } = await sb.from("daycare_payment_accounts").select("*").eq("facility_id", facilityId).maybeSingle();
      if (!acct?.stripe_account_id || !acct.charges_enabled) return reply({ error: "This daycare doesn't take online payments yet." }, 409);
      const methods = [...(acct.card_enabled ? ["card"] : []), ...(acct.bank_enabled && acct.bank_available ? ["us_bank_account"] : [])];
      if (!methods.length) return reply({ error: "This daycare has online payments turned off right now." }, 409);

      const [{ data: entries }, { data: pending }, { data: fac }, { data: fam }] = await Promise.all([
        sb.from("daycare_ledger").select("kind, amount").eq("facility_id", facilityId).eq("family_id", familyId).eq("payer", "family").is("voided_at", null),
        sb.from("daycare_online_payments").select("amount").eq("facility_id", facilityId).eq("family_id", familyId).eq("status", "processing"),
        sb.from("facilities").select("name").eq("id", facilityId).maybeSingle(),
        sb.from("families").select("name").eq("id", familyId).maybeSingle(),
      ]);
      const balanceCents = Math.round((entries || []).reduce((s: number, e: any) => s + (e.kind === "charge" ? 1 : -1) * Number(e.amount), 0) * 100)
                         - Math.round((pending || []).reduce((s: number, p: any) => s + Number(p.amount), 0) * 100);
      const cents = Math.round(Number(body.amount) * 100);
      if (!(cents >= 100)) return reply({ error: "Pay at least $1.00." }, 400);
      if (cents > balanceCents) return reply({ error: balanceCents > 0 ? `That's more than you owe (${money(balanceCents / 100)}).` : "There's nothing to pay right now." }, 400);
      const fee = Math.round(cents * (Number(acct.fee_bps) || 0) / 10000);

      const { data: row, error: insErr } = await sb.from("daycare_online_payments").insert({
        facility_id: facilityId, family_id: familyId, amount: cents / 100, fee: fee / 100, test_mode: acct.test_mode,
        stripe_account_id: acct.stripe_account_id, paid_by: user.id,
        paid_by_name: (user.user_metadata?.name || user.email?.split("@")[0] || "").slice(0, 120) || null,
      }).select("*").single();
      if (insErr || !row) return reply({ error: "Couldn't start the payment. Please try again." }, 500);

      const base = baseUrl(body.returnUrl);
      const facName = fac?.name || "your daycare";
      const params = (types: string[]) => {
        const p: Record<string, string> = {
          mode: "payment", client_reference_id: row.id,
          "line_items[0][quantity]": "1",
          "line_items[0][price_data][currency]": "usd",
          "line_items[0][price_data][unit_amount]": String(cents),
          "line_items[0][price_data][product_data][name]": `Payment to ${facName}`,
          "line_items[0][price_data][product_data][description]": `${fam?.name ? `${fam.name} family` : "Family"} account`,
          "payment_intent_data[description]": `${facName}: ${fam?.name || "family"} account`,
          "payment_intent_data[metadata][payment_id]": row.id, "payment_intent_data[metadata][facility_id]": facilityId,
          "payment_intent_data[metadata][family_id]": familyId, "payment_intent_data[metadata][app]": "littleloop",
          "metadata[payment_id]": row.id, "metadata[app]": "littleloop",
          success_url: withParams(base, { daycare_paid: row.id, daycare: facilityId }),
          cancel_url: withParams(base, { daycare_pay: "canceled", daycare: facilityId }),
        };
        if (fee > 0) p["payment_intent_data[application_fee_amount]"] = String(fee);
        if (user.email) p.customer_email = user.email;
        types.forEach((t, i) => { p[`payment_method_types[${i}]`] = t; });
        return p;
      };
      let r = await stripe(acct.test_mode, "/checkout/sessions", "POST", params(methods), acct.stripe_account_id);
      if (!r.ok && methods.includes("us_bank_account") && /us_bank_account|ach/i.test(stripeMsg(r))) {
        // The daycare's Stripe account can't take bank payments yet: remember that, and offer card
        await sb.from("daycare_payment_accounts").update({ bank_available: false, updated_at: nowIso() }).eq("facility_id", facilityId);
        if (acct.card_enabled) r = await stripe(acct.test_mode, "/checkout/sessions", "POST", params(["card"]), acct.stripe_account_id);
      }
      if (!r.ok || !r.data?.url) {
        await sb.from("daycare_online_payments").update({ status: "failed", failure_reason: stripeMsg(r).slice(0, 300), updated_at: nowIso() }).eq("id", row.id);
        return reply({ error: `Couldn't start the payment: ${stripeMsg(r)}` }, 502);
      }
      await sb.from("daycare_online_payments").update({ checkout_session_id: r.data.id, updated_at: nowIso() }).eq("id", row.id);
      return reply({ url: r.data.url });
    }

    if (action === "confirm") {
      const paymentId = String(body.paymentId || "");
      if (!/^[0-9a-f-]{36}$/.test(paymentId)) return reply({ error: "Missing payment." }, 400);
      const { data: row } = await sb.from("daycare_online_payments").select("*").eq("id", paymentId).maybeSingle();
      if (!row) return reply({ error: "Payment not found." }, 404);
      if (row.paid_by !== user.id && !(await isParentOf(row.family_id)) && !(await isManager(row.facility_id))) return reply({ error: "Payment not found." }, 404);
      const next = await syncPayment(sb, row);
      return reply({ payment: { id: next.id, status: next.status, amount: next.amount, method: next.method, facility_id: next.facility_id } });
    }

    return reply({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("daycare-payments error:", err);
    return reply({ error: "Something went wrong. Please try again." }, 500);
  }
});
