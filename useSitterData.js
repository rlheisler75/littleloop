// src/hooks/useSitterData.js
// ─────────────────────────────────────────────────────────────
// All data fetching + mutations for the sitter side.
// Replaces every setDb() call in SitterApp with real DB ops.
//
// Returns:
//   data      – { sitter, families, members, children,
//                 posts, messages, invoices }
//   loading   – true while initial fetch is in progress
//   error     – string | null
//   actions   – all mutation functions
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";

export function useSitterData(sitterId) {
  const [sitter,   setSitter]   = useState(null);
  const [families, setFamilies] = useState([]);
  const [members,  setMembers]  = useState([]);
  const [children, setChildren] = useState([]);
  const [posts,    setPosts]    = useState([]);
  // messages keyed by familyId: { [familyId]: [...msgs] }
  const [messages, setMessages] = useState({});
  const [invoices, setInvoices] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const realtimeSubs = useRef([]);

  // ── Initial load ────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!sitterId) return;
    setLoading(true);
    setError(null);

    try {
      // Load everything in parallel
      const [
        { data: sitterRow,     error: e1 },
        { data: familyRows,    error: e2 },
        { data: memberRows,    error: e3 },
        { data: childRows,     error: e4 },
        { data: postRows,      error: e5 },
        { data: messageRows,   error: e6 },
        { data: invoiceRows,   error: e7 },
      ] = await Promise.all([
        supabase.from("sitters").select("*").eq("id", sitterId).single(),

        supabase.from("families").select("*").eq("sitter_id", sitterId).order("created_at"),

        supabase.from("members").select("*")
          .in("family_id", (await supabase.from("families").select("id").eq("sitter_id", sitterId)).data?.map(f=>f.id) ?? [])
          .order("created_at"),

        supabase.from("children")
          .select(`*, medications(*), emergency_contacts(*)`)
          .in("family_id", (await supabase.from("families").select("id").eq("sitter_id", sitterId)).data?.map(f=>f.id) ?? [])
          .order("created_at"),

        supabase.from("posts")
          .select(`*, post_children(child_id), post_likes(member_id)`)
          .in("family_id", (await supabase.from("families").select("id").eq("sitter_id", sitterId)).data?.map(f=>f.id) ?? [])
          .order("created_at", { ascending: false }),

        supabase.from("messages")
          .select("*")
          .in("family_id", (await supabase.from("families").select("id").eq("sitter_id", sitterId)).data?.map(f=>f.id) ?? [])
          .order("created_at"),

        supabase.from("invoices")
          .select(`*, invoice_extras(*), payments(*)`)
          .eq("sitter_id", sitterId)
          .order("issued_date", { ascending: false }),
      ]);

      const err = e1 || e2 || e3 || e4 || e5 || e6 || e7;
      if (err) throw err;

      setSitter(sitterRow);
      setFamilies(familyRows ?? []);
      setMembers(memberRows ?? []);
      setChildren(childRows ?? []);
      setPosts(postRows ?? []);

      // Group messages by family_id
      const msgMap = {};
      (messageRows ?? []).forEach(m => {
        if (!msgMap[m.family_id]) msgMap[m.family_id] = [];
        msgMap[m.family_id].push(m);
      });
      setMessages(msgMap);

      setInvoices(invoiceRows ?? []);
    } catch (err) {
      setError(err.message ?? "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [sitterId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Realtime subscriptions ──────────────────────────────────
  // Keeps feed, messages, checkins live without polling.
  useEffect(() => {
    if (!sitterId || families.length === 0) return;
    const familyIds = families.map(f => f.id);

    // New posts from parents
    const postSub = supabase
      .channel("sitter-posts")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "posts",
          filter: `family_id=in.(${familyIds.join(",")})` },
        payload => setPosts(prev => [payload.new, ...prev])
      )
      .subscribe();

    // New messages from parents
    const msgSub = supabase
      .channel("sitter-messages")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages",
          filter: `family_id=in.(${familyIds.join(",")})` },
        payload => {
          const msg = payload.new;
          setMessages(prev => ({
            ...prev,
            [msg.family_id]: [...(prev[msg.family_id] ?? []), msg],
          }));
        }
      )
      .subscribe();

    // Payment updates (parent records a payment)
    const paymentSub = supabase
      .channel("sitter-payments")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "payments" },
        payload => {
          setInvoices(prev => prev.map(inv =>
            inv.id === payload.new.invoice_id
              ? { ...inv, payments: [...(inv.payments ?? []), payload.new] }
              : inv
          ));
        }
      )
      .subscribe();

    realtimeSubs.current = [postSub, msgSub, paymentSub];

    return () => {
      realtimeSubs.current.forEach(sub =>
        supabase.removeChannel(sub)
      );
    };
  }, [sitterId, families]);

  // ── ACTIONS ─────────────────────────────────────────────────

  // ── Invite a family ─────────────────────────────────────────
  async function inviteFamily({ familyName, adminEmail, childNames }) {
    // 1. Create the family
    const { data: family, error: e1 } = await supabase
      .from("families")
      .insert({ sitter_id: sitterId, name: familyName, admin_email: adminEmail, status: "pending" })
      .select()
      .single();
    if (e1) return { error: e1.message };

    // 2. Create the admin member (pending until they sign up)
    const { data: adminMember, error: e2 } = await supabase
      .from("members")
      .insert({
        family_id: family.id,
        name:   adminEmail.split("@")[0],
        email:  adminEmail,
        role:   "admin",
        status: "pending",
      })
      .select()
      .single();
    if (e2) return { error: e2.message };

    // 3. Create children placeholders
    const kidInserts = childNames
      .filter(n => n.trim())
      .map(name => ({ family_id: family.id, name: name.trim(), avatar: "🌟", color: "#8B78D4" }));

    if (kidInserts.length > 0) {
      const { error: e3 } = await supabase.from("children").insert(kidInserts);
      if (e3) return { error: e3.message };
    }

    // TODO: Send invite email via Supabase Edge Function or Resend
    // await sendInviteEmail(adminEmail, familyName, sitter.name);

    // Refresh local state
    await loadAll();
    return { error: null };
  }

  // ── Create a post ───────────────────────────────────────────
  async function createPost({ familyId, childIds, type, mood, text, photoFile }) {
    let photo_url = null;

    // Upload photo if provided
    if (photoFile) {
      const ext  = photoFile.name.split(".").pop();
      const path = `${familyId}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("post-photos")
        .upload(path, photoFile);
      if (uploadErr) return { error: uploadErr.message };

      const { data: { publicUrl } } = supabase.storage
        .from("post-photos")
        .getPublicUrl(path);
      photo_url = publicUrl;
    }

    // Insert post
    const { data: post, error: e1 } = await supabase
      .from("posts")
      .insert({
        family_id:   familyId,
        author_role: "sitter",
        author_id:   sitterId,
        type,
        mood,
        text,
        photo_url,
        pinned: false,
      })
      .select()
      .single();
    if (e1) return { error: e1.message };

    // Tag children
    if (childIds.length > 0) {
      const { error: e2 } = await supabase
        .from("post_children")
        .insert(childIds.map(cid => ({ post_id: post.id, child_id: cid })));
      if (e2) return { error: e2.message };
    }

    setPosts(prev => [{ ...post, post_children: childIds.map(c=>({child_id:c})), post_likes: [] }, ...prev]);
    return { error: null, post };
  }

  // ── Toggle post pinned ──────────────────────────────────────
  async function togglePin(postId, currentlyPinned) {
    const { error } = await supabase
      .from("posts")
      .update({ pinned: !currentlyPinned })
      .eq("id", postId);
    if (!error) {
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, pinned: !p.pinned } : p
      ));
    }
    return { error };
  }

  // ── Send a message ──────────────────────────────────────────
  async function sendMessage({ familyId, text }) {
    const { data: msg, error } = await supabase
      .from("messages")
      .insert({
        family_id:   familyId,
        sender_role: "sitter",
        sender_id:   sitterId,
        sender_name: sitter?.name ?? "Sitter",
        text,
      })
      .select()
      .single();

    if (!error) {
      setMessages(prev => ({
        ...prev,
        [familyId]: [...(prev[familyId] ?? []), msg],
      }));
    }
    return { error };
  }

  // ── Create an invoice ───────────────────────────────────────
  async function createInvoice({ familyId, type, hours, rate, tuitionPeriod, tuitionRate, extras, note, dueDate }) {
    const { data: invoice, error: e1 } = await supabase
      .from("invoices")
      .insert({
        family_id:      familyId,
        sitter_id:      sitterId,
        type,
        hours:          type === "hourly"  ? hours         : null,
        rate:           type === "hourly"  ? rate          : null,
        tuition_period: type === "tuition" ? tuitionPeriod : null,
        tuition_rate:   type === "tuition" ? tuitionRate   : null,
        note,
        due_date:       dueDate || null,
      })
      .select()
      .single();
    if (e1) return { error: e1.message };

    // Insert extras
    if (extras.length > 0) {
      const { error: e2 } = await supabase
        .from("invoice_extras")
        .insert(extras.map((ex, i) => ({
          invoice_id: invoice.id,
          label:      ex.label,
          amount:     ex.amount,
          sort_order: i,
        })));
      if (e2) return { error: e2.message };
    }

    await loadAll(); // refresh to get totals from the view
    return { error: null };
  }

  // ── Record a payment ────────────────────────────────────────
  async function recordPayment({ invoiceId, amount, method, note, paidDate }) {
    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        invoice_id:  invoiceId,
        amount,
        method,
        note:        note || null,
        paid_date:   paidDate ?? new Date().toISOString().slice(0, 10),
        recorded_by: sitterId,
      })
      .select()
      .single();

    if (!error) {
      setInvoices(prev => prev.map(inv =>
        inv.id === invoiceId
          ? { ...inv, payments: [...(inv.payments ?? []), payment] }
          : inv
      ));
    }
    return { error };
  }

  // ── Update a member's role ──────────────────────────────────
  async function updateMemberRole(memberId, newRole) {
    const { error } = await supabase
      .from("members")
      .update({ role: newRole })
      .eq("id", memberId);
    if (!error) {
      setMembers(prev => prev.map(m =>
        m.id === memberId ? { ...m, role: newRole } : m
      ));
    }
    return { error };
  }

  // ── Remove a member ─────────────────────────────────────────
  async function removeMember(memberId) {
    const { error } = await supabase
      .from("members")
      .update({ status: "removed" })  // soft delete
      .eq("id", memberId);
    if (!error) {
      setMembers(prev => prev.filter(m => m.id !== memberId));
    }
    return { error };
  }

  return {
    data: { sitter, families, members, children, posts, messages, invoices },
    loading,
    error,
    reload: loadAll,
    actions: {
      inviteFamily,
      createPost,
      togglePin,
      sendMessage,
      createInvoice,
      recordPayment,
      updateMemberRole,
      removeMember,
    },
  };
}
