import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Keep in sync with FREE_FAMILY_LIMIT in src/lib/plan.js and enforce_free_family_limit() in the DB.
const FREE_FAMILY_LIMIT = 2;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    // Verify user via JWT
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const { mode } = body;

    // Service role bypasses RLS
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── Mode: parent (new parent creating their own family) ──────────────────
    if (!mode || mode === 'parent') {
      const { familyName, userName } = body;
      if (!familyName?.trim()) return json({ error: 'Family name is required' }, 400);

      const { data: family, error: famErr } = await admin
        .from('families')
        .insert({ name: familyName.trim(), admin_email: user.email, icon: '\u{1F468}‍\u{1F469}‍\u{1F467}' })
        .select().single();
      if (famErr) throw famErr;

      const { error: memErr } = await admin.from('members').insert({
        family_id: family.id,
        user_id:   user.id,
        name:      userName || user.email!.split('@')[0],
        email:     user.email,
        role:      'admin',
        status:    'active',
        avatar:    '\u{1F464}',
      });
      if (memErr) throw memErr;

      return json({ success: true, familyId: family.id });
    }

    // ── Mode: sitter-invite (sitter inviting a new family) ───────────────────
    if (mode === 'sitter-invite') {
      const { familyName, adminEmail, sitterId, childNames } = body;
      if (!familyName?.trim() || !adminEmail?.trim() || !sitterId) {
        return json({ error: 'Missing required fields' }, 400);
      }
      // A sitter can only invite families to their own account.
      if (sitterId !== user.id) return json({ error: 'Forbidden' }, 403);

      // Free plan limit (service role bypasses the DB trigger, so check here).
      const { data: isPro, error: proErr } = await admin.rpc('sitter_is_pro', { p_sitter_id: sitterId });
      if (proErr) throw proErr;
      if (!isPro) {
        const { count, error: cntErr } = await admin.from('family_sitters')
          .select('id', { count: 'exact', head: true })
          .eq('sitter_id', sitterId).in('status', ['active', 'pending']);
        if (cntErr) throw cntErr;
        if ((count ?? 0) >= FREE_FAMILY_LIMIT) {
          return json({ error: `The free plan includes ${FREE_FAMILY_LIMIT} families. Upgrade to Pro for unlimited families.`, code: 'FREE_FAMILY_LIMIT' }, 402);
        }
      }

      // Create family
      const { data: family, error: famErr } = await admin
        .from('families')
        .insert({ name: familyName.trim(), admin_email: adminEmail.trim(), status: 'pending' })
        .select().single();
      if (famErr) throw famErr;

      // Link sitter
      const { error: linkErr } = await admin.from('family_sitters').insert({ family_id: family.id, sitter_id: sitterId, status: 'pending' });
      if (linkErr) throw linkErr;

      // Create pending member
      await admin.from('members').insert({
        family_id: family.id,
        name:      adminEmail.trim().split('@')[0],
        email:     adminEmail.trim(),
        role:      'admin',
        status:    'pending',
      });

      // Add children if provided
      if (childNames?.length > 0) {
        await admin.from('children').insert(
          childNames.map((n: string) => ({ family_id: family.id, name: n, avatar: '\u{1F31F}', color: '#8B78D4' }))
        );
      }

      return json({ success: true, familyId: family.id, familyName: family.name });
    }

    return json({ error: 'Unknown mode' }, 400);

  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
