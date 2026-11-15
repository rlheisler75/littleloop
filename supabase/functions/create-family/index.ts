import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Parent creates their own family. (Sitter invites go through the invite_family() DB function,
// which dedupes by email and enforces the free-plan limit.)
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const { mode } = body;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Legacy path for older app builds: forward to invite_family(), run as the calling sitter
    // so dedupe, the free-plan limit and link rules all apply.
    if (mode === 'sitter-invite') {
      const { familyName, adminEmail, childNames } = body;
      const { data, error } = await userClient.rpc('invite_family', {
        p_family_name: familyName || '', p_admin_email: adminEmail || '', p_child_names: childNames || [],
      });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true, familyId: data.family_id, familyName, ...data });
    }

    if (!mode || mode === 'parent') {
      const { familyName, userName } = body;
      if (!familyName?.trim()) return json({ error: 'Family name is required' }, 400);
      const email = (user.email || '').toLowerCase();

      // Already a member somewhere? Don't create a second family.
      const { data: current } = await admin.from('members').select('family_id')
        .eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle();
      if (current) return json({ success: true, familyId: current.family_id, existing: true });

      // A sitter already invited this email: join that family instead of duplicating it.
      const { data: invited } = await admin.from('members').select('id,family_id')
        .ilike('email', email).eq('status', 'pending').is('user_id', null)
        .order('created_at', { ascending: true }).limit(1).maybeSingle();
      if (invited) {
        await admin.from('members').update({ user_id: user.id, status: 'active', name: userName || email.split('@')[0] }).eq('id', invited.id);
        const { data: fam } = await admin.from('families').update({ status: 'active' })
          .eq('id', invited.family_id).eq('status', 'pending').select('id');
        if (fam?.length) {
          await admin.from('family_sitters').update({ status: 'active' }).eq('family_id', invited.family_id).eq('status', 'pending');
        }
        return json({ success: true, familyId: invited.family_id, existing: true });
      }

      const { data: family, error: famErr } = await admin
        .from('families')
        .insert({ name: familyName.trim(), admin_email: email, icon: '\u{1F468}‍\u{1F469}‍\u{1F467}' })
        .select().single();
      if (famErr) throw famErr;

      const { error: memErr } = await admin.from('members').insert({
        family_id: family.id,
        user_id:   user.id,
        name:      userName || email.split('@')[0],
        email,
        role:      'admin',
        status:    'active',
        avatar:    '\u{1F464}',
      });
      if (memErr) throw memErr;

      return json({ success: true, familyId: family.id });
    }

    return json({ error: 'Unknown mode' }, 400);

  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
