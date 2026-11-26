// Daily job: creates invoices for recurring schedules that are due.
// Called by pg_cron (x-cron-secret header, checked against Vault) or with the service-role key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TZ = "America/Chicago";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

// ── Date helpers on YYYY-MM-DD strings ───────────────────────────────────────
const todayLocal = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const toDate = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => { const d = toDate(s); d.setUTCDate(d.getUTCDate() + n); return fmt(d); };
function addMonth(s: string, anchor: number) {
  const d = toDate(s);
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
  const daysInNext = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return fmt(new Date(Date.UTC(y, m, Math.min(anchor, daysInNext))));
}
function step(s: string, freq: string, anchor: number) {
  if (freq === "weekly")   return addDays(s, 7);
  if (freq === "biweekly") return addDays(s, 14);
  return addMonth(s, anchor);
}

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
// Recurring invoices are a paid feature: any paid sitter plan, a complimentary plan, or the
// free sitter mode daycare staff get. sitter_is_pro() in the database decides (one place).
async function isPro(sb: any, sitterId: string, cache: Map<string, boolean>) {
  if (!cache.has(sitterId)) {
    const { data } = await sb.rpc("sitter_is_pro", { p_sitter_id: sitterId });
    cache.set(sitterId, data === true);
  }
  return cache.get(sitterId)!;
}

Deno.serve(async (req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ── Auth: cron secret or service key only ──────────────────────────────────
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const cronSecret = req.headers.get("x-cron-secret") || "";
  let allowed = bearer === SUPABASE_SERVICE_KEY;
  if (!allowed && cronSecret) {
    const { data } = await sb.rpc("check_cron_secret", { p_secret: cronSecret });
    allowed = data === true;
  }
  if (!allowed) return json({ error: "Forbidden" }, 403);

  const today = todayLocal();
  const { data: due, error } = await sb.from("recurring_invoices")
    .select("*, sitters(name, subscription_status, subscription_plan), children(name)")
    .eq("active", true).lte("next_run_date", today);
  if (error) return json({ error: error.message }, 500);

  const results: any[] = [];
  const proCache = new Map<string, boolean>();
  for (const r of due || []) {
    try {
      // Still connected to this family?
      const { data: link } = await sb.from("family_sitters").select("id")
        .eq("sitter_id", r.sitter_id).eq("family_id", r.family_id).eq("status", "active").maybeSingle();
      if (!link) {
        await sb.from("recurring_invoices").update({ active: false }).eq("id", r.id);
        results.push({ id: r.id, skipped: "family no longer connected; paused" });
        continue;
      }
      if (!(await isPro(sb, r.sitter_id, proCache))) { results.push({ id: r.id, skipped: "not on a paid plan" }); continue; }

      // Next date strictly after today (missed periods produce one invoice, not several).
      const anchor = r.anchor_day || toDate(r.next_run_date).getUTCDate();
      let next = r.next_run_date;
      while (next <= today) next = step(next, r.frequency, anchor);

      // Claim the run atomically so a double call can't bill twice.
      const { data: claimed } = await sb.from("recurring_invoices")
        .update({ next_run_date: next, last_run_at: new Date().toISOString() })
        .eq("id", r.id).eq("next_run_date", r.next_run_date).eq("active", true)
        .select("id");
      if (!claimed?.length) { results.push({ id: r.id, skipped: "already claimed" }); continue; }

      const amount = Number(r.amount);
      const status = r.auto_send ? "sent" : "draft";
      const { data: number } = await sb.rpc("next_invoice_number", { p_sitter_id: r.sitter_id });
      const { data: inv, error: invErr } = await sb.from("invoices").insert({
        invoice_number: number, family_id: r.family_id, sitter_id: r.sitter_id, status,
        issued_date: today, due_date: addDays(today, r.due_days || 0), notes: null,
      }).select("id, invoice_number").single();
      if (invErr || !inv) {
        await sb.from("recurring_invoices").update({ next_run_date: r.next_run_date }).eq("id", r.id);   // un-claim
        throw new Error(invErr?.message || "invoice insert failed");
      }

      const { error: itemErr } = await sb.from("invoice_items").insert({
        invoice_id: inv.id, service_date: today, end_date: null,
        child_id: r.child_id, child_name: r.children?.name || "",
        rate_type: "flat", hours: null, rate: amount, amount,
        description: r.description || null, sort_order: 0,
      });
      if (itemErr) {
        await sb.from("invoices").delete().eq("id", inv.id);
        await sb.from("recurring_invoices").update({ next_run_date: r.next_run_date }).eq("id", r.id);
        throw new Error(itemErr.message);
      }

      await sb.from("recurring_invoices").update({ last_invoice_id: inv.id }).eq("id", r.id);

      const sitterName = r.sitters?.name || "Your sitter";
      if (r.auto_send) {
        const { data: fam } = await sb.from("families").select("name").eq("id", r.family_id).maybeSingle();
        await sb.functions.invoke("send-notification", {
          body: { type: "new_invoice", payload: {
            familyId: r.family_id, sitterName, invoiceNumber: inv.invoice_number,
            amount: money(amount), familyName: fam?.name || "",
          } },
        }).catch((e: any) => console.error("notify failed", e));
      }
      await sb.from("notifications").insert({
        user_id: r.sitter_id, type: "new_invoice", read: false,
        title: r.auto_send ? `Recurring invoice ${inv.invoice_number} sent` : `Recurring invoice ${inv.invoice_number} drafted`,
        body: `${money(amount)}${r.auto_send ? " sent automatically" : " is ready to review and send"}`,
        data: { invoiceId: inv.id, recurringId: r.id },
      });

      results.push({ id: r.id, invoice: inv.invoice_number, status, next });
    } catch (e) {
      console.error("recurring run failed", r.id, e);
      results.push({ id: r.id, error: String(e) });
    }
  }
  return json({ today, processed: results.length, results });
});
