import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY  = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT     = "mailto:hello@littleloop.xyz";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── VAPID JWT ─────────────────────────────────────────────────────────────────
function b64urlEncode(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

async function makeVapidJwt(audience: string): Promise<string> {
  const header  = b64urlEncode(new TextEncoder().encode(JSON.stringify({ typ:"JWT", alg:"ES256" })));
  const payload = b64urlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now()/1000) + 12*3600,
    sub: VAPID_SUBJECT,
  })));

  const keyData = b64urlDecode(VAPID_PRIVATE_KEY);
  const key = await crypto.subtle.importKey(
    "raw", keyData,
    { name:"ECDSA", namedCurve:"P-256" },
    false, ["sign"]
  );
  const sig = await crypto.subtle.sign(
    { name:"ECDSA", hash:"SHA-256" },
    key,
    new TextEncoder().encode(`${header}.${payload}`)
  );
  return `${header}.${payload}.${b64urlEncode(new Uint8Array(sig))}`;
}

// ── Send one push ─────────────────────────────────────────────────────────────
async function sendPush(subscription: any, payload: object): Promise<boolean> {
  const endpoint: string = subscription.endpoint;
  const audience = new URL(endpoint).origin;
  const jwt = await makeVapidJwt(audience);

  const body = new TextEncoder().encode(JSON.stringify(payload));

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
      "Content-Type":  "application/json",
      "TTL":           "86400",
    },
    body,
  });

  return res.ok || res.status === 201;
}

// ── Main ──────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { userIds, title, body, icon, url, tag } = await req.json();
    if (!userIds?.length) return new Response(JSON.stringify({ sent: 0 }), { headers: corsHeaders });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", userIds);

    if (!subs?.length) return new Response(JSON.stringify({ sent: 0 }), { headers: corsHeaders });

    const payload = { title, body, icon: icon || "/icons/icon-192x192.png", url: url || "/", tag };
    let sent = 0;
    const stale: string[] = [];

    for (const sub of subs) {
      try {
        const ok = await sendPush(sub.subscription, payload);
        if (ok) { sent++; }
        else { stale.push(sub.id); }
      } catch { stale.push(sub.id); }
    }

    // Remove stale subscriptions
    if (stale.length) {
      await supabase.from("push_subscriptions").delete().in("id", stale);
    }

    return new Response(JSON.stringify({ sent }), { headers: corsHeaders });
  } catch (err) {
    console.error("send-push error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
