import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY       = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const esc = (v: unknown) => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Signed-in sitter (inviting for themselves) or a littleloop admin.
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: auth } = token ? await supabase.auth.getUser(token) : { data: null };
    const user = auth?.user;
    if (!user) return reply({ error: "Unauthorized" }, 401);

    const { familyName: rawFamily, parentEmail: rawEmail, sitterId } = await req.json();
    const parentEmail = String(rawEmail || "").trim();
    const familyName  = String(rawFamily || "").trim().slice(0, 80);
    if (!familyName || !sitterId || !EMAIL_RE.test(parentEmail)) return reply({ error: "Missing or invalid fields" }, 400);

    if (user.id !== sitterId) {
      const { data: adminRow } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
      if (!adminRow) return reply({ error: "Forbidden" }, 403);
    }

    const { data: sitter } = await supabase.from("sitters").select("name").eq("id", sitterId).maybeSingle();
    if (!sitter) return reply({ error: "Sitter not found" }, 404);
    const sitterName = sitter.name || "Your sitter";

    const inviteToken = crypto.randomUUID();
    const { error: tokenErr } = await supabase.from("invite_tokens").insert({
      token: inviteToken,
      sitter_id: sitterId,
      family_name: familyName,
      admin_email: parentEmail,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (tokenErr) throw new Error(tokenErr.message);

    // Parents who already have an account sign in and accept from their dashboard instead.
    const { data: hasAccount } = await supabase.rpc("email_has_account", { p_email: parentEmail });
    const inviteUrl = hasAccount ? "https://littleloop.xyz/?portal=parent" : `https://littleloop.xyz/?invite=${inviteToken}`;
    const S = esc(sitterName), F = esc(familyName), E = esc(parentEmail);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "littleloop <hello@littleloop.xyz>",
        to: parentEmail,
        subject: `${sitterName.replace(/[\r\n]+/g, " ")} invited you to littleloop`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F7FB;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#0C1420,#1A2E4A);padding:32px 36px">
      <img src="https://www.littleloop.xyz/icons/mark-coral.png" width="56" height="28" alt="littleloop" style="display:block;margin-bottom:6px;border:0">
      <div style="font-size:22px;font-weight:700;color:#A8CCFF;letter-spacing:-0.5px">littleloop</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:3px">Independent childcare, thoughtfully connected.</div>
    </div>
    <div style="padding:32px 36px">
      <h1 style="font-size:22px;font-weight:700;color:#14243A;margin:0 0 12px">${hasAccount ? "A new sitter invite" : "You've been invited!"}</h1>
      <p style="font-size:15px;color:#3A5070;line-height:1.6;margin:0 0 24px">
        ${hasAccount
          ? `<strong>${S}</strong> wants to connect with <strong>${F}</strong> on littleloop. Sign in to accept or decline.`
          : `<strong>${S}</strong> has invited <strong>${F}</strong> to join littleloop, a private app to stay connected about your children's day.`}
      </p>
      <div style="background:#F0F5FF;border-radius:12px;padding:18px 20px;margin-bottom:28px">
        <div style="font-size:12px;font-weight:700;color:#3A6FD4;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:12px">What you'll get</div>
        <div style="margin-bottom:10px"><span style="font-size:18px">🌸</span> <strong style="font-size:13px;color:#14243A">Daily updates</strong> <span style="font-size:12px;color:#7A90AA">Photos and activity posts from your sitter</span></div>
        <div style="margin-bottom:10px"><span style="font-size:18px">💬</span> <strong style="font-size:13px;color:#14243A">Direct messaging</strong> <span style="font-size:12px;color:#7A90AA">Private chat with your sitter</span></div>
        <div style="margin-bottom:10px"><span style="font-size:18px">✅</span> <strong style="font-size:13px;color:#14243A">Check in/out</strong> <span style="font-size:12px;color:#7A90AA">Know when your children arrive and leave</span></div>
        <div><span style="font-size:18px">💳</span> <strong style="font-size:13px;color:#14243A">Invoices</strong> <span style="font-size:12px;color:#7A90AA">View and pay invoices in one place</span></div>
      </div>
      <div style="text-align:center;margin-bottom:24px">
        <a href="${inviteUrl}" style="display:inline-block;background:linear-gradient(135deg,#3A6FD4,#2550A8);color:#fff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">${hasAccount ? "Sign in to accept →" : "Accept Invitation →"}</a>
      </div>
      <p style="font-size:12px;color:#9AAABB;line-height:1.6;text-align:center;margin:0">
        ${hasAccount
          ? `You already have a littleloop account. Sign in with <strong>${E}</strong> and you'll see ${S} under Sitters.`
          : `This invitation expires in 7 days.<br>Sign up with <strong>${E}</strong> to connect automatically.`}
      </p>
    </div>
    <div style="padding:18px 36px;border-top:1px solid #EAF0F8;text-align:center">
      <div style="font-size:11px;color:#B0BEC5">littleloop · littleloop.xyz</div>
      <div style="font-size:11px;color:#C8D8E8;margin-top:3px">You received this because ${S} entered your email.</div>
    </div>
  </div>
</body>
</html>`,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    return reply({ success: true });
  } catch (err) {
    console.error("send-invite error:", err);
    return reply({ error: "Could not send invite" }, 500);
  }
});
