import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── Supabase ─────────────────────────────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── Global CSS ───────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; background: #0C1420; color: #E4EAF4; min-height: 100vh; overflow-x: hidden; }
  input, button, textarea, select { font-family: 'DM Sans', sans-serif; }

  @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  @keyframes floatLeaf { 0%,100% { transform:translateY(0) rotate(-2deg); } 50% { transform:translateY(-10px) rotate(2deg); } }
  @keyframes shimmerText { 0% { background-position:0% center; } 100% { background-position:200% center; } }
  @keyframes spin { to { transform:rotate(360deg); } }
  @keyframes orb1 { 0%,100% { transform:translate(0,0) scale(1); } 33% { transform:translate(30px,-20px) scale(1.05); } 66% { transform:translate(-20px,15px) scale(0.97); } }
  @keyframes orb2 { 0%,100% { transform:translate(0,0) scale(1); } 50% { transform:translate(-25px,20px) scale(1.08); } }
  @keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }

  .fade-up { animation: fadeUp 0.55s cubic-bezier(0.22,1,0.36,1) both; }
  .slide-in { animation: slideIn 0.35s cubic-bezier(0.22,1,0.36,1) both; }
  .d1{animation-delay:.05s} .d2{animation-delay:.10s} .d3{animation-delay:.15s}
  .d4{animation-delay:.20s} .d5{animation-delay:.25s} .d6{animation-delay:.30s}

  .leaf { animation: floatLeaf 5s ease-in-out infinite; display: inline-block; }
  .spinner { width:16px; height:16px; border:2px solid rgba(255,255,255,0.2); border-top-color:#fff; border-radius:50%; animation:spin 0.65s linear infinite; display:inline-block; vertical-align:middle; }

  .logo-text {
    font-family: 'Cormorant Garamond', serif; font-size:42px; font-weight:700; letter-spacing:-1px;
    background: linear-gradient(90deg,#6FA3E8,#A8CCFF,#E2EDFF,#A8CCFF,#6FA3E8);
    background-size:200% auto; -webkit-background-clip:text; -webkit-text-fill-color:transparent;
    background-clip:text; animation:shimmerText 5s linear infinite;
  }

  .card {
    background: rgba(255,255,255,0.035); border:1px solid rgba(255,255,255,0.07);
    border-radius:18px; backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px);
    box-shadow: 0 20px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06);
  }

  .nav-tab {
    flex:1; padding:11px 0; text-align:center; cursor:pointer; font-size:12px; font-weight:500;
    color:rgba(255,255,255,0.3); border-bottom:2px solid transparent; transition:all 0.2s;
    display:flex; flex-direction:column; align-items:center; gap:3px;
  }
  .nav-tab:hover { color:rgba(255,255,255,0.6); }
  .nav-tab.active { color:#7BAAEE; border-bottom-color:#7BAAEE; }

  .tab { flex:1; padding:9px 0; text-align:center; cursor:pointer; font-size:13px; font-weight:500; color:rgba(255,255,255,0.3); border-bottom:2px solid transparent; transition:all 0.2s; }
  .tab:hover { color:rgba(255,255,255,0.6); }
  .tab.active { color:#7BAAEE; border-bottom-color:#7BAAEE; }

  .field-label { display:block; font-size:10px; font-weight:600; letter-spacing:.9px; text-transform:uppercase; color:rgba(255,255,255,0.3); margin-bottom:7px; }
  .field-input { width:100%; padding:11px 14px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.09); border-radius:10px; color:#E4EAF4; font-size:13px; outline:none; transition:all 0.2s; margin-bottom:14px; }
  .field-input::placeholder { color:rgba(255,255,255,0.2); }
  .field-input:focus { border-color:rgba(111,163,232,0.45); background:rgba(111,163,232,0.06); box-shadow:0 0 0 3px rgba(111,163,232,0.1); }

  .btn-primary { padding:11px 20px; background:linear-gradient(135deg,#3A6FD4,#2550A8); border:none; border-radius:10px; color:#fff; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s; display:inline-flex; align-items:center; gap:7px; }
  .btn-primary:hover:not(:disabled) { background:linear-gradient(135deg,#4A7FE4,#3560B8); transform:translateY(-1px); box-shadow:0 6px 20px rgba(58,111,212,0.3); }
  .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
  .btn-primary.full { width:100%; justify-content:center; }

  .btn-ghost { padding:9px 16px; background:transparent; border:1px solid rgba(255,255,255,0.12); border-radius:10px; color:rgba(255,255,255,0.5); font-size:13px; cursor:pointer; transition:all 0.2s; display:inline-flex; align-items:center; gap:6px; }
  .btn-ghost:hover { border-color:rgba(255,255,255,0.25); color:rgba(255,255,255,0.8); }

  .btn-danger { padding:8px 14px; background:rgba(192,80,80,0.12); border:1px solid rgba(192,80,80,0.25); border-radius:9px; color:#F5AAAA; font-size:12px; cursor:pointer; transition:all 0.2s; }
  .btn-danger:hover { background:rgba(192,80,80,0.2); }

  .alert { border-radius:10px; padding:10px 14px; font-size:12px; line-height:1.55; margin-bottom:16px; }
  .alert-error   { background:rgba(192,80,80,0.1);  border:1px solid rgba(192,80,80,0.25);  color:#F5AAAA; }
  .alert-success { background:rgba(58,158,122,0.1); border:1px solid rgba(58,158,122,0.25); color:#88D8B8; }
  .alert-info    { background:rgba(58,111,212,0.1); border:1px solid rgba(58,111,212,0.25); color:#A8CCFF; }

  .family-card { padding:16px 18px; border-radius:14px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); transition:all 0.2s; cursor:pointer; }
  .family-card:hover { background:rgba(255,255,255,0.055); border-color:rgba(111,163,232,0.25); }
  .family-card.active { background:rgba(111,163,232,0.08); border-color:rgba(111,163,232,0.35); }

  .status-badge { display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border-radius:20px; font-size:10px; font-weight:600; }
  .status-active  { background:rgba(58,158,122,0.15); color:#88D8B8; border:1px solid rgba(58,158,122,0.25); }
  .status-pending { background:rgba(200,120,74,0.15); color:#F5C098; border:1px solid rgba(200,120,74,0.25); }

  .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:100; display:flex; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(4px); }
  .modal-box { background:#111D2E; border:1px solid rgba(255,255,255,0.1); border-radius:20px; padding:28px; width:100%; max-width:440px; box-shadow:0 40px 80px rgba(0,0,0,0.6); }

  .empty-state { text-align:center; padding:48px 20px; }
  .empty-state .icon { font-size:40px; margin-bottom:14px; opacity:0.4; }
  .empty-state h3 { font-family:'Cormorant Garamond',serif; font-size:20px; font-weight:600; margin-bottom:8px; opacity:0.7; }
  .empty-state p { font-size:12px; color:rgba(255,255,255,0.3); line-height:1.6; margin-bottom:20px; }

  ::-webkit-scrollbar { width:3px; } ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:4px; }
`;

// ─── Background ───────────────────────────────────────────────────────────────
function Background() {
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
      <div style={{ position:"absolute", width:600, height:600, borderRadius:"50%", left:-200, top:-150, background:"radial-gradient(circle,rgba(30,70,140,0.35) 0%,transparent 70%)", animation:"orb1 18s ease-in-out infinite" }} />
      <div style={{ position:"absolute", width:500, height:500, borderRadius:"50%", right:-150, bottom:-100, background:"radial-gradient(circle,rgba(20,90,80,0.25) 0%,transparent 70%)", animation:"orb2 22s ease-in-out infinite" }} />
      <div style={{ position:"absolute", inset:0, backgroundImage:"radial-gradient(rgba(255,255,255,0.05) 1px,transparent 1px)", backgroundSize:"32px 32px", maskImage:"radial-gradient(ellipse 80% 80% at 50% 50%,black 40%,transparent 100%)", WebkitMaskImage:"radial-gradient(ellipse 80% 80% at 50% 50%,black 40%,transparent 100%)" }} />
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────
function Field({ label, type="text", value, onChange, placeholder, autoComplete, required=true }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input className="field-input" type={type} value={value} onChange={onChange}
        placeholder={placeholder} autoComplete={autoComplete} required={required} />
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ─── Invite Family Modal ──────────────────────────────────────────────────────
function InviteFamilyModal({ open, onClose, sitterId, sitterName, onInvited }) {
  const [familyName,   setFamilyName]   = useState("");
  const [adminEmail,   setAdminEmail]   = useState("");
  const [childrenStr,  setChildrenStr]  = useState("");
  const [loading,      setLoading]      = useState(false);
  const [alert,        setAlert]        = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setAlert(null);
    setLoading(true);

    try {
      // 1 — Create the family row
      const { data: family, error: famErr } = await supabase
        .from("families")
        .insert({ sitter_id: sitterId, name: familyName, admin_email: adminEmail, status: "pending" })
        .select()
        .single();
      if (famErr) throw famErr;

      // 2 — Create a pending admin member row
      const { error: memErr } = await supabase
        .from("members")
        .insert({
          family_id: family.id,
          name: adminEmail.split("@")[0],
          email: adminEmail,
          role: "admin",
          status: "pending",
        });
      if (memErr) throw memErr;

      // 3 — Create children rows if provided
      const childNames = childrenStr.split(",").map(s => s.trim()).filter(Boolean);
      if (childNames.length > 0) {
        const childRows = childNames.map(name => ({
          family_id: family.id,
          name,
          avatar: "🌟",
          color: "#8B78D4",
        }));
        const { error: kidErr } = await supabase.from("children").insert(childRows);
        if (kidErr) throw kidErr;
      }

      // 4 — Send invite email via Edge Function
      await supabase.functions.invoke("send-invite", {
        body: { familyName, parentEmail: adminEmail, sitterName },
      });

      setAlert({ type:"success", text:`${familyName} invited! An email is on its way to ${adminEmail}.` });
      setTimeout(() => {
        onInvited();
        onClose();
        setFamilyName(""); setAdminEmail(""); setChildrenStr(""); setAlert(null);
      }, 1800);

    } catch (err) {
      setAlert({ type:"error", text: err.message || "Something went wrong." });
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (loading) return;
    setFamilyName(""); setAdminEmail(""); setChildrenStr(""); setAlert(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose}>
      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, fontWeight:600, marginBottom:4 }}>
        Invite a Family
      </div>
      <p style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginBottom:22, lineHeight:1.6 }}>
        The email you enter becomes the family admin — they can add other members once they join.
      </p>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.text}</div>}

      <form onSubmit={handleSubmit}>
        <Field label="Family name" value={familyName} onChange={e => setFamilyName(e.target.value)}
          placeholder="e.g. The Johnson Family" autoComplete="off" />
        <Field label="Admin email" type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)}
          placeholder="parent@example.com" autoComplete="off" />
        <div>
          <label className="field-label">Children's names <span style={{ opacity:0.5 }}>(comma separated, optional)</span></label>
          <input className="field-input" value={childrenStr} onChange={e => setChildrenStr(e.target.value)}
            placeholder="e.g. Emma, Jack" />
        </div>

        <div style={{ display:"flex", gap:10, marginTop:6 }}>
          <button type="submit" className="btn-primary full" disabled={loading}>
            {loading ? <><span className="spinner" /> Inviting…</> : "📧 Send Invite"}
          </button>
          <button type="button" className="btn-ghost" onClick={handleClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Family Detail Panel ──────────────────────────────────────────────────────
function FamilyDetail({ family, children, onRefresh }) {
  return (
    <div className="slide-in">
      {/* Family header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:600 }}>{family.name}</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:2 }}>{family.admin_email}</div>
        </div>
        <span className={`status-badge status-${family.status}`}>
          {family.status === "active" ? "✅ Active" : "⏳ Pending"}
        </span>
      </div>

      {/* Children */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:10, fontWeight:600, letterSpacing:"0.9px", textTransform:"uppercase", color:"rgba(255,255,255,0.3)", marginBottom:10 }}>
          Children
        </div>
        {children.length === 0 ? (
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.25)", fontStyle:"italic" }}>No children added yet</div>
        ) : (
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {children.map(c => (
              <div key={c.id} style={{ display:"flex", alignItems:"center", gap:7, background:"rgba(255,255,255,0.05)", borderRadius:20, padding:"6px 12px", border:"1px solid rgba(255,255,255,0.08)" }}>
                <span style={{ fontSize:16 }}>{c.avatar}</span>
                <span style={{ fontSize:13, fontWeight:500 }}>{c.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info box */}
      {family.status === "pending" && (
        <div className="alert alert-info" style={{ marginBottom:0 }}>
          💡 Once you connect Resend in Supabase, families will automatically receive an invite email when you add them.
        </div>
      )}
    </div>
  );
}

// ─── Families Tab ─────────────────────────────────────────────────────────────
function FamiliesTab({ sitterId, sitterName }) {
  const [families,     setFamilies]     = useState([]);
  const [children,     setChildren]     = useState({});  // familyId → []
  const [selected,     setSelected]     = useState(null);
  const [showInvite,   setShowInvite]   = useState(false);
  const [loading,      setLoading]      = useState(true);

  async function loadFamilies() {
    setLoading(true);
    const { data: fams } = await supabase
      .from("families")
      .select("*")
      .eq("sitter_id", sitterId)
      .order("created_at", { ascending: false });

    setFamilies(fams || []);

    // Load children for all families
    if (fams && fams.length > 0) {
      const famIds = fams.map(f => f.id);
      const { data: kids } = await supabase
        .from("children")
        .select("*")
        .in("family_id", famIds);

      // Group by family_id
      const grouped = {};
      (kids || []).forEach(k => {
        if (!grouped[k.family_id]) grouped[k.family_id] = [];
        grouped[k.family_id].push(k);
      });
      setChildren(grouped);
    }

    setLoading(false);
  }

  useEffect(() => { loadFamilies(); }, [sitterId]);

  // Auto-select first family
  useEffect(() => {
    if (families.length > 0 && !selected) setSelected(families[0].id);
  }, [families]);

  const selectedFamily   = families.find(f => f.id === selected);
  const selectedChildren = selected ? (children[selected] || []) : [];

  if (loading) return (
    <div style={{ textAlign:"center", padding:"60px 0" }}>
      <div className="spinner" style={{ width:24, height:24, borderWidth:3 }} />
    </div>
  );

  return (
    <div>
      {/* Header row */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:600 }}>
          Families <span style={{ fontSize:14, color:"rgba(255,255,255,0.3)", fontFamily:"'DM Sans',sans-serif", fontWeight:400 }}>({families.length})</span>
        </div>
        <button className="btn-primary" onClick={() => setShowInvite(true)}>
          + Invite Family
        </button>
      </div>

      {families.length === 0 ? (
        <div className="empty-state">
          <div className="icon">👨‍👩‍👧</div>
          <h3>No families yet</h3>
          <p>Invite your first family to get started.<br />They'll be able to view updates, chat, and pay invoices.</p>
          <button className="btn-primary" onClick={() => setShowInvite(true)}>+ Invite your first family</button>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"200px 1fr", gap:14, alignItems:"start" }}>
          {/* Family list */}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {families.map(f => (
              <div key={f.id} className={`family-card ${selected === f.id ? "active" : ""}`}
                onClick={() => setSelected(f.id)}>
                <div style={{ fontWeight:600, fontSize:13, marginBottom:3 }}>{f.name}</div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>
                    {(children[f.id] || []).length} child{(children[f.id] || []).length !== 1 ? "ren" : ""}
                  </span>
                  <span className={`status-badge status-${f.status}`} style={{ fontSize:9 }}>
                    {f.status === "active" ? "Active" : "Pending"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Detail panel */}
          {selectedFamily && (
            <div className="card" style={{ padding:22 }}>
              <FamilyDetail
                family={selectedFamily}
                children={selectedChildren}
                onRefresh={loadFamilies}
              />
            </div>
          )}
        </div>
      )}

      <InviteFamilyModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        sitterId={sitterId}
        sitterName={sitterName}
        onInvited={() => { loadFamilies(); }}
      />
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ session, onSignOut }) {
  const [tab, setTab] = useState("families");
  const sitterId = session.user.id;
  const name     = session.user.user_metadata?.name || session.user.email.split("@")[0];

  const NAV = [
    { id:"families", icon:"👨‍👩‍👧", label:"Families" },
    { id:"feed",     icon:"🌸",     label:"Feed"     },
    { id:"invoices", icon:"💰",     label:"Invoices" },
    { id:"messages", icon:"💬",     label:"Messages" },
  ];

  return (
    <div style={{ position:"relative", zIndex:1, minHeight:"100vh", display:"flex", flexDirection:"column" }}>

      {/* Top bar */}
      <div style={{ padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid rgba(255,255,255,0.06)", background:"rgba(0,0,0,0.2)", backdropFilter:"blur(20px)", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div className="leaf" style={{ fontSize:22, filter:"drop-shadow(0 0 10px rgba(58,158,122,0.4))" }}>🌿</div>
          <div className="logo-text" style={{ fontSize:20 }}>littleloop</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)" }}>{name}</div>
          <button className="btn-ghost" style={{ padding:"6px 12px", fontSize:12 }} onClick={onSignOut}>Sign out</button>
        </div>
      </div>

      {/* Bottom nav */}
      <div style={{ display:"flex", borderBottom:"1px solid rgba(255,255,255,0.06)", background:"rgba(0,0,0,0.15)" }}>
        {NAV.map(n => (
          <div key={n.id} className={`nav-tab ${tab === n.id ? "active" : ""}`} onClick={() => setTab(n.id)}>
            <span style={{ fontSize:18 }}>{n.icon}</span>
            <span>{n.label}</span>
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:"auto", padding:"22px 20px", maxWidth:800, width:"100%", margin:"0 auto" }}>
        {tab === "families" && <FamiliesTab sitterId={sitterId} sitterName={name} />}

        {tab === "feed" && (
          <div className="empty-state">
            <div className="icon">🌸</div>
            <h3>Feed coming soon</h3>
            <p>Post daily updates, photos, and milestones for each family.</p>
          </div>
        )}
        {tab === "invoices" && (
          <div className="empty-state">
            <div className="icon">💰</div>
            <h3>Invoices coming soon</h3>
            <p>Create and track invoices with full payment history.</p>
          </div>
        )}
        {tab === "messages" && (
          <div className="empty-state">
            <div className="icon">💬</div>
            <h3>Messages coming soon</h3>
            <p>Private messaging with each family.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen() {
  const [mode, setMode]         = useState("login");
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [alert, setAlert]       = useState(null);

  function switchMode(m) { setMode(m); setAlert(null); setName(""); setEmail(""); setPassword(""); setConfirm(""); }

  async function handleSubmit(e) {
    e.preventDefault(); setAlert(null);
    if (mode === "signup") {
      if (password.length < 8) { setAlert({ type:"error", text:"Password must be at least 8 characters." }); return; }
      if (password !== confirm) { setAlert({ type:"error", text:"Passwords don't match." }); return; }
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { role:"sitter", name } } });
        if (error) throw error;
        setAlert({ type:"success", text:"Account created! Check your email to confirm, then sign in." });
        setTimeout(() => switchMode("login"), 3500);
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo:"https://littleloop.xyz/reset-password" });
        if (error) throw error;
        setAlert({ type:"success", text:"Reset link sent — check your inbox." });
      }
    } catch (err) {
      const msg = err.message || "";
      if (msg.includes("Invalid login credentials")) setAlert({ type:"error", text:"Incorrect email or password." });
      else if (msg.includes("User already registered")) setAlert({ type:"error", text:"An account with that email already exists." });
      else if (msg.includes("Email not confirmed")) setAlert({ type:"info", text:"Please confirm your email first." });
      else setAlert({ type:"error", text: msg || "Something went wrong." });
    } finally { setLoading(false); }
  }

  return (
    <div style={{ position:"relative", zIndex:1, minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"32px 16px" }}>
      <div style={{ width:"100%", maxWidth:400 }}>
        <div className="fade-up" style={{ textAlign:"center", marginBottom:36 }}>
          <div className="leaf" style={{ fontSize:46, marginBottom:10, filter:"drop-shadow(0 0 20px rgba(58,158,122,0.45))" }}>🌿</div>
          <div className="logo-text">littleloop</div>
          <p style={{ fontSize:12, color:"rgba(255,255,255,0.28)", marginTop:8, letterSpacing:"0.04em" }}>Independent childcare, thoughtfully connected.</p>
        </div>
        <div className="card fade-up d1" style={{ padding:"32px 28px" }}>
          <div className="fade-up d2" style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:22 }}>
            <div style={{ width:28, height:28, borderRadius:8, background:"linear-gradient(135deg,#3A6FD4,#3A9E7A)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>🌿</div>
            <span style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.35)", letterSpacing:"1.2px", textTransform:"uppercase" }}>Sitter Portal</span>
          </div>
          {mode !== "forgot" && (
            <div style={{ display:"flex", borderBottom:"1px solid rgba(255,255,255,0.07)", marginBottom:26 }} className="fade-up d2">
              <div className={`tab ${mode==="login"?"active":""}`}  onClick={() => switchMode("login")}>Sign In</div>
              <div className={`tab ${mode==="signup"?"active":""}`} onClick={() => switchMode("signup")}>Create Account</div>
            </div>
          )}
          {mode === "forgot" && (
            <div className="fade-up" style={{ marginBottom:22 }}>
              <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:600, marginBottom:4 }}>Reset password</div>
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.3)" }}>We'll email you a link to choose a new one.</div>
            </div>
          )}
          {alert && <div className={`alert alert-${alert.type} fade-up`}>{alert.text}</div>}
          <form onSubmit={handleSubmit}>
            {mode === "signup" && <div className="fade-up d2"><Field label="Your name" value={name} onChange={e=>setName(e.target.value)} placeholder="Maya Rodriguez" autoComplete="name" /></div>}
            <div className="fade-up d3"><Field label="Email address" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></div>
            {mode !== "forgot" && <div className="fade-up d4"><Field label="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode==="login"?"current-password":"new-password"} /></div>}
            {mode === "signup" && <div className="fade-up d5"><Field label="Confirm password" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="••••••••" autoComplete="new-password" /></div>}
            <div className="fade-up d5" style={{ marginTop:4 }}>
              <button type="submit" className="btn-primary full" disabled={loading}>
                {loading ? <><span className="spinner" /> Please wait…</> : mode==="signup" ? "Create Sitter Account" : mode==="forgot" ? "Send Reset Link" : "Sign In"}
              </button>
            </div>
          </form>
          <div className="fade-up d6" style={{ textAlign:"center", marginTop:16 }}>
            {mode==="login"  && <span style={{ fontSize:12, color:"rgba(111,163,232,0.75)", cursor:"pointer" }} onClick={() => switchMode("forgot")}>Forgot your password?</span>}
            {mode==="forgot" && <span style={{ fontSize:12, color:"rgba(111,163,232,0.75)", cursor:"pointer" }} onClick={() => switchMode("login")}>← Back to sign in</span>}
          </div>
        </div>
        <p className="fade-up d6" style={{ textAlign:"center", marginTop:28, fontSize:11, color:"rgba(255,255,255,0.15)", lineHeight:1.7 }}>
          littleloop is invite-only for families.<br />Sitters create an account here, then invite their families.
        </p>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    const tag = document.createElement("style");
    tag.textContent = GLOBAL_CSS;
    document.head.appendChild(tag);
    return () => document.head.removeChild(tag);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session ?? null));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return (
    <>
      <Background />
      <div style={{ position:"relative", zIndex:1, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ textAlign:"center" }}>
          <div className="leaf" style={{ fontSize:40, marginBottom:12 }}>🌿</div>
          <div className="spinner" style={{ width:20, height:20, margin:"0 auto" }} />
        </div>
      </div>
    </>
  );

  return (
    <>
      <Background />
      {session
        ? <Dashboard session={session} onSignOut={() => supabase.auth.signOut()} />
        : <AuthScreen />
      }
    </>
  );
}
