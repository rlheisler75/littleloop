// Daycare alerts to a child's parents: an in-app notification plus a phone push (no email).
//   { kind: "daily_report", reportId } -> the day's report was sent. Caller: active staff at
//                                         that daycare; the report must have been sent in the
//                                         last 15 minutes (so this can't be replayed later).
//   { kind: "incident", incidentId }   -> an incident report is ready to read and sign.
//                                         Caller: the daycare's director or office; the report
//                                         must have status "sent".
// Recipients are always the child's parents (members with role admin/member), looked up
// here, never taken from the request. Messages carry no health details, only that
// something is waiting in the app.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: auth } = token ? await sb.auth.getUser(token) : { data: null };
    const user = auth?.user;
    if (!user) return reply({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const kind = String(body.kind || "");

    let facilityId = "", childId = "", type = "", tag = "", itemId = "";
    let managersOnly = false;

    if (kind === "daily_report") {
      const { data: r } = await sb.from("daily_reports").select("id, facility_id, child_id, sent_at").eq("id", body.reportId).maybeSingle();
      if (!r || !r.sent_at) return reply({ error: "Report not found" }, 404);
      if (Date.now() - new Date(r.sent_at).getTime() > 15 * 60 * 1000) return reply({ error: "This report was sent a while ago." }, 409);
      facilityId = r.facility_id; childId = r.child_id; itemId = r.id;
      type = "daycare_report"; tag = "daycare_report";
    } else if (kind === "incident") {
      const { data: r } = await sb.from("incident_reports").select("id, facility_id, child_id, status").eq("id", body.incidentId).maybeSingle();
      if (!r) return reply({ error: "Report not found" }, 404);
      if (r.status !== "sent") return reply({ error: "This report isn't waiting for a signature." }, 409);
      facilityId = r.facility_id; childId = r.child_id; itemId = r.id;
      type = "daycare_incident"; tag = "daycare_incident"; managersOnly = true;
    } else {
      return reply({ error: "Unknown kind" }, 400);
    }

    const { data: me } = await sb.from("facility_staff").select("role")
      .eq("facility_id", facilityId).eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (!me || (managersOnly && !["director", "office"].includes(me.role))) return reply({ error: "Forbidden" }, 403);

    const [{ data: child }, { data: fac }] = await Promise.all([
      sb.from("children").select("name, preferred_name, family_id").eq("id", childId).maybeSingle(),
      sb.from("facilities").select("name").eq("id", facilityId).maybeSingle(),
    ]);
    if (!child) return reply({ error: "Child not found" }, 404);

    const { data: parents } = await sb.from("members").select("user_id")
      .eq("family_id", child.family_id).eq("status", "active").in("role", ["admin", "member"]).not("user_id", "is", null);
    const userIds = [...new Set((parents || []).map((p: any) => p.user_id))].filter((id) => id !== user.id);
    if (!userIds.length) return reply({ sent: 0 });

    const first = (child.preferred_name || child.name || "Your child").split(" ")[0];
    const daycare = fac?.name || "Daycare";
    const title = kind === "daily_report" ? `${first}'s day at ${daycare}` : `Incident report from ${daycare}`;
    const text  = kind === "daily_report"
      ? `${first}'s daily report is ready: meals, naps and more.`
      : `Please read and sign the report about ${first}.`;

    const { error: nErr } = await sb.from("notifications").insert(userIds.map((uid) => ({
      user_id: uid, type, title, body: text, read: false,
      data: { facility_id: facilityId, child_id: childId, item_id: itemId },
    })));
    if (nErr) console.error("daycare-notify notifications insert:", nErr.message);

    await sb.functions.invoke("send-push", { body: { userIds, title, body: text, url: "/", tag } })
      .catch((e: any) => console.error("daycare-notify send-push:", e));

    return reply({ sent: userIds.length });
  } catch (e) {
    console.error("daycare-notify error:", e);
    return reply({ error: "Something went wrong" }, 500);
  }
});
