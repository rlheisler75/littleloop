import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const ADMIN_SECRET = Deno.env.get("ADMIN_SECRET");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
};

const esc = (v: unknown) => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // Scheduler-only: service-role key or the admin secret.
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const secret = req.headers.get("x-admin-secret");
  if (bearer !== SUPABASE_SERVICE_KEY && !(ADMIN_SECRET && secret === ADMIN_SECRET)) {
    return new Response("Forbidden", { status: 403, headers: cors });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Find all open check-ins older than 8 hours
  const cutoff = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
  const { data: openCheckins } = await supabase
    .from("checkins")
    .select("*, children(name,avatar), families(id,name,admin_email)")
    .eq("status", "in")
    .is("facility_id", null)   // daycares see open check-ins on their own Today board
    .lt("checked_at", cutoff);

  if (!openCheckins?.length) {
    return new Response(JSON.stringify({ reminded: 0 }), { headers: cors });
  }

  const bySitter: Record<string, any[]> = {};
  for (const c of openCheckins) {
    const key = c.checked_by || "unknown";
    if (!bySitter[key]) bySitter[key] = [];
    bySitter[key].push(c);
  }

  let reminded = 0;

  for (const [sitterId, checkins] of Object.entries(bySitter)) {
    const { data: u } = await supabase.auth.admin.getUserById(sitterId).catch(() => ({ data: null }));
    const email = u?.user?.email;
    if (!email) continue;

    const childList = checkins.map((c: any) =>
      `<li style="margin-bottom:4px"><strong>${esc(c.children?.avatar || "🧒")} ${esc(c.children?.name)}</strong> — checked in at ${new Date(c.checked_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} for ${esc(c.families?.name)}</li>`
    ).join("");

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F4F7FB;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#0C1420,#1A2E4A);padding:28px 36px">
      <img src="https://www.littleloop.xyz/icons/mark-coral.png" width="56" height="28" alt="littleloop" style="display:block;margin-bottom:6px;border:0">
      <div style="font-size:20px;font-weight:700;color:#A8CCFF">littleloop</div>
    </div>
    <div style="padding:28px 36px">
      <h2 style="font-size:20px;font-weight:700;color:#14243A;margin:0 0 8px">&#x23F1; Don't forget to check out!</h2>
      <p style="font-size:13px;color:#7A90AA;margin:0 0 16px">The following children are still checked in:</p>
      <ul style="padding-left:20px;margin:0 0 20px;color:#3A5070;font-size:14px">${childList}</ul>
      <p style="font-size:12px;color:#9AAABB;margin:0">Log into littleloop to check them out and keep your hours accurate.</p>
    </div>
    <div style="padding:16px 36px;border-top:1px solid #EAF0F8;text-align:center">
      <a href="https://littleloop.xyz/?portal=sitter" style="display:inline-block;background:linear-gradient(135deg,#3A6FD4,#2550A8);color:#fff;padding:11px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px">Open littleloop &rarr;</a>
    </div>
  </div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "littleloop <hello@littleloop.xyz>", reply_to: "littleloop@loopwaresolutions.com",
        to: email,
        subject: `⏱ Reminder: ${checkins.length} child${checkins.length !== 1 ? "ren" : ""} still checked in`,
        html,
      }),
    });

    if (res.ok) reminded++;
    else console.error("Email failed for", sitterId, await res.text());
  }

  return new Response(JSON.stringify({ reminded, total: Object.keys(bySitter).length }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
