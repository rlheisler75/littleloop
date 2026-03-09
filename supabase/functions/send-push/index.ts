import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL       = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY   = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY  = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT      = "mailto:hello@littleloop.xyz";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function b64urlEncode(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64urlDecode(str: string): Uint8Array {
  const b64 = (str + "===".slice((str.length + 3) % 4))
    .replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

async function importVapidPrivateKey(): Promise<CryptoKey> {
  const rawKey = b64urlDecode(VAPID_PRIVATE_KEY);
  // Build PKCS8 DER wrapper for P-256 raw private key
  const pkcs8Header = new Uint8Array([
    0x30, 0x41,             // SEQUENCE
    0x02, 0x01, 0x00,       // INTEGER 0 (version)
    0x30, 0x13,             // SEQUENCE (algorithm)
      0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // OID ecPublicKey
      0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // OID P-256
    0x04, 0x27,             // OCTET STRING
      0x30, 0x25,           // SEQUENCE
        0x02, 0x01, 0x01,   // INTEGER 1
        0x04, 0x20,         // OCTET STRING (32 bytes = raw key)
  ]);
  const pkcs8 = new Uint8Array(pkcs8Header.length + rawKey.length);
  pkcs8.set(pkcs8Header);
  pkcs8.set(rawKey, pkcs8Header.length);

  return crypto.subtle.importKey(
    "pkcs8", pkcs8,
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"]
  );
}

async function makeVapidJwt(audience: string): Promise<string> {
  const header  = b64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64urlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: VAPID_SUBJECT,
  })));
  const key = await importVapidPrivateKey();
  const data = new TextEncoder().encode(`${header}.${payload}`);
  const sig  = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, data);
  return `${header}.${payload}.${b64urlEncode(new Uint8Array(sig))}`;
}

async function sendOnePush(sub: Record<string, unknown>, payload: object): Promise<boolean> {
  const endpoint = sub.endpoint as string;
  const origin   = new URL(endpoint).origin;
  const jwt      = await makeVapidJwt(origin);

  const res = await fetch(endpoint, {
    method:  "POST",
    headers: {
      "Authorization": `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
      "Content-Type":  "application/json",
      "TTL":           "86400",
    },
    body: JSON.stringify(payload),
  });
  console.log(`Push to ${origin}: ${res.status}`);
  return res.ok || res.status === 201;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { userIds, title, body, url, tag } = await req.json();
    if (!userIds?.length) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", userIds);

    if (error) throw new Error(error.message);
    if (!subs?.length) {
      return new Response(JSON.stringify({ sent: 0, note: "no subscriptions found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const payload = { title, body, icon: "/icons/icon-192x192.png", url: url || "/", tag };
    let sent = 0;
    const stale: string[] = [];

    for (const sub of subs) {
      try {
        const ok = await sendOnePush(sub.subscription, payload);
        if (ok) sent++;
        else stale.push(sub.id);
      } catch (e) {
        console.error("Push send error:", e);
        stale.push(sub.id);
      }
    }

    if (stale.length) {
      await supabase.from("push_subscriptions").delete().in("id", stale);
    }

    return new Response(JSON.stringify({ sent, total: subs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("send-push error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
