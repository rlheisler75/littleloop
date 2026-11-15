import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY       = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const BASE_URL = "https://littleloop.xyz";

const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const forbidden = () => reply({ error: "Forbidden" }, 403);

// Escape anything that came from a request or user content before it goes into email HTML.
const esc = (v: unknown) => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const clip = (v: unknown, n: number) => String(v ?? "").slice(0, n);

// ── Caller identity & relationships ──────────────────────────────────────────
type Caller = { service: boolean; id?: string };

async function getCaller(req: Request, sb: any): Promise<Caller | null> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  if (token === SUPABASE_SERVICE_KEY) return { service: true };
  const { data } = await sb.auth.getUser(token);
  return data?.user ? { service: false, id: data.user.id } : null;
}

const ids = (rows: any[] | null, key: string) =>
  new Set((rows || []).map((r: any) => (typeof r === "string" ? r : r[key])));

async function callerFamilies(sb: any, c: Caller) {
  const { data } = await sb.rpc("user_family_ids", { p_user: c.id });
  return ids(data, "user_family_ids");
}
async function callerConnections(sb: any, c: Caller) {
  const { data } = await sb.rpc("connected_user_ids", { p_user: c.id });
  return ids(data, "connected_user_ids");
}
async function sitterName(sb: any, sitterId?: string) {
  if (!sitterId) return null;
  const { data } = await sb.from("sitters").select("name").eq("id", sitterId).maybeSingle();
  return data?.name || null;
}
async function familyName(sb: any, familyId: string) {
  const { data } = await sb.from("families").select("name").eq("id", familyId).maybeSingle();
  return data?.name || "";
}

async function createNotification(sb: any, userId: string, type: string, title: string, body: string, data?: Record<string, unknown>) {
  if (!userId) return;
  const { error } = await sb.from("notifications").insert({ user_id: userId, type, title, body, data: data || null, read: false });
  if (error) console.error(`createNotification error for ${userId}:`, error.message);
}

// Push via send-push, called with the service key (internal).
async function sendPush(sb: any, userIds: string[], title: string, body: string, tag: string, url?: string) {
  if (!userIds.length) return;
  await sb.functions.invoke("send-push", { body: { userIds, title, body, url: url || "/", tag } })
    .catch((e: any) => console.error("send-push invoke error:", e));
}

function emailWrapper(body: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F7FB;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#0C1420,#1A2E4A);padding:28px 36px">
      <img src="https://www.littleloop.xyz/icons/mark-coral.png" width="56" height="28" alt="littleloop" style="display:block;margin-bottom:6px;border:0">
      <div style="font-size:20px;font-weight:700;color:#A8CCFF;letter-spacing:-0.5px">littleloop</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:2px">Independent childcare, thoughtfully connected.</div>
    </div>
    <div style="padding:28px 36px">${body}</div>
    <div style="padding:16px 36px;border-top:1px solid #EAF0F8;text-align:center">
      <a href="${BASE_URL}/?portal=parent" style="display:inline-block;background:linear-gradient(135deg,#3A6FD4,#2550A8);color:#fff;padding:11px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;margin-bottom:14px">Open littleloop →</a>
      <div style="font-size:11px;color:#B0BEC5">littleloop · littleloop.xyz</div>
    </div>
  </div>
</body>
</html>`;
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "littleloop <hello@littleloop.xyz>", to, subject: subject.replace(/[\r\n]+/g, " ").slice(0, 150), html }),
  });
  if (!res.ok) { const err = await res.json(); throw new Error(JSON.stringify(err)); }
}

async function familyRecipients(sb: any, familyId: string) {
  const { data: members } = await sb.from("members").select("email,name,user_id")
    .eq("family_id", familyId).in("role", ["admin", "member"]).eq("status", "active");
  const list = (members || []).filter((m: any) => m.user_id);
  const userIds = list.map((m: any) => m.user_id);
  const { data: prefs } = userIds.length
    ? await sb.from("email_preferences").select("user_id,preferences").in("user_id", userIds)
    : { data: [] };
  const prefMap: Record<string, any> = {};
  (prefs || []).forEach((p: any) => { prefMap[p.user_id] = p.preferences || {}; });
  return { list, userIds, prefMap };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const caller = await getCaller(req, supabase);
    if (!caller) return reply({ error: "Unauthorized" }, 401);

    const { type, payload = {} } = await req.json();
    const svc = caller.service;
    const myFamilies   = svc ? null : await callerFamilies(supabase, caller);
    const inMyFamily   = (fid: string) => svc || (!!fid && myFamilies!.has(fid));
    const connections  = async () => (svc ? null : await callerConnections(supabase, caller));
    // When the caller is a sitter, use their real name instead of trusting the request.
    const myName = svc ? null : await sitterName(supabase, caller.id);

    // ── NEW POST ─────────────────────────────────────────────────────────────
    if (type === "new_post") {
      const { familyId, postType, postContent, postId } = payload;
      if (!inMyFamily(familyId)) return forbidden();
      const sName = myName || clip(payload.sitterName, 60) || "Your sitter";
      const fName = await familyName(supabase, familyId);
      const { list, userIds, prefMap } = await familyRecipients(supabase, familyId);
      if (!list.length) return reply({ sent: 0 });
      const typeLabel: Record<string, string> = { activity: "Activity Update", meal: "Meal Update", mood: "Mood Update", nap: "Nap Update", milestone: "Milestone", general: "Update" };
      const label = typeLabel[postType] || "Update";
      const content = clip(postContent, 2000);
      const preview = content.slice(0, 120) + (content.length > 120 ? "..." : "");
      const html = emailWrapper(`
        <h2 style="font-size:20px;font-weight:700;color:#14243A;margin:0 0 6px">${esc(label)} from ${esc(sName)}</h2>
        <p style="font-size:13px;color:#7A90AA;margin:0 0 18px">${esc(fName)}</p>
        ${preview ? `<div style="background:#F0F5FF;border-radius:10px;padding:14px 16px;font-size:14px;color:#3A5070;line-height:1.6;margin-bottom:20px">${esc(preview)}</div>` : ""}
        <p style="font-size:12px;color:#9AAABB;margin:0">Open littleloop to see the full update and leave a comment.</p>
      `);
      let sent = 0;
      for (const m of list) {
        if (m.user_id === caller.id) continue;
        await createNotification(supabase, m.user_id, "new_post", `New ${label.toLowerCase()} from ${sName}`, preview || "Tap to view.", { familyId, postType });
        if (prefMap[m.user_id]?.new_post === false) continue;
        if (m.email) { await sendEmail(m.email, `${sName} posted a new update`, html).catch(console.error); sent++; }
      }
      const pushTag = postId ? `post-${postId}` : `post-${familyId}-${Date.now()}`;
      await sendPush(supabase, userIds.filter((id: string) => id !== caller.id), `New ${label} from ${sName}`, preview || "Tap to view.", pushTag);
      return reply({ sent });
    }

    // ── NEW MESSAGE ──────────────────────────────────────────────────────────
    if (type === "new_message") {
      const { recipientId, isSitter, messageId } = payload;
      if (!svc && !(await connections())!.has(recipientId)) return forbidden();
      const senderName = myName || clip(payload.senderName, 60) || "Someone";
      const msg = clip(payload.messagePreview, 500);
      await createNotification(supabase, recipientId, "new_message", `New message from ${senderName}`, msg.slice(0, 80) || "Tap to read.", { isSitter: !!isSitter });
      const pushTag = messageId ? `msg-${messageId}` : `msg-${recipientId}-${Date.now()}`;
      await sendPush(supabase, [recipientId], `New message from ${senderName}`, msg.slice(0, 80) || "Tap to read.", pushTag);
      const { data: epRow } = await supabase.from("email_preferences").select("preferences").eq("user_id", recipientId).maybeSingle();
      if (epRow?.preferences?.new_message === false) return reply({ sent: 0, note: "opted out" });
      const { data: user } = await supabase.auth.admin.getUserById(recipientId);
      if (!user?.user?.email) return reply({ sent: 0 });
      const html = emailWrapper(`
        <h2 style="font-size:20px;font-weight:700;color:#14243A;margin:0 0 6px">New message from ${esc(senderName)}</h2>
        <p style="font-size:13px;color:#7A90AA;margin:0 0 18px">${isSitter ? "Your sitter sent you a message" : "A family member sent you a message"}</p>
        ${msg ? `<div style="background:#F0F5FF;border-radius:10px;padding:14px 16px;font-size:14px;color:#3A5070;line-height:1.6;margin-bottom:20px">&quot;${esc(msg.slice(0, 120))}${msg.length > 120 ? "..." : ""}&quot;</div>` : ""}
        <p style="font-size:12px;color:#9AAABB;margin:0">Open littleloop to reply.</p>
      `);
      await sendEmail(user.user.email, `New message from ${senderName}`, html);
      return reply({ sent: 1 });
    }

    // ── NEW INVOICE ──────────────────────────────────────────────────────────
    if (type === "new_invoice") {
      const { familyId } = payload;
      if (!inMyFamily(familyId)) return forbidden();
      const sName = myName || clip(payload.sitterName, 60) || "Your sitter";
      const invoiceNumber = clip(payload.invoiceNumber, 30);
      const amount = clip(payload.amount, 30);
      const fName = await familyName(supabase, familyId);
      const { list, userIds, prefMap } = await familyRecipients(supabase, familyId);
      if (!list.length) return reply({ sent: 0 });
      const html = emailWrapper(`
        <h2 style="font-size:20px;font-weight:700;color:#14243A;margin:0 0 6px">New invoice from ${esc(sName)}</h2>
        <p style="font-size:13px;color:#7A90AA;margin:0 0 18px">${esc(fName)}</p>
        <div style="background:#F0F5FF;border-radius:10px;padding:16px 20px;margin-bottom:20px">
          <div style="font-size:12px;color:#7A90AA;text-transform:uppercase;letter-spacing:0.8px">Invoice #${esc(invoiceNumber)}</div>
          <div style="font-size:24px;font-weight:700;color:#14243A;margin-top:4px">${esc(amount)}</div>
        </div>
        <p style="font-size:12px;color:#9AAABB;margin:0">Open littleloop to view the full invoice and payment options.</p>
      `);
      let sent = 0;
      for (const m of list) {
        await createNotification(supabase, m.user_id, "new_invoice", `New invoice from ${sName}`, `${amount} — Invoice #${invoiceNumber}`, { familyId, invoiceNumber, amount });
        if (prefMap[m.user_id]?.new_invoice === false) continue;
        if (m.email) { await sendEmail(m.email, `New invoice from ${sName} - ${amount}`, html).catch(console.error); sent++; }
      }
      await sendPush(supabase, userIds, `New invoice from ${sName}`, `${amount} — Invoice #${invoiceNumber}`, `invoice-${invoiceNumber.replace(/[^a-zA-Z0-9-]/g, "-")}`);
      return reply({ sent });
    }

    // ── INVOICE PAID (notifies the family's sitter) ─────────────────────────
    if (type === "invoice_paid") {
      const { familyId } = payload;
      if (!inMyFamily(familyId)) return forbidden();
      const invoiceNumber = clip(payload.invoiceNumber, 30);
      const { data: fsRow } = await supabase.from("family_sitters")
        .select("sitter_id").eq("family_id", familyId).eq("status", "active").limit(1).maybeSingle();
      if (!fsRow?.sitter_id || fsRow.sitter_id === caller.id) return reply({ sent: 0 });
      const fName = await familyName(supabase, familyId) || "a family";
      await createNotification(supabase, fsRow.sitter_id, "invoice_paid", `Invoice paid by ${fName}`, `Invoice #${invoiceNumber}`, { familyId, invoiceNumber });
      await sendPush(supabase, [fsRow.sitter_id], `Invoice paid by ${fName}`, `Invoice #${invoiceNumber}`, `invoice-paid-${invoiceNumber.replace(/[^a-zA-Z0-9-]/g, "-")}`);
      return reply({ sent: 1 });
    }

    // ── INVOICE REMINDER (recipients come from the invoice, not the request) ─
    if (type === "invoice_reminder") {
      const { invoiceId } = payload;
      if (!invoiceId) return reply({ error: "invoiceId required" }, 400);
      const { data: inv } = await supabase.from("invoices").select("id,sitter_id,family_id,invoice_number,due_date").eq("id", invoiceId).maybeSingle();
      if (!inv) return reply({ error: "Not found" }, 404);
      if (!svc && inv.sitter_id !== caller.id) return forbidden();
      const sName = (await sitterName(supabase, inv.sitter_id)) || "Your sitter";
      const { data: fam } = await supabase.from("families").select("admin_email").eq("id", inv.family_id).maybeSingle();
      const { data: items } = await supabase.from("invoice_items").select("amount,hours,rate,rate_type").eq("invoice_id", inv.id);
      const total = (items || []).reduce((s: number, it: any) =>
        s + (parseFloat(it.amount) || (it.rate_type === "hourly" ? parseFloat(it.hours || 0) * parseFloat(it.rate || 0) : parseFloat(it.rate || 0))), 0);
      const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(total);
      const invoiceNumber = String(inv.invoice_number || "");
      const dueDate = clip(payload.dueDate, 40);
      const { userIds } = await familyRecipients(supabase, inv.family_id);
      for (const uid of userIds) {
        await createNotification(supabase, uid, "invoice_reminder", `Payment reminder from ${sName}`, `${amount} due${dueDate ? ` on ${dueDate}` : ""}`, { invoiceId, invoiceNumber, amount });
      }
      await sendPush(supabase, userIds, `Payment reminder from ${sName}`, `${amount} due${dueDate ? ` on ${dueDate}` : ""}`, `reminder-${invoiceNumber.replace(/[^a-zA-Z0-9-]/g, "-")}`);
      const html = emailWrapper(`
        <h2 style="font-size:20px;font-weight:700;color:#14243A;margin:0 0 6px">Friendly payment reminder</h2>
        <p style="font-size:13px;color:#7A90AA;margin:0 0 18px">from ${esc(sName)}</p>
        <div style="background:#FFF8F0;border:1px solid #FFD599;border-radius:10px;padding:16px 20px;margin-bottom:20px">
          <div style="font-size:12px;color:#7A90AA;text-transform:uppercase;letter-spacing:0.8px">Invoice #${esc(invoiceNumber)}</div>
          <div style="font-size:24px;font-weight:700;color:#14243A;margin-top:4px">${esc(amount)}</div>
          ${dueDate ? `<div style="font-size:12px;color:#D48A3A;margin-top:4px">Due ${esc(dueDate)}</div>` : ""}
        </div>
        <p style="font-size:12px;color:#9AAABB;margin:0">Open littleloop to view payment options.</p>
      `);
      if (fam?.admin_email) await sendEmail(fam.admin_email, `Payment reminder from ${sName} - ${amount}`, html).catch(console.error);
      return reply({ sent: 1 });
    }

    // ── ETA (parent → their family's sitters) ────────────────────────────────
    if (type === "eta") {
      const { familyId } = payload;
      if (!inMyFamily(familyId)) return forbidden();
      const { data: fsRows } = await supabase.from("family_sitters").select("sitter_id").eq("family_id", familyId).eq("status", "active");
      const familySitters = new Set((fsRows || []).map((r: any) => r.sitter_id));
      const sitterIds: string[] = (payload.sitterIds || []).filter((id: string) => familySitters.has(id));
      if (!sitterIds.length) return reply({ sent: 0 });
      const memberName = clip(payload.memberName, 60) || "A parent";
      const minutes = Math.max(0, Math.min(600, parseInt(payload.minutes) || 0));
      const { data: etaPrefs } = await supabase.from("email_preferences").select("user_id,preferences").in("user_id", sitterIds);
      const etaPrefMap: Record<string, any> = {};
      (etaPrefs || []).forEach((p: any) => { etaPrefMap[p.user_id] = p.preferences || {}; });
      const html = emailWrapper(`
        <h2 style="font-size:20px;font-weight:700;color:#14243A;margin:0 0 6px">On the way!</h2>
        <p style="font-size:13px;color:#7A90AA;margin:0 0 18px">${esc(memberName)} is heading your way</p>
        <div style="background:#F0FFF8;border:1px solid #88D8B8;border-radius:10px;padding:16px 20px;margin-bottom:20px;text-align:center">
          <div style="font-size:24px;font-weight:700;color:#14243A">~${minutes} minutes away</div>
        </div>
        <p style="font-size:12px;color:#9AAABB;margin:0">Open littleloop for details.</p>
      `);
      let sent = 0;
      for (const id of sitterIds) {
        await createNotification(supabase, id, "eta", `${memberName} is on the way!`, `~${minutes} minutes away`, { memberName, minutes });
        if (etaPrefMap[id]?.eta === false) continue;
        const { data: u } = await supabase.auth.admin.getUserById(id);
        if (u?.user?.email) { await sendEmail(u.user.email, `${memberName} is on the way - ~${minutes} min`, html).catch(console.error); sent++; }
      }
      await sendPush(supabase, sitterIds, `${memberName} is on the way!`, `~${minutes} minutes away`, `eta-${familyId}-${Date.now()}`);
      return reply({ sent });
    }

    // ── CHECKIN ──────────────────────────────────────────────────────────────
    if (type === "checkin") {
      const { familyId, status } = payload;
      if (!inMyFamily(familyId)) return forbidden();
      const allowed = await connections();
      const notify: string[] = (payload.notifyUserIds || []).filter((id: string) => svc || allowed!.has(id));
      const childName = clip(payload.childName, 60) || "Your child";
      const checkerName = myName || clip(payload.checkerName, 60) || "your sitter";
      const icon = status === "in" ? "🟢" : "🔴";
      const verb = status === "in" ? "checked in" : "checked out";
      for (const uid of notify) {
        await createNotification(supabase, uid, status === "in" ? "checkin" : "checkout", `${icon} ${childName} ${verb}`, `by ${checkerName}`, { familyId, childName, status });
      }
      await sendPush(supabase, notify, `${icon} ${childName} ${verb}`, `by ${checkerName}`, `checkin-${familyId}-${Date.now()}`);
      return reply({ sent: notify.length });
    }

    // ── CONNECTION REQUEST (family → sitter; the request row must exist) ─────
    if (type === "connection_request") {
      const { sitterId } = payload;
      if (!svc) {
        const { data: link } = await supabase.from("family_sitters").select("family_id")
          .eq("sitter_id", sitterId).eq("status", "requested").in("family_id", [...myFamilies!]).limit(1).maybeSingle();
        if (!link) return forbidden();
      }
      const fName = clip(payload.familyName, 60) || "A family";
      await createNotification(supabase, sitterId, "connection_request", `Connection request from ${fName}`, "Tap to accept or decline.", { familyName: fName });
      await sendPush(supabase, [sitterId], `Connection request from ${fName}`, "Tap to accept or decline.", `connect-${sitterId}`);
      return reply({ sent: 1 });
    }

    // ── CONNECTION ACCEPTED (sitter → family admin) ──────────────────────────
    if (type === "connection_accepted") {
      const { familyId } = payload;
      if (!inMyFamily(familyId)) return forbidden();
      const { data: adminMember } = await supabase.from("members")
        .select("user_id").eq("family_id", familyId).eq("role", "admin").eq("status", "active").limit(1).maybeSingle();
      const sName = myName || "Your sitter";
      if (adminMember?.user_id) {
        await createNotification(supabase, adminMember.user_id, "connection_accepted", `✅ Connected with ${sName}`, "You're now connected on littleloop.", { sitterName: sName });
        await sendPush(supabase, [adminMember.user_id], `✅ Connected with ${sName}`, "You're now connected on littleloop.", `connected-${familyId}`);
      }
      return reply({ sent: 1 });
    }

    // ── NEW REVIEW ───────────────────────────────────────────────────────────
    if (type === "new_review") {
      const { sitterId } = payload;
      if (!svc && !(await connections())!.has(sitterId)) return forbidden();
      const fName = clip(payload.familyName, 60) || "A family";
      const stars = "⭐".repeat(Math.max(1, Math.min(parseInt(payload.rating) || 5, 5)));
      await createNotification(supabase, sitterId, "review", `New review from ${fName}`, `${stars} — tap to view.`, { familyName: fName });
      await sendPush(supabase, [sitterId], `New review from ${fName}`, `${stars} — tap to view.`, `review-${sitterId}-${Date.now()}`);
      return reply({ sent: 1 });
    }

    return reply({ error: "Unknown type" }, 400);
  } catch (err) {
    console.error("Notification error:", err);
    return reply({ error: "Internal error" }, 500);
  }
});
