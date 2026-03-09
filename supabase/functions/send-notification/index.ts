import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://littleloop.xyz";

function emailWrapper(body: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F7FB;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#0C1420,#1A2E4A);padding:28px 36px">
      <div style="font-size:30px;margin-bottom:4px">➿</div>
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
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "littleloop <hello@littleloop.xyz>",
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(JSON.stringify(err));
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { type, payload } = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ── NEW POST ──────────────────────────────────────────────────────────────
    if (type === "new_post") {
      const { familyId, sitterName, postType, postContent, familyName } = payload;

      // Get all members who should receive emails (admin + member roles)
      const { data: members } = await supabase
        .from("members")
        .select("email, name")
        .eq("family_id", familyId)
        .in("role", ["admin", "member"])
        .eq("status", "active");

      if (!members?.length) return new Response(JSON.stringify({ sent: 0 }), { headers: corsHeaders });

      const typeLabel: Record<string, string> = {
        activity: "📚 Activity Update",
        meal: "🍽️ Meal Update",
        mood: "😊 Mood Update",
        nap: "😴 Nap Update",
        milestone: "⭐ Milestone",
        general: "📝 Update",
      };

      const label = typeLabel[postType] || "📝 Update";
      const preview = postContent?.slice(0, 120) + (postContent?.length > 120 ? "…" : "");

      const html = emailWrapper(`
        <h2 style="font-size:20px;font-weight:700;color:#14243A;margin:0 0 6px">${label} from ${sitterName}</h2>
        <p style="font-size:13px;color:#7A90AA;margin:0 0 18px">${familyName}</p>
        ${preview ? `<div style="background:#F0F5FF;border-radius:10px;padding:14px 16px;font-size:14px;color:#3A5070;line-height:1.6;margin-bottom:20px">${preview}</div>` : ""}
        <p style="font-size:12px;color:#9AAABB;margin:0">Open littleloop to see the full update and leave a comment.</p>
      `);

      for (const m of members) {
        if (m.email) await sendEmail(m.email, `${sitterName} posted a new update`, html).catch(console.error);
      }

      return new Response(JSON.stringify({ sent: members.length }), { headers: corsHeaders });
    }

    // ── NEW MESSAGE ───────────────────────────────────────────────────────────
    if (type === "new_message") {
      const { recipientId, senderName, messagePreview, isSitter } = payload;

      // Get recipient email
      const { data: user } = await supabase.auth.admin.getUserById(recipientId);
      if (!user?.user?.email) return new Response(JSON.stringify({ sent: 0 }), { headers: corsHeaders });

      const html = emailWrapper(`
        <h2 style="font-size:20px;font-weight:700;color:#14243A;margin:0 0 6px">New message from ${senderName}</h2>
        <p style="font-size:13px;color:#7A90AA;margin:0 0 18px">${isSitter ? "Your sitter sent you a message" : "A family member sent you a message"}</p>
        ${messagePreview ? `<div style="background:#F0F5FF;border-radius:10px;padding:14px 16px;font-size:14px;color:#3A5070;line-height:1.6;margin-bottom:20px">"${messagePreview.slice(0, 120)}${messagePreview.length > 120 ? '…' : ''}"</div>` : ""}
        <p style="font-size:12px;color:#9AAABB;margin:0">Open littleloop to reply.</p>
      `);

      await sendEmail(user.user.email, `New message from ${senderName}`, html);
      return new Response(JSON.stringify({ sent: 1 }), { headers: corsHeaders });
    }

    // ── NEW INVOICE ───────────────────────────────────────────────────────────
    if (type === "new_invoice") {
      const { familyId, sitterName, invoiceNumber, amount, familyName } = payload;

      const { data: members } = await supabase
        .from("members")
        .select("email, name")
        .eq("family_id", familyId)
        .in("role", ["admin", "member"])
        .eq("status", "active");

      if (!members?.length) return new Response(JSON.stringify({ sent: 0 }), { headers: corsHeaders });

      const html = emailWrapper(`
        <h2 style="font-size:20px;font-weight:700;color:#14243A;margin:0 0 6px">New invoice from ${sitterName}</h2>
        <p style="font-size:13px;color:#7A90AA;margin:0 0 18px">${familyName}</p>
        <div style="background:#F0F5FF;border-radius:10px;padding:16px 20px;margin-bottom:20px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:12px;color:#7A90AA;text-transform:uppercase;letter-spacing:0.8px">Invoice #${invoiceNumber}</div>
              <div style="font-size:24px;font-weight:700;color:#14243A;margin-top:4px">${amount}</div>
            </div>
            <div style="font-size:32px">💳</div>
          </div>
        </div>
        <p style="font-size:12px;color:#9AAABB;margin:0">Open littleloop to view the full invoice and payment options.</p>
      `);

      for (const m of members) {
        if (m.email) await sendEmail(m.email, `New invoice from ${sitterName} — ${amount}`, html).catch(console.error);
      }

      return new Response(JSON.stringify({ sent: members.length }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Unknown notification type" }), { status: 400, headers: corsHeaders });

  } catch (err) {
    console.error("Notification error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
