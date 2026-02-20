// src/components/AuthScreen.jsx
// ─────────────────────────────────────────────────────────────
// Login / signup screen shown when no session exists.
// Handles both sitters (email+password) and parents (magic link
// or email+password). Drop this in place of SitterApp/ParentApp
// when useAuth().user is null.
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

const STYLES = {
  wrap: {
    minHeight: "100vh", display: "flex", alignItems: "center",
    justifyContent: "center", background: "#EFF4FB", fontFamily: "'Outfit', sans-serif",
  },
  card: {
    background: "#fff", borderRadius: 20, padding: "40px 36px",
    width: "100%", maxWidth: 420, boxShadow: "0 8px 48px #14243A18",
  },
  logo: {
    fontFamily: "'Playfair Display', serif", fontSize: 28,
    fontWeight: 700, color: "#3A6FD4", marginBottom: 4,
  },
  tagline: { fontSize: 13, color: "#7A90AA", marginBottom: 32 },
  label: {
    display: "block", fontSize: 10, fontWeight: 700,
    letterSpacing: ".8px", color: "#7A90AA", marginBottom: 5,
    textTransform: "uppercase",
  },
  input: {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    border: "1px solid #D8E4F4", fontSize: 13, color: "#14243A",
    outline: "none", marginBottom: 12, boxSizing: "border-box",
    fontFamily: "'Outfit', sans-serif",
  },
  btn: (color = "#3A6FD4") => ({
    width: "100%", padding: "12px", borderRadius: 10, border: "none",
    background: color, color: "#fff", fontSize: 14, fontWeight: 700,
    cursor: "pointer", fontFamily: "'Outfit', sans-serif", marginBottom: 10,
  }),
  ghost: {
    width: "100%", padding: "11px", borderRadius: 10,
    border: "1px solid #D8E4F4", background: "transparent",
    color: "#7A90AA", fontSize: 13, cursor: "pointer",
    fontFamily: "'Outfit', sans-serif", marginBottom: 10,
  },
  tabs: { display: "flex", marginBottom: 24, borderBottom: "1px solid #EAE0D4" },
  tab: (active) => ({
    flex: 1, padding: "10px 0", textAlign: "center", cursor: "pointer",
    fontSize: 13, fontWeight: 700,
    color: active ? "#3A6FD4" : "#7A90AA",
    borderBottom: active ? "2px solid #3A6FD4" : "2px solid transparent",
  }),
  err: {
    background: "#FFE8E8", border: "1px solid #FFB0B0", borderRadius: 8,
    padding: "9px 12px", fontSize: 12, color: "#B03A3A", marginBottom: 12,
  },
  ok: {
    background: "#E8F5EE", border: "1px solid #A0D4B8", borderRadius: 8,
    padding: "9px 12px", fontSize: 12, color: "#2A7A50", marginBottom: 12,
  },
  divider: {
    display: "flex", alignItems: "center", gap: 10,
    margin: "16px 0", color: "#B0BEC5", fontSize: 11,
  },
  line: { flex: 1, height: 1, background: "#EAE0D4" },
};

export function AuthScreen() {
  // "sitter" | "parent"
  const [accountType, setAccountType] = useState("parent");
  // "login" | "signup" | "magic"
  const [mode, setMode]               = useState("login");

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [name,     setName]     = useState("");
  const [sent,     setSent]     = useState(false);   // magic link sent

  const { login, signUpAsSitter, signUpAsParent, sendMagicLink, error, loading } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    setSent(false);

    if (mode === "magic") {
      const { error } = await sendMagicLink(email);
      if (!error) setSent(true);
      return;
    }

    if (mode === "signup") {
      const fn = accountType === "sitter" ? signUpAsSitter : signUpAsParent;
      await fn(email, password, name);
      return;
    }

    // login
    await login(email, password);
  }

  return (
    <div style={STYLES.wrap}>
      <div style={STYLES.card}>
        <div style={STYLES.logo}>🌿 littleloop</div>
        <div style={STYLES.tagline}>Independent childcare, thoughtfully connected.</div>

        {/* Account type tabs */}
        <div style={STYLES.tabs}>
          <div style={STYLES.tab(accountType === "parent")}   onClick={() => setAccountType("parent")}>👨‍👩‍👧 Family</div>
          <div style={STYLES.tab(accountType === "sitter")}   onClick={() => setAccountType("sitter")}>🌿 Sitter</div>
        </div>

        {/* Error / success */}
        {error  && <div style={STYLES.err}>{error}</div>}
        {sent   && <div style={STYLES.ok}>✉️ Check your email — we sent a sign-in link!</div>}

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <>
              <label style={STYLES.label}>YOUR NAME</label>
              <input style={STYLES.input} value={name} onChange={e => setName(e.target.value)}
                placeholder={accountType === "sitter" ? "Maya Rodriguez" : "Sarah Chen"} required />
            </>
          )}

          <label style={STYLES.label}>EMAIL</label>
          <input style={STYLES.input} type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com" required />

          {mode !== "magic" && (
            <>
              <label style={STYLES.label}>PASSWORD</label>
              <input style={STYLES.input} type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required minLength={8} />
            </>
          )}

          <button type="submit" style={STYLES.btn()} disabled={loading}>
            {loading ? "Please wait…" :
              mode === "magic"  ? "Send Sign-in Link" :
              mode === "signup" ? `Create ${accountType === "sitter" ? "Sitter" : "Family"} Account` :
              "Sign In"}
          </button>
        </form>

        {/* Magic link option (parents only) */}
        {accountType === "parent" && mode !== "magic" && (
          <>
            <div style={STYLES.divider}>
              <div style={STYLES.line} />
              <span>or</span>
              <div style={STYLES.line} />
            </div>
            <button style={STYLES.ghost} onClick={() => setMode("magic")}>
              ✉️ Sign in with email link (no password)
            </button>
          </>
        )}

        {/* Toggle between login and signup */}
        <div style={{ textAlign: "center", fontSize: 12, color: "#7A90AA", marginTop: 8 }}>
          {mode === "login" ? (
            <>Don't have an account?{" "}
              <span style={{ color: "#3A6FD4", cursor: "pointer", fontWeight: 700 }}
                onClick={() => setMode("signup")}>Sign up</span>
            </>
          ) : (
            <>Already have an account?{" "}
              <span style={{ color: "#3A6FD4", cursor: "pointer", fontWeight: 700 }}
                onClick={() => setMode("login")}>Sign in</span>
            </>
          )}
        </div>

        {/* Parent-specific hint */}
        {accountType === "parent" && mode === "signup" && (
          <div style={{ marginTop: 20, background: "#EBF3FF", borderRadius: 10,
            padding: "10px 14px", fontSize: 11, color: "#2A52A8", lineHeight: 1.6 }}>
            💡 Your sitter will have sent an invite to your email. Sign up with that
            same email address and you'll be automatically connected to your family.
          </div>
        )}
      </div>
    </div>
  );
}
