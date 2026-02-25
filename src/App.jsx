import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function getPortal() {
  const p = new URLSearchParams(window.location.search);
  return p.get("portal") || "sitter";
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'DM Sans',sans-serif;background:#0C1420;color:#E4EAF4;min-height:100vh;overflow-x:hidden}
  input,button,textarea,select{font-family:'DM Sans',sans-serif}
  @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
  @keyframes floatLeaf{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-10px) rotate(2deg)}}
  @keyframes shimmer{0%{background-position:0% center}100%{background-position:200% center}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes orb1{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(30px,-20px) scale(1.05)}66%{transform:translate(-20px,15px) scale(.97)}}
  @keyframes orb2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-25px,20px) scale(1.08)}}
  @keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
  .fade-up{animation:fadeUp .55s cubic-bezier(.22,1,.36,1) both}
  .slide-in{animation:slideIn .35s cubic-bezier(.22,1,.36,1) both}
  .d1{animation-delay:.05s}.d2{animation-delay:.10s}.d3{animation-delay:.15s}.d4{animation-delay:.20s}.d5{animation-delay:.25s}.d6{animation-delay:.30s}
  .leaf{animation:floatLeaf 5s ease-in-out infinite;display:inline-block}
  .spin{animation:spin .65s linear infinite}
  .logo-text{font-family:'Cormorant Garamond',serif;font-size:42px;font-weight:700;letter-spacing:-1px;background:linear-gradient(90deg,#6FA3E8,#A8CCFF,#E2EDFF,#A8CCFF,#6FA3E8);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 5s linear infinite}
  .card{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);border-radius:18px;backdrop-filter:blur(24px);box-shadow:0 20px 60px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.06)}
  .nav-tab{flex:1;padding:11px 0;text-align:center;cursor:pointer;font-size:12px;font-weight:500;color:rgba(255,255,255,.3);border-bottom:2px solid transparent;transition:all .2s;display:flex;flex-direction:column;align-items:center;gap:3px}
  .nav-tab:hover{color:rgba(255,255,255,.6)}.nav-tab.active{color:#7BAAEE;border-bottom-color:#7BAAEE}
  .tab{flex:1;padding:9px 0;text-align:center;cursor:pointer;font-size:13px;font-weight:500;color:rgba(255,255,255,.3);border-bottom:2px solid transparent;transition:all .2s}
  .tab:hover{color:rgba(255,255,255,.6)}.tab.active{color:#7BAAEE;border-bottom-color:#7BAAEE}
  .fl{display:block;font-size:10px;font-weight:600;letter-spacing:.9px;text-transform:uppercase;color:rgba(255,255,255,.3);margin-bottom:7px}
  .fi{width:100%;padding:11px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:10px;color:#E4EAF4;font-size:13px;outline:none;transition:all .2s;margin-bottom:14px}
  .fi::placeholder{color:rgba(255,255,255,.2)}.fi:focus{border-color:rgba(111,163,232,.45);background:rgba(111,163,232,.06);box-shadow:0 0 0 3px rgba(111,163,232,.1)}
  .bp{padding:11px 20px;background:linear-gradient(135deg,#3A6FD4,#2550A8);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:7px}
  .bp:hover:not(:disabled){background:linear-gradient(135deg,#4A7FE4,#3560B8);transform:translateY(-1px);box-shadow:0 6px 20px rgba(58,111,212,.3)}.bp:disabled{opacity:.5;cursor:not-allowed}.bp.full{width:100%;justify-content:center}
  .bg{padding:9px 16px;background:transparent;border:1px solid rgba(255,255,255,.12);border-radius:10px;color:rgba(255,255,255,.5);font-size:13px;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:6px}
  .bg:hover{border-color:rgba(255,255,255,.25);color:rgba(255,255,255,.8)}
  .bd{padding:8px 14px;background:rgba(192,80,80,.12);border:1px solid rgba(192,80,80,.25);border-radius:9px;color:#F5AAAA;font-size:12px;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:6px}
  .bd:hover{background:rgba(192,80,80,.22)}
  .al{border-radius:10px;padding:10px 14px;font-size:12px;line-height:1.55;margin-bottom:16px}
  .al-e{background:rgba(192,80,80,.1);border:1px solid rgba(192,80,80,.25);color:#F5AAAA}
  .al-s{background:rgba(58,158,122,.1);border:1px solid rgba(58,158,122,.25);color:#88D8B8}
  .al-i{background:rgba(58,111,212,.1);border:1px solid rgba(58,111,212,.25);color:#A8CCFF}
  .al-w{background:rgba(200,150,50,.1);border:1px solid rgba(200,150,50,.25);color:#F5D08A}
  .fc{padding:14px 16px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);transition:all .2s;cursor:pointer}
  .fc:hover{background:rgba(255,255,255,.055);border-color:rgba(111,163,232,.25)}.fc.active{background:rgba(111,163,232,.08);border-color:rgba(111,163,232,.35)}
  .sb{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:600}
  .sb-a{background:rgba(58,158,122,.15);color:#88D8B8;border:1px solid rgba(58,158,122,.25)}
  .sb-p{background:rgba(200,120,74,.15);color:#F5C098;border:1px solid rgba(200,120,74,.25)}
  .sb-i{background:rgba(120,120,140,.15);color:#B0B8C8;border:1px solid rgba(120,120,140,.25)}
  .mo{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:100;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px)}
  .mb{background:#111D2E;border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:28px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 40px 80px rgba(0,0,0,.6)}
  .es{text-align:center;padding:48px 20px}
  .es .ic{font-size:40px;margin-bottom:14px;opacity:.4}
  .es h3{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:600;margin-bottom:8px;opacity:.7}
  .es p{font-size:12px;color:rgba(255,255,255,.3);line-height:1.6;margin-bottom:20px}
  .note-card{padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);margin-bottom:8px}
  .chip{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:5px 11px;font-size:12px}
  ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:4px}
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Bg() {
  return (
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
      <div style={{position:"absolute",width:600,height:600,borderRadius:"50%",left:-200,top:-150,background:"radial-gradient(circle,rgba(30,70,140,.35) 0%,transparent 70%)",animation:"orb1 18s ease-in-out infinite"}}/>
      <div style={{position:"absolute",width:500,height:500,borderRadius:"50%",right:-150,bottom:-100,background:"radial-gradient(circle,rgba(20,90,80,.25) 0%,transparent 70%)",animation:"orb2 22s ease-in-out infinite"}}/>
      <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(rgba(255,255,255,.05) 1px,transparent 1px)",backgroundSize:"32px 32px",maskImage:"radial-gradient(ellipse 80% 80% at 50% 50%,black 40%,transparent 100%)",WebkitMaskImage:"radial-gradient(ellipse 80% 80% at 50% 50%,black 40%,transparent 100%)"}}/>
    </div>
  );
}

function Spinner({size=16}) {
  return <span style={{width:size,height:size,border:"2px solid rgba(255,255,255,.2)",borderTopColor:"#fff",borderRadius:"50%",display:"inline-block",flexShrink:0}} className="spin"/>;
}

function Field({label,type="text",value,onChange,placeholder,autoComplete,required=true,as="input",rows=3}) {
  return (
    <div>
      <label className="fl">{label}</label>
      {as==="textarea"
        ? <textarea className="fi" value={value} onChange={onChange} placeholder={placeholder} rows={rows} style={{resize:"vertical",marginBottom:14}}/>
        : <input className="fi" type={type} value={value} onChange={onChange} placeholder={placeholder} autoComplete={autoComplete} required={required}/>
      }
    </div>
  );
}

function Modal({open,onClose,children}) {
  if(!open) return null;
  return <div className="mo" onClick={onClose}><div className="mb" onClick={e=>e.stopPropagation()}>{children}</div></div>;
}

function Confirm({open,title,message,onConfirm,onCancel,danger=false}) {
  return (
    <Modal open={open} onClose={onCancel}>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600,marginBottom:8}}>{title}</div>
      <p style={{fontSize:13,color:"rgba(255,255,255,.5)",marginBottom:24,lineHeight:1.6}}>{message}</p>
      <div style={{display:"flex",gap:10}}>
        <button className={danger?"bd":"bp full"} style={danger?{padding:"11px 20px"}:{}} onClick={onConfirm}>Confirm</button>
        <button className="bg" onClick={onCancel}>Cancel</button>
      </div>
    </Modal>
  );
}

const ROLE_LABELS = {admin:"Admin",member:"Member",feed_only:"Feed Only",pickup:"Pickup"};
const AVATARS = ["👤","👩","👨","👵","👴","🧑","👦","👧","🧒","🧔","👩‍🦱","👨‍🦱","👩‍🦰","👨‍🦰","👩‍🦳","👨‍🦳"];
const CHILD_AVATARS = ["🌟","🦋","🐻","🦄","🐸","🐼","🦊","🐯","🐶","🐱","🌈","🚀","⭐","🎈","🌺","🦁"];

// ─── Section header ───────────────────────────────────────────────────────────
function SectionLabel({children}) {
  return <div style={{fontSize:10,fontWeight:600,letterSpacing:"0.9px",textTransform:"uppercase",color:"rgba(255,255,255,.3)",marginBottom:10}}>{children}</div>;
}

// ─── Auth Form ────────────────────────────────────────────────────────────────
function AuthForm({portal}) {
  const isParent = portal==="parent";
  const [mode,setMode]         = useState("login");
  const [name,setName]         = useState("");
  const [email,setEmail]       = useState("");
  const [password,setPassword] = useState("");
  const [confirm,setConfirm]   = useState("");
  const [loading,setLoading]   = useState(false);
  const [alert,setAlert]       = useState(null);

  useEffect(()=>{
    const p=new URLSearchParams(window.location.search);
    const inv=p.get("email");
    if(inv){setEmail(inv);setMode("signup");}
  },[]);

  function sw(m){setMode(m);setAlert(null);setName("");setEmail("");setPassword("");setConfirm("");}

  async function submit(e){
    e.preventDefault();setAlert(null);
    if(mode==="signup"){
      if(password.length<8){setAlert({t:"e",m:"Password must be at least 8 characters."});return;}
      if(password!==confirm){setAlert({t:"e",m:"Passwords don't match."});return;}
    }
    setLoading(true);
    try{
      if(mode==="signup"){
        const {error}=await supabase.auth.signUp({email,password,options:{data:{role:isParent?"parent":"sitter",name}}});
        if(error) throw error;
        setAlert({t:"s",m:"Account created! Check your email to confirm, then sign in."});
        setTimeout(()=>sw("login"),3500);
      } else if(mode==="login"){
        const {error}=await supabase.auth.signInWithPassword({email,password});
        if(error) throw error;
      } else {
        const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:"https://littleloop.xyz/reset-password"});
        if(error) throw error;
        setAlert({t:"s",m:"Reset link sent — check your inbox."});
      }
    } catch(err){
      const m=err.message||"";
      if(m.includes("Invalid login credentials")) setAlert({t:"e",m:"Incorrect email or password."});
      else if(m.includes("User already registered")) setAlert({t:"e",m:"An account with that email already exists."});
      else if(m.includes("Email not confirmed")) setAlert({t:"i",m:"Please confirm your email first."});
      else setAlert({t:"e",m:m||"Something went wrong."});
    } finally{setLoading(false);}
  }

  return (
    <div style={{position:"relative",zIndex:1,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 16px"}}>
      <div style={{width:"100%",maxWidth:400}}>
        <div className="fade-up" style={{textAlign:"center",marginBottom:36}}>
          <div className="leaf" style={{fontSize:46,marginBottom:10,filter:"drop-shadow(0 0 20px rgba(58,158,122,.45))"}}>🌿</div>
          <div className="logo-text">littleloop</div>
          <p style={{fontSize:12,color:"rgba(255,255,255,.28)",marginTop:8,letterSpacing:".04em"}}>Independent childcare, thoughtfully connected.</p>
        </div>
        <div className="card fade-up d1" style={{padding:"32px 28px"}}>
          <div className="fade-up d2" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:22}}>
            <div style={{width:28,height:28,borderRadius:8,background:isParent?"linear-gradient(135deg,#3A9E7A,#2A7A5A)":"linear-gradient(135deg,#3A6FD4,#3A9E7A)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>{isParent?"👨‍👩‍👧":"🌿"}</div>
            <span style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,.35)",letterSpacing:"1.2px",textTransform:"uppercase"}}>{isParent?"Family Portal":"Sitter Portal"}</span>
          </div>
          {mode!=="forgot" && (
            <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,.07)",marginBottom:26}} className="fade-up d2">
              <div className={`tab ${mode==="login"?"active":""}`} onClick={()=>sw("login")}>Sign In</div>
              <div className={`tab ${mode==="signup"?"active":""}`} onClick={()=>sw("signup")}>Create Account</div>
            </div>
          )}
          {mode==="forgot" && (
            <div className="fade-up" style={{marginBottom:22}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600,marginBottom:4}}>Reset password</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>We'll email you a link to choose a new one.</div>
            </div>
          )}
          {alert && <div className={`al al-${alert.t} fade-up`}>{alert.m}</div>}
          {isParent&&mode==="signup"&&<div className="al al-i" style={{marginBottom:16}}>💡 Sign up with the email your sitter used to invite you and you'll be automatically connected to your family.</div>}
          <form onSubmit={submit}>
            {mode==="signup"&&<div className="fade-up d2"><Field label="Your name" value={name} onChange={e=>setName(e.target.value)} placeholder={isParent?"Sarah Chen":"Maya Rodriguez"} autoComplete="name"/></div>}
            <div className="fade-up d3"><Field label="Email address" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"/></div>
            {mode!=="forgot"&&<div className="fade-up d4"><Field label="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode==="login"?"current-password":"new-password"}/></div>}
            {mode==="signup"&&<div className="fade-up d5"><Field label="Confirm password" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="••••••••" autoComplete="new-password"/></div>}
            <div className="fade-up d5" style={{marginTop:4}}>
              <button type="submit" className="bp full" disabled={loading}>
                {loading?<><Spinner/> Please wait…</>:mode==="signup"?`Create ${isParent?"Family":"Sitter"} Account`:mode==="forgot"?"Send Reset Link":"Sign In"}
              </button>
            </div>
          </form>
          <div className="fade-up d6" style={{textAlign:"center",marginTop:16}}>
            {mode==="login"&&<span style={{fontSize:12,color:"rgba(111,163,232,.75)",cursor:"pointer"}} onClick={()=>sw("forgot")}>Forgot your password?</span>}
            {mode==="forgot"&&<span style={{fontSize:12,color:"rgba(111,163,232,.75)",cursor:"pointer"}} onClick={()=>sw("login")}>← Back to sign in</span>}
          </div>
        </div>
        <p className="fade-up d6" style={{textAlign:"center",marginTop:24,fontSize:12,color:"rgba(255,255,255,.2)"}}>
          {isParent?<>Are you a sitter? <a href="/" style={{color:"rgba(111,163,232,.6)",textDecoration:"none"}}>Sitter sign in →</a></>
                   :<>Are you a family member? <a href="/?portal=parent" style={{color:"rgba(111,163,232,.6)",textDecoration:"none"}}>Family sign in →</a></>}
        </p>
      </div>
    </div>
  );
}

// ─── Child Profile Modal ──────────────────────────────────────────────────────
function ChildProfileModal({open,onClose,child,sitterId,canEdit,isParent}) {
  const [tab,setTab]             = useState("info");
  const [notes,setNotes]         = useState([]);
  const [newNote,setNewNote]     = useState("");
  const [visible,setVisible]     = useState(false);
  const [saving,setSaving]       = useState(false);
  const [loadingNotes,setLoadingNotes] = useState(false);

  useEffect(()=>{
    if(open && child) loadNotes();
  },[open,child]);

  async function loadNotes(){
    setLoadingNotes(true);
    if(isParent){
      // Parents see only notes marked visible
      const {data}=await supabase.from("sitter_child_notes").select("*")
        .eq("child_id",child.id).eq("visible_to_family",true)
        .order("created_at",{ascending:false});
      setNotes(data||[]);
    } else {
      // Sitter sees their own notes
      const {data}=await supabase.from("sitter_child_notes").select("*")
        .eq("child_id",child.id).eq("sitter_id",sitterId)
        .order("created_at",{ascending:false});
      setNotes(data||[]);
    }
    setLoadingNotes(false);
  }

  async function addNote(){
    if(!newNote.trim()) return;
    setSaving(true);
    const {error}=await supabase.from("sitter_child_notes").insert({
      sitter_id:sitterId, child_id:child.id,
      note:newNote.trim(), visible_to_family:visible,
    });
    setSaving(false);
    if(!error){setNewNote("");setVisible(false);loadNotes();}
  }

  async function toggleVisibility(note){
    await supabase.from("sitter_child_notes")
      .update({visible_to_family:!note.visible_to_family})
      .eq("id",note.id);
    loadNotes();
  }

  async function deleteNote(id){
    await supabase.from("sitter_child_notes").delete().eq("id",id);
    loadNotes();
  }

  if(!child) return null;

  const today = new Date();
  const dob = child.dob ? new Date(child.dob) : null;
  const age = dob ? Math.floor((today-dob)/(365.25*24*60*60*1000)) : null;

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
        <div style={{width:52,height:52,borderRadius:16,background:`${child.color||"#8B78D4"}22`,border:`2px solid ${child.color||"#8B78D4"}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>{child.avatar||"🌟"}</div>
        <div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600}}>{child.name}</div>
          {age!==null&&<div style={{fontSize:12,color:"rgba(255,255,255,.35)"}}>Age {age} · Born {dob.toLocaleDateString()}</div>}
        </div>
      </div>

      <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,.07)",marginBottom:20}}>
        {[["info","📋 Info"],["notes",isParent?"📝 Sitter Notes":"📝 My Notes"]].map(([id,label])=>(
          <div key={id} className={`tab ${tab===id?"active":""}`} onClick={()=>setTab(id)}>{label}</div>
        ))}
      </div>

      {tab==="info" && (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {child.allergies?.length>0&&(
            <div>
              <SectionLabel>Allergies</SectionLabel>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {child.allergies.map((a,i)=><span key={i} className="chip" style={{background:"rgba(192,80,80,.1)",borderColor:"rgba(192,80,80,.2)",color:"#F5AAAA"}}>⚠️ {a}</span>)}
              </div>
            </div>
          )}
          {child.dietary_restrictions&&(
            <div>
              <SectionLabel>Dietary Restrictions</SectionLabel>
              <p style={{fontSize:13,color:"rgba(255,255,255,.7)",lineHeight:1.6}}>{child.dietary_restrictions}</p>
            </div>
          )}
          {child.medical_notes&&(
            <div>
              <SectionLabel>Medical Notes</SectionLabel>
              <p style={{fontSize:13,color:"rgba(255,255,255,.7)",lineHeight:1.6}}>{child.medical_notes}</p>
            </div>
          )}
          {!child.allergies?.length&&!child.dietary_restrictions&&!child.medical_notes&&(
            <p style={{fontSize:12,color:"rgba(255,255,255,.25)",fontStyle:"italic"}}>No medical info added yet.</p>
          )}
        </div>
      )}

      {tab==="notes" && (
        <div>
          {!isParent&&(
            <div style={{marginBottom:16}}>
              <Field label="Add a note" as="textarea" rows={3} value={newNote} onChange={e=>setNewNote(e.target.value)} placeholder="Write a note about this child…" required={false}/>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:-8}}>
                <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:12,color:"rgba(255,255,255,.45)"}}>
                  <input type="checkbox" checked={visible} onChange={e=>setVisible(e.target.checked)} style={{accentColor:"#7BAAEE"}}/>
                  Visible to family
                </label>
                <button className="bp" onClick={addNote} disabled={saving||!newNote.trim()} style={{padding:"8px 16px",fontSize:12}}>
                  {saving?<Spinner/>:"Add note"}
                </button>
              </div>
            </div>
          )}

          {loadingNotes?<div style={{textAlign:"center",padding:20}}><Spinner size={20}/></div>
            :notes.length===0
              ?<p style={{fontSize:12,color:"rgba(255,255,255,.25)",fontStyle:"italic",textAlign:"center",padding:"20px 0"}}>
                {isParent?"No notes shared with your family yet.":"No notes yet."}
              </p>
              :<div>
                {notes.map(n=>(
                  <div key={n.id} className="note-card">
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
                      <p style={{fontSize:13,color:"rgba(255,255,255,.8)",lineHeight:1.6,flex:1}}>{n.note}</p>
                      {!isParent&&(
                        <div style={{display:"flex",gap:6,flexShrink:0}}>
                          <button title={n.visible_to_family?"Hide from family":"Share with family"}
                            onClick={()=>toggleVisibility(n)}
                            style={{background:"none",border:"none",cursor:"pointer",fontSize:14,opacity:n.visible_to_family?1:.4}}>👁️</button>
                          <button onClick={()=>deleteNote(n.id)}
                            style={{background:"none",border:"none",cursor:"pointer",fontSize:14,opacity:.4}}>🗑️</button>
                        </div>
                      )}
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}>
                      <span style={{fontSize:10,color:"rgba(255,255,255,.25)"}}>{new Date(n.created_at).toLocaleString()}</span>
                      {n.visible_to_family&&<span style={{fontSize:10,color:"#88D8B8"}}>👁️ Shared with family</span>}
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      )}

      <button className="bg" onClick={onClose} style={{width:"100%",justifyContent:"center",marginTop:20}}>Close</button>
    </Modal>
  );
}

// ─── Add/Edit Child Modal ─────────────────────────────────────────────────────
function ChildModal({open,onClose,familyId,child,onSaved}) {
  const isEdit = !!child;
  const [name,setName]         = useState(child?.name||"");
  const [dob,setDob]           = useState(child?.dob||"");
  const [avatar,setAvatar]     = useState(child?.avatar||"🌟");
  const [color,setColor]       = useState(child?.color||"#8B78D4");
  const [allergies,setAllergies] = useState(child?.allergies?.join(", ")||"");
  const [diet,setDiet]         = useState(child?.dietary_restrictions||"");
  const [medical,setMedical]   = useState(child?.medical_notes||"");
  const [loading,setLoading]   = useState(false);
  const [alert,setAlert]       = useState(null);
  const [confirmDel,setConfirmDel] = useState(false);

  useEffect(()=>{
    if(open){
      setName(child?.name||"");setDob(child?.dob||"");setAvatar(child?.avatar||"🌟");
      setColor(child?.color||"#8B78D4");setAllergies(child?.allergies?.join(", ")||"");
      setDiet(child?.dietary_restrictions||"");setMedical(child?.medical_notes||"");
      setAlert(null);
    }
  },[open,child]);

  async function save(e){
    e.preventDefault();setAlert(null);setLoading(true);
    const payload={
      name,dob:dob||null,avatar,color,
      allergies:allergies.split(",").map(s=>s.trim()).filter(Boolean),
      dietary_restrictions:diet||null,
      medical_notes:medical||null,
      family_id:familyId,
    };
    let error;
    if(isEdit){({error}=await supabase.from("children").update(payload).eq("id",child.id));}
    else{({error}=await supabase.from("children").insert(payload));}
    setLoading(false);
    if(error){setAlert({t:"e",m:error.message});return;}
    onSaved();onClose();
  }

  async function deleteChild(){
    setLoading(true);
    await supabase.from("children").delete().eq("id",child.id);
    setLoading(false);onSaved();onClose();setConfirmDel(false);
  }

  const COLORS=["#8B78D4","#3A9E7A","#3A6FD4","#D4783A","#D43A6F","#7AC4D4","#D4C23A","#8BD48B"];

  return (
    <>
      <Modal open={open&&!confirmDel} onClose={onClose}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600,marginBottom:20}}>
          {isEdit?"Edit Child":"Add Child"}
        </div>
        {alert&&<div className={`al al-${alert.t}`}>{alert.m}</div>}
        <form onSubmit={save}>
          <Field label="Name" value={name} onChange={e=>setName(e.target.value)} placeholder="Child's name"/>
          <Field label="Date of birth (optional)" type="date" value={dob} onChange={e=>setDob(e.target.value)} required={false}/>

          <div style={{marginBottom:14}}>
            <SectionLabel>Avatar</SectionLabel>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {CHILD_AVATARS.map(a=>(
                <button key={a} type="button" onClick={()=>setAvatar(a)}
                  style={{width:36,height:36,borderRadius:10,border:`2px solid ${avatar===a?"#7BAAEE":"rgba(255,255,255,.1)"}`,background:avatar===a?"rgba(111,163,232,.15)":"rgba(255,255,255,.04)",cursor:"pointer",fontSize:20}}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div style={{marginBottom:14}}>
            <SectionLabel>Color</SectionLabel>
            <div style={{display:"flex",gap:8}}>
              {COLORS.map(c=>(
                <button key={c} type="button" onClick={()=>setColor(c)}
                  style={{width:28,height:28,borderRadius:"50%",background:c,border:`3px solid ${color===c?"#fff":"transparent"}`,cursor:"pointer"}}/>
              ))}
            </div>
          </div>

          <Field label="Allergies (comma separated)" value={allergies} onChange={e=>setAllergies(e.target.value)} placeholder="e.g. peanuts, dairy" required={false}/>
          <Field label="Dietary restrictions" as="textarea" rows={2} value={diet} onChange={e=>setDiet(e.target.value)} placeholder="e.g. vegetarian, no gluten" required={false}/>
          <Field label="Medical notes" as="textarea" rows={3} value={medical} onChange={e=>setMedical(e.target.value)} placeholder="Medications, conditions, important notes…" required={false}/>

          <div style={{display:"flex",gap:10,marginTop:4}}>
            <button type="submit" className="bp full" disabled={loading}>{loading?<Spinner/>:isEdit?"Save Changes":"Add Child"}</button>
            {isEdit&&<button type="button" className="bd" onClick={()=>setConfirmDel(true)}>Remove</button>}
            <button type="button" className="bg" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </Modal>
      <Confirm open={confirmDel} title="Remove child?" message={`This will permanently remove ${child?.name} and all their data.`} danger onConfirm={deleteChild} onCancel={()=>setConfirmDel(false)}/>
    </>
  );
}

// ─── Member Modal ─────────────────────────────────────────────────────────────
function MemberModal({open,onClose,familyId,familyName,member,adminName,onSaved}) {
  const isEdit = !!member;
  const [name,setName]   = useState(member?.name||"");
  const [email,setEmail] = useState(member?.email||"");
  const [role,setRole]   = useState(member?.role||"member");
  const [avatar,setAv]   = useState(member?.avatar||"👤");
  const [loading,setLoading] = useState(false);
  const [alert,setAlert] = useState(null);
  const [confirmDel,setConfirmDel] = useState(false);

  useEffect(()=>{
    if(open){
      setName(member?.name||"");setEmail(member?.email||"");
      setRole(member?.role||"member");setAv(member?.avatar||"👤");setAlert(null);
    }
  },[open,member]);

  async function save(e){
    e.preventDefault();setAlert(null);setLoading(true);
    let error;
    if(isEdit){
      ({error}=await supabase.from("members").update({name,role,avatar}).eq("id",member.id));
    } else {
      // Insert member row
      const {data:newMem,error:insErr}=await supabase.from("members").insert({
        family_id:familyId,name,email,role,avatar,status:"pending",
      }).select().single();
      error=insErr;
      if(!insErr&&newMem){
        // Send invite email
        await supabase.functions.invoke("send-member-invite",{
          body:{memberEmail:email,memberName:name,familyName,inviterName:adminName,inviteToken:newMem.invite_token},
        });
      }
    }
    setLoading(false);
    if(error){setAlert({t:"e",m:error.message});return;}
    onSaved();onClose();
  }

  async function removeMember(){
    await supabase.from("members").delete().eq("id",member.id);
    onSaved();onClose();setConfirmDel(false);
  }

  return (
    <>
      <Modal open={open&&!confirmDel} onClose={onClose}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600,marginBottom:20}}>
          {isEdit?"Edit Member":"Add Member"}
        </div>
        {alert&&<div className={`al al-${alert.t}`}>{alert.m}</div>}
        <form onSubmit={save}>
          <Field label="Name" value={name} onChange={e=>setName(e.target.value)} placeholder="Full name"/>
          {!isEdit&&<Field label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="their@email.com"/>}

          <div style={{marginBottom:14}}>
            <SectionLabel>Avatar</SectionLabel>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {AVATARS.map(a=>(
                <button key={a} type="button" onClick={()=>setAv(a)}
                  style={{width:36,height:36,borderRadius:10,border:`2px solid ${avatar===a?"#7BAAEE":"rgba(255,255,255,.1)"}`,background:avatar===a?"rgba(111,163,232,.15)":"rgba(255,255,255,.04)",cursor:"pointer",fontSize:20}}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div style={{marginBottom:14}}>
            <SectionLabel>Role</SectionLabel>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {Object.entries(ROLE_LABELS).map(([r,l])=>(
                <button key={r} type="button" onClick={()=>setRole(r)}
                  style={{padding:"7px 14px",borderRadius:20,border:`1px solid ${role===r?"#7BAAEE":"rgba(255,255,255,.12)"}`,background:role===r?"rgba(111,163,232,.15)":"rgba(255,255,255,.04)",color:role===r?"#7BAAEE":"rgba(255,255,255,.5)",fontSize:12,cursor:"pointer"}}>
                  {l}
                </button>
              ))}
            </div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.25)",marginTop:8,lineHeight:1.6}}>
              <strong style={{color:"rgba(255,255,255,.4)"}}>Admin</strong> — full access · <strong style={{color:"rgba(255,255,255,.4)"}}>Member</strong> — view all · <strong style={{color:"rgba(255,255,255,.4)"}}>Feed Only</strong> — feed tab · <strong style={{color:"rgba(255,255,255,.4)"}}>Pickup</strong> — messages only
            </div>
          </div>

          <div style={{display:"flex",gap:10,marginTop:4}}>
            <button type="submit" className="bp full" disabled={loading}>{loading?<Spinner/>:isEdit?"Save Changes":"Add & Send Invite"}</button>
            {isEdit&&member?.role!=="admin"&&<button type="button" className="bd" onClick={()=>setConfirmDel(true)}>Remove</button>}
            <button type="button" className="bg" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </Modal>
      <Confirm open={confirmDel} title="Remove member?" message={`Remove ${member?.name} from this family?`} danger onConfirm={removeMember} onCancel={()=>setConfirmDel(false)}/>
    </>
  );
}

// ─── Invite Family Modal ──────────────────────────────────────────────────────
function InviteFamilyModal({open,onClose,sitterId,sitterName,onInvited}) {
  const [familyName,setFamilyName]   = useState("");
  const [adminEmail,setAdminEmail]   = useState("");
  const [childrenStr,setChildrenStr] = useState("");
  const [loading,setLoading]         = useState(false);
  const [alert,setAlert]             = useState(null);

  async function submit(e){
    e.preventDefault();setAlert(null);setLoading(true);
    try{
      const {data:existing}=await supabase.from("families").select("id,sitter_id,name,status").eq("admin_email",adminEmail).maybeSingle();
      if(existing){
        if(existing.sitter_id&&existing.sitter_id!==sitterId&&existing.status!=="inactive"){
          setAlert({t:"w",m:"This family already has a sitter. The family admin or current sitter must remove them first."});
          setLoading(false);return;
        }
        if(existing.sitter_id===sitterId&&existing.status!=="inactive"){
          setAlert({t:"i",m:"You're already connected to this family."});
          setLoading(false);return;
        }
        const {error}=await supabase.from("families").update({sitter_id:sitterId,status:"active"}).eq("id",existing.id);
        if(error) throw error;
        setAlert({t:"s",m:`You've been reconnected to the ${existing.name} family!`});
        setTimeout(()=>{onInvited();onClose();setFamilyName("");setAdminEmail("");setChildrenStr("");setAlert(null);},1800);
        return;
      }
      const {data:family,error:famErr}=await supabase.from("families").insert({sitter_id:sitterId,name:familyName,admin_email:adminEmail,status:"pending"}).select().single();
      if(famErr) throw famErr;
      const {error:memErr}=await supabase.from("members").insert({family_id:family.id,name:adminEmail.split("@")[0],email:adminEmail,role:"admin",status:"pending"});
      if(memErr) throw memErr;
      const childNames=childrenStr.split(",").map(s=>s.trim()).filter(Boolean);
      if(childNames.length>0){
        const {error:kidErr}=await supabase.from("children").insert(childNames.map(n=>({family_id:family.id,name:n,avatar:"🌟",color:"#8B78D4"})));
        if(kidErr) throw kidErr;
      }
      await supabase.functions.invoke("send-invite",{body:{familyName,parentEmail:adminEmail,sitterName}});
      setAlert({t:"s",m:`${familyName} invited! An email is on its way to ${adminEmail}.`});
      setTimeout(()=>{onInvited();onClose();setFamilyName("");setAdminEmail("");setChildrenStr("");setAlert(null);},1800);
    } catch(err){
      setAlert({t:"e",m:err.message||"Something went wrong."});
    } finally{setLoading(false);}
  }

  function close(){if(loading)return;setFamilyName("");setAdminEmail("");setChildrenStr("");setAlert(null);onClose();}

  return (
    <Modal open={open} onClose={close}>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:600,marginBottom:4}}>Invite a Family</div>
      <p style={{fontSize:12,color:"rgba(255,255,255,.35)",marginBottom:22,lineHeight:1.6}}>The email you enter becomes the family admin.</p>
      {alert&&<div className={`al al-${alert.t}`}>{alert.m}</div>}
      <form onSubmit={submit}>
        <Field label="Family name" value={familyName} onChange={e=>setFamilyName(e.target.value)} placeholder="The Johnson Family" autoComplete="off" required={false}/>
        <Field label="Admin email" type="email" value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} placeholder="parent@example.com" autoComplete="off"/>
        <div><label className="fl">Children's names <span style={{opacity:.5}}>(comma separated, optional)</span></label><input className="fi" value={childrenStr} onChange={e=>setChildrenStr(e.target.value)} placeholder="Emma, Jack"/></div>
        <div style={{display:"flex",gap:10,marginTop:6}}>
          <button type="submit" className="bp full" disabled={loading}>{loading?<><Spinner/> Please wait…</>:"📧 Send Invite"}</button>
          <button type="button" className="bg" onClick={close}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Sitter Family Detail ─────────────────────────────────────────────────────
function SitterFamilyDetail({family,children,sitterId,onDeactivate}) {
  const [selectedChild,setSelectedChild] = useState(null);
  const [confirmRemove,setConfirmRemove] = useState(false);
  const [loading,setLoading]             = useState(false);
  const [alert,setAlert]                 = useState(null);

  async function deactivate(){
    setLoading(true);
    const {error}=await supabase.from("families").update({status:"inactive"}).eq("id",family.id);
    setLoading(false);setConfirmRemove(false);
    if(error){setAlert({t:"e",m:error.message});return;}
    onDeactivate();
  }

  return (
    <div className="slide-in">
      {alert&&<div className={`al al-${alert.t}`}>{alert.m}</div>}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600}}>{family.name}</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.3)",marginTop:2}}>{family.admin_email}</div>
        </div>
        <span className={`sb sb-${family.status==="active"?"a":family.status==="pending"?"p":"i"}`}>
          {family.status==="active"?"✅ Active":family.status==="pending"?"⏳ Pending":"⬜ Inactive"}
        </span>
      </div>

      <div style={{marginBottom:20}}>
        <SectionLabel>Children — click to view profile</SectionLabel>
        {children.length===0
          ?<div style={{fontSize:12,color:"rgba(255,255,255,.25)",fontStyle:"italic"}}>No children added yet</div>
          :<div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {children.map(c=>(
              <button key={c.id} onClick={()=>setSelectedChild(c)}
                style={{display:"flex",alignItems:"center",gap:7,background:`${c.color||"#8B78D4"}18`,borderRadius:20,padding:"6px 14px",border:`1px solid ${c.color||"#8B78D4"}44`,cursor:"pointer",color:"#E4EAF4"}}>
                <span style={{fontSize:16}}>{c.avatar||"🌟"}</span>
                <span style={{fontSize:13,fontWeight:500}}>{c.name}</span>
              </button>
            ))}
          </div>
        }
      </div>

      <div style={{borderTop:"1px solid rgba(255,255,255,.06)",paddingTop:16}}>
        <button className="bd" onClick={()=>setConfirmRemove(true)} disabled={loading}>🔕 Remove from my families</button>
      </div>

      <ChildProfileModal open={!!selectedChild} onClose={()=>setSelectedChild(null)} child={selectedChild} sitterId={sitterId} canEdit={false} isParent={false}/>
      <Confirm open={confirmRemove} title="Remove family?" message={`This will disconnect you from ${family.name}. Their data stays intact.`} danger onConfirm={deactivate} onCancel={()=>setConfirmRemove(false)}/>
    </div>
  );
}

// ─── Families Tab (Sitter) ────────────────────────────────────────────────────
function FamiliesTab({sitterId,sitterName}) {
  const [families,setFamilies]   = useState([]);
  const [kids,setKids]           = useState({});
  const [selected,setSelected]   = useState(null);
  const [showInvite,setShowInvite] = useState(false);
  const [loading,setLoading]     = useState(true);

  const load = useCallback(async()=>{
    setLoading(true);
    const {data:fams}=await supabase.from("families").select("*").eq("sitter_id",sitterId).neq("status","inactive").order("created_at",{ascending:false});
    setFamilies(fams||[]);
    if(fams?.length){
      const {data:kds}=await supabase.from("children").select("*").in("family_id",fams.map(f=>f.id));
      const g={};(kds||[]).forEach(k=>{if(!g[k.family_id])g[k.family_id]=[];g[k.family_id].push(k);});
      setKids(g);
    }
    setLoading(false);
  },[sitterId]);

  useEffect(()=>{load();},[load]);
  useEffect(()=>{if(families.length>0&&!selected)setSelected(families[0].id);},[families]);

  const selFam=families.find(f=>f.id===selected);

  if(loading) return <div style={{textAlign:"center",padding:"60px 0"}}><Spinner size={24}/></div>;

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600}}>
          Families <span style={{fontSize:14,color:"rgba(255,255,255,.3)",fontFamily:"'DM Sans',sans-serif",fontWeight:400}}>({families.length})</span>
        </div>
        <button className="bp" onClick={()=>setShowInvite(true)}>+ Invite Family</button>
      </div>

      {families.length===0
        ?<div className="es"><div className="ic">👨‍👩‍👧</div><h3>No families yet</h3><p>Invite your first family to get started.</p><button className="bp" onClick={()=>setShowInvite(true)}>+ Invite your first family</button></div>
        :<div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:14,alignItems:"start"}}>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {families.map(f=>(
              <div key={f.id} className={`fc ${selected===f.id?"active":""}`} onClick={()=>setSelected(f.id)}>
                <div style={{fontWeight:600,fontSize:13,marginBottom:3}}>{f.name}</div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>{(kids[f.id]||[]).length} child{(kids[f.id]||[]).length!==1?"ren":""}</span>
                  <span className={`sb sb-${f.status==="active"?"a":"p"}`} style={{fontSize:9}}>{f.status}</span>
                </div>
              </div>
            ))}
          </div>
          {selFam&&(
            <div className="card" style={{padding:22}}>
              <SitterFamilyDetail family={selFam} children={kids[selected]||[]} sitterId={sitterId} onDeactivate={()=>{setSelected(null);load();}}/>
            </div>
          )}
        </div>
      }
      <InviteFamilyModal open={showInvite} onClose={()=>setShowInvite(false)} sitterId={sitterId} sitterName={sitterName} onInvited={load}/>
    </div>
  );
}


// ─── Post type / mood constants ───────────────────────────────────────────────
const POST_TYPES = [
  {id:"activity", icon:"🎨", label:"Activity"},
  {id:"meal",     icon:"🍎", label:"Meal"},
  {id:"nap",      icon:"😴", label:"Nap"},
  {id:"milestone",icon:"⭐", label:"Milestone"},
  {id:"note",     icon:"📝", label:"Note"},
  {id:"photo",    icon:"📸", label:"Photo"},
];
const POST_MOODS = [
  {id:"happy",   icon:"😄"},{id:"content",icon:"😊"},{id:"proud",  icon:"🥹"},
  {id:"excited", icon:"🤩"},{id:"tired",  icon:"😴"},{id:"fussy",  icon:"😣"},
  {id:"rested",  icon:"😌"},{id:"curious",icon:"🧐"},
];
const getMoodIcon = mood => POST_MOODS.find(m=>m.id===mood)?.icon||"";
const getTypeIcon = type => POST_TYPES.find(t=>t.id===type)?.icon||"📝";

const timeAgo = ts => {
  const d=Date.now()-new Date(ts).getTime();
  if(d<60000) return "just now";
  if(d<3600000) return `${Math.floor(d/60000)}m ago`;
  if(d<86400000) return `${Math.floor(d/3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
};

// ─── New Post Modal ───────────────────────────────────────────────────────────
function NewPostModal({open,onClose,familyId,sitterId,children,onPosted}) {
  const [type,setType]         = useState("note");
  const [mood,setMood]         = useState("");
  const [text,setText]         = useState("");
  const [tagged,setTagged]     = useState([]);
  const [photo,setPhoto]       = useState(null);
  const [preview,setPreview]   = useState(null);
  const [loading,setLoading]   = useState(false);
  const [alert,setAlert]       = useState(null);

  function reset(){setType("note");setMood("");setText("");setTagged([]);setPhoto(null);setPreview(null);setAlert(null);}
  function close(){if(loading)return;reset();onClose();}

  function handleFile(e){
    const f=e.target.files?.[0]; if(!f) return;
    if(f.size>10*1024*1024){setAlert({t:"e",m:"Photo must be under 10MB."});return;}
    setPhoto(f); setPreview(URL.createObjectURL(f));
  }

  function toggleChild(id){setTagged(t=>t.includes(id)?t.filter(x=>x!==id):[...t,id]);}

  async function submit(e){
    e.preventDefault();
    if(!text.trim()&&!photo){setAlert({t:"e",m:"Add some text or a photo."});return;}
    setLoading(true);setAlert(null);
    try{
      let photo_url=null;
      if(photo){
        const ext=photo.name.split(".").pop();
        const path=`${familyId}/${Date.now()}.${ext}`;
        const {error:upErr}=await supabase.storage.from("post-photos").upload(path,photo,{contentType:photo.type});
        if(upErr) throw upErr;
        const urlResult=supabase.storage.from("post-photos").getPublicUrl(path);
        photo_url=urlResult?.data?.publicUrl||null;
        if(!photo_url) throw new Error("Could not get photo URL. Check that the post-photos bucket is set to public in Supabase Storage.");
      }
      const {data:post,error:postErr}=await supabase.from("posts").insert({
        family_id:familyId,author_id:sitterId,author_role:"sitter",
        type,mood:mood||null,text:text.trim()||null,photo_url,
      }).select().single();
      if(postErr) throw postErr;
      if(tagged.length>0){
        await supabase.from("post_children").insert(tagged.map(child_id=>({post_id:post.id,child_id})));
      }
      reset();onPosted();onClose();
    }catch(err){setAlert({t:"e",m:err.message||"Something went wrong."});}
    finally{setLoading(false);}
  }

  return (
    <Modal open={open} onClose={close}>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:600,marginBottom:4}}>New Post</div>
      <p style={{fontSize:12,color:"rgba(255,255,255,.35)",marginBottom:20,lineHeight:1.6}}>Share an update with this family.</p>
      {alert&&<div className={`al al-${alert.t}`}>{alert.m}</div>}
      <form onSubmit={submit}>
        <div style={{marginBottom:14}}>
          <SectionLabel>Type</SectionLabel>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {POST_TYPES.map(t=>(
              <button key={t.id} type="button" onClick={()=>setType(t.id)}
                style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:20,border:`1px solid ${type===t.id?"#7BAAEE":"rgba(255,255,255,.1)"}`,background:type===t.id?"rgba(111,163,232,.15)":"rgba(255,255,255,.04)",color:type===t.id?"#7BAAEE":"rgba(255,255,255,.5)",fontSize:12,cursor:"pointer"}}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{marginBottom:14}}>
          <SectionLabel>Mood (optional)</SectionLabel>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {POST_MOODS.map(m=>(
              <button key={m.id} type="button" onClick={()=>setMood(mood===m.id?"":m.id)}
                style={{width:36,height:36,borderRadius:10,border:`2px solid ${mood===m.id?"#7BAAEE":"rgba(255,255,255,.1)"}`,background:mood===m.id?"rgba(111,163,232,.15)":"rgba(255,255,255,.04)",cursor:"pointer",fontSize:20}}>
                {m.icon}
              </button>
            ))}
          </div>
        </div>
        {children.length>0&&(
          <div style={{marginBottom:14}}>
            <SectionLabel>Tag children (optional)</SectionLabel>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {children.map(c=>(
                <button key={c.id} type="button" onClick={()=>toggleChild(c.id)}
                  style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:20,border:`1px solid ${tagged.includes(c.id)?c.color||"#7BAAEE":"rgba(255,255,255,.1)"}`,background:tagged.includes(c.id)?`${c.color||"#8B78D4"}22`:"rgba(255,255,255,.04)",color:"rgba(255,255,255,.7)",fontSize:12,cursor:"pointer"}}>
                  {c.avatar} {c.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <label className="fl">Update</label>
          <textarea className="fi" value={text} onChange={e=>setText(e.target.value)} placeholder="What's happening today?" rows={3} style={{resize:"vertical",marginBottom:14}}/>
        </div>
        <div style={{marginBottom:16}}>
          <SectionLabel>Photo (optional)</SectionLabel>
          {preview
            ?<div style={{position:"relative"}}>
              <img src={preview} alt="preview" style={{width:"100%",maxHeight:200,objectFit:"cover",borderRadius:12,border:"1px solid rgba(255,255,255,.1)"}}/>
              <button type="button" onClick={()=>{setPhoto(null);setPreview(null);}}
                style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,.6)",border:"none",borderRadius:"50%",width:28,height:28,cursor:"pointer",color:"#fff",fontSize:14}}>✕</button>
            </div>
            :<label style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderRadius:12,border:"1px dashed rgba(255,255,255,.15)",cursor:"pointer",color:"rgba(255,255,255,.4)",fontSize:13}}>
              📷 Choose a photo
              <input type="file" accept="image/*" onChange={handleFile} style={{display:"none"}}/>
            </label>
          }
        </div>
        <div style={{display:"flex",gap:10}}>
          <button type="submit" className="bp full" disabled={loading}>{loading?<><Spinner/> Posting…</>:"Post Update"}</button>
          <button type="button" className="bg" onClick={close}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────
function PostCard({post,taggedChildren,currentUserId,memberId,isSitter,onDeleted}) {
  const [comments,setComments]     = useState([]);
  const [likes,setLikes]           = useState([]);
  const [showComments,setShowComments] = useState(false);
  const [newComment,setNewComment] = useState("");
  const [submitting,setSubmitting] = useState(false);
  const [confirmDel,setConfirmDel] = useState(false);
  const [expanded,setExpanded]     = useState(false);

  const myLike = likes.find(l=>l.member_id===memberId);
  const liked  = !!myLike;

  useEffect(()=>{loadLikes();},[post.id]);
  useEffect(()=>{if(showComments)loadComments();},[showComments,post.id]);

  async function loadLikes(){
    const {data}=await supabase.from("post_likes").select("*").eq("post_id",post.id);
    setLikes(data||[]);
  }
  async function loadComments(){
    const {data}=await supabase.from("post_comments").select("*").eq("post_id",post.id).order("created_at",{ascending:true});
    setComments(data||[]);
  }
  async function toggleLike(){
    if(!memberId) return;
    if(liked){await supabase.from("post_likes").delete().eq("post_id",post.id).eq("member_id",memberId);}
    else{await supabase.from("post_likes").insert({post_id:post.id,member_id:memberId});}
    loadLikes();
  }
  async function addComment(){
    if(!newComment.trim()) return;
    setSubmitting(true);
    await supabase.from("post_comments").insert({
      post_id:post.id,
      author_id:currentUserId,
      author_role:isSitter?"sitter":"parent",
      author_name:isSitter?"Your Sitter":"Family",
      author_avatar:isSitter?"🌿":"👤",
      text:newComment.trim(),
    });
    setNewComment("");setSubmitting(false);loadComments();
  }

  return (
    <div className="card" style={{padding:0,marginBottom:14,overflow:"hidden"}}>
      {post.photo_url&&(
        <div style={{cursor:"pointer"}} onClick={()=>setExpanded(!expanded)}>
          <img src={post.photo_url} alt="post" style={{width:"100%",maxHeight:expanded?800:320,objectFit:"cover",display:"block",transition:"max-height .3s"}}/>
        </div>
      )}
      <div style={{padding:"14px 16px"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,borderRadius:12,background:"linear-gradient(135deg,#3A6FD4,#3A9E7A)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🌿</div>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:13,fontWeight:600}}>Your Sitter</span>
                <span style={{fontSize:16}}>{getTypeIcon(post.type)}</span>
                {post.mood&&<span style={{fontSize:16}}>{getMoodIcon(post.mood)}</span>}
              </div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>{timeAgo(post.created_at)}</div>
            </div>
          </div>
          {isSitter&&<button onClick={()=>setConfirmDel(true)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,opacity:.4,padding:4}}>🗑️</button>}
        </div>
        {post.text&&<p style={{fontSize:14,lineHeight:1.65,color:"rgba(255,255,255,.85)",marginBottom:10}}>{post.text}</p>}
        {taggedChildren.length>0&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
            {taggedChildren.map(c=>(
              <span key={c.id} className="chip" style={{fontSize:11}}>{c.avatar} {c.name}</span>
            ))}
          </div>
        )}
        <div style={{display:"flex",alignItems:"center",gap:16,paddingTop:10,borderTop:"1px solid rgba(255,255,255,.06)"}}>
          {memberId&&(
            <button onClick={toggleLike} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:5,color:liked?"#F5AAAA":"rgba(255,255,255,.35)",fontSize:12,padding:0}}>
              <span style={{fontSize:16}}>{liked?"❤️":"🤍"}</span>
              {likes.length>0&&<span>{likes.length}</span>}
            </button>
          )}
          <button onClick={()=>setShowComments(!showComments)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:5,color:showComments?"#7BAAEE":"rgba(255,255,255,.35)",fontSize:12,padding:0}}>
            <span style={{fontSize:16}}>💬</span>
            <span>{comments.length>0?comments.length:"Comment"}</span>
          </button>
          <span style={{marginLeft:"auto",fontSize:11,color:"rgba(255,255,255,.2)",textTransform:"capitalize"}}>{post.type}</span>
        </div>
        {showComments&&(
          <div style={{marginTop:12,borderTop:"1px solid rgba(255,255,255,.06)",paddingTop:12}}>
            {comments.map(c=>(
              <div key={c.id} style={{display:"flex",gap:8,marginBottom:10}}>
                <span style={{fontSize:20,flexShrink:0}}>{c.author_avatar}</span>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                    <span style={{fontSize:12,fontWeight:600}}>{c.author_name}</span>
                    <span style={{fontSize:10,color:"rgba(255,255,255,.25)"}}>{timeAgo(c.created_at)}</span>
                  </div>
                  <p style={{fontSize:13,color:"rgba(255,255,255,.75)",lineHeight:1.5}}>{c.text}</p>
                </div>
              </div>
            ))}
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <input className="fi" value={newComment} onChange={e=>setNewComment(e.target.value)}
                placeholder="Add a comment…" style={{marginBottom:0,flex:1}}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();addComment();}}}/>
              <button className="bp" onClick={addComment} disabled={submitting||!newComment.trim()} style={{padding:"8px 14px",flexShrink:0}}>
                {submitting?<Spinner/>:"Send"}
              </button>
            </div>
          </div>
        )}
      </div>
      <Confirm open={confirmDel} title="Delete post?" message="This will permanently delete this post and all its comments." danger onConfirm={async()=>{await supabase.from("posts").delete().eq("id",post.id);setConfirmDel(false);onDeleted();}} onCancel={()=>setConfirmDel(false)}/>
    </div>
  );
}

// ─── Feed Tab ─────────────────────────────────────────────────────────────────
function FeedTab({familyId,sitterId,memberId,isSitter,children,unseenCount,onMarkSeen}) {
  const [posts,setPosts]       = useState([]);
  const [postKids,setPostKids] = useState({});
  const [loading,setLoading]   = useState(true);
  const [showNew,setShowNew]   = useState(false);
  const [filter,setFilter]     = useState("all");

  const load = useCallback(async()=>{
    setLoading(true);
    const {data:ps}=await supabase.from("posts").select("*").eq("family_id",familyId).order("created_at",{ascending:false});
    setPosts(ps||[]);
    if(ps?.length){
      const {data:pc}=await supabase.from("post_children").select("*").in("post_id",ps.map(p=>p.id));
      const g={};(pc||[]).forEach(r=>{if(!g[r.post_id])g[r.post_id]=[];g[r.post_id].push(r.child_id);});
      setPostKids(g);
      if(unseenCount>0&&onMarkSeen) onMarkSeen(ps.map(p=>p.id));
    }
    setLoading(false);
  },[familyId,unseenCount]);

  useEffect(()=>{load();},[load]);

  useEffect(()=>{
    const sub=supabase.channel(`feed-${familyId}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"posts",filter:`family_id=eq.${familyId}`},()=>load())
      .subscribe();
    return()=>supabase.removeChannel(sub);
  },[familyId]);

  const childMap={};children.forEach(c=>{childMap[c.id]=c;});
  const filtered=filter==="all"?posts:posts.filter(p=>p.type===filter);

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600}}>
          Feed
          {unseenCount>0&&<span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:20,height:20,borderRadius:"50%",background:"#3A6FD4",fontSize:11,fontWeight:700,marginLeft:6}}>{unseenCount}</span>}
        </div>
        {isSitter&&<button className="bp" onClick={()=>setShowNew(true)}>+ New Post</button>}
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:16}}>
        {[{id:"all",icon:"📋",label:"All"},...POST_TYPES].map(t=>(
          <button key={t.id} type="button" onClick={()=>setFilter(t.id)}
            style={{display:"flex",alignItems:"center",gap:4,padding:"5px 11px",borderRadius:20,border:`1px solid ${filter===t.id?"#7BAAEE":"rgba(255,255,255,.1)"}`,background:filter===t.id?"rgba(111,163,232,.15)":"rgba(255,255,255,.04)",color:filter===t.id?"#7BAAEE":"rgba(255,255,255,.4)",fontSize:11,cursor:"pointer"}}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {loading
        ?<div style={{textAlign:"center",padding:"60px 0"}}><Spinner size={24}/></div>
        :filtered.length===0
          ?<div className="es"><div className="ic">🌸</div><h3>No posts yet</h3>
            <p>{isSitter?"Share your first update with this family.":"Your sitter hasn't posted yet."}</p>
            {isSitter&&<button className="bp" onClick={()=>setShowNew(true)}>+ Post an update</button>}
          </div>
          :<div>{filtered.map(p=>(
            <PostCard key={p.id} post={p}
              taggedChildren={(postKids[p.id]||[]).map(id=>childMap[id]).filter(Boolean)}
              currentUserId={sitterId||memberId}
              memberId={memberId} isSitter={isSitter} onDeleted={load}/>
          ))}</div>
      }
      {isSitter&&(
        <NewPostModal open={showNew} onClose={()=>setShowNew(false)}
          familyId={familyId} sitterId={sitterId} children={children} onPosted={load}/>
      )}
    </div>
  );
}


// ─── Sitter Feed Wrapper — picks a family to show feed for ───────────────────
function SitterFeedWrapper({sitterId}) {
  const [families,setFamilies] = useState([]);
  const [children,setChildren] = useState({});
  const [selected,setSelected] = useState(null);
  const [loading,setLoading]   = useState(true);

  useEffect(()=>{
    async function load(){
      const {data:fams}=await supabase.from("families").select("*").eq("sitter_id",sitterId).neq("status","inactive").order("created_at",{ascending:false});
      setFamilies(fams||[]);
      if(fams?.length){
        setSelected(fams[0].id);
        const {data:kids}=await supabase.from("children").select("*").in("family_id",fams.map(f=>f.id));
        const g={};(kids||[]).forEach(k=>{if(!g[k.family_id])g[k.family_id]=[];g[k.family_id].push(k);});
        setChildren(g);
      }
      setLoading(false);
    }
    load();
  },[sitterId]);

  if(loading) return <div style={{textAlign:"center",padding:"60px 0"}}><Spinner size={24}/></div>;
  if(families.length===0) return <div className="es"><div className="ic">🌸</div><h3>No families yet</h3><p>Invite a family first to start posting updates.</p></div>;

  return (
    <div>
      {families.length>1&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:16}}>
          {families.map(f=>(
            <button key={f.id} type="button" onClick={()=>setSelected(f.id)}
              style={{padding:"6px 14px",borderRadius:20,border:`1px solid ${selected===f.id?"#7BAAEE":"rgba(255,255,255,.1)"}`,background:selected===f.id?"rgba(111,163,232,.15)":"rgba(255,255,255,.04)",color:selected===f.id?"#7BAAEE":"rgba(255,255,255,.5)",fontSize:12,cursor:"pointer"}}>
              {f.name}
            </button>
          ))}
        </div>
      )}
      {selected&&(
        <FeedTab
          familyId={selected}
          sitterId={sitterId}
          memberId={null}
          isSitter={true}
          children={children[selected]||[]}
          unseenCount={0}
          onMarkSeen={null}
        />
      )}
    </div>
  );
}


// ─── Messages ─────────────────────────────────────────────────────────────────

// New Conversation Modal
function NewConversationModal({open, onClose, familyId, currentUserId, isSitter, families=[], members, sitterName, sitterAvatar, onCreated}) {
  const [title, setTitle]       = useState("");
  const [selected, setSelected] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [alert, setAlert]       = useState(null);

  function reset(){setTitle("");setSelected([]);setAlert(null);}
  function close(){if(loading)return;reset();onClose();}

  function toggleMember(m){
    setSelected(s=>s.find(x=>x.user_id===m.user_id)?s.filter(x=>x.user_id!==m.user_id):[...s,m]);
  }

  async function create(e){
    e.preventDefault();
    if(selected.length===0){setAlert({t:"e",m:"Select at least one person."});return;}
    setLoading(true);setAlert(null);
    try{
      // Create conversation
      const {data:conv,error:convErr}=await supabase.from("conversations").insert({
        family_id:selectedFamily||familyId,
        created_by:currentUserId,
        title:title.trim()||null,
      }).select().single();
      if(convErr) throw convErr;

      // Add all participants (current user + selected)
      const participants=[
        {conversation_id:conv.id, user_id:currentUserId, participant_name:isSitter?sitterName:"You", participant_avatar:isSitter?"🌿":sitterAvatar||"👤", is_sitter:isSitter},
        ...selected.map(m=>({conversation_id:conv.id, user_id:m.user_id, participant_name:m.name, participant_avatar:m.avatar||"👤", is_sitter:false})),
      ];
      // If family member starting, also add sitter
      if(!isSitter){
        const {data:fam}=await supabase.from("families").select("sitter_id, sitters(name)").eq("id",familyId).single();
        if(fam?.sitter_id){
          participants.push({conversation_id:conv.id, user_id:fam.sitter_id, participant_name:fam.sitters?.name||"Sitter", participant_avatar:"🌿", is_sitter:true});
        }
      }
      const {error:partErr}=await supabase.from("conversation_participants").insert(participants);
      if(partErr) throw partErr;

      reset();onCreated(conv.id);onClose();
    }catch(err){setAlert({t:"e",m:err.message||"Something went wrong."});}
    finally{setLoading(false);}
  }

  const [availableMembers, setAvailableMembers] = useState([]);
  const [selectedFamily, setSelectedFamily] = useState(familyId||"");

  useEffect(()=>{
    if(!open) return;
    setSelectedFamily(familyId||"");
    setSelected([]);
  },[open,familyId]);

  useEffect(()=>{
    if(!selectedFamily) return;
    async function loadMembers(){
      const {data}=await supabase.from("members").select("*").eq("family_id",selectedFamily);
      setAvailableMembers((data||[]).filter(m=>m.user_id&&m.user_id!==currentUserId&&["admin","member"].includes(m.role)));
    }
    loadMembers();
  },[selectedFamily,currentUserId]);

  // Available people to add (exclude current user)
  const available = availableMembers;

  return (
    <Modal open={open} onClose={close}>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:600,marginBottom:4}}>New Conversation</div>
      <p style={{fontSize:12,color:"rgba(255,255,255,.35)",marginBottom:20,lineHeight:1.6}}>
        {isSitter?"Start a conversation with family members.":"Start a conversation with your sitter and family members."}
      </p>
      {alert&&<div className={`al al-${alert.t}`}>{alert.m}</div>}
      <form onSubmit={create}>
        {isSitter&&families&&families.length>1&&(
          <div style={{marginBottom:14}}>
            <SectionLabel>Family</SectionLabel>
            <select className="fi" value={selectedFamily} onChange={e=>{setSelectedFamily(e.target.value);setSelected([]);}} style={{marginBottom:0}}>
              <option value="">Select a family…</option>
              {families.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        )}
        <Field label="Title (optional)" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Emma's schedule" required={false} autoComplete="off"/>
        <div style={{marginBottom:16}}>
          <SectionLabel>Add people</SectionLabel>
          {available.length===0
            ?<p style={{fontSize:12,color:"rgba(255,255,255,.3)",fontStyle:"italic"}}>No other members available yet.</p>
            :<div style={{display:"flex",flexDirection:"column",gap:8}}>
              {available.map(m=>{
                const sel=!!selected.find(x=>x.user_id===m.user_id);
                return (
                  <div key={m.id} onClick={()=>toggleMember(m)}
                    style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:12,border:`1px solid ${sel?"#7BAAEE":"rgba(255,255,255,.07)"}`,background:sel?"rgba(111,163,232,.1)":"rgba(255,255,255,.03)",cursor:"pointer"}}>
                    <span style={{fontSize:22}}>{m.avatar||"👤"}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:500}}>{m.name}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>{ROLE_LABELS[m.role]}</div>
                    </div>
                    <span style={{fontSize:16}}>{sel?"✅":"○"}</span>
                  </div>
                );
              })}
            </div>
          }
        </div>
        <div style={{display:"flex",gap:10}}>
          <button type="submit" className="bp full" disabled={loading||selected.length===0}>
            {loading?<><Spinner/> Creating…</>:"Start Conversation"}
          </button>
          <button type="button" className="bg" onClick={close}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

// Add Participant Modal
function AddParticipantModal({open, onClose, convId, familyId, currentParticipants, currentUserId, isSitter, onAdded}) {
  const [members, setMembers]   = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading]   = useState(false);

  useEffect(()=>{
    if(!open) return;
    async function load(){
      const {data}=await supabase.from("members").select("*").eq("family_id",familyId);
      setMembers((data||[]).filter(m=>
        m.user_id &&
        m.user_id!==currentUserId &&
        ["admin","member"].includes(m.role) &&
        !currentParticipants.find(p=>p.user_id===m.user_id)
      ));
    }
    load();
  },[open,familyId,currentParticipants]);

  async function add(){
    if(selected.length===0) return;
    setLoading(true);
    await supabase.from("conversation_participants").insert(
      selected.map(m=>({conversation_id:convId, user_id:m.user_id, participant_name:m.name, participant_avatar:m.avatar||"👤", is_sitter:false}))
    );
    setLoading(false);setSelected([]);onAdded();onClose();
  }

  function toggle(m){setSelected(s=>s.find(x=>x.user_id===m.user_id)?s.filter(x=>x.user_id!==m.user_id):[...s,m]);}

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600,marginBottom:16}}>Add People</div>
      {members.length===0
        ?<p style={{fontSize:13,color:"rgba(255,255,255,.35)",marginBottom:20}}>Everyone is already in this conversation.</p>
        :<div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
          {members.map(m=>{
            const sel=!!selected.find(x=>x.user_id===m.user_id);
            return (
              <div key={m.id} onClick={()=>toggle(m)}
                style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:12,border:`1px solid ${sel?"#7BAAEE":"rgba(255,255,255,.07)"}`,background:sel?"rgba(111,163,232,.1)":"rgba(255,255,255,.03)",cursor:"pointer"}}>
                <span style={{fontSize:22}}>{m.avatar||"👤"}</span>
                <span style={{fontSize:13,fontWeight:500,flex:1}}>{m.name}</span>
                <span style={{fontSize:16}}>{sel?"✅":"○"}</span>
              </div>
            );
          })}
        </div>
      }
      <div style={{display:"flex",gap:10}}>
        <button className="bp full" onClick={add} disabled={loading||selected.length===0}>{loading?<Spinner/>:"Add"}</button>
        <button className="bg" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

// Conversation Thread
function ConversationThread({conv, currentUserId, isSitter, familyId, onBack, participants, onParticipantsChanged}) {
  const [messages, setMessages]     = useState([]);
  const [newMsg, setNewMsg]         = useState("");
  const [sending, setSending]       = useState(false);
  const [showAdd, setShowAdd]       = useState(false);
  const [loading, setLoading]       = useState(true);
  const bottomRef                   = useRef(null);
  const senderName                  = isSitter ? "Your Sitter" : (participants.find(p=>p.user_id===currentUserId)?.participant_name||"You");
  const senderAvatar                = isSitter ? "🌿" : (participants.find(p=>p.user_id===currentUserId)?.participant_avatar||"👤");

  const load = useCallback(async()=>{
    const {data}=await supabase.from("messages").select("*").eq("conversation_id",conv.id).order("created_at",{ascending:true});
    setMessages(data||[]);
    setLoading(false);
    // Mark seen
    await supabase.from("message_seen").upsert({conversation_id:conv.id, user_id:currentUserId, last_seen_at:new Date().toISOString()},{onConflict:"conversation_id,user_id"});
    setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),100);
  },[conv.id,currentUserId]);

  useEffect(()=>{load();},[load]);

  useEffect(()=>{
    const sub=supabase.channel(`conv-${conv.id}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`conversation_id=eq.${conv.id}`},()=>load())
      .subscribe();
    return()=>supabase.removeChannel(sub);
  },[conv.id]);

  async function send(){
    if(!newMsg.trim()) return;
    setSending(true);
    await supabase.from("messages").insert({
      conversation_id:conv.id,
      sender_id:currentUserId,
      sender_name:senderName,
      sender_avatar:senderAvatar,
      is_sitter:isSitter,
      text:newMsg.trim(),
    });
    setNewMsg("");setSending(false);
  }

  const convTitle = conv.title || participants.filter(p=>p.user_id!==currentUserId).map(p=>p.participant_name).join(", ") || "Conversation";

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 160px)",minHeight:400}}>
      {/* Thread header */}
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,.06)",marginBottom:12,flexShrink:0}}>
        <button onClick={onBack} className="bg" style={{padding:"6px 10px",fontSize:12}}>← Back</button>
        <div style={{flex:1}}>
          <div style={{fontWeight:600,fontSize:14}}>{convTitle}</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>
            {participants.map(p=>p.participant_name).join(", ")}
          </div>
        </div>
        <button onClick={()=>setShowAdd(true)} className="bg" style={{padding:"6px 10px",fontSize:12}}>+ Add</button>
      </div>

      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,paddingBottom:8}}>
        {loading
          ?<div style={{textAlign:"center",padding:40}}><Spinner size={20}/></div>
          :messages.length===0
            ?<div style={{textAlign:"center",padding:40,color:"rgba(255,255,255,.25)",fontSize:13}}>No messages yet. Say hello! 👋</div>
            :messages.map((m,i)=>{
              const isMe = m.sender_id===currentUserId;
              const showAvatar = i===0||messages[i-1].sender_id!==m.sender_id;
              return (
                <div key={m.id} style={{display:"flex",flexDirection:isMe?"row-reverse":"row",alignItems:"flex-end",gap:8}}>
                  {!isMe&&showAvatar&&<span style={{fontSize:22,flexShrink:0}}>{m.sender_avatar}</span>}
                  {!isMe&&!showAvatar&&<span style={{width:30,flexShrink:0}}/>}
                  <div style={{maxWidth:"70%"}}>
                    {showAvatar&&!isMe&&<div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginBottom:3,marginLeft:2}}>{m.sender_name}</div>}
                    <div style={{padding:"9px 13px",borderRadius:isMe?"16px 16px 4px 16px":"16px 16px 16px 4px",background:isMe?"linear-gradient(135deg,#3A6FD4,#2550A8)":"rgba(255,255,255,.08)",fontSize:13,lineHeight:1.5,color:"#E4EAF4",wordBreak:"break-word"}}>
                      {m.text}
                    </div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,.2)",marginTop:3,textAlign:isMe?"right":"left"}}>{timeAgo(m.created_at)}</div>
                  </div>
                </div>
              );
            })
        }
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div style={{display:"flex",gap:8,paddingTop:12,borderTop:"1px solid rgba(255,255,255,.06)",flexShrink:0}}>
        <input className="fi" value={newMsg} onChange={e=>setNewMsg(e.target.value)}
          placeholder="Type a message…" style={{marginBottom:0,flex:1}}
          onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}/>
        <button className="bp" onClick={send} disabled={sending||!newMsg.trim()} style={{padding:"8px 16px",flexShrink:0}}>
          {sending?<Spinner/>:"Send"}
        </button>
      </div>

      <AddParticipantModal open={showAdd} onClose={()=>setShowAdd(false)}
        convId={conv.id} familyId={familyId} currentParticipants={participants}
        currentUserId={currentUserId} isSitter={isSitter}
        onAdded={()=>{onParticipantsChanged();setShowAdd(false);}}/>
    </div>
  );
}

// Messages Tab
function MessagesTab({currentUserId, isSitter, families, memberInfo}) {
  const [convs, setConvs]           = useState([]);
  const [participants, setParticipants] = useState({});
  const [lastMessages, setLastMessages] = useState({});
  const [unseenCounts, setUnseenCounts] = useState({});
  const [selectedConv, setSelectedConv] = useState(null);
  const [selectedFamilyId, setSelectedFamilyId] = useState(null);
  const [showNew, setShowNew]       = useState(false);
  const [loading, setLoading]       = useState(true);

  // For sitter: all families; for family: their family
  const familyId = isSitter ? null : memberInfo?.family_id;
  const familyList = isSitter ? families : (memberInfo ? [{id:memberInfo.family_id,name:"My Family"}] : []);

  const [newConvFamilyId, setNewConvFamilyId] = useState(null);

  const load = useCallback(async()=>{
    setLoading(true);
    let query = supabase.from("conversations").select("*").order("updated_at",{ascending:false});
    if(!isSitter && familyId) query=query.eq("family_id",familyId);
    const {data:convData}=await query;
    const filtered=(convData||[]).filter(c=>isSitter||familyList.find(f=>f.id===c.family_id));
    setConvs(filtered);

    if(filtered.length>0){
      const ids=filtered.map(c=>c.id);

      // Load participants
      const {data:parts}=await supabase.from("conversation_participants").select("*").in("conversation_id",ids);
      const pg={};(parts||[]).forEach(p=>{if(!pg[p.conversation_id])pg[p.conversation_id]=[];pg[p.conversation_id].push(p);});
      setParticipants(pg);

      // Load last message per conversation
      const lastMsgs={};
      await Promise.all(ids.map(async id=>{
        const {data}=await supabase.from("messages").select("*").eq("conversation_id",id).order("created_at",{ascending:false}).limit(1);
        if(data?.[0]) lastMsgs[id]=data[0];
      }));
      setLastMessages(lastMsgs);

      // Load unseen counts
      const {data:seen}=await supabase.from("message_seen").select("*").eq("user_id",currentUserId).in("conversation_id",ids);
      const seenMap={};(seen||[]).forEach(s=>{seenMap[s.conversation_id]=s.last_seen_at;});
      const unseen={};
      await Promise.all(ids.map(async id=>{
        const since=seenMap[id];
        if(!since){const {count}=await supabase.from("messages").select("*",{count:"exact",head:true}).eq("conversation_id",id).neq("sender_id",currentUserId);unseen[id]=count||0;}
        else{const {count}=await supabase.from("messages").select("*",{count:"exact",head:true}).eq("conversation_id",id).gt("created_at",since).neq("sender_id",currentUserId);unseen[id]=count||0;}
      }));
      setUnseenCounts(unseen);
    }
    setLoading(false);
  },[currentUserId,isSitter,familyId]);

  useEffect(()=>{load();},[load]);

  // Realtime for new messages
  useEffect(()=>{
    const sub=supabase.channel("messages-list")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},()=>load())
      .subscribe();
    return()=>supabase.removeChannel(sub);
  },[]);

  const totalUnseen=Object.values(unseenCounts).reduce((a,b)=>a+b,0);
  const selectedConvData=convs.find(c=>c.id===selectedConv);
  const selectedParts=participants[selectedConv]||[];

  const sitterName = isSitter ? "Your Sitter" : "";

  if(loading) return <div style={{textAlign:"center",padding:"60px 0"}}><Spinner size={24}/></div>;

  // Show thread view
  if(selectedConv&&selectedConvData) return (
    <ConversationThread
      conv={selectedConvData}
      currentUserId={currentUserId}
      isSitter={isSitter}
      familyId={selectedConvData.family_id}
      participants={selectedParts}
      onBack={()=>{setSelectedConv(null);load();}}
      onParticipantsChanged={load}
    />
  );

  // Conversation list
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600}}>
          Messages {totalUnseen>0&&<span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:20,height:20,borderRadius:"50%",background:"#3A6FD4",fontSize:11,fontWeight:700,marginLeft:6}}>{totalUnseen}</span>}
        </div>
        <button className="bp" onClick={()=>{setNewConvFamilyId(isSitter?(families[0]?.id||null):familyId);setShowNew(true);}}>+ New</button>
      </div>

      {convs.length===0
        ?<div className="es"><div className="ic">💬</div><h3>No conversations yet</h3><p>Start a conversation with {isSitter?"a family":"your sitter"}.</p><button className="bp" onClick={()=>{setNewConvFamilyId(isSitter?(families[0]?.id||null):familyId);setShowNew(true);}}>+ Start a conversation</button></div>
        :<div style={{display:"flex",flexDirection:"column",gap:8}}>
          {convs.map(c=>{
            const parts=participants[c.id]||[];
            const last=lastMessages[c.id];
            const unseen=unseenCounts[c.id]||0;
            const title=c.title||parts.filter(p=>p.user_id!==currentUserId).map(p=>p.participant_name).join(", ")||"Conversation";
            const fam=familyList.find(f=>f.id===c.family_id);
            return (
              <div key={c.id} className="fc" onClick={()=>setSelectedConv(c.id)}
                style={{padding:"14px 16px"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                  <div style={{width:40,height:40,borderRadius:12,background:"linear-gradient(135deg,#3A6FD4,#3A9E7A)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>💬</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:3}}>
                      <div style={{fontWeight:600,fontSize:13,display:"flex",alignItems:"center",gap:6}}>
                        {title}
                        {unseen>0&&<span style={{background:"#3A6FD4",borderRadius:"50%",width:18,height:18,fontSize:10,fontWeight:700,display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{unseen}</span>}
                      </div>
                      {last&&<div style={{fontSize:10,color:"rgba(255,255,255,.25)",flexShrink:0}}>{timeAgo(last.created_at)}</div>}
                    </div>
                    {isSitter&&fam&&<div style={{fontSize:10,color:"rgba(111,163,232,.6)",marginBottom:3}}>{fam.name}</div>}
                    {last
                      ?<div style={{fontSize:12,color:"rgba(255,255,255,.4)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}><strong style={{color:"rgba(255,255,255,.55)"}}>{last.sender_id===currentUserId?"You":last.sender_name}:</strong> {last.text}</div>
                      :<div style={{fontSize:12,color:"rgba(255,255,255,.25)",fontStyle:"italic"}}>No messages yet</div>
                    }
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      }

      <NewConversationModal
        open={showNew}
        onClose={()=>setShowNew(false)}
        familyId={newConvFamilyId}
        currentUserId={currentUserId}
        isSitter={isSitter}
        families={familyList}
        members={[]}
        sitterName={sitterName}
        sitterAvatar="🌿"
        onCreated={(id)=>{setSelectedConv(id);load();}}
      />
    </div>
  );
}

// ─── Sitter Messages Wrapper ──────────────────────────────────────────────────
function SitterMessagesWrapper({sitterId, sitterName}) {
  const [families, setFamilies] = useState([]);
  const [allMembers, setAllMembers] = useState({});
  const [loading, setLoading]   = useState(true);

  useEffect(()=>{
    async function load(){
      const {data:fams}=await supabase.from("families").select("*").eq("sitter_id",sitterId).neq("status","inactive");
      setFamilies(fams||[]);
      if(fams?.length){
        const {data:mems}=await supabase.from("members").select("*").in("family_id",fams.map(f=>f.id));
        const g={};(mems||[]).forEach(m=>{if(!g[m.family_id])g[m.family_id]=[];g[m.family_id].push(m);});
        setAllMembers(g);
      }
      setLoading(false);
    }
    load();
  },[sitterId]);

  if(loading) return <div style={{textAlign:"center",padding:"60px 0"}}><Spinner size={24}/></div>;
  if(families.length===0) return <div className="es"><div className="ic">💬</div><h3>No families yet</h3><p>Invite a family first to start messaging.</p></div>;

  return <MessagesTab currentUserId={sitterId} isSitter={true} families={families} memberInfo={null} allMembers={allMembers} sitterName={sitterName}/>;
}

// ─── Family Messages Wrapper ──────────────────────────────────────────────────
function MessagesTabWrapper({currentUserId, member, family, memberName, memberAvatar}) {
  if(!member||!family) return <div className="es"><div className="ic">💬</div><h3>Not connected</h3><p>No family connected yet.</p></div>;
  return <MessagesTab currentUserId={currentUserId} isSitter={false} families={[family]} memberInfo={{...member, family_id:family.id}} allMembers={{[family.id]:[]}} sitterName="Your Sitter" memberName={memberName} memberAvatar={memberAvatar}/>;
}

// ─── Sitter Dashboard ─────────────────────────────────────────────────────────
function SitterDashboard({session,onSignOut}) {
  const [tab,setTab]=useState("families");
  const sitterId=session.user.id;
  const name=session.user.user_metadata?.name||session.user.email.split("@")[0];
  const NAV=[{id:"families",icon:"👨‍👩‍👧",label:"Families"},{id:"feed",icon:"🌸",label:"Feed"},{id:"invoices",icon:"💰",label:"Invoices"},{id:"messages",icon:"💬",label:"Messages"}];

  return (
    <div style={{position:"relative",zIndex:1,minHeight:"100vh",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(255,255,255,.06)",background:"rgba(0,0,0,.2)",backdropFilter:"blur(20px)",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div className="leaf" style={{fontSize:22,filter:"drop-shadow(0 0 10px rgba(58,158,122,.4))"}}>🌿</div>
          <div className="logo-text" style={{fontSize:20}}>littleloop</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:12,color:"rgba(255,255,255,.35)"}}>{name}</div>
          <button className="bg" style={{padding:"6px 12px",fontSize:12}} onClick={onSignOut}>Sign out</button>
        </div>
      </div>
      <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,.06)",background:"rgba(0,0,0,.15)"}}>
        {NAV.map(n=><div key={n.id} className={`nav-tab ${tab===n.id?"active":""}`} onClick={()=>setTab(n.id)}><span style={{fontSize:18}}>{n.icon}</span><span>{n.label}</span></div>)}
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"22px 20px",maxWidth:800,width:"100%",margin:"0 auto"}}>
        {tab==="families"&&<FamiliesTab sitterId={sitterId} sitterName={name}/>}
        {tab==="feed"&&<SitterFeedWrapper sitterId={sitterId}/>}
        {tab==="invoices"&&<div className="es"><div className="ic">💰</div><h3>Invoices coming soon</h3><p>Create and track invoices with payment history.</p></div>}
        {tab==="messages"&&<SitterMessagesWrapper sitterId={sitterId} sitterName={name}/>}
      </div>
    </div>
  );
}

// ─── Parent Dashboard ─────────────────────────────────────────────────────────
function ParentDashboard({session,onSignOut}) {
  const [member,setMember]     = useState(null);
  const [family,setFamily]     = useState(null);
  const [children,setChildren] = useState([]);
  const [members,setMembers]   = useState([]);
  const [loading,setLoading]   = useState(true);
  const [tab,setTab]           = useState("home");
  const [selectedChild,setSelectedChild] = useState(null);
  const [editChild,setEditChild]         = useState(null);
  const [showAddChild,setShowAddChild]   = useState(false);
  const [editMember,setEditMember]       = useState(null);
  const [showAddMember,setShowAddMember] = useState(false);
  const name=session.user.user_metadata?.name||session.user.email.split("@")[0];

  const load = useCallback(async()=>{
    setLoading(true);
    const {data:mem}=await supabase.from("members").select("*").eq("user_id",session.user.id).maybeSingle();
    if(!mem){setLoading(false);return;}
    setMember(mem);
    const [{data:fam},{data:kids},{data:mems}]=await Promise.all([
      supabase.from("families").select("*").eq("id",mem.family_id).single(),
      supabase.from("children").select("*").eq("family_id",mem.family_id),
      supabase.from("members").select("*").eq("family_id",mem.family_id),
    ]);
    setFamily(fam);setChildren(kids||[]);setMembers(mems||[]);
    setLoading(false);
  },[session.user.id]);

  useEffect(()=>{load();},[load]);

  const isAdmin  = member?.role==="admin";
  const canView  = ["admin","member"].includes(member?.role);
  const feedOnly = member?.role==="feed_only";
  const pickup   = member?.role==="pickup";

  // Build nav based on role
  const NAV=[
    ...(!feedOnly&&!pickup?[{id:"home",icon:"🏠",label:"Home"}]:[]),
    {id:"feed",icon:"🌸",label:"Feed",badge:unseenCount},
    ...(canView||isAdmin?[{id:"invoices",icon:"💰",label:"Invoices"}]:[]),
    {id:"messages",icon:"💬",label:"Messages"},
  ];

  // Default tab based on role
  useEffect(()=>{
    if(pickup) setTab("messages");
    else if(feedOnly) setTab("feed");
  },[pickup,feedOnly]);

  if(loading) return <><Bg/><div style={{position:"relative",zIndex:1,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner size={24}/></div></>;

  return (
    <div style={{position:"relative",zIndex:1,minHeight:"100vh",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(255,255,255,.06)",background:"rgba(0,0,0,.2)",backdropFilter:"blur(20px)",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div className="leaf" style={{fontSize:22,filter:"drop-shadow(0 0 10px rgba(58,158,122,.4))"}}>🌿</div>
          <div className="logo-text" style={{fontSize:20}}>littleloop</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:12,color:"rgba(255,255,255,.35)"}}>{name}</div>
          <button className="bg" style={{padding:"6px 12px",fontSize:12}} onClick={onSignOut}>Sign out</button>
        </div>
      </div>

      <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,.06)",background:"rgba(0,0,0,.15)"}}>
        {NAV.map(n=>(
          <div key={n.id} className={`nav-tab ${tab===n.id?"active":""}`} onClick={()=>setTab(n.id)}>
            <span style={{position:"relative",display:"inline-block"}}>
              <span style={{fontSize:18}}>{n.icon}</span>
              {n.badge>0&&<span style={{position:"absolute",top:-4,right:-6,background:"#3A6FD4",borderRadius:"50%",width:14,height:14,fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{n.badge}</span>}
            </span>
            <span>{n.label}</span>
          </div>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"22px 20px",maxWidth:800,width:"100%",margin:"0 auto"}}>

        {tab==="home"&&(
          <div>
            {!family
              ?<div className="es"><div className="ic">👨‍👩‍👧</div><h3>Not connected yet</h3><p>Your account isn't linked to a family yet.<br/>Make sure you signed up with the email your sitter invited.</p></div>
              :<>
                {/* Family card */}
                <div className="card fade-up" style={{padding:24,marginBottom:16}}>
                  <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
                    <div style={{width:48,height:48,borderRadius:14,background:"linear-gradient(135deg,#3A9E7A,#2A7A5A)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>👨‍👩‍👧</div>
                    <div>
                      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600}}>{family.name}</div>
                      <span className={`sb sb-${family.status==="active"?"a":"p"}`} style={{marginTop:4}}>{family.status}</span>
                    </div>
                  </div>

                  {/* Children */}
                  <div style={{marginBottom:20}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                      <SectionLabel>Children</SectionLabel>
                      {isAdmin&&<button className="bp" style={{padding:"5px 12px",fontSize:11}} onClick={()=>setShowAddChild(true)}>+ Add Child</button>}
                    </div>
                    {children.length===0
                      ?<div style={{fontSize:12,color:"rgba(255,255,255,.25)",fontStyle:"italic"}}>No children added yet.</div>
                      :<div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                        {children.map(c=>(
                          <button key={c.id} onClick={()=>setSelectedChild(c)}
                            style={{display:"flex",alignItems:"center",gap:7,background:`${c.color||"#8B78D4"}18`,borderRadius:20,padding:"6px 14px",border:`1px solid ${c.color||"#8B78D4"}44`,cursor:"pointer",color:"#E4EAF4"}}>
                            <span style={{fontSize:16}}>{c.avatar||"🌟"}</span>
                            <span style={{fontSize:13,fontWeight:500}}>{c.name}</span>
                            {isAdmin&&<span style={{fontSize:10,opacity:.4}} onClick={e=>{e.stopPropagation();setEditChild(c);}}>✏️</span>}
                          </button>
                        ))}
                      </div>
                    }
                  </div>

                  {/* Members */}
                  <div>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                      <SectionLabel>Family Members</SectionLabel>
                      {isAdmin&&<button className="bp" style={{padding:"5px 12px",fontSize:11}} onClick={()=>setShowAddMember(true)}>+ Add Member</button>}
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {members.map(m=>(
                        <div key={m.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"rgba(255,255,255,.03)",borderRadius:12,border:"1px solid rgba(255,255,255,.06)"}}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <span style={{fontSize:22}}>{m.avatar||"👤"}</span>
                            <div>
                              <div style={{fontSize:13,fontWeight:500}}>{m.name}{m.user_id===session.user.id&&<span style={{fontSize:10,color:"rgba(255,255,255,.3)",marginLeft:6}}>(you)</span>}</div>
                              <div style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>{m.email}</div>
                            </div>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span className={`sb sb-${m.status==="active"?"a":"p"}`} style={{fontSize:9}}>{ROLE_LABELS[m.role]||m.role}</span>
                            {isAdmin&&m.user_id!==session.user.id&&(
                              <button className="bg" style={{padding:"4px 10px",fontSize:11}} onClick={()=>setEditMember(m)}>Edit</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            }
          </div>
        )}

        {tab==="feed"&&family&&<FeedTab familyId={family.id} sitterId={null} memberId={member?.id} isSitter={false} children={children} unseenCount={0} onMarkSeen={null}/>}
        {tab==="feed"&&!family&&<div className="es"><div className="ic">🌸</div><h3>Not connected</h3><p>No family connected yet.</p></div>}
        {tab==="messages"&&member&&<MessagesTabWrapper currentUserId={session.user.id} member={member} family={family} memberName={name} memberAvatar={member?.avatar||"👤"}/>}
        {tab==="invoices"&&<div className="es"><div className="ic">💰</div><h3>Invoices coming soon</h3><p>View and pay invoices from your sitter.</p></div>}
      </div>

      {/* Modals */}
      <ChildProfileModal open={!!selectedChild} onClose={()=>setSelectedChild(null)} child={selectedChild} sitterId={null} isParent={true}/>
      <ChildModal open={showAddChild||!!editChild} onClose={()=>{setShowAddChild(false);setEditChild(null);}} familyId={family?.id} child={editChild||null} onSaved={load}/>
      <MemberModal open={showAddMember||!!editMember} onClose={()=>{setShowAddMember(false);setEditMember(null);}} familyId={family?.id} familyName={family?.name} member={editMember||null} adminName={name} onSaved={load}/>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [session,setSession]   = useState(undefined);
  const [userRole,setUserRole] = useState(null);
  const portal = getPortal();

  useEffect(()=>{
    const tag=document.createElement("style");
    tag.textContent=CSS;
    document.head.appendChild(tag);
    return()=>document.head.removeChild(tag);
  },[]);

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      setSession(session??null);
      if(session) setUserRole(session.user.user_metadata?.role||"sitter");
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,session)=>{
      setSession(session??null);
      if(session) setUserRole(session.user.user_metadata?.role||"sitter");
    });
    return()=>subscription.unsubscribe();
  },[]);

  if(session===undefined) return (
    <><Bg/>
      <div style={{position:"relative",zIndex:1,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{textAlign:"center"}}>
          <div className="leaf" style={{fontSize:40,marginBottom:12}}>🌿</div>
          <Spinner size={20}/>
        </div>
      </div>
    </>
  );

  const signOut=()=>supabase.auth.signOut();

  if(!session) return <><Bg/><AuthForm portal={portal}/></>;
  if(userRole==="parent") return <><Bg/><ParentDashboard session={session} onSignOut={signOut}/></>;
  return <><Bg/><SitterDashboard session={session} onSignOut={signOut}/></>;
}
