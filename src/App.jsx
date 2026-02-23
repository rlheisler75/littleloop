import { useState, useEffect } from "react";

// ─── Fonts + global CSS ───────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'DM Sans', sans-serif;
    background: #0C1420;
    color: #E4EAF4;
    min-height: 100vh;
    overflow-x: hidden;
  }

  input, button { font-family: 'DM Sans', sans-serif; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes floatLeaf {
    0%, 100% { transform: translateY(0)   rotate(-2deg); }
    50%       { transform: translateY(-10px) rotate(2deg); }
  }
  @keyframes shimmerText {
    0%   { background-position: 0% center; }
    100% { background-position: 200% center; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes orb1 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33%       { transform: translate(30px, -20px) scale(1.05); }
    66%       { transform: translate(-20px, 15px) scale(0.97); }
  }
  @keyframes orb2 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50%       { transform: translate(-25px, 20px) scale(1.08); }
  }

  .fade-up   { animation: fadeUp 0.55s cubic-bezier(0.22,1,0.36,1) both; }
  .d1 { animation-delay: 0.05s; }
  .d2 { animation-delay: 0.12s; }
  .d3 { animation-delay: 0.19s; }
  .d4 { animation-delay: 0.26s; }
  .d5 { animation-delay: 0.33s; }
  .d6 { animation-delay: 0.40s; }

  .leaf { animation: floatLeaf 5s ease-in-out infinite; display: inline-block; }

  .logo-text {
    font-family: 'Cormorant Garamond', serif;
    font-size: 42px;
    font-weight: 700;
    letter-spacing: -1px;
    background: linear-gradient(90deg, #6FA3E8, #A8CCFF, #E2EDFF, #A8CCFF, #6FA3E8);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: shimmerText 5s linear infinite;
  }

  .card {
    background: rgba(255,255,255,0.035);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 22px;
    padding: 34px 30px;
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    box-shadow:
      0 40px 80px rgba(0,0,0,0.45),
      inset 0 1px 0 rgba(255,255,255,0.06);
  }

  .tab-bar {
    display: flex;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    margin-bottom: 26px;
  }
  .tab {
    flex: 1; padding: 10px 0; text-align: center; cursor: pointer;
    font-size: 13px; font-weight: 500; letter-spacing: 0.01em;
    color: rgba(255,255,255,0.3);
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
  }
  .tab:hover { color: rgba(255,255,255,0.6); }
  .tab.active { color: #7BAAEE; border-bottom-color: #7BAAEE; }

  .field-label {
    display: block;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.9px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.3);
    margin-bottom: 7px;
  }

  .field-input {
    width: 100%;
    padding: 12px 15px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 11px;
    color: #E4EAF4;
    font-size: 14px;
    outline: none;
    transition: all 0.2s;
    margin-bottom: 16px;
  }
  .field-input::placeholder { color: rgba(255,255,255,0.2); }
  .field-input:focus {
    border-color: rgba(111,163,232,0.45);
    background: rgba(111,163,232,0.06);
    box-shadow: 0 0 0 3px rgba(111,163,232,0.1);
  }

  .btn-primary {
    width: 100%;
    padding: 13px;
    background: linear-gradient(135deg, #3A6FD4 0%, #2550A8 100%);
    border: none;
    border-radius: 11px;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    letter-spacing: 0.01em;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #4A7FE4 0%, #3560B8 100%);
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(58,111,212,0.3);
  }
  .btn-primary:active:not(:disabled) { transform: translateY(0); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .spinner {
    width: 16px; height: 16px;
    border: 2px solid rgba(255,255,255,0.25);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.65s linear infinite;
    flex-shrink: 0;
  }

  .text-link {
    color: rgba(111,163,232,0.75);
    cursor: pointer;
    font-weight: 500;
    transition: color 0.15s;
    font-size: 12px;
  }
  .text-link:hover { color: #A8CCFF; }

  .alert {
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 12px;
    line-height: 1.55;
    margin-bottom: 18px;
  }
  .alert-error {
    background: rgba(192,80,80,0.1);
    border: 1px solid rgba(192,80,80,0.25);
    color: #F5AAAA;
  }
  .alert-success {
    background: rgba(58,158,122,0.1);
    border: 1px solid rgba(58,158,122,0.25);
    color: #88D8B8;
  }

  .divider {
    display: flex; align-items: center; gap: 10;
    margin: 16px 0;
  }
  .divider-line {
    flex: 1; height: 1px;
    background: rgba(255,255,255,0.07);
  }
  .divider-text {
    font-size: 11px;
    color: rgba(255,255,255,0.2);
    white-space: nowrap;
  }
`;

// ─── Background orbs ──────────────────────────────────────────────────────────
function Background() {
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
      {/* Orbs */}
      <div style={{
        position:"absolute", width:600, height:600,
        borderRadius:"50%", left:-200, top:-150,
        background:"radial-gradient(circle, rgba(30,70,140,0.35) 0%, transparent 70%)",
        animation:"orb1 18s ease-in-out infinite",
      }} />
      <div style={{
        position:"absolute", width:500, height:500,
        borderRadius:"50%", right:-150, bottom:-100,
        background:"radial-gradient(circle, rgba(20,90,80,0.25) 0%, transparent 70%)",
        animation:"orb2 22s ease-in-out infinite",
      }} />
      {/* Subtle dot grid */}
      <div style={{
        position:"absolute", inset:0,
        backgroundImage:"radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
        backgroundSize:"32px 32px",
        maskImage:"radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
        WebkitMaskImage:"radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
      }} />
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────
function Field({ label, type="text", value, onChange, placeholder, autoComplete }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input
        className="field-input"
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
      />
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  // "login" | "signup" | "forgot"
  const [mode, setMode]         = useState("login");
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [alert, setAlert]       = useState(null); // { type:"error"|"success", text }

  // Inject CSS once
  useEffect(() => {
    const tag = document.createElement("style");
    tag.textContent = GLOBAL_CSS;
    document.head.appendChild(tag);
    return () => document.head.removeChild(tag);
  }, []);

  function switchMode(m) {
    setMode(m);
    setAlert(null);
    setName(""); setEmail(""); setPassword(""); setConfirm("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setAlert(null);

    // Client-side validation
    if (mode === "signup") {
      if (password.length < 8) {
        setAlert({ type:"error", text:"Password must be at least 8 characters." });
        return;
      }
      if (password !== confirm) {
        setAlert({ type:"error", text:"Passwords don't match." });
        return;
      }
    }

    setLoading(true);

    try {
      // ── Wire up Supabase here ───────────────────────────────────────────────
      // Step 1: npm install @supabase/supabase-js
      // Step 2: add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local
      // Step 3: uncomment the imports and calls below
      //
      // import { createClient } from "@supabase/supabase-js";
      // const supabase = createClient(
      //   import.meta.env.VITE_SUPABASE_URL,
      //   import.meta.env.VITE_SUPABASE_ANON_KEY
      // );
      //
      // SIGNUP:
      //   const { error } = await supabase.auth.signUp({
      //     email, password,
      //     options: { data: { role: "sitter", name } }
      //   });
      //   if (error) throw error;
      //   setAlert({ type:"success", text:"Check your email to confirm your account!" });
      //   setTimeout(() => switchMode("login"), 3000);
      //
      // LOGIN:
      //   const { error } = await supabase.auth.signInWithPassword({ email, password });
      //   if (error) throw error;
      //   // redirect to dashboard: window.location.href = "/dashboard";
      //
      // FORGOT:
      //   const { error } = await supabase.auth.resetPasswordForEmail(email, {
      //     redirectTo: "https://littleloop.xyz/reset-password"
      //   });
      //   if (error) throw error;
      //   setAlert({ type:"success", text:"Reset link sent — check your inbox." });
      // ───────────────────────────────────────────────────────────────────────

      // Placeholder until Supabase is wired in:
      await new Promise(r => setTimeout(r, 1000));

      if (mode === "signup") {
        setAlert({ type:"success", text:`Account created for ${name.split(" ")[0]}! Check your email to confirm, then sign in.` });
        setTimeout(() => switchMode("login"), 3500);
      } else if (mode === "forgot") {
        setAlert({ type:"success", text:"If that email has an account, a reset link is on its way." });
      } else {
        setAlert({ type:"error", text:"Supabase not connected yet — see the comments in App.jsx to wire it up." });
      }

    } catch (err) {
      setAlert({ type:"error", text: err.message ?? "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  const submitLabel = loading ? null
    : mode === "signup" ? "Create Sitter Account"
    : mode === "forgot" ? "Send Reset Link"
    : "Sign In";

  return (
    <>
      <Background />

      <div style={{
        position:"relative", zIndex:1,
        minHeight:"100vh",
        display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        padding:"32px 16px",
      }}>
        <div style={{ width:"100%", maxWidth:400 }}>

          {/* Logo */}
          <div className="fade-up" style={{ textAlign:"center", marginBottom:36 }}>
            <div className="leaf" style={{
              fontSize:46, marginBottom:10,
              filter:"drop-shadow(0 0 20px rgba(58,158,122,0.45))",
            }}>🌿</div>
            <div className="logo-text">littleloop</div>
            <p style={{ fontSize:12, color:"rgba(255,255,255,0.28)", marginTop:8, letterSpacing:"0.04em" }}>
              Independent childcare, thoughtfully connected.
            </p>
          </div>

          {/* Card */}
          <div className="card fade-up d1">

            {/* Sitter badge */}
            <div className="fade-up d2" style={{
              display:"flex", alignItems:"center", justifyContent:"center",
              gap:8, marginBottom:22,
            }}>
              <div style={{
                width:28, height:28, borderRadius:8,
                background:"linear-gradient(135deg,#3A6FD4,#3A9E7A)",
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:14,
              }}>🌿</div>
              <span style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.35)", letterSpacing:"1.2px", textTransform:"uppercase" }}>
                Sitter Portal
              </span>
            </div>

            {/* Tabs — Sign In / Create Account */}
            {mode !== "forgot" && (
              <div className="tab-bar fade-up d2">
                <div className={`tab ${mode === "login"  ? "active" : ""}`} onClick={() => switchMode("login")}>Sign In</div>
                <div className={`tab ${mode === "signup" ? "active" : ""}`} onClick={() => switchMode("signup")}>Create Account</div>
              </div>
            )}

            {/* Forgot password heading */}
            {mode === "forgot" && (
              <div className="fade-up" style={{ marginBottom:22 }}>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:600, marginBottom:4 }}>
                  Reset password
                </div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.3)" }}>
                  We'll email you a link to choose a new one.
                </div>
              </div>
            )}

            {/* Alert */}
            {alert && (
              <div className={`alert alert-${alert.type} fade-up`}>
                {alert.text}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit}>
              {mode === "signup" && (
                <div className="fade-up d2">
                  <Field label="Your name" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Maya Rodriguez" autoComplete="name" />
                </div>
              )}

              <div className="fade-up d3">
                <Field label="Email address" type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" autoComplete="email" />
              </div>

              {mode !== "forgot" && (
                <div className="fade-up d4">
                  <Field label="Password" type="password" value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === "login" ? "current-password" : "new-password"} />
                </div>
              )}

              {mode === "signup" && (
                <div className="fade-up d5">
                  <Field label="Confirm password" type="password" value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••" autoComplete="new-password" />
                </div>
              )}

              <div className="fade-up d5" style={{ marginTop:4 }}>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? <><div className="spinner" /> Please wait…</> : submitLabel}
                </button>
              </div>
            </form>

            {/* Forgot / back links */}
            <div className="fade-up d6" style={{ textAlign:"center", marginTop:16 }}>
              {mode === "login" && (
                <span className="text-link" onClick={() => switchMode("forgot")}>
                  Forgot your password?
                </span>
              )}
              {mode === "forgot" && (
                <span className="text-link" onClick={() => switchMode("login")}>
                  ← Back to sign in
                </span>
              )}
            </div>
          </div>

          {/* Footer note */}
          <p className="fade-up d6" style={{
            textAlign:"center", marginTop:28,
            fontSize:11, color:"rgba(255,255,255,0.15)", lineHeight:1.7,
          }}>
            littleloop is invite-only for families.<br />
            Sitters create an account here, then invite their families.
          </p>
        </div>
      </div>
    </>
  );
}
