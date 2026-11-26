// Daycare billing messages (phase 4A). Statements and reminders reach a family's parents by
// email (amounts and dates only, no health information) and, for parents with a login, by
// push; statement bells are added by daycare_billing_run() itself.
//   { action: "statements", statementIds } -> after the office runs billing. Caller: the
//        director or office of each statement's daycare; statements made in the last 30 min.
//   { action: "reminder", facilityId, familyId } -> a past-due reminder (bell + push + email).
//        Caller: the director or office.
//   { action: "run_due" } -> pg_cron (x-cron-secret) or the service key: automatic billing
//        (daycare_run_due_billing) for every daycare whose bill day has come, then sends them.
// Recipients are always looked up here (the family's parents), never taken from the request.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY   = Deno.env.get("RESEND_API_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n) || 0);
const day = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

async function parents(sb: any, familyId: string) {
  const { data } = await sb.from("members").select("user_id, email, status, role")
    .eq("family_id", familyId).in("role", ["admin", "member"]).in("status", ["active", "pending"]);
  const rows = data || [];
  return {
    userIds: [...new Set(rows.filter((m: any) => m.user_id && m.status === "active").map((m: any) => m.user_id))] as string[],
    emails: [...new Set(rows.map((m: any) => (m.email || "").trim().toLowerCase()).filter((e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)))] as string[],
  };
}

function layout(facility: any, inner: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#FFF8EE;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#22244D">
  <div style="max-width:540px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #F1E6D6">
    <div style="padding:22px 30px;background:#2B2D6B;color:#fff">
      <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;opacity:.8">littleloop</div>
      <div style="font-size:20px;font-weight:700;margin-top:2px">${esc(facility?.name || "Your daycare")}</div>
    </div>
    <div style="padding:24px 30px">${inner}</div>
    <div style="padding:14px 30px;border-top:1px solid #F1E6D6;font-size:11px;color:#8A8DAE">
      ${esc([facility?.phone, facility?.email].filter(Boolean).join(" · "))}<br>Sent by littleloop for ${esc(facility?.name || "your daycare")}. Questions about your bill? Reply to this email or contact the daycare.
    </div>
  </div>
</body></html>`;
}

async function sendEmail(to: string[], subject: string, html: string, replyTo?: string | null) {
  if (!to.length) return { sent: 0 };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "littleloop <hello@littleloop.xyz>", reply_to: replyTo || "littleloop@loopwaresolutions.com", to, subject, html }),
  });
  if (!res.ok) { console.error("daycare-billing email failed:", res.status, await res.text()); return { sent: 0, error: `Email failed (${res.status})` }; }
  return { sent: to.length };
}

async function push(sb: any, userIds: string[], title: string, body: string) {
  if (!userIds.length) return;
  await sb.functions.invoke("send-push", { body: { userIds, title, body, url: "/", tag: "daycare_billing" } })
    .catch((e: any) => console.error("daycare-billing push:", e));
}

async function sendStatement(sb: any, statementId: string) {
  const { data: st } = await sb.from("daycare_statements").select("*").eq("id", statementId).maybeSingle();
  if (!st) return { id: statementId, error: "not found" };
  const [{ data: fac }, { data: fam }, { data: lines }, { data: settings }] = await Promise.all([
    sb.from("facilities").select("name, phone, email").eq("id", st.facility_id).maybeSingle(),
    sb.from("families").select("name").eq("id", st.family_id).maybeSingle(),
    sb.from("daycare_ledger").select("kind, description, amount, entry_date, method, period_start, period_end, voided_at")
      .eq("statement_id", st.id).is("voided_at", null).order("entry_date"),
    sb.from("daycare_billing_settings").select("payment_instructions").eq("facility_id", st.facility_id).maybeSingle(),
  ]);
  const who = await parents(sb, st.family_id);
  const rows = (lines || []).map((l: any) => `<tr><td style="padding:6px 0;border-bottom:1px solid #F4EDE2">${esc(l.description || (l.kind === "payment" ? "Payment" : l.kind === "credit" ? "Credit" : "Charge"))}${l.period_start ? `<div style="font-size:11px;color:#8A8DAE">${esc(day(l.period_start))} – ${esc(day(l.period_end))}</div>` : ""}</td>
    <td style="padding:6px 0;border-bottom:1px solid #F4EDE2;text-align:right;white-space:nowrap">${l.kind === "charge" ? "" : "−"}${esc(money(l.amount))}</td></tr>`).join("");
  const due = Number(st.balance_due);
  const html = layout(fac, `
    <div style="font-size:13px;color:#686B90">Statement #${esc(st.number)} · ${esc(fam?.name || "")}</div>
    <div style="font-size:26px;font-weight:700;margin:6px 0 2px">${due > 0 ? `${esc(money(due))} due` : "Paid up. Thank you!"}</div>
    ${due > 0 ? `<div style="font-size:13px;color:#686B90">by ${esc(day(st.due_date))}</div>` : ""}
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:18px 0 8px">
      <tr><td style="padding:6px 0;color:#686B90">Previous balance</td><td style="text-align:right">${esc(money(st.previous_balance))}</td></tr>
      ${rows}
      <tr><td style="padding:8px 0;font-weight:700">Balance due</td><td style="padding:8px 0;text-align:right;font-weight:700">${esc(money(due))}</td></tr>
    </table>
    ${settings?.payment_instructions ? `<div style="font-size:13px;background:#FFF8EE;border-radius:10px;padding:10px 12px;margin-top:10px"><b>How to pay:</b> ${esc(settings.payment_instructions)}</div>` : ""}
    ${who.userIds.length ? `<div style="margin-top:20px"><a href="https://littleloop.xyz/" style="display:inline-block;background:#E8553F;color:#fff;padding:10px 22px;border-radius:999px;text-decoration:none;font-weight:700;font-size:13px">See it in littleloop</a></div>` : ""}`);
  const subject = due > 0 ? `${fac?.name || "Daycare"}: ${money(due)} due ${day(st.due_date)}` : `${fac?.name || "Daycare"}: statement #${st.number}`;
  const mail = await sendEmail(who.emails, subject, html, fac?.email);
  await push(sb, who.userIds, `Statement from ${fac?.name || "your daycare"}`, due > 0 ? `${money(due)} due by ${day(st.due_date)}` : "Your account is paid up.");
  return { id: st.id, emailed: mail.sent, pushed: who.userIds.length, error: mail.error };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");

    // ── Automatic billing (scheduler only) ──
    if (action === "run_due") {
      let allowed = bearer === SERVICE_KEY;
      const secret = req.headers.get("x-cron-secret") || "";
      if (!allowed && secret) { const { data } = await sb.rpc("check_cron_secret", { p_secret: secret }); allowed = data === true; }
      if (!allowed) return reply({ error: "Forbidden" }, 403);
      const { data: runs, error } = await sb.rpc("daycare_run_due_billing");
      if (error) return reply({ error: error.message }, 500);
      const results: any[] = [];
      for (const r of runs || []) for (const id of r.created || []) results.push(await sendStatement(sb, id));
      return reply({ runs, sent: results });
    }

    // ── Staff actions ──
    const { data: auth } = bearer ? await sb.auth.getUser(bearer) : { data: null };
    const user = auth?.user;
    if (!user) return reply({ error: "Unauthorized" }, 401);
    const isManager = async (facilityId: string) => {
      const { data } = await sb.from("facility_staff").select("role").eq("facility_id", facilityId)
        .eq("user_id", user.id).eq("status", "active").maybeSingle();
      return !!data && ["director", "office"].includes(data.role);
    };

    if (action === "statements") {
      const ids = (Array.isArray(body.statementIds) ? body.statementIds : []).filter((x: unknown) => typeof x === "string").slice(0, 300);
      if (!ids.length) return reply({ sent: [] });
      const { data: sts } = await sb.from("daycare_statements").select("id, facility_id, created_at").in("id", ids);
      const okFacilities = new Map<string, boolean>();
      const results: any[] = [];
      for (const st of sts || []) {
        if (!okFacilities.has(st.facility_id)) okFacilities.set(st.facility_id, await isManager(st.facility_id));
        if (!okFacilities.get(st.facility_id)) { results.push({ id: st.id, error: "Forbidden" }); continue; }
        if (Date.now() - new Date(st.created_at).getTime() > 30 * 60 * 1000) { results.push({ id: st.id, error: "Too old to send again" }); continue; }
        results.push(await sendStatement(sb, st.id));
      }
      return reply({ sent: results });
    }

    if (action === "reminder") {
      const facilityId = String(body.facilityId || ""), familyId = String(body.familyId || "");
      if (!(await isManager(facilityId))) return reply({ error: "Only the director or office can send reminders." }, 403);
      const { data: link } = await sb.from("facility_families").select("id").eq("facility_id", facilityId).eq("family_id", familyId).maybeSingle();
      if (!link) return reply({ error: "That family isn't connected to this daycare." }, 404);
      const { data: entries } = await sb.from("daycare_ledger").select("kind, amount")
        .eq("facility_id", facilityId).eq("family_id", familyId).eq("payer", "family").is("voided_at", null);
      const balance = (entries || []).reduce((s: number, e: any) => s + (e.kind === "charge" ? 1 : -1) * Number(e.amount), 0);
      if (balance <= 0) return reply({ error: "This family doesn't owe anything." }, 409);
      const [{ data: fac }, { data: settings }] = await Promise.all([
        sb.from("facilities").select("name, phone, email").eq("id", facilityId).maybeSingle(),
        sb.from("daycare_billing_settings").select("payment_instructions").eq("facility_id", facilityId).maybeSingle(),
      ]);
      const who = await parents(sb, familyId);
      const title = `Payment reminder from ${fac?.name || "your daycare"}`;
      const text = `Your balance is ${money(balance)}. Please pay when you can.`;
      if (who.userIds.length) {
        await sb.from("notifications").insert(who.userIds.map((uid) => ({
          user_id: uid, type: "daycare_statement", title, body: text, read: false, data: { facility_id: facilityId, reminder: true },
        })));
      }
      await push(sb, who.userIds, title, text);
      const mail = await sendEmail(who.emails, `${fac?.name || "Daycare"}: payment reminder (${money(balance)})`, layout(fac, `
        <div style="font-size:20px;font-weight:700;margin-bottom:6px">Friendly reminder</div>
        <div style="font-size:14px;line-height:1.6">Your balance with ${esc(fac?.name || "the daycare")} is <b>${esc(money(balance))}</b>. Please pay when you can.</div>
        ${settings?.payment_instructions ? `<div style="font-size:13px;background:#FFF8EE;border-radius:10px;padding:10px 12px;margin-top:14px"><b>How to pay:</b> ${esc(settings.payment_instructions)}</div>` : ""}`), fac?.email);
      return reply({ emailed: mail.sent, pushed: who.userIds.length, error: mail.error });
    }

    return reply({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("daycare-billing error:", e);
    return reply({ error: "Something went wrong" }, 500);
  }
});
