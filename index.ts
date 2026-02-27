import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { familyName, parentEmail, sitterName, sitterId } = await req.json();

    if (!familyName || !parentEmail || !sitterName || !sitterId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create invite token in DB
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const token = crypto.randomUUID();
    
    const { error: tokenErr } = await supabase.from("invite_tokens").insert({
      token,
      sitter_id: sitterId,
      family_name: familyName,
      admin_email: parentEmail,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    });

    if (tokenErr) throw new Error(tokenErr.message);

    const inviteUrl = `https://littleloop.xyz/?invite=${token}`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "littleloop <hello@littleloop.xyz>",
        to: parentEmail,
        subject: `${sitterName} invited you to littleloop`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F7FB;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#0C1420,#1A2E4A);padding:32px 36px">
      <div style="font-size:28px;margin-bottom:6px">🌿</div>
      <div style="font-size:22px;font-weight:700;color:#A8CCFF;letter-spacing:-0.5px">littleloop</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:3px">Independent childcare, thoughtfully connected.</div>
    </div>
    <div style="padding:32px 36px">
      <h1 style="font-size:22px;font-weight:700;color:#14243A;margin:0 0 12px">You've been invited!</h1>
      <p style="font-size:15px;color:#3A5070;line-height:1.6;margin:0 0 24px">
        <strong>${sitterName}</strong> has invited <strong>${familyName}</strong> to join littleloop —
        a private app to stay connected about your children's day.
      </p>
      <div style="background:#F0F5FF;border-radius:12px;padding:18px 20px;margin-bottom:28px">
        <div style="font-size:12px;font-weight:700;color:#3A6FD4;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:12px">What you'll get</div>
        <div style="display:flex;gap:12px;margin-bottom:10px"><span style="font-size:18px">🌸</span><div><div style="font-size:13px;font-weight:600;color:#14243A">Daily updates</div><div style="font-size:12px;color:#7A90AA">Photos and activity posts from your sitter</div></div></div>
        <div style="display:flex;gap:12px;margin-bottom:10px"><span style="font-size:18px">💬</span><div><div style="font-size:13px;font-weight:600;color:#14243A">Direct messaging</div><div style="font-size:12px;color:#7A90AA">Private chat with your sitter</div></div></div>
        <div style="display:flex;gap:12px;margin-bottom:10px"><span style="font-size:18px">✅</span><div><div style="font-size:13px;font-weight:600;color:#14243A">Check in/out</div><div style="font-size:12px;color:#7A90AA">Know when your children arrive and leave</div></div></div>
        <div style="display:flex;gap:12px"><span style="font-size:18px">💳</span><div><div style="font-size:13px;font-weight:600;color:#14243A">Invoices</div><div style="font-size:12px;color:#7A90AA">View and pay invoices in one place</div></div></div>
      </div>
      <div style="text-align:center;margin-bottom:24px">
        <a href="${inviteUrl}" style="display:inline-block;background:linear-gradient(135deg,#3A6FD4,#2550A8);color:#fff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
          Accept Invitation →
        </a>
      </div>
      <p style="font-size:12px;color:#9AAABB;line-height:1.6;text-align:center;margin:0">
        This invitation expires in 7 days.<br>
        Sign up with <strong>${parentEmail}</strong> to connect automatically.
      </p>
    </div>
    <div style="padding:18px 36px;border-top:1px solid #EAF0F8;text-align:center">
      <div style="font-size:11px;color:#B0BEC5">littleloop · littleloop.xyz</div>
      <div style="font-size:11px;color:#C8D8E8;margin-top:3px">You received this because ${sitterName} entered your email.</div>
    </div>
  </div>
</body>
</html>`,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Function error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
