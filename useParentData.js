// src/hooks/useParentData.js
// ─────────────────────────────────────────────────────────────
// All data fetching + mutations for the parent side.
// Scoped entirely to the family the logged-in member belongs to.
// RLS in Supabase enforces this at the DB level — no family can
// ever accidentally see another family's data.
//
// Returns:
//   data      – { member, family, members, children,
//                 posts, messages, invoices }
//   loading
//   error
//   actions   – all mutation functions
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";

export function useParentData(userId) {
  const [member,   setMember]   = useState(null);   // this user's member row
  const [family,   setFamily]   = useState(null);
  const [members,  setMembers]  = useState([]);      // all family members
  const [children, setChildren] = useState([]);
  const [posts,    setPosts]    = useState([]);
  const [messages, setMessages] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const realtimeSubs = useRef([]);

  // ── Initial load ────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Find this user's member record (gives us family_id)
      const { data: memberRow, error: e1 } = await supabase
        .from("members")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .single();
      if (e1) throw new Error("Could not find your family membership. " + e1.message);
      setMember(memberRow);

      const familyId = memberRow.family_id;

      // 2. Load everything else in parallel, all scoped to this family
      const [
        { data: familyRow,   error: e2 },
        { data: memberRows,  error: e3 },
        { data: childRows,   error: e4 },
        { data: postRows,    error: e5 },
        { data: messageRows, error: e6 },
        { data: invoiceRows, error: e7 },
      ] = await Promise.all([

        supabase
          .from("families")
          .select("*")
          .eq("id", familyId)
          .single(),

        supabase
          .from("members")
          .select("*")
          .eq("family_id", familyId)
          .eq("status", "active")
          .order("created_at"),

        // Children with nested medications and emergency contacts
        supabase
          .from("children")
          .select(`
            *,
            medications ( id, name, dose, instructions ),
            emergency_contacts ( id, name, relation, phone )
          `)
          .eq("family_id", familyId)
          .order("created_at"),

        // Posts with tagged children and likes
        supabase
          .from("posts")
          .select(`
            *,
            post_children ( child_id ),
            post_likes    ( member_id )
          `)
          .eq("family_id", familyId)
          .order("pinned",      { ascending: false })
          .order("created_at",  { ascending: false }),

        supabase
          .from("messages")
          .select("*")
          .eq("family_id", familyId)
          .order("created_at"),

        // Invoices with extras and payments (RLS limits to admin/member roles)
        supabase
          .from("invoices")
          .select(`
            *,
            invoice_extras ( id, label, amount, sort_order ),
            payments       ( id, amount, method, note, paid_date, recorded_by )
          `)
          .eq("family_id", familyId)
          .order("issued_date", { ascending: false }),
      ]);

      const err = e2 || e3 || e4 || e5 || e6 || e7;
      if (err) throw err;

      setFamily(familyRow);
      setMembers(memberRows   ?? []);
      setChildren(childRows   ?? []);
      setPosts(postRows       ?? []);
      setMessages(messageRows ?? []);
      setInvoices(invoiceRows ?? []);

    } catch (err) {
      setError(err.message ?? "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Realtime subscriptions ──────────────────────────────────
  useEffect(() => {
    if (!member?.family_id) return;
    const familyId = member.family_id;

    // New posts from sitter
    const postSub = supabase
      .channel("parent-posts")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "posts",
          filter: `family_id=eq.${familyId}` },
        async payload => {
          // Fetch full post with children + likes
          const { data } = await supabase
            .from("posts")
            .select("*, post_children(child_id), post_likes(member_id)")
            .eq("id", payload.new.id)
            .single();
          if (data) setPosts(prev => [data, ...prev]);
        }
      )
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "posts",
          filter: `family_id=eq.${familyId}` },
        payload => {
          setPosts(prev => prev.map(p =>
            p.id === payload.new.id ? { ...p, ...payload.new } : p
          ));
        }
      )
      .subscribe();

    // New messages from sitter
    const msgSub = supabase
      .channel("parent-messages")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages",
          filter: `family_id=eq.${familyId}` },
        payload => setMessages(prev => [...prev, payload.new])
      )
      .subscribe();

    // New payments (sitter records one)
    const paymentSub = supabase
      .channel("parent-payments")
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

    // Like updates
    const likeSub = supabase
      .channel("parent-likes")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "post_likes" },
        () => loadAll()   // simple reload on any like change
      )
      .subscribe();

    realtimeSubs.current = [postSub, msgSub, paymentSub, likeSub];

    return () => {
      realtimeSubs.current.forEach(sub => supabase.removeChannel(sub));
    };
  }, [member?.family_id, loadAll]);

  // ── ACTIONS ─────────────────────────────────────────────────

  // ── Send a message ──────────────────────────────────────────
  async function sendMessage(text) {
    if (!member) return { error: "Not logged in" };
    const { data: msg, error } = await supabase
      .from("messages")
      .insert({
        family_id:   member.family_id,
        sender_role: "parent",
        sender_id:   member.id,
        sender_name: member.name.split(" ")[0],
        text,
      })
      .select()
      .single();

    if (!error) setMessages(prev => [...prev, msg]);
    return { error };
  }

  // ── Like / unlike a post ────────────────────────────────────
  async function toggleLike(postId) {
    if (!member) return;
    const alreadyLiked = posts
      .find(p => p.id === postId)
      ?.post_likes?.some(l => l.member_id === member.id);

    if (alreadyLiked) {
      await supabase.from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("member_id", member.id);
    } else {
      await supabase.from("post_likes")
        .insert({ post_id: postId, member_id: member.id });
    }

    // Optimistic update
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const likes = p.post_likes ?? [];
      return {
        ...p,
        post_likes: alreadyLiked
          ? likes.filter(l => l.member_id !== member.id)
          : [...likes, { member_id: member.id }],
      };
    }));
  }

  // ── Check a child in or out ─────────────────────────────────
  async function toggleCheckin(childId) {
    const child = children.find(c => c.id === childId);
    if (!child) return;

    // Fetch current status
    const { data: current } = await supabase
      .from("checkins")
      .select("status")
      .eq("child_id", childId)
      .maybeSingle();

    const newStatus = current?.status === "in" ? "out" : "in";

    // Upsert — creates row if first checkin, updates if exists
    const { error } = await supabase
      .from("checkins")
      .upsert({
        child_id:        childId,
        status:          newStatus,
        checked_at:      new Date().toISOString(),
        checked_by:      member.id,
        checked_by_role: "parent",
      });

    if (!error) {
      setChildren(prev => prev.map(c =>
        c.id === childId
          ? { ...c, checkin: { status: newStatus, checked_at: new Date().toISOString() } }
          : c
      ));
    }
    return { error };
  }

  // ── Record a payment on an invoice ─────────────────────────
  async function recordPayment({ invoiceId, amount, method, note }) {
    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        invoice_id:  invoiceId,
        amount,
        method,
        note:        note || null,
        paid_date:   new Date().toISOString().slice(0, 10),
        recorded_by: member.id,
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

  // ── Update child profile ────────────────────────────────────
  async function updateChild(childId, updates) {
    const { allergies, medications, emergency_contacts, ...childFields } = updates;

    // Update core child fields
    const { error: e1 } = await supabase
      .from("children")
      .update({
        name:                 childFields.name,
        dob:                  childFields.dob || null,
        avatar:               childFields.avatar,
        color:                childFields.color,
        photo_url:            childFields.photo_url ?? null,
        allergies:            allergies ?? [],
        dietary_restrictions: childFields.dietary_restrictions || null,
        medical_notes:        childFields.medical_notes || null,
        behavioral_notes:     childFields.behavioral_notes || null,
      })
      .eq("id", childId);
    if (e1) return { error: e1.message };

    // Replace medications — delete all, re-insert
    await supabase.from("medications").delete().eq("child_id", childId);
    if ((medications ?? []).length > 0) {
      const { error: e2 } = await supabase.from("medications").insert(
        medications.map(m => ({
          child_id:     childId,
          name:         m.name,
          dose:         m.dose || null,
          instructions: m.instructions || null,
        }))
      );
      if (e2) return { error: e2.message };
    }

    // Replace emergency contacts
    await supabase.from("emergency_contacts").delete().eq("child_id", childId);
    if ((emergency_contacts ?? []).length > 0) {
      const { error: e3 } = await supabase.from("emergency_contacts").insert(
        emergency_contacts.map(c => ({
          child_id: childId,
          name:     c.name,
          relation: c.relation || null,
          phone:    c.phone,
        }))
      );
      if (e3) return { error: e3.message };
    }

    await loadAll();
    return { error: null };
  }

  // ── Upload child photo ──────────────────────────────────────
  async function uploadChildPhoto(childId, file) {
    const ext  = file.name.split(".").pop();
    const path = `${member.family_id}/${childId}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("child-photos")
      .upload(path, file, { upsert: true });
    if (uploadErr) return { error: uploadErr.message, url: null };

    const { data: { publicUrl } } = supabase.storage
      .from("child-photos")
      .getPublicUrl(path);

    // Save URL to child row
    await supabase.from("children")
      .update({ photo_url: publicUrl })
      .eq("id", childId);

    setChildren(prev => prev.map(c =>
      c.id === childId ? { ...c, photo_url: publicUrl } : c
    ));

    return { error: null, url: publicUrl };
  }

  // ── Invite a new family member ──────────────────────────────
  // Admin-only. Creates a pending member row — DB trigger
  // auto-activates them when they sign up with this email.
  async function inviteMember({ name, email, avatar, role }) {
    if (member?.role !== "admin") return { error: "Admin only" };

    const { data: newMember, error } = await supabase
      .from("members")
      .insert({
        family_id:  member.family_id,
        invited_by: member.id,
        name,
        email,
        avatar:     avatar ?? "👤",
        role,
        status:     "pending",
      })
      .select()
      .single();

    if (!error) setMembers(prev => [...prev, newMember]);
    return { error, member: newMember };
  }

  // ── Change a member's role ──────────────────────────────────
  async function updateMemberRole(memberId, newRole) {
    if (member?.role !== "admin") return { error: "Admin only" };

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
    if (member?.role !== "admin") return { error: "Admin only" };

    const { error } = await supabase
      .from("members")
      .update({ status: "removed" })
      .eq("id", memberId);

    if (!error) setMembers(prev => prev.filter(m => m.id !== memberId));
    return { error };
  }

  return {
    data: { member, family, members, children, posts, messages, invoices },
    loading,
    error,
    reload: loadAll,
    actions: {
      sendMessage,
      toggleLike,
      toggleCheckin,
      recordPayment,
      updateChild,
      uploadChildPhoto,
      inviteMember,
      updateMemberRole,
      removeMember,
    },
  };
}
