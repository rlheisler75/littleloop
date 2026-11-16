import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_SECRET = Deno.env.get("ADMIN_SECRET") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
};
const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function cleanupUserData(adminClient: any, userId: string) {
  await adminClient.from("sitters").update({ background_check_verified_by: null }).eq("background_check_verified_by", userId);

  const { data: sessions } = await adminClient.from("field_trip_sessions").select("id").eq("created_by", userId);
  if (sessions?.length) {
    const sessionIds = sessions.map((s: any) => s.id);
    await adminClient.from("field_trip_locations").delete().in("session_id", sessionIds);
    await adminClient.from("field_trip_children").delete().in("session_id", sessionIds);
    await adminClient.from("field_trip_sessions").delete().eq("created_by", userId);
  }
}

// Remove every file under "<familyId>/" in a bucket (best effort).
async function removeFolder(adminClient: any, bucket: string, folder: string) {
  for (let i = 0; i < 20; i++) {
    const { data } = await adminClient.storage.from(bucket).list(folder, { limit: 100 });
    if (!data?.length) return;
    const { error } = await adminClient.storage.from(bucket).remove(data.map((f: any) => `${folder}/${f.name}`));
    if (error) { console.error(`remove ${bucket}/${folder}:`, error.message); return; }
  }
}

// Parent accounts: work out which families this user belongs to, and whether
// deleting them would leave a family with members but no admin.
async function planParentDeletion(adminClient: any, userId: string) {
  const { data: mine } = await adminClient.from("members").select("id,family_id,role").eq("user_id", userId);
  const toClose: string[] = [];
  for (const m of mine || []) {
    const { data: others } = await adminClient.from("members").select("role,status,user_id")
      .eq("family_id", m.family_id).neq("user_id", userId).not("user_id", "is", null).eq("status", "active");
    if (!others?.length) toClose.push(m.family_id);
    else if (m.role === "admin" && !others.some((o: any) => o.role === "admin")) {
      return { blocked: true, mine: mine || [], toClose };
    }
  }
  return { blocked: false, mine: mine || [], toClose };
}

async function deleteParentData(adminClient: any, userId: string, mine: any[], toClose: string[]) {
  for (const fid of toClose) {
    const { error } = await adminClient.rpc("close_family_data", { p_family_id: fid });
    if (error) throw new Error(error.message);
    await removeFolder(adminClient, "agreements", fid);
    await removeFolder(adminClient, "post-photos", fid);
  }
  const ids = mine.map((m: any) => m.id);
  if (ids.length) {
    await adminClient.from("member_locations").delete().in("member_id", ids);
    await adminClient.from("members").update({ invited_by: null }).in("invited_by", ids);
    const { error } = await adminClient.from("members").delete().in("id", ids);
    if (error) throw new Error(error.message);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const body = await req.json().catch(() => ({}));

    // Admin path
    const adminSecret = req.headers.get("x-admin-secret");
    if (adminSecret && ADMIN_SECRET && adminSecret === ADMIN_SECRET) {
      const { userId, type } = body;
      if (!userId) return reply({ error: "userId required" }, 400);
      await cleanupUserData(adminClient, userId);
      if (type === "sitter") {
        await adminClient.from("sitters").delete().eq("id", userId);
      } else {
        const plan = await planParentDeletion(adminClient, userId);
        await deleteParentData(adminClient, userId, plan.mine, plan.toClose);
      }
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) throw new Error(error.message);
      return reply({ success: true });
    }

    // Self-delete path
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return reply({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return reply({ error: "Could not verify user" }, 401);

    const plan = await planParentDeletion(adminClient, user.id);
    if (body?.dryRun) return reply({ blocked: plan.blocked, closesFamily: plan.toClose.length > 0 });
    if (plan.blocked) {
      return reply({ error: "last_admin", message: "You're the only admin of your family. Make another member an admin first, then delete your account." }, 409);
    }

    await cleanupUserData(adminClient, user.id);
    await deleteParentData(adminClient, user.id, plan.mine, plan.toClose);
    await adminClient.from("sitters").delete().eq("id", user.id);

    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteErr) throw new Error(deleteErr.message);
    return reply({ success: true });
  } catch (err) {
    console.error("delete-account error:", err);
    return reply({ error: "Could not delete account" }, 500);
  }
});
