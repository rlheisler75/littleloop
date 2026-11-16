import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY       = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

const esc = (v: unknown) => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: auth } = token ? await supabase.auth.getUser(token) : { data: null };
    const user = auth?.user;
    if (!user) return reply({ error: "Unauthorized" }, 401);

    const { memberEmail, inviterName, inviteToken } = await req.json();
    if (!memberEmail || !inviteToken) return reply({ error: "Missing fields" }, 400);

    // The invite must be a real pending member row; the email goes only to that row's address.
    const { data: member } = await supabase.from("members")
      .select("id,email,family_id,status,families(name)")
      .eq("invite_token", inviteToken).maybeSingle();
    if (!member || member.status !== "pending" || String(member.email).toLowerCase() !== String(memberEmail).toLowerCase()) {
      return reply({ error: "Invite not found" }, 404);
    }

    // Caller must belong to that family (member or sitter) or be a littleloop admin.
    const { data: fams } = await supabase.rpc("user_family_ids", { p_user: user.id });
    const famIds = new Set((fams || []).map((r: any) => (typeof r === "string" ? r : r.user_family_ids)));
    if (!famIds.has(member.family_id)) {
      const { data: adminRow } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
      if (!adminRow) return reply({ error: "Forbidden" }, 403);
    }

    const familyName = (member as any).families?.name || "your family";
    const inviter = String(inviterName || "Someone").slice(0, 60);
    const signupUrl = `https://littleloop.xyz/?portal=parent&email=${encodeURIComponent(member.email)}&token=${encodeURIComponent(inviteToken)}`;
    const F = esc(familyName), I = esc(inviter), E = esc(member.email);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "littleloop <hello@littleloop.xyz>", reply_to: "littleloop@loopwaresolutions.com",
        to: member.email,
        subject: `${inviter} added you to ${familyName} on littleloop`.replace(/[\r\n]+/g, " "),
        html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#F4F7FB;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;"><div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)"><div style="background:linear-gradient(135deg,#0C1420,#1A2E4A);padding:32px 36px"><img src="https://www.littleloop.xyz/icons/mark-coral.png" width="56" height="28" alt="littleloop" style="display:block;margin-bottom:6px;border:0"><div style="font-size:22px;font-weight:700;color:#A8CCFF;letter-spacing:-0.5px">littleloop</div><div style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:3px">Independent childcare, thoughtfully connected.</div></div><div style="padding:32px 36px"><h1 style="font-size:22px;font-weight:700;color:#14243A;margin:0 0 12px">You've been added to ${F}</h1><p style="font-size:15px;color:#3A5070;line-height:1.6;margin:0 0 28px"><strong>${I}</strong> has added you as a member of <strong>${F}</strong> on littleloop. Create your account to get access.</p><div style="text-align:center;margin-bottom:24px"><a href="${signupUrl}" style="display:inline-block;background:linear-gradient(135deg,#3A6FD4,#2550A8);color:#fff !important;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">Create your account &rarr;</a></div><p style="font-size:12px;color:#9AAABB;line-height:1.6;text-align:center;margin:0">Sign up with <strong>${E}</strong> to be automatically connected to ${F}.</p></div><div style="padding:18px 36px;border-top:1px solid #EAF0F8;text-align:center"><div style="font-size:11px;color:#B0BEC5">littleloop &middot; littleloop.xyz</div></div></div></body></html>`,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    return reply({ success: true });
  } catch (err) {
    console.error("send-member-invite error:", err);
    return reply({ error: "Could not send invite" }, 500);
  }
});
