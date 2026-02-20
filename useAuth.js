// src/hooks/useAuth.js
// ─────────────────────────────────────────────────────────────
// Handles all authentication for both sitters and parents.
//
// Sitter signup:  signUpAsSitter(email, password, name)
// Parent signup:  signUpAsParent(email, password, name)
//   → the DB trigger auto-links them to any pending invite
//     and auto-promotes to admin if they match admin_email
//
// Login:          login(email, password)
// Magic link:     sendMagicLink(email)   ← great for parents
// Logout:         logout()
// Current user:   { session, user, role, loading, error }
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export function useAuth() {
  const [session, setSession] = useState(null);
  const [user,    setUser]    = useState(null);
  // "sitter" | "parent" | null — derived from DB after login
  const [role,    setRole]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // ── Determine role after a session is established ──────────
  const resolveRole = useCallback(async (authUser) => {
    if (!authUser) { setRole(null); return; }

    // Is this user a sitter?
    const { data: sitter } = await supabase
      .from("sitters")
      .select("id")
      .eq("id", authUser.id)
      .maybeSingle();

    if (sitter) { setRole("sitter"); return; }

    // Otherwise they're a parent/member
    setRole("parent");
  }, []);

  // ── Listen for auth state changes ──────────────────────────
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      resolveRole(session?.user ?? null).finally(() => setLoading(false));
    });

    // Subscribe to future changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        resolveRole(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, [resolveRole]);

  // ── Sign up as sitter ───────────────────────────────────────
  // The DB trigger (handle_new_user) creates the sitters row.
  async function signUpAsSitter(email, password, name) {
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role: "sitter", name },
      },
    });
    if (error) setError(error.message);
    return { error };
  }

  // ── Sign up as parent ───────────────────────────────────────
  // The DB trigger (handle_member_activation) auto-links them
  // to any pending invite matching their email.
  async function signUpAsParent(email, password, name) {
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role: "parent", name },
      },
    });
    if (error) setError(error.message);
    return { error };
  }

  // ── Email + password login ──────────────────────────────────
  async function login(email, password) {
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    return { error };
  }

  // ── Magic link (passwordless) ───────────────────────────────
  // Great UX for parents — they click a link in their email.
  async function sendMagicLink(email) {
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // After clicking the link, redirect back to your app
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) setError(error.message);
    return { error };
  }

  // ── Logout ─────────────────────────────────────────────────
  async function logout() {
    await supabase.auth.signOut();
    setRole(null);
  }

  return {
    session,
    user,
    role,       // "sitter" | "parent" | null
    loading,
    error,
    signUpAsSitter,
    signUpAsParent,
    login,
    sendMagicLink,
    logout,
  };
}
