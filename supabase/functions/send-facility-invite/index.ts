// Daycare invite emails.
//   { kind: "staff",  staffId }             -> the invited staff member, link to create their login
//   { kind: "family", facilityId, familyId } -> the family's parent, link to sign up or sign in
// The caller must be a director or office manager of that daycare. Emails go only to the
// address stored on the staff row / family, never to an address from the request.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY       = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE = "https://littleloop.xyz";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

const esc = (v: unknown) => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const ROLE_LABEL: Record<string, string> = { director: "a director", office: "office staff", teacher: "a teacher" };

function emailHtml(title: string, body: string, button: string, url: string, foot: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#F4F7FB;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;"><div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)"><div style="background:linear-gradient(135deg,#0C1420,#1A2E4A);padding:32px 36px"><img src="https://www.littleloop.xyz/icons/mark-coral.png" width="56" height="28" alt="littleloop" style="display:block;margin-bottom:6px;border:0"><div style="font-size:22px;font-weight:700;color:#A8CCFF;letter-spacing:-0.5px">littleloop</div><div style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:3px">Childcare, thoughtfully connected.</div></div><div style="padding:32px 36px"><h1 style="font-size:22px;font-weight:700;color:#14243A;margin:0 0 12px">${title}</h1><p style="font-size:15px;color:#3A5070;line-height:1.6;margin:0 0 28px">${body}</p><div style="text-align:center;margin-bottom:24px"><a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#3A6FD4,#2550A8);color:#fff !important;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">${button} &rarr;</a></div><p style="font-size:12px;color:#9AAABB;line-height:1.6;text-align:center;margin:0">${foot}</p></div><div style="padding:18px 36px;border-top:1px solid #EAF0F8;text-align:center"><div style="font-size:11px;color:#B0BEC5">littleloop &middot; littleloop.xyz</div></div></div></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: auth } = token ? await sb.auth.getUser(token) : { data: null };
    const user = auth?.user;
    if (!user) return reply({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const kind = String(body.kind || "");

    // Load the target first, then check the caller manages that daycare.
    let facilityId = "";
    let to = "";
    let staffRow: any = null;
    let familyRow: any = null;
    if (kind === "staff") {
      const { data } = await sb.from("facility_staff").select("id,facility_id,email,name,role,status").eq("id", body.staffId).maybeSingle();
      if (!data || data.status !== "invited") return reply({ error: "Invite not found" }, 404);
      staffRow = data; facilityId = data.facility_id; to = data.email;
    } else if (kind === "family") {
      const { data: link } = await sb.from("facility_families").select("status,families(id,name,admin_email)")
        .eq("facility_id", body.facilityId).eq("family_id", body.familyId).maybeSingle();
      const fam = (link as any)?.families;
      if (!link || link.status === "inactive" || !fam?.admin_email) return reply({ error: "Family not found" }, 404);
      familyRow = fam; facilityId = String(body.facilityId); to = fam.admin_email;
    } else {
      return reply({ error: "Unknown invite" }, 400);
    }

    const { data: me } = await sb.from("facility_staff").select("role,name")
      .eq("facility_id", facilityId).eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (!me || !["director", "office"].includes(me.role)) return reply({ error: "Forbidden" }, 403);

    const { data: facility } = await sb.from("facilities").select("name").eq("id", facilityId).maybeSingle();
    const D = esc(facility?.name || "Your daycare");
    const inviter = esc(me.name || "Your director");
    const { data: hasAccount } = await sb.rpc("email_has_account", { p_email: to });

    let subject: string, html: string;
    if (kind === "staff") {
      const url = hasAccount ? `${SITE}/?portal=daycare` : `${SITE}/?portal=daycare&email=${encodeURIComponent(to)}`;
      subject = `${facility?.name || "Your daycare"} invited you to littleloop`;
      html = emailHtml(
        `Join ${D} on littleloop`,
        `<strong>${inviter}</strong> added you to <strong>${D}</strong> as ${esc(ROLE_LABEL[staffRow.role] || "staff")}. littleloop is where you'll check children in and out, see your classroom, and share updates with families.`,
        hasAccount ? "Sign in" : "Create your login", url,
        hasAccount ? `Sign in with <strong>${esc(to)}</strong> and ${D} will appear.` : `Sign up with <strong>${esc(to)}</strong> (choose "Daycare") to join ${D} automatically.`,
      );
    } else {
      const url = hasAccount ? `${SITE}/?portal=parent` : `${SITE}/?portal=parent&email=${encodeURIComponent(to)}`;
      subject = `${facility?.name || "Your daycare"} uses littleloop for your family`;
      html = emailHtml(
        `${D} is on littleloop`,
        hasAccount
          ? `<strong>${D}</strong> would like to connect with <strong>${esc(familyRow.name)}</strong>. Sign in and accept on your Home screen to see check-ins and classroom updates.`
          : `<strong>${D}</strong> set up <strong>${esc(familyRow.name)}</strong> on littleloop. Create your parent account to see check-ins, classroom updates and photos.`,
        hasAccount ? "Sign in" : "Create your account", url,
        hasAccount ? `Use <strong>${esc(to)}</strong> to sign in.` : `Sign up with <strong>${esc(to)}</strong> to be connected automatically.`,
      );
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "littleloop <hello@littleloop.xyz>", reply_to: "littleloop@loopwaresolutions.com",
        to, subject: subject.replace(/[\r\n]+/g, " "), html,
      }),
    });
    if (!res.ok) {
      console.error("send-facility-invite: Resend rejected", res.status, (await res.text()).slice(0, 300));
      return reply({ error: "Could not send the email" }, 502);
    }
    return reply({ success: true, has_account: !!hasAccount });
  } catch (err) {
    console.error("send-facility-invite error:", err);
    return reply({ error: "Could not send the email" }, 500);
  }
});
