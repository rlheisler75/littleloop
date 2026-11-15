import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FCM_PROJECT_ID       = 'littleloop-aa558';
const FCM_CLIENT_EMAIL     = 'firebase-adminsdk-fbsvc@littleloop-aa558.iam.gserviceaccount.com';
const FCM_PRIVATE_KEY      = Deno.env.get('FCM_PRIVATE_KEY')!;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// ── Caller identity ───────────────────────────────────────────────────────────
// Other edge functions call with the service-role key; the app calls with the user's JWT.
async function getCaller(req: Request, sb: any): Promise<{ service: boolean; id?: string } | null> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  if (token === SUPABASE_SERVICE_KEY) return { service: true };
  const { data } = await sb.auth.getUser(token);
  return data?.user ? { service: false, id: data.user.id } : null;
}

// ── FCM OAuth2 access token via service account JWT ──────────────────────────
async function getFcmAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const b64u = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const header  = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64u(JSON.stringify({
    iss: FCM_CLIENT_EMAIL, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const sigInput = `${header}.${payload}`;
  const pemBody = FCM_PRIVATE_KEY.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').replace(/\n/g, '');
  const keyBytes = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey('pkcs8', keyBytes, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sigBytes = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(sigInput));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${sigInput}.${sig}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`OAuth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function sendFcmPush(token: string, accessToken: string, p: { title: string; body: string; url: string; tag?: string }) {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: p.title, body: p.body },
        webpush: {
          notification: {
            title: p.title, body: p.body,
            icon: '/icons/icon-192x192.png', badge: '/icons/icon-96x96.png',
            tag: p.tag || 'littleloop', renotify: true, vibrate: [200, 100, 200],
          },
          fcm_options: { link: p.url },
        },
      },
    }),
  });
  return { ok: res.status === 200, status: res.status, body: await res.text() };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const caller = await getCaller(req, supabase);
    if (!caller) return json({ error: 'Unauthorized' }, 401);

    const { userIds: rawIds, title: rawTitle, body: rawBody, url: rawUrl, tag } = await req.json();
    let userIds: string[] = Array.isArray(rawIds) ? rawIds.filter((x: unknown) => typeof x === 'string') : [];
    if (!userIds.length) return json({ sent: 0, note: 'no userIds' });

    // A signed-in user may only push to people they share a family or conversation with.
    if (!caller.service) {
      const { data: rows } = await supabase.rpc('connected_user_ids', { p_user: caller.id });
      const allowed = new Set((rows || []).map((r: any) => (typeof r === 'string' ? r : r.connected_user_ids)));
      userIds = userIds.filter(id => allowed.has(id) && id !== caller.id);
      if (!userIds.length) return json({ error: 'Forbidden' }, 403);
    }

    const title = String(rawTitle || 'littleloop').slice(0, 120);
    const body  = String(rawBody || '').slice(0, 300);
    // Only links back into littleloop: no pushes that open some other site.
    const url = typeof rawUrl === 'string' && rawUrl.startsWith('/') && !rawUrl.startsWith('//') ? rawUrl : '/';

    const { data: prefs } = await supabase.from('push_preferences').select('user_id,preferences').in('user_id', userIds);
    const prefMap: Record<string, Record<string, boolean>> = {};
    (prefs || []).forEach((p: any) => { prefMap[p.user_id] = p.preferences || {}; });
    const eligibleIds = userIds.filter(id => !(tag && prefMap[id]?.[tag] === false));
    if (!eligibleIds.length) return json({ sent: 0, note: 'opted out' });

    const { data: subs, error } = await supabase.from('push_subscriptions').select('*').in('user_id', eligibleIds);
    if (error) throw new Error(error.message);
    if (!subs?.length) return json({ sent: 0, note: 'no subs' });

    const accessToken = await getFcmAccessToken();
    let sent = 0;
    const stale: string[] = [];
    for (const sub of subs) {
      const token = sub.fcm_token || sub.subscription?.fcm_token || sub.subscription?.endpoint;
      if (!token) continue;
      try {
        const r = await sendFcmPush(token, accessToken, { title, body, url, tag });
        if (r.ok) sent++;
        else if (r.status === 404) stale.push(sub.id);
        else console.error(`Failed sub ${sub.id}: ${r.status} ${r.body.slice(0, 200)}`);
      } catch (e) {
        console.error(`Exception for sub ${sub.id}:`, e);
      }
    }
    if (stale.length) await supabase.from('push_subscriptions').delete().in('id', stale);
    return json({ sent, total: subs.length });
  } catch (err) {
    console.error('send-push fatal:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
