import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const VAPID_PUBLIC_KEY = 'BLj1J-8f4WT9C_ql5m1sX7GFWeCDWZwEbT99LcrvxlJyTdNMO3c1B2lBPdWzKDf17jJLYG8rdktppsYAVa33-Gg';

// ── Push Notifications ────────────────────────────────────────────────────────
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    return reg;
  } catch (e) { console.warn('SW registration failed:', e); return null; }
}

function b64urlToUint8(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function subscribeToPush(userId) {
  try {
    const reg = await registerServiceWorker();
    if (!reg) return;

    // Check existing subscription
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64urlToUint8(VAPID_PUBLIC_KEY),
      });
    }

    // Store in DB (upsert)
    const {error} = await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      subscription: sub.toJSON(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) console.error('Push subscription save failed:', error);
    else console.log('Push subscription saved for', userId);
  } catch (e) { console.warn('Push subscribe failed:', e); }
}

async function sendPushNotification(userIds, title, body, url, tag) {
  if (!userIds?.length) return;
  supabase.functions.invoke('send-push', {
    body: { userIds, title, body, url, tag }
  }).catch(console.error);
}

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function getPortal() {
  const p = new URLSearchParams(window.location.search);
  return p.get("portal") || "sitter";
}

function getInviteToken() {
  const p = new URLSearchParams(window.location.search);
  return p.get("invite") || null;
}


// ─── Themes ───────────────────────────────────────────────────────────────────
const PALETTES = [
  // DARK
  { id:"midnight",  name:"Midnight",    dark:true,  body:"#0C1420", orb1:"rgba(30,70,140,.35)",  orb2:"rgba(20,90,80,.25)",  card:"rgba(255,255,255,.035)", accent:"#3A6FD4", accentGrad:"linear-gradient(135deg,#3A6FD4,#2550A8)", nav:"rgba(0,0,0,.2)",   logo:"linear-gradient(90deg,#6FA3E8,#A8CCFF,#E2EDFF,#A8CCFF,#6FA3E8)" },
  { id:"forest",    name:"Forest",      dark:true,  body:"#0A1610", orb1:"rgba(20,90,40,.35)",   orb2:"rgba(10,70,60,.25)",  card:"rgba(255,255,255,.035)", accent:"#3A9E5A", accentGrad:"linear-gradient(135deg,#3A9E5A,#1E6B3A)", nav:"rgba(0,0,0,.2)",   logo:"linear-gradient(90deg,#6FB87A,#A8D4AE,#E2F4E8,#A8D4AE,#6FB87A)" },
  { id:"amethyst",  name:"Amethyst",    dark:true,  body:"#120E20", orb1:"rgba(80,30,140,.35)",  orb2:"rgba(60,20,100,.25)", card:"rgba(255,255,255,.035)", accent:"#7B4FD4", accentGrad:"linear-gradient(135deg,#7B4FD4,#5530A8)", nav:"rgba(0,0,0,.2)",   logo:"linear-gradient(90deg,#B07BE8,#CFA8FF,#EEE2FF,#CFA8FF,#B07BE8)" },
  { id:"ember",     name:"Ember",       dark:true,  body:"#1A0E08", orb1:"rgba(140,60,20,.35)",  orb2:"rgba(100,30,10,.25)", card:"rgba(255,255,255,.035)", accent:"#D46A3A", accentGrad:"linear-gradient(135deg,#D46A3A,#A84520)", nav:"rgba(0,0,0,.2)",   logo:"linear-gradient(90deg,#E8956F,#FFBFA8,#FFE8E2,#FFBFA8,#E8956F)" },
  { id:"arctic",    name:"Arctic",      dark:true,  body:"#091520", orb1:"rgba(20,100,160,.35)", orb2:"rgba(10,70,120,.25)", card:"rgba(255,255,255,.035)", accent:"#2AA8D4", accentGrad:"linear-gradient(135deg,#2AA8D4,#1580A8)", nav:"rgba(0,0,0,.2)",   logo:"linear-gradient(90deg,#6FD4E8,#A8E8FF,#E2F8FF,#A8E8FF,#6FD4E8)" },
  { id:"obsidian",  name:"Obsidian",    dark:true,  body:"#0A0A0A", orb1:"rgba(60,60,60,.35)",   orb2:"rgba(40,40,40,.25)",  card:"rgba(255,255,255,.035)", accent:"#8A8A9A", accentGrad:"linear-gradient(135deg,#8A8A9A,#5A5A6A)", nav:"rgba(0,0,0,.2)",   logo:"linear-gradient(90deg,#C0C0D0,#E0E0F0,#FFFFFF,#E0E0F0,#C0C0D0)" },
  // LIGHT
  { id:"cloud",     name:"Cloud",       dark:false, body:"#F0F4FA", orb1:"rgba(100,140,220,.2)", orb2:"rgba(80,160,140,.15)",card:"rgba(255,255,255,.8)",   accent:"#3A6FD4", accentGrad:"linear-gradient(135deg,#3A6FD4,#2550A8)", nav:"rgba(255,255,255,.7)",logo:"linear-gradient(90deg,#3A6FD4,#2550A8,#3A6FD4)" },
  { id:"mint",      name:"Mint",        dark:false, body:"#EFF8F4", orb1:"rgba(80,180,120,.2)",  orb2:"rgba(60,140,100,.15)",card:"rgba(255,255,255,.8)",   accent:"#2A8A5A", accentGrad:"linear-gradient(135deg,#2A8A5A,#1A6040)", nav:"rgba(255,255,255,.7)",logo:"linear-gradient(90deg,#2A8A5A,#1A6040,#2A8A5A)" },
  { id:"lavender",  name:"Lavender",    dark:false, body:"#F4F0FB", orb1:"rgba(140,100,220,.2)", orb2:"rgba(100,80,180,.15)",card:"rgba(255,255,255,.8)",   accent:"#7040C8", accentGrad:"linear-gradient(135deg,#7040C8,#5020A0)", nav:"rgba(255,255,255,.7)",logo:"linear-gradient(90deg,#7040C8,#5020A0,#7040C8)" },
  { id:"peach",     name:"Peach",       dark:false, body:"#FBF2EE", orb1:"rgba(220,120,80,.2)",  orb2:"rgba(180,80,50,.15)", card:"rgba(255,255,255,.8)",   accent:"#C85030", accentGrad:"linear-gradient(135deg,#C85030,#A03010)", nav:"rgba(255,255,255,.7)",logo:"linear-gradient(90deg,#C85030,#A03010,#C85030)" },
  { id:"sky",       name:"Sky",         dark:false, body:"#EEF6FB", orb1:"rgba(80,160,220,.2)",  orb2:"rgba(60,120,180,.15)",card:"rgba(255,255,255,.8)",   accent:"#1888C8", accentGrad:"linear-gradient(135deg,#1888C8,#0060A0)", nav:"rgba(255,255,255,.7)",logo:"linear-gradient(90deg,#1888C8,#0060A0,#1888C8)" },
  { id:"sand",      name:"Sand",        dark:false, body:"#FAF7F0", orb1:"rgba(180,150,80,.2)",  orb2:"rgba(140,110,60,.15)",card:"rgba(255,255,255,.8)",   accent:"#8A6020", accentGrad:"linear-gradient(135deg,#8A6020,#604010)", nav:"rgba(255,255,255,.7)",logo:"linear-gradient(90deg,#8A6020,#604010,#8A6020)" },
];

function getPalette(id) {
  return PALETTES.find(p=>p.id===id) || PALETTES[0];
}

function applyTheme(palette) {
  const p = typeof palette === 'string' ? getPalette(palette) : palette;
  const root = document.documentElement;
  root.style.setProperty('--body-bg', p.body);
  root.style.setProperty('--card-bg', p.card);
  root.style.setProperty('--accent', p.accent);
  root.style.setProperty('--accent-grad', p.accentGrad);
  root.style.setProperty('--nav-bg', p.nav);
  root.style.setProperty('--orb1', p.orb1);
  root.style.setProperty('--orb2', p.orb2);
  root.style.setProperty('--logo-grad', p.logo);
  // Light mode text adjustments
  if(!p.dark) {
    root.style.setProperty('--text', '#14243A');
    root.style.setProperty('--text-dim', 'rgba(20,36,58,.5)');
    root.style.setProperty('--text-faint', 'rgba(20,36,58,.3)');
    root.style.setProperty('--border', 'rgba(20,36,58,.1)');
    root.style.setProperty('--input-bg', 'rgba(20,36,58,.04)');
    root.style.setProperty('--input-border', 'rgba(20,36,58,.12)');
    root.style.setProperty('--dot-color', 'rgba(20,36,58,.06)');
  } else {
    root.style.setProperty('--text', '#E4EAF4');
    root.style.setProperty('--text-dim', 'rgba(255,255,255,.5)');
    root.style.setProperty('--text-faint', 'rgba(255,255,255,.3)');
    root.style.setProperty('--border', 'rgba(255,255,255,.07)');
    root.style.setProperty('--input-bg', 'rgba(255,255,255,.04)');
    root.style.setProperty('--input-border', 'rgba(255,255,255,.09)');
    root.style.setProperty('--dot-color', 'rgba(255,255,255,.05)');
  }
  document.body.style.background = p.body;
  document.body.style.color = p.dark ? '#E4EAF4' : '#14243A';
}

// Load saved theme from localStorage on startup
const savedTheme = localStorage.getItem('ll_theme') || 'midnight';
applyTheme(savedTheme);

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'DM Sans',sans-serif;background:var(--body-bg,#0C1420);color:var(--text,#E4EAF4);min-height:100vh;overflow-x:hidden}
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
  .logo-text{font-family:'Cormorant Garamond',serif;font-size:42px;font-weight:700;letter-spacing:-1px;background:var(--logo-grad,linear-gradient(90deg,#6FA3E8,#A8CCFF,#E2EDFF,#A8CCFF,#6FA3E8));background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 5s linear infinite}
  .card{background:var(--card-bg,rgba(255,255,255,.035));border:1px solid var(--border,rgba(255,255,255,.07));border-radius:18px;backdrop-filter:blur(24px);box-shadow:0 20px 60px rgba(0,0,0,.2),inset 0 1px 0 rgba(255,255,255,.06)}
  .nav-tab{flex:1;padding:11px 0;text-align:center;cursor:pointer;font-size:12px;font-weight:500;color:var(--text-faint,rgba(255,255,255,.3));border-bottom:2px solid transparent;transition:all .2s;display:flex;flex-direction:column;align-items:center;gap:3px}
  .nav-tab:hover{color:var(--text-dim,rgba(255,255,255,.6))}.nav-tab.active{color:var(--accent,#7BAAEE);border-bottom-color:var(--accent,#7BAAEE)}
  .tab{flex:1;padding:9px 0;text-align:center;cursor:pointer;font-size:13px;font-weight:500;color:var(--text-faint,rgba(255,255,255,.3));border-bottom:2px solid transparent;transition:all .2s}
  .tab:hover{color:var(--text-dim,rgba(255,255,255,.5))}.tab.active{color:var(--accent,#7BAAEE);border-bottom-color:var(--accent,#7BAAEE)}
  .fl{display:block;font-size:10px;font-weight:600;letter-spacing:.9px;text-transform:uppercase;color:var(--text-faint,rgba(255,255,255,.3));margin-bottom:7px}
  .fi{width:100%;padding:11px 14px;background:var(--input-bg,rgba(255,255,255,.04));border:1px solid var(--input-border,rgba(255,255,255,.09));border-radius:10px;color:var(--text,#E4EAF4);font-size:13px;outline:none;transition:all .2s;margin-bottom:14px}
  .fi::placeholder{color:var(--text-faint,rgba(255,255,255,.2))}.fi:focus{border-color:rgba(111,163,232,.45);background:rgba(111,163,232,.06);box-shadow:0 0 0 3px rgba(111,163,232,.1)}
  .bp{padding:11px 20px;background:var(--accent-grad,linear-gradient(135deg,#3A6FD4,#2550A8));border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:7px}
  .bp:hover:not(:disabled){background:linear-gradient(135deg,#4A7FE4,#3560B8);transform:translateY(-1px);box-shadow:0 6px 20px rgba(58,111,212,.3)}.bp:disabled{opacity:.5;cursor:not-allowed}.bp.full{width:100%;justify-content:center}
  .bg{padding:9px 16px;background:transparent;border:1px solid var(--border,rgba(255,255,255,.12));border-radius:10px;color:var(--text-dim,rgba(255,255,255,.5));font-size:13px;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:6px}
  .bg:hover{border-color:var(--text-dim);color:var(--text)}
  .bd{padding:8px 14px;background:rgba(192,80,80,.12);border:1px solid rgba(192,80,80,.25);border-radius:9px;color:#F5AAAA;font-size:12px;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:6px}
  .bd:hover{background:rgba(192,80,80,.22)}
  .al{border-radius:10px;padding:10px 14px;font-size:12px;line-height:1.55;margin-bottom:16px}
  .al-e{background:rgba(192,80,80,.1);border:1px solid rgba(192,80,80,.25);color:#F5AAAA}
  .al-s{background:rgba(58,158,122,.1);border:1px solid rgba(58,158,122,.25);color:#88D8B8}
  .al-i{background:rgba(58,111,212,.1);border:1px solid rgba(58,111,212,.25);color:#A8CCFF}
  .al-w{background:rgba(200,150,50,.1);border:1px solid rgba(200,150,50,.25);color:#F5D08A}
  .fc{padding:14px 16px;border-radius:14px;background:var(--input-bg,rgba(255,255,255,.03));border:1px solid var(--border,rgba(255,255,255,.07));transition:all .2s;cursor:pointer}
  .fc:hover{background:var(--card-bg);border-color:rgba(111,163,232,.25)}.fc.active{background:rgba(111,163,232,.08);border-color:rgba(111,163,232,.35)}
  .sb{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:600}
  .sb-a{background:rgba(58,158,122,.15);color:#88D8B8;border:1px solid rgba(58,158,122,.25)}
  .sb-p{background:rgba(200,120,74,.15);color:#F5C098;border:1px solid rgba(200,120,74,.25)}
  .sb-i{background:rgba(120,120,140,.15);color:#B0B8C8;border:1px solid rgba(120,120,140,.25)}
  .mo{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:100;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px)}
  .mb{background:var(--nav-bg,#111D2E);border:1px solid var(--border,rgba(255,255,255,.1));border-radius:20px;padding:28px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 40px 80px rgba(0,0,0,.4)}
  .es{text-align:center;padding:48px 20px}
  .es .ic{font-size:40px;margin-bottom:14px;opacity:.4}
  .es h3{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:600;margin-bottom:8px;opacity:.7}
  .es p{font-size:12px;color:var(--text-faint,rgba(255,255,255,.3));line-height:1.6;margin-bottom:20px}
  .note-card{padding:12px 14px;border-radius:12px;background:var(--input-bg,rgba(255,255,255,.03));border:1px solid var(--border,rgba(255,255,255,.07));margin-bottom:8px}
  .chip{display:inline-flex;align-items:center;gap:6px;background:var(--input-bg,rgba(255,255,255,.05));border:1px solid var(--border,rgba(255,255,255,.08));border-radius:20px;padding:5px 11px;font-size:12px;color:var(--text,#E4EAF4)}
  ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:4px}

  @media(max-width:600px){
    .mb{padding:20px 16px;max-height:95vh;border-radius:16px 16px 0 0;position:fixed;bottom:0;left:0;right:0;width:100%;max-width:100%}
    .mo{align-items:flex-end;padding:0}
    .two-col{grid-template-columns:1fr!important}
    .hide-mobile{display:none!important}
    .nav-tab{font-size:11px}
    .logo-text{font-size:16px!important}
    .bp{font-size:12px;padding:9px 14px}
  }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Bg() {
  return (
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
      <div style={{position:"absolute",width:600,height:600,borderRadius:"50%",left:-200,top:-150,background:"radial-gradient(circle,var(--orb1,rgba(30,70,140,.35)) 0%,transparent 70%)",animation:"orb1 18s ease-in-out infinite"}}/>
      <div style={{position:"absolute",width:500,height:500,borderRadius:"50%",right:-150,bottom:-100,background:"radial-gradient(circle,var(--orb2,rgba(20,90,80,.25)) 0%,transparent 70%)",animation:"orb2 22s ease-in-out infinite"}}/>
      <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(var(--dot-color,rgba(255,255,255,.05)) 1px,transparent 1px)",backgroundSize:"32px 32px",maskImage:"radial-gradient(ellipse 80% 80% at 50% 50%,black 40%,transparent 100%)",WebkitMaskImage:"radial-gradient(ellipse 80% 80% at 50% 50%,black 40%,transparent 100%)"}}/>
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
      <p style={{fontSize:13,color:"var(--text-dim)",marginBottom:24,lineHeight:1.6}}>{message}</p>
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
  return <div style={{fontSize:10,fontWeight:600,letterSpacing:"0.9px",textTransform:"uppercase",color:"var(--text-faint)",marginBottom:10}}>{children}</div>;
}

// ─── Auth Form ────────────────────────────────────────────────────────────────
function AuthForm({portal, inviteData}) {
  const isParent = portal==="parent";
  const [mode,setMode]         = useState(inviteData ? "signup" : "login");
  const [name,setName]         = useState("");
  const [email,setEmail]       = useState(inviteData?.admin_email||"");
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
          <div className="leaf" style={{fontSize:46,marginBottom:10,filter:"drop-shadow(0 0 20px rgba(58,158,122,.45))"}}>➿</div>
          <div className="logo-text">littleloop</div>
          <p style={{fontSize:12,color:"var(--text-faint)",marginTop:8,letterSpacing:".04em"}}>Independent childcare, thoughtfully connected.</p>
        </div>
        <div className="card fade-up d1" style={{padding:"32px 28px"}}>
          <div className="fade-up d2" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:22}}>
            <div style={{width:28,height:28,borderRadius:8,background:isParent?"linear-gradient(135deg,#3A9E7A,#2A7A5A)":"linear-gradient(135deg,#3A6FD4,#3A9E7A)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>{isParent?"👨‍👩‍👧":"➿"}</div>
            <span style={{fontSize:11,fontWeight:600,color:"var(--text-faint)",letterSpacing:"1.2px",textTransform:"uppercase"}}>{isParent?"Family Portal":"Sitter Portal"}</span>
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
              <div style={{fontSize:12,color:"var(--text-faint)"}}>We'll email you a link to choose a new one.</div>
            </div>
          )}
          {alert && <div className={`al al-${alert.t} fade-up`}>{alert.m}</div>}
          {isParent&&mode==="signup"&&!inviteData&&<div className="al al-i" style={{marginBottom:16}}>💡 Sign up with the email your sitter used to invite you and you'll be automatically connected to your family.</div>}
          {inviteData&&<div className="al al-s" style={{marginBottom:16}}>➿ Creating your account for <strong>{inviteData.family_name}</strong>. Use {inviteData.admin_email} to auto-connect.</div>}
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
        <p className="fade-up d6" style={{textAlign:"center",marginTop:24,fontSize:12,color:"var(--text-faint)"}}>
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
          {age!==null&&<div style={{fontSize:12,color:"var(--text-faint)"}}>Age {age} · Born {dob.toLocaleDateString()}</div>}
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
              <p style={{fontSize:13,color:"var(--text-dim)",lineHeight:1.6}}>{child.dietary_restrictions}</p>
            </div>
          )}
          {child.medical_notes&&(
            <div>
              <SectionLabel>Medical Notes</SectionLabel>
              <p style={{fontSize:13,color:"var(--text-dim)",lineHeight:1.6}}>{child.medical_notes}</p>
            </div>
          )}
          {!child.allergies?.length&&!child.dietary_restrictions&&!child.medical_notes&&(
            <p style={{fontSize:12,color:"var(--text-faint)",fontStyle:"italic"}}>No medical info added yet.</p>
          )}
        </div>
      )}

      {tab==="notes" && (
        <div>
          {!isParent&&(
            <div style={{marginBottom:16}}>
              <Field label="Add a note" as="textarea" rows={3} value={newNote} onChange={e=>setNewNote(e.target.value)} placeholder="Write a note about this child…" required={false}/>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:-8}}>
                <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:12,color:"var(--text-dim)"}}>
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
              ?<p style={{fontSize:12,color:"var(--text-faint)",fontStyle:"italic",textAlign:"center",padding:"20px 0"}}>
                {isParent?"No notes shared with your family yet.":"No notes yet."}
              </p>
              :<div>
                {notes.map(n=>(
                  <div key={n.id} className="note-card">
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
                      <p style={{fontSize:13,color:"var(--text,rgba(255,255,255,.8))",lineHeight:1.6,flex:1}}>{n.note}</p>
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
                      <span style={{fontSize:10,color:"var(--text-faint)"}}>{new Date(n.created_at).toLocaleString()}</span>
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
            <div style={{fontSize:11,color:"var(--text-faint)",marginTop:8,lineHeight:1.6}}>
              <strong style={{color:"var(--text-dim)"}}>Admin</strong> — full access · <strong style={{color:"var(--text-dim)"}}>Member</strong> — view all · <strong style={{color:"var(--text-dim)"}}>Feed Only</strong> — feed tab · <strong style={{color:"var(--text-dim)"}}>Pickup</strong> — messages only
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
      const {data:existing}=await supabase.from("families").select("id,name,status").eq("admin_email",adminEmail).maybeSingle();
      if(existing){
        const {data:existingConn}=await supabase.from("family_sitters").select("id,status").eq("family_id",existing.id).eq("sitter_id",sitterId).maybeSingle();
        if(existingConn&&existingConn.status!=="inactive"){
          setAlert({t:"i",m:"You're already connected to this family."});
          setLoading(false);return;
        }
        if(existingConn){
          await supabase.from("family_sitters").update({status:"active"}).eq("id",existingConn.id);
        } else {
          await supabase.from("family_sitters").insert({family_id:existing.id,sitter_id:sitterId,status:"pending"});
        }
        setAlert({t:"s",m:`You've been connected to the ${existing.name} family!`});
        setTimeout(()=>{onInvited();onClose();setFamilyName("");setAdminEmail("");setChildrenStr("");setAlert(null);},1800);
        return;
      }
      const {data:family,error:famErr}=await supabase.from("families").insert({name:familyName,admin_email:adminEmail,status:"pending"}).select().single();
      if(famErr) throw famErr;
      await supabase.from("family_sitters").insert({family_id:family.id,sitter_id:sitterId,status:"pending"});
      const {error:memErr}=await supabase.from("members").insert({family_id:family.id,name:adminEmail.split("@")[0],email:adminEmail,role:"admin",status:"pending"});
      if(memErr) throw memErr;
      const childNames=childrenStr.split(",").map(s=>s.trim()).filter(Boolean);
      if(childNames.length>0){
        const {error:kidErr}=await supabase.from("children").insert(childNames.map(n=>({family_id:family.id,name:n,avatar:"🌟",color:"#8B78D4"})));
        if(kidErr) throw kidErr;
      }
      await supabase.functions.invoke("send-invite",{body:{familyName,parentEmail:adminEmail,sitterName,sitterId}});
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
      <p style={{fontSize:12,color:"var(--text-faint)",marginBottom:22,lineHeight:1.6}}>The email you enter becomes the family admin.</p>
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

// ─── Family Name Editor ───────────────────────────────────────────────────────
function FamilyNameEditor({familyId, name, onSaved}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue]     = useState(name);
  const [saving, setSaving]   = useState(false);

  async function save(){
    if(!value.trim()||value.trim()===name){setEditing(false);return;}
    setSaving(true);
    const {error} = await supabase.from('families').update({name:value.trim()}).eq('id',familyId);
    setSaving(false);
    if(!error){onSaved(value.trim());setEditing(false);}
  }

  if(editing) return (
    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
      <input className="fi" value={value} onChange={e=>setValue(e.target.value)}
        onKeyDown={e=>{if(e.key==='Enter')save();if(e.key==='Escape')setEditing(false);}}
        style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,marginBottom:0,padding:'4px 8px'}}
        autoFocus/>
      <button className="bp" style={{padding:'5px 10px',fontSize:12,flexShrink:0}} onClick={save} disabled={saving}>
        {saving?<Spinner size={10}/>:'✓'}
      </button>
      <button className="bg" style={{padding:'5px 10px',fontSize:12,flexShrink:0}} onClick={()=>{setValue(name);setEditing(false);}}>✕</button>
    </div>
  );

  return (
    <div style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}} onClick={()=>setEditing(true)}>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600}}>{name}</div>
      <span style={{fontSize:12,opacity:.35}}>✏️</span>
    </div>
  );
}

// ─── Sitter Family Detail ─────────────────────────────────────────────────────
function SitterFamilyDetail({family,children,sitterId,sitterName,onDeactivate}) {
  const [selectedChild,setSelectedChild] = useState(null);
  const [confirmRemove,setConfirmRemove] = useState(false);
  const [loading,setLoading]             = useState(false);
  const [alert,setAlert]                 = useState(null);
  const [editEmail,setEditEmail]         = useState(false);
  const [newEmail,setNewEmail]           = useState(family.admin_email||'');
  const [emailSaving,setEmailSaving]     = useState(false);
  const [etas,setEtas]                   = useState([]);

  useEffect(()=>{
    async function loadEtas(){
      const {data}=await supabase.from('eta_notifications')
        .select('*')
        .eq('family_id',family.id)
        .gt('expires_at',new Date().toISOString())
        .order('created_at',{ascending:false});
      setEtas(data||[]);
    }
    loadEtas();
    // Real-time subscription
    const ch=supabase.channel(`eta-${family.id}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'eta_notifications',
        filter:`family_id=eq.${family.id}`},()=>loadEtas())
      .subscribe();
    return()=>supabase.removeChannel(ch);
  },[family.id]);

  async function deactivate(){
    setLoading(true);
    const {error}=await supabase.from("family_sitters").update({status:"inactive"}).eq("family_id",family.id).eq("sitter_id",sitterId);
    setLoading(false);setConfirmRemove(false);
    if(error){setAlert({t:"e",m:error.message});return;}
    onDeactivate();
  }

  async function saveEmailAndResend(){
    if(!newEmail.trim()||newEmail.trim()===family.admin_email){setEditEmail(false);return;}
    setEmailSaving(true);
    const trimmed=newEmail.trim();
    // Update admin_email on family
    const {error:upErr}=await supabase.from('families').update({admin_email:trimmed}).eq('id',family.id);
    if(upErr){setAlert({t:'e',m:upErr.message});setEmailSaving(false);return;}
    // Update the pending member record email + name
    await supabase.from('members')
      .update({email:trimmed, name:trimmed.split('@')[0]})
      .eq('family_id',family.id)
      .eq('status','pending');
    family.admin_email=trimmed;
    // Resend invite via edge function
    const {error:fnErr}=await supabase.functions.invoke('send-invite',{
      body:{familyName:family.name,parentEmail:trimmed,sitterName,sitterId}
    });
    setEmailSaving(false);
    setEditEmail(false);
    if(fnErr) setAlert({t:'w',m:'Email updated but invite failed to send. Try resending.'});
    else setAlert({t:'s',m:'Email updated and invite resent!'});
    setTimeout(()=>setAlert(null),3000);
  }

  async function resendInvite(){
    setLoading(true);
    const {error}=await supabase.functions.invoke('send-invite',{
      body:{familyName:family.name,parentEmail:family.admin_email,sitterName,sitterId}
    });
    setLoading(false);
    setAlert(error?{t:'e',m:'Failed to resend invite.'}:{t:'s',m:'Invite resent!'});
    setTimeout(()=>setAlert(null),3000);
  }

  return (
    <div className="slide-in">
      {alert&&<div className={`al al-${alert.t}`}>{alert.m}</div>}

      {/* ETA banners */}
      {etas.map(eta=>{
        const etaTime=new Date(eta.eta_time);
        const minsLeft=Math.max(0,Math.round((etaTime-Date.now())/60000));
        return (
          <div key={eta.id} style={{marginBottom:12,padding:'10px 14px',borderRadius:12,
            background:'rgba(58,158,122,.12)',border:'1px solid rgba(94,207,170,.3)',
            display:'flex',alignItems:'center',gap:10,animation:'pulse 2s infinite'}}>
            <span style={{fontSize:20}}>🚗</span>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:'#5ECFAA'}}>
                {eta.member_name} is on the way!
              </div>
              <div style={{fontSize:11,color:'var(--text-faint)'}}>
                {minsLeft>0?`~${minsLeft} min away · `:'Arriving soon · '}
                {etaTime.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}
              </div>
            </div>
          </div>
        );
      })}

      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
        <div style={{flex:1,minWidth:0}}>
          <FamilyNameEditor familyId={family.id} name={family.name} onSaved={n=>{family.name=n;setAlert({t:'s',m:'Family name updated!'});setTimeout(()=>setAlert(null),2000);}}/>
          {/* Email — editable when pending */}
          {editEmail
            ? <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4}}>
                <input className="fi" value={newEmail} onChange={e=>setNewEmail(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter')saveEmailAndResend();if(e.key==='Escape')setEditEmail(false);}}
                  style={{marginBottom:0,padding:'4px 8px',fontSize:12}} autoFocus/>
                <button className="bp" style={{padding:'4px 10px',fontSize:11,flexShrink:0}} onClick={saveEmailAndResend} disabled={emailSaving}>
                  {emailSaving?<Spinner size={10}/>:'Save & Resend'}
                </button>
                <button className="bg" style={{padding:'4px 8px',fontSize:11,flexShrink:0}} onClick={()=>{setNewEmail(family.admin_email);setEditEmail(false);}}>✕</button>
              </div>
            : <div style={{display:'flex',alignItems:'center',gap:6,marginTop:2,flexWrap:'wrap'}}>
                <span style={{fontSize:11,color:"var(--text-faint)"}}>{family.admin_email}</span>
                {family.status==='pending'&&<>
                  <button onClick={()=>setEditEmail(true)}
                    style={{background:'none',border:'none',fontSize:10,color:'var(--accent,#7BAAEE)',cursor:'pointer',padding:0,textDecoration:'underline'}}>edit</button>
                  <button onClick={resendInvite} disabled={loading}
                    style={{background:'none',border:'none',fontSize:10,color:'var(--accent,#7BAAEE)',cursor:'pointer',padding:0,textDecoration:'underline'}}>
                    {loading?'sending…':'resend invite'}
                  </button>
                </>}
              </div>
          }
        </div>
        <span className={`sb sb-${family.status==="active"?"a":family.status==="pending"?"p":"i"}`} style={{flexShrink:0,marginLeft:8}}>
          {family.status==="active"?"✅ Active":family.status==="pending"?"⏳ Pending":"⬜ Inactive"}
        </span>
      </div>

      <div style={{marginBottom:20}}>
        <SectionLabel>Children</SectionLabel>
        {children.length===0
          ?<div style={{fontSize:12,color:"var(--text-faint)",fontStyle:"italic"}}>No children added yet</div>
          :<div style={{display:"flex",flexDirection:"column",gap:8}}>
            {children.map(c=>(
              <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
                background:`${c.color||"#8B78D4"}12`,borderRadius:14,border:`1px solid ${c.color||"#8B78D4"}33`}}>
                <button onClick={()=>setSelectedChild(c)} style={{display:"flex",alignItems:"center",gap:7,background:"none",border:"none",cursor:"pointer",flex:1,minWidth:0,padding:0}}>
                  <span style={{fontSize:22}}>{c.avatar||"🌟"}</span>
                  <span style={{fontSize:13,fontWeight:500,color:"var(--text,#E4EAF4)"}}>{c.name}</span>
                </button>
                <CheckInButton child={c} familyId={family.id} currentUserId={sitterId}
                  checkerName={sitterName||"Sitter"} isSitter={true}/>
              </div>
            ))}
          </div>
        }
        <CheckinLog familyId={family.id}/>
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
    const {data:fsRows}=await supabase.from("family_sitters").select("status,families(*)").eq("sitter_id",sitterId).neq("status","inactive").order("joined_at",{ascending:false});
    const fams=(fsRows||[]).map(r=>r.families).filter(Boolean);
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
          Families <span style={{fontSize:14,color:"var(--text-faint)",fontFamily:"'DM Sans',sans-serif",fontWeight:400}}>({families.length})</span>
        </div>
        <button className="bp" onClick={()=>setShowInvite(true)}>+ Invite Family</button>
      </div>

      {families.length===0
        ?<div className="es"><div className="ic">👨‍👩‍👧</div><h3>No families yet</h3><p>Invite your first family to get started.</p><button className="bp" onClick={()=>setShowInvite(true)}>+ Invite your first family</button></div>
        :<div>
          {/* Mobile: show detail if selected, else show list */}
          {selected && selFam
            ? <div>
                <button className="bg" style={{marginBottom:12,fontSize:12,padding:"6px 12px"}} onClick={()=>setSelected(null)}>← All Families</button>
                <div className="card" style={{padding:22}}>
                  <SitterFamilyDetail family={selFam} children={kids[selected]||[]} sitterId={sitterId} sitterName={sitterName} onDeactivate={()=>{setSelected(null);load();}}/>
                </div>
              </div>
            : <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {families.map(f=>(
                  <div key={f.id} className={`fc ${selected===f.id?"active":""}`} onClick={()=>setSelected(f.id)}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <div style={{fontWeight:600,fontSize:14}}>{f.name}</div>
                      <span className={`sb sb-${f.status==="active"?"a":"p"}`} style={{fontSize:9}}>{f.status}</span>
                    </div>
                    <div style={{fontSize:12,color:"var(--text-faint)",marginTop:3}}>{(kids[f.id]||[]).length} child{(kids[f.id]||[]).length!==1?"ren":""}</div>
                  </div>
                ))}
              </div>
          }
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
function NewPostModal({open,onClose,familyId,sitterId,sitterName,familyName,children,onPosted}) {
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
      // Send email notification to family (fire and forget)
      supabase.functions.invoke("send-notification",{body:{
        type:"new_post",
        payload:{familyId,sitterName,familyName,postType:type,postContent:text.trim()}
      }}).catch(console.error);
      // Send push notification to family members
      supabase.from("members").select("user_id").eq("family_id",familyId).in("role",["admin","member"]).eq("status","active")
        .then(({data:mems})=>{
          const ids=(mems||[]).map(m=>m.user_id).filter(Boolean);
          sendPushNotification(ids,`New update from ${sitterName}`,text.trim().slice(0,80)||"Tap to see the latest update",`/?portal=parent`,"new_post");
        });
      reset();onPosted();onClose();
    }catch(err){setAlert({t:"e",m:err.message||"Something went wrong."});}
    finally{setLoading(false);}
  }

  return (
    <Modal open={open} onClose={close}>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:600,marginBottom:4}}>New Post</div>
      <p style={{fontSize:12,color:"var(--text-faint)",marginBottom:20,lineHeight:1.6}}>Share an update with this family.</p>
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
                  style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:20,border:`1px solid ${tagged.includes(c.id)?c.color||"#7BAAEE":"rgba(255,255,255,.1)"}`,background:tagged.includes(c.id)?`${c.color||"#8B78D4"}22`:"rgba(255,255,255,.04)",color:"var(--text-dim)",fontSize:12,cursor:"pointer"}}>
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
              <img src={preview} alt="preview" style={{width:"100%",maxHeight:200,objectFit:"cover",borderRadius:12,border:"1px solid var(--border)"}}/>
              <button type="button" onClick={()=>{setPhoto(null);setPreview(null);}}
                style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,.6)",border:"none",borderRadius:"50%",width:28,height:28,cursor:"pointer",color:"#fff",fontSize:14}}>✕</button>
            </div>
            :<label style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderRadius:12,border:"1px dashed rgba(255,255,255,.15)",cursor:"pointer",color:"var(--text-dim)",fontSize:13}}>
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
function PostCard({post,taggedChildren,currentUserId,memberId,isSitter,onDeleted,sitterName='Sitter',currentUserName='',currentUserAvatar='👤'}) {
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
      author_name:isSitter?sitterName:currentUserName,
      author_avatar:isSitter?"➿":currentUserAvatar,
      text:newComment.trim(),
    });
    setNewComment("");setSubmitting(false);loadComments();
  }

  return (
    <div className="card" style={{padding:0,marginBottom:14,overflow:"hidden"}}>
      {post.photo_url&&(
        <div style={{cursor:"pointer"}} onClick={()=>setExpanded(!expanded)}>
          <img src={post.photo_url} alt="post" style={{width:"100%",maxHeight:expanded?"100vw":280,objectFit:"cover",display:"block",transition:"max-height .3s"}}/>
        </div>
      )}
      <div style={{padding:"14px 16px"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,borderRadius:12,background:"linear-gradient(135deg,#3A6FD4,#3A9E7A)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>➿</div>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:13,fontWeight:600}}>{sitterName}</span>
                <span style={{fontSize:16}}>{getTypeIcon(post.type)}</span>
                {post.mood&&<span style={{fontSize:16}}>{getMoodIcon(post.mood)}</span>}
              </div>
              <div style={{fontSize:11,color:"var(--text-faint)"}}>{timeAgo(post.created_at)}</div>
            </div>
          </div>
          {isSitter&&<button onClick={()=>setConfirmDel(true)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,opacity:.4,padding:4}}>🗑️</button>}
        </div>
        {post.text&&<p style={{fontSize:14,lineHeight:1.65,color:"var(--text,rgba(255,255,255,.85))",marginBottom:10}}>{post.text}</p>}
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
          <span style={{marginLeft:"auto",fontSize:11,color:"var(--text-faint)",textTransform:"capitalize"}}>{post.type}</span>
        </div>
        {showComments&&(
          <div style={{marginTop:12,borderTop:"1px solid rgba(255,255,255,.06)",paddingTop:12}}>
            {comments.map(c=>(
              <div key={c.id} style={{display:"flex",gap:8,marginBottom:10}}>
                <span style={{fontSize:20,flexShrink:0}}>{c.author_avatar}</span>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                    <span style={{fontSize:12,fontWeight:600}}>{c.author_name}</span>
                    <span style={{fontSize:10,color:"var(--text-faint)"}}>{timeAgo(c.created_at)}</span>
                  </div>
                  <p style={{fontSize:13,color:"var(--text-dim,rgba(255,255,255,.75))",lineHeight:1.5}}>{c.text}</p>
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
function FeedTab({familyId,sitterId,memberId,isSitter,children,unseenCount,onMarkSeen,sitterName='Sitter',currentUserName='',currentUserAvatar='👤',familyName=''}) {
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

  // Subscribe to push on mount
  useEffect(()=>{ subscribeToPush(sitterId); },[sitterId]);

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
              memberId={memberId} isSitter={isSitter} onDeleted={load}
              sitterName={sitterName} currentUserName={currentUserName} currentUserAvatar={currentUserAvatar}/>
          ))}</div>
      }
      {isSitter&&(
        <NewPostModal open={showNew} onClose={()=>setShowNew(false)}
          familyId={familyId} sitterId={sitterId} sitterName={sitterName} familyName={familyName||''} children={children} onPosted={load}/>
      )}
    </div>
  );
}


// ─── Sitter Feed Wrapper — picks a family to show feed for ───────────────────
function SitterFeedWrapper({sitterId, sitterName}) {
  const [families,setFamilies] = useState([]);
  const [children,setChildren] = useState({});
  const [selected,setSelected] = useState(null);
  const [loading,setLoading]   = useState(true);

  useEffect(()=>{
    async function load(){
      const {data:fsRows}=await supabase.from("family_sitters").select("status,families(*)").eq("sitter_id",sitterId).neq("status","inactive").order("joined_at",{ascending:false});
      const fams=(fsRows||[]).map(r=>r.families).filter(Boolean);
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
          sitterName={sitterName}
          currentUserName={sitterName}
          currentUserAvatar="➿"
          familyName={families.find(f=>f.id===selected)?.name||''}
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
    if(isSitter && selected.length===0){setAlert({t:"e",m:"Select at least one family member."});return;}
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
        {conversation_id:conv.id, user_id:currentUserId, participant_name:isSitter?sitterName:"You", participant_avatar:isSitter?"➿":sitterAvatar||"👤", is_sitter:isSitter},
        ...selected.map(m=>({conversation_id:conv.id, user_id:m.user_id, participant_name:m.name, participant_avatar:m.avatar||"👤", is_sitter:false})),
      ];
      // If family member starting, also add sitter
      if(!isSitter){
        const {data:fsRows}=await supabase.from("family_sitters").select("sitter_id, sitters(name,avatar_url)").eq("family_id",selectedFamily||familyId).eq("status","active");
        for(const fs of (fsRows||[])){
          participants.push({conversation_id:conv.id, user_id:fs.sitter_id, participant_name:fs.sitters?.name||"Sitter", participant_avatar:fs.sitters?.avatar_url||"➿", is_sitter:true});
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
      <p style={{fontSize:12,color:"var(--text-faint)",marginBottom:20,lineHeight:1.6}}>
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
          <SectionLabel>{isSitter?"Add family members":"Add more family members (optional)"}</SectionLabel>
          {!isSitter&&<p style={{fontSize:11,color:"rgba(88,158,122,.8)",marginBottom:8}}>✓ Your sitter will be included automatically</p>}
          {available.length===0
            ?<p style={{fontSize:12,color:"var(--text-faint)",fontStyle:"italic"}}>{isSitter?"No family members available yet.":"No other members to add."}</p>
            :<div style={{display:"flex",flexDirection:"column",gap:8}}>
              {available.map(m=>{
                const sel=!!selected.find(x=>x.user_id===m.user_id);
                return (
                  <div key={m.id} onClick={()=>toggleMember(m)}
                    style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:12,border:`1px solid ${sel?"#7BAAEE":"rgba(255,255,255,.07)"}`,background:sel?"rgba(111,163,232,.1)":"rgba(255,255,255,.03)",cursor:"pointer"}}>
                    <span style={{fontSize:22}}>{m.avatar||"👤"}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:500}}>{m.name}</div>
                      <div style={{fontSize:11,color:"var(--text-faint)"}}>{ROLE_LABELS[m.role]}</div>
                    </div>
                    <span style={{fontSize:16}}>{sel?"✅":"○"}</span>
                  </div>
                );
              })}
            </div>
          }
        </div>
        <div style={{display:"flex",gap:10}}>
          <button type="submit" className="bp full" disabled={loading||(isSitter&&selected.length===0)}>
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
        ?<p style={{fontSize:13,color:"var(--text-faint)",marginBottom:20}}>Everyone is already in this conversation.</p>
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
  const senderAvatar                = isSitter ? "➿" : (participants.find(p=>p.user_id===currentUserId)?.participant_avatar||"👤");

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
    const msgText=newMsg.trim();
    await supabase.from("messages").insert({
      conversation_id:conv.id,
      sender_id:currentUserId,
      sender_name:senderName,
      sender_avatar:senderAvatar,
      is_sitter:isSitter,
      text:msgText,
    });
    // Notify all other participants (fire and forget)
    const others=participants.filter(p=>p.user_id!==currentUserId);
    for(const p of others){
      supabase.functions.invoke("send-notification",{body:{
        type:"new_message",
        payload:{recipientId:p.user_id,senderName,messagePreview:msgText,isSitter}
      }}).catch(console.error);
      sendPushNotification([p.user_id],`New message from ${senderName}`,msgText.slice(0,80),'/?portal='+(isSitter?'parent':'sitter'),'new_message');
    }
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
          <div style={{fontSize:11,color:"var(--text-faint)"}}>
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
            ?<div style={{textAlign:"center",padding:40,color:"var(--text-faint)",fontSize:13}}>No messages yet. Say hello! 👋</div>
            :messages.map((m,i)=>{
              const isMe = m.sender_id===currentUserId;
              const showAvatar = i===0||messages[i-1].sender_id!==m.sender_id;
              return (
                <div key={m.id} style={{display:"flex",flexDirection:isMe?"row-reverse":"row",alignItems:"flex-end",gap:8}}>
                  {!isMe&&showAvatar&&<span style={{fontSize:22,flexShrink:0}}>{m.sender_avatar}</span>}
                  {!isMe&&!showAvatar&&<span style={{width:30,flexShrink:0}}/>}
                  <div style={{maxWidth:"80%"}}>
                    {showAvatar&&!isMe&&<div style={{fontSize:10,color:"var(--text-faint)",marginBottom:3,marginLeft:2}}>{m.sender_name}</div>}
                    <div style={{padding:"9px 13px",borderRadius:isMe?"16px 16px 4px 16px":"16px 16px 16px 4px",background:isMe?"linear-gradient(135deg,#3A6FD4,#2550A8)":"rgba(255,255,255,.08)",fontSize:13,lineHeight:1.5,color:"#E4EAF4",wordBreak:"break-word"}}>
                      {m.text}
                    </div>
                    <div style={{fontSize:10,color:"var(--text-faint)",marginTop:3,textAlign:isMe?"right":"left"}}>{timeAgo(m.created_at)}</div>
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
function MessagesTab({currentUserId, isSitter, families=[], memberInfo, allMembers={}, sitterName='', memberName='', memberAvatar='👤'}) {
  const [convs, setConvs]           = useState([]);
  const [participants, setParticipants] = useState({});
  const [lastMessages, setLastMessages] = useState({});
  const [unseenCounts, setUnseenCounts] = useState({});
  const [selectedConv, setSelectedConv] = useState(null);
  const [selectedFamilyId, setSelectedFamilyId] = useState(null);
  const [showNew, setShowNew]       = useState(false);
  const [loading, setLoading]       = useState(true);

  // For sitter: all families; for family: their family
  const familyId = memberInfo?.family_id || null;
  const familyList = families.length > 0 ? families : (memberInfo ? [{id:memberInfo.family_id,name:"My Family"}] : []);

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
        <button className="bp" onClick={()=>{setNewConvFamilyId(families[0]?.id||familyId||null);setShowNew(true);}}>+ New</button>
      </div>

      {convs.length===0
        ?<div className="es"><div className="ic">💬</div><h3>No conversations yet</h3><p>Start a conversation with {isSitter?"a family":"your sitter"}.</p><button className="bp" onClick={()=>{setNewConvFamilyId(families[0]?.id||familyId||null);setShowNew(true);}}>+ Start a conversation</button></div>
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
                      {last&&<div style={{fontSize:10,color:"var(--text-faint)",flexShrink:0}}>{timeAgo(last.created_at)}</div>}
                    </div>
                    {isSitter&&fam&&<div style={{fontSize:10,color:"rgba(111,163,232,.6)",marginBottom:3}}>{fam.name}</div>}
                    {last
                      ?<div style={{fontSize:12,color:"var(--text-dim)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}><strong style={{color:"var(--text-dim,rgba(255,255,255,.55))"}}>{last.sender_id===currentUserId?"You":last.sender_name}:</strong> {last.text}</div>
                      :<div style={{fontSize:12,color:"var(--text-faint)",fontStyle:"italic"}}>No messages yet</div>
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
        sitterAvatar="➿"
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
      const {data:fsRows}=await supabase.from("family_sitters").select("status,families(*)").eq("sitter_id",sitterId).neq("status","inactive");
      const fams=(fsRows||[]).map(r=>r.families).filter(Boolean);
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


// ─── Invoices ──────────────────────────────────────────────────────────────────

const PAYMENT_TYPES = [
  {id:"venmo",    label:"Venmo",        icon:"💜", placeholder:"@username",    deeplink:(handle,amount,note)=>`venmo://paycharge?txn=pay&recipients=${encodeURIComponent(handle.replace('@',''))}&amount=${amount}&note=${encodeURIComponent(note)}`, weblink:(handle,amount,note)=>`https://venmo.com/${handle.replace('@','')}`},
  {id:"paypal",   label:"PayPal",       icon:"💙", placeholder:"username",     deeplink:(handle,amount,note)=>`https://paypal.me/${handle}/${amount}`},
  {id:"zelle",    label:"Zelle",        icon:"💛", placeholder:"email or phone",deeplink:null},
  {id:"cash",     label:"Cash",         icon:"💵", placeholder:"(no handle needed)",deeplink:null},
  {id:"check",    label:"Check",        icon:"📝", placeholder:"(no handle needed)",deeplink:null},
  {id:"transfer", label:"Bank Transfer",icon:"🏦", placeholder:"routing/account or instructions",deeplink:null},
];

function fmt(n){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n||0);}
function fmtDate(d){if(!d)return"";return new Date(d+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});}
function fmtDateRange(items){
  if(!items?.length) return "";
  const dates=items.map(i=>new Date(i.service_date+"T00:00:00")).sort((a,b)=>a-b);
  const lo=dates[0],hi=dates[dates.length-1];
  if(lo.toDateString()===hi.toDateString()) return fmtDate(lo.toISOString().slice(0,10));
  return `${fmtDate(lo.toISOString().slice(0,10))} – ${fmtDate(hi.toISOString().slice(0,10))}`;
}

// ─── Sitter Payment Settings Modal ───────────────────────────────────────────
function PaymentSettingsModal({open, onClose, sitterId, onSaved}) {
  const [legalName, setLegalName]   = useState("");
  const [addr1, setAddr1]           = useState("");
  const [addr2, setAddr2]           = useState("");
  const [city, setCity]             = useState("");
  const [state, setState]           = useState("");
  const [zip, setZip]               = useState("");
  const [methods, setMethods]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [alert, setAlert]           = useState(null);

  useEffect(()=>{
    if(!open) return;
    async function load(){
      const {data}=await supabase.from("sitters").select("*").eq("id",sitterId).single();
      if(data){
        setLegalName(data.legal_name||"");setAddr1(data.address_line1||"");
        setAddr2(data.address_line2||"");setCity(data.city||"");
        setState(data.state||"");setZip(data.zip||"");
        setMethods(data.payment_methods||[]);
      }
    }
    load();
  },[open,sitterId]);

  function toggleMethod(id){
    setMethods(ms=>{
      const ex=ms.find(m=>m.type===id);
      if(ex) return ms.map(m=>m.type===id?{...m,enabled:!m.enabled}:m);
      return [...ms,{type:id,handle:"",enabled:true}];
    });
  }
  function setHandle(id,val){
    setMethods(ms=>{
      const ex=ms.find(m=>m.type===id);
      if(ex) return ms.map(m=>m.type===id?{...m,handle:val}:m);
      return [...ms,{type:id,handle:val,enabled:true}];
    });
  }
  function getMethod(id){return methods.find(m=>m.type===id)||{type:id,handle:"",enabled:false};}

  async function save(e){
    e.preventDefault();setAlert(null);setLoading(true);
    const {error}=await supabase.from("sitters").update({
      legal_name:legalName,address_line1:addr1,address_line2:addr2||null,
      city,state,zip,payment_methods:methods,
    }).eq("id",sitterId);
    setLoading(false);
    if(error){setAlert({t:"e",m:error.message});return;}
    setAlert({t:"s",m:"Settings saved!"});
    setTimeout(()=>{onSaved();onClose();},1000);
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600,marginBottom:4}}>Invoice Settings</div>
      <p style={{fontSize:12,color:"var(--text-faint)",marginBottom:20,lineHeight:1.6}}>This info appears on your invoices for FSA reimbursement.</p>
      {alert&&<div className={`al al-${alert.t}`}>{alert.m}</div>}
      <form onSubmit={save}>
        <Field label="Legal full name" value={legalName} onChange={e=>setLegalName(e.target.value)} placeholder="Jane Smith"/>
        <Field label="Address line 1" value={addr1} onChange={e=>setAddr1(e.target.value)} placeholder="123 Main St"/>
        <Field label="Address line 2 (optional)" value={addr2} onChange={e=>setAddr2(e.target.value)} placeholder="Apt 4B" required={false}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 80px 80px",gap:8,marginBottom:14}}>
          <div><label className="fl">City</label><input className="fi" value={city} onChange={e=>setCity(e.target.value)} style={{marginBottom:0}}/></div>
          <div><label className="fl">State</label><input className="fi" value={state} onChange={e=>setState(e.target.value)} maxLength={2} style={{marginBottom:0}}/></div>
          <div><label className="fl">ZIP</label><input className="fi" value={zip} onChange={e=>setZip(e.target.value)} maxLength={10} style={{marginBottom:0}}/></div>
        </div>

        <div style={{marginBottom:16}}>
          <SectionLabel>Accepted payment methods</SectionLabel>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {PAYMENT_TYPES.map(pt=>{
              const m=getMethod(pt.id);
              return (
                <div key={pt.id} style={{borderRadius:12,border:`1px solid ${m.enabled?"rgba(111,163,232,.3)":"rgba(255,255,255,.07)"}`,background:m.enabled?"rgba(111,163,232,.06)":"rgba(255,255,255,.02)",padding:"10px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:m.enabled?8:0}}>
                    <span style={{fontSize:20}}>{pt.icon}</span>
                    <span style={{fontSize:13,fontWeight:500,flex:1}}>{pt.label}</span>
                    <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                      <input type="checkbox" checked={m.enabled} onChange={()=>toggleMethod(pt.id)} style={{accentColor:"#7BAAEE",width:16,height:16}}/>
                      <span style={{fontSize:11,color:"var(--text-faint,rgba(255,255,255,.4))"}}>Accept</span>
                    </label>
                  </div>
                  {m.enabled&&pt.placeholder!=="(no handle needed)"&&(
                    <input className="fi" value={m.handle} onChange={e=>setHandle(pt.id,e.target.value)}
                      placeholder={pt.placeholder} style={{marginBottom:0,fontSize:12}}/>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{display:"flex",gap:10}}>
          <button type="submit" className="bp full" disabled={loading}>{loading?<Spinner/>:"Save Settings"}</button>
          <button type="button" className="bg" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Invoice Line Item Editor ─────────────────────────────────────────────────
function LineItemRow({item, children, onChange, onRemove, index}) {
  const child = children.find(c=>c.id===item.child_id)||null;
  return (
    <div style={{padding:"12px 14px",borderRadius:12,background:"var(--card-bg)",border:"1px solid var(--border)",marginBottom:8}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        <div>
          <label className="fl">{item.rate_type==="flat"?"Start date":"Date"}</label>
          <input className="fi" type="date" value={item.service_date} onChange={e=>onChange(index,{service_date:e.target.value})} style={{marginBottom:0}}/>
        </div>
        <div>
          <label className="fl">Child</label>
          <select className="fi" value={item.child_id||""} onChange={e=>{
            const c=children.find(x=>x.id===e.target.value);
            onChange(index,{child_id:e.target.value,child_name:c?.name||""});
          }} style={{marginBottom:0}}>
            <option value="">Select child…</option>
            {children.map(c=><option key={c.id} value={c.id}>{c.avatar} {c.name}</option>)}
          </select>
        </div>
      </div>
      {item.rate_type==="flat"&&(
        <div style={{marginBottom:8}}>
          <label className="fl">End date</label>
          <input className="fi" type="date" value={item.end_date||""} onChange={e=>onChange(index,{end_date:e.target.value})} style={{marginBottom:0}} min={item.service_date}/>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"100px 1fr 1fr auto",gap:8,alignItems:"end"}}>
        <div>
          <label className="fl">Type</label>
          <select className="fi" value={item.rate_type} onChange={e=>onChange(index,{rate_type:e.target.value,hours:e.target.value==="flat"?null:item.hours})} style={{marginBottom:0}}>
            <option value="hourly">Hourly</option>
            <option value="flat">Flat</option>
          </select>
        </div>
        {item.rate_type==="hourly"&&(
          <div>
            <label className="fl">Hours</label>
            <input className="fi" type="number" step="0.25" min="0" value={item.hours||""} onChange={e=>onChange(index,{hours:parseFloat(e.target.value)||0})} style={{marginBottom:0}}/>
          </div>
        )}
        <div>
          <label className="fl">Rate ($)</label>
          <input className="fi" type="number" step="0.01" min="0" value={item.rate||""} onChange={e=>onChange(index,{rate:parseFloat(e.target.value)||0})} style={{marginBottom:0}}/>
        </div>
        <div style={{paddingBottom:2}}>
          <div style={{fontSize:12,fontWeight:600,color:"#88D8B8",textAlign:"right",minWidth:60}}>{fmt(item.rate_type==="hourly"?(item.hours||0)*item.rate:item.rate)}</div>
        </div>
      </div>
      {item.rate_type==="hourly"&&<div/>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
        <input className="fi" value={item.description||""} onChange={e=>onChange(index,{description:e.target.value})} placeholder="Notes (optional)" style={{marginBottom:0,fontSize:12,flex:1,marginRight:8}}/>
        <button onClick={()=>onRemove(index)} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,opacity:.4,padding:4,flexShrink:0}}>🗑️</button>
      </div>
    </div>
  );
}

// ─── Create/Edit Invoice Modal ────────────────────────────────────────────────
function InvoiceModal({open, onClose, sitterId, sitterName, families, allFamilyChildren, onSaved, editInvoice}) {
  const isEdit = !!editInvoice;
  const [familyId, setFamilyId]   = useState("");
  const [notes, setNotes]         = useState("");
  const [dueDate, setDueDate]     = useState("");
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(false);
  const [alert, setAlert]         = useState(null);

  function blankItem(){return {service_date:new Date().toISOString().slice(0,10),end_date:"",child_id:"",child_name:"",rate_type:"hourly",hours:0,rate:0,amount:0,description:""};}

  useEffect(()=>{
    if(!open) return;
    if(isEdit){
      setFamilyId(editInvoice.family_id);
      setNotes(editInvoice.notes||"");
      setDueDate(editInvoice.due_date||"");
      // load items
      supabase.from("invoice_items").select("*").eq("invoice_id",editInvoice.id).order("sort_order").then(({data})=>setItems(data||[]));
    } else {
      setFamilyId(families[0]?.id||"");
      setNotes("");setDueDate("");setItems([blankItem()]);
    }
    setAlert(null);
  },[open,editInvoice]);

  function updateItem(i,patch){
    setItems(its=>its.map((it,idx)=>{
      if(idx!==i) return it;
      const merged={...it,...patch};
      merged.amount=merged.rate_type==="hourly"?(merged.hours||0)*merged.rate:merged.rate;
      return merged;
    }));
  }
  function removeItem(i){setItems(its=>its.filter((_,idx)=>idx!==i));}
  function addItem(){setItems(its=>[...its,blankItem()]);}

  const total=items.reduce((s,it)=>s+(it.amount||0),0);
  const familyChildren=allFamilyChildren[familyId]||[];

  async function save(status="draft"){
    if(!familyId){setAlert({t:"e",m:"Select a family."});return;}
    if(items.length===0){setAlert({t:"e",m:"Add at least one line item."});return;}
    const unset=items.find(it=>!it.child_id||!it.service_date||(it.rate_type==="hourly"&&!it.hours)||!it.rate);
    if(unset){setAlert({t:"e",m:"Fill in all line item fields."});return;}
    setLoading(true);setAlert(null);
    try{
      let invId=editInvoice?.id;
      if(!isEdit){
        const {data:numData}=await supabase.rpc("next_invoice_number",{p_sitter_id:sitterId});
        const {data:inv,error:invErr}=await supabase.from("invoices").insert({
          invoice_number:numData,family_id:familyId,sitter_id:sitterId,
          status,notes:notes||null,due_date:dueDate||null,
        }).select().single();
        if(invErr) throw invErr;
        invId=inv.id;
        // Notify family about new invoice (fire and forget)
        const total=items.reduce((s,it)=>s+(it.amount||0),0);
        const fmt=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(total);
        const selectedFam=families.find(f=>f.id===familyId);
        supabase.functions.invoke("send-notification",{body:{
          type:"new_invoice",
          payload:{familyId,sitterName,invoiceNumber:numData,amount:fmt,familyName:selectedFam?.name||""}
        }}).catch(console.error);
        supabase.from("members").select("user_id").eq("family_id",familyId).in("role",["admin","member"]).eq("status","active")
          .then(({data:mems})=>{
            const ids=(mems||[]).map(m=>m.user_id).filter(Boolean);
            sendPushNotification(ids,`New invoice from ${sitterName}`,`${fmt} — tap to view`,'/?portal=parent','new_invoice');
          });
      } else {
        const {error}=await supabase.from("invoices").update({
          status,notes:notes||null,due_date:dueDate||null,
        }).eq("id",invId);
        if(error) throw error;
        await supabase.from("invoice_items").delete().eq("invoice_id",invId);
      }
      const {error:itemErr}=await supabase.from("invoice_items").insert(
        items.map((it,i)=>({
          invoice_id:invId,service_date:it.service_date,end_date:it.end_date||null,
          child_id:it.child_id||null,child_name:it.child_name,
          rate_type:it.rate_type,hours:it.hours||null,rate:it.rate,
          amount:it.amount,description:it.description||null,sort_order:i,
        }))
      );
      if(itemErr) throw itemErr;
      onSaved();onClose();
    }catch(err){setAlert({t:"e",m:err.message||"Something went wrong."});}
    finally{setLoading(false);}
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600,marginBottom:16}}>{isEdit?"Edit Invoice":"New Invoice"}</div>
      {alert&&<div className={`al al-${alert.t}`}>{alert.m}</div>}

      <div style={{marginBottom:14}}>
        <label className="fl">Family</label>
        <select className="fi" value={familyId} onChange={e=>setFamilyId(e.target.value)} disabled={isEdit}>
          {families.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
        <div><label className="fl">Due date (optional)</label><input className="fi" type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} style={{marginBottom:0}}/></div>
      </div>

      <div style={{marginBottom:8}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <SectionLabel>Line Items</SectionLabel>
          <button type="button" className="bp" style={{padding:"5px 12px",fontSize:11}} onClick={addItem}>+ Add Item</button>
        </div>
        {items.map((it,i)=>(
          <LineItemRow key={i} item={it} index={i} children={familyChildren} onChange={updateItem} onRemove={removeItem}/>
        ))}
        <div style={{textAlign:"right",fontSize:14,fontWeight:600,color:"#88D8B8",marginTop:8}}>Total: {fmt(total)}</div>
      </div>

      <div style={{marginBottom:14}}>
        <label className="fl">Notes (optional)</label>
        <textarea className="fi" value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Additional notes…" style={{resize:"vertical",marginBottom:0}}/>
      </div>

      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button className="bp" onClick={()=>save("draft")} disabled={loading}>{loading?<Spinner/>:"Save Draft"}</button>
        <button className="bp" onClick={()=>save("sent")} disabled={loading} style={{background:"linear-gradient(135deg,#3A9E7A,#2A7A5A)"}}>{loading?<Spinner/>:"Save & Send"}</button>
        <button className="bg" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

// ─── Invoice Print View ───────────────────────────────────────────────────────
function printInvoice(invoice, items, sitter, family, adminMember) {
  const enabledMethods=(sitter.payment_methods||[]).filter(m=>m.enabled);
  const total=items.reduce((s,it)=>s+(it.amount||0),0);
  const totalHours=items.filter(i=>i.rate_type==="hourly").reduce((s,i)=>s+(i.hours||0),0);
  const dateRange=fmtDateRange(items);

  const paymentButtons=enabledMethods.map(m=>{
    const pt=PAYMENT_TYPES.find(p=>p.id===m.type);
    if(!pt) return "";
    const link=pt.deeplink?pt.deeplink(m.handle,total.toFixed(2),invoice.invoice_number):"";
    if(link){
      return `<a href="${link}" style="display:inline-block;padding:12px 20px;background:#1a2a3a;border:1px solid #3A6FD4;border-radius:10px;color:#7BAAEE;text-decoration:none;font-size:14px;font-weight:600;margin:4px">${pt.icon} Pay with ${pt.label}${m.handle?" · "+m.handle:""}</a>`;
    }
    return `<div style="display:inline-block;padding:12px 20px;background:#1a2a3a;border:1px solid #444;border-radius:10px;color:#aaa;font-size:14px;margin:4px">${pt.icon} ${pt.label}${m.handle?" · "+m.handle:""}</div>`;
  }).join("\n");

  const html=`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${invoice.invoice_number} - littleloop</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  *{box-sizing:border-box}
  body{font-family:'Helvetica Neue',Arial,sans-serif;background:#fff;color:#14243A;padding:24px 16px;max-width:760px;margin:0 auto;font-size:14px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #E8F0FA;flex-wrap:wrap;gap:12px}
  .logo{font-size:24px;font-weight:700;color:#2550A8;letter-spacing:-0.5px}
  .logo span{font-size:13px;display:block;color:#888;font-weight:400;margin-top:2px}
  .inv-num{font-size:28px;font-weight:700;color:#2550A8}
  .inv-meta{font-size:12px;color:#666;margin-top:4px}
  .parties{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
  .party h3{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888;margin-bottom:8px}
  .party p{font-size:13px;line-height:1.7;color:#333}
  .party strong{color:#14243A}
  .section-title{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#888;margin-bottom:10px}
  table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;min-width:480px}
  th{background:#F4F8FF;padding:6px 8px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#666;border-bottom:1px solid #DDE8F5}
  td{padding:8px;border-bottom:1px solid #EEF3FA;color:#333;vertical-align:top}
  tr:last-child td{border-bottom:none}
  .amount{text-align:right}
  .totals{margin-left:auto;width:240px;margin-bottom:28px}
  .totals-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#555;border-bottom:1px solid #EEF3FA}
  .totals-row.grand{font-size:16px;font-weight:700;color:#14243A;border-bottom:none;padding-top:10px}
  .status{display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
  .status-draft{background:#F5F5F5;color:#888}
  .status-sent{background:#EEF5FF;color:#2550A8}
  .status-paid{background:#EEFAF5;color:#1A7A55}
  .payment-section{margin-bottom:28px}
  .footer{margin-top:32px;padding-top:20px;border-top:1px solid #EEF3FA;font-size:11px;color:#aaa;text-align:center}
  .purpose{background:#F4F8FF;border-left:3px solid #3A6FD4;padding:10px 14px;border-radius:0 8px 8px 0;font-size:12px;color:#3A5070;margin-bottom:24px}
  @media print{body{padding:20px}.no-print{display:none!important}a{color:#2550A8!important}}
  @media(max-width:600px){
    body{padding:16px 12px;font-size:13px}
    .header>div:last-child{text-align:left}
    .inv-num{font-size:20px}
    .parties{grid-template-columns:1fr}
    .totals{width:100%}
    .payment-section a,.payment-section div{display:block!important;width:100%;text-align:center;margin:6px 0!important;box-sizing:border-box;padding:12px!important}
    .purpose{font-size:11px}
  }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">➿ littleloop<span>Independent Childcare</span></div>
  </div>
  <div style="text-align:right">
    <div class="inv-num">${invoice.invoice_number}</div>
    <div class="inv-meta">Issued: ${fmtDate(invoice.issued_date)}</div>
    ${invoice.due_date?`<div class="inv-meta">Due: ${fmtDate(invoice.due_date)}</div>`:""}
    <div style="margin-top:6px"><span class="status status-${invoice.status}">${invoice.status}</span></div>
  </div>
</div>

<div class="parties">
  <div class="party">
    <h3>Care Provider</h3>
    <p><strong>${sitter.legal_name||sitter.name}</strong><br>
    ${sitter.address_line1||""}<br>
    ${sitter.address_line2?sitter.address_line2+"<br>":""}
    ${[sitter.city,sitter.state,sitter.zip].filter(Boolean).join(", ")}</p>
  </div>
  <div class="party">
    <h3>Billed To</h3>
    <p><strong>${family.name}</strong><br>
    ${adminMember?.name||""}</p>
  </div>
</div>

<div class="purpose" style="word-wrap:break-word">
  <strong>Purpose of care:</strong> Childcare services · Service period: ${dateRange}
  ${totalHours>0?` · Total hours: ${totalHours.toFixed(2)}`:""}
</div>

<div class="section-title">Services Rendered</div>
<table style="width:100%">
  <thead>
    <tr>
      <th>Date</th>
      <th>Child</th>
      <th>Description</th>
      <th>Type</th>
      <th>Hrs</th>
      <th>Rate</th>
      <th class="amount">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${items.map(it=>`
    <tr>
      <td>${it.end_date&&it.end_date!==it.service_date?fmtDate(it.service_date)+' – '+fmtDate(it.end_date):fmtDate(it.service_date)}</td>
      <td>${it.child_name}</td>
      <td>${it.description||"—"}</td>
      <td style="text-transform:capitalize">${it.rate_type}</td>
      <td>${it.rate_type==="hourly"?(it.hours||0).toFixed(2):"—"}</td>
      <td>${fmt(it.rate)}${it.rate_type==="hourly"?"/hr":""}</td>
      <td class="amount">${fmt(it.amount)}</td>
    </tr>`).join("")}
  </tbody>
</table>

<div class="totals">
  ${totalHours>0?`<div class="totals-row"><span>Total hours</span><span>${totalHours.toFixed(2)}</span></div>`:""}
  <div class="totals-row grand"><span>Total Due</span><span>${fmt(total)}</span></div>
</div>

${invoice.notes?`<div style="margin-bottom:24px"><div class="section-title">Notes</div><p style="font-size:13px;color:#555;line-height:1.6">${invoice.notes}</p></div>`:""}

${enabledMethods.length>0?`
<div class="payment-section no-print">
  <div class="section-title">Pay This Invoice</div>
  <div>${paymentButtons}</div>
</div>`:""}

<div class="footer">
  This invoice was generated via littleloop · littleloop.xyz<br>
  For FSA/DCFSA reimbursement: provider's TIN available upon request.
</div>

<div class="no-print" style="text-align:center;margin-top:24px">
  <button onclick="window.print()" style="padding:12px 28px;background:#2550A8;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">🖨️ Print / Save as PDF</button>
</div>
</body>
</html>`;

  const blob = new Blob([html], {type: 'text/html'});
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

// ─── Invoices Tab (Sitter) ────────────────────────────────────────────────────
function SitterInvoicesTab({sitterId, sitterName}) {
  const [invoices,setInvoices]   = useState([]);
  const [families,setFamilies]   = useState([]);
  const [familyChildren,setFamilyChildren] = useState({});
  const [familyMembers,setFamilyMembers]   = useState({});
  const [sitter,setSitter]       = useState(null);
  const [showNew,setShowNew]     = useState(false);
  const [editInv,setEditInv]     = useState(null);
  const [showSettings,setShowSettings] = useState(false);
  const [filter,setFilter]       = useState("all");
  const [loading,setLoading]     = useState(true);
  const [confirmPaid,setConfirmPaid] = useState(null);

  const load=useCallback(async()=>{
    setLoading(true);
    const [{data:fams},{data:invs},{data:sit}]=await Promise.all([
      supabase.from("family_sitters").select("status,families(*)").eq("sitter_id",sitterId).neq("status","inactive"),
      supabase.from("invoices").select("*").eq("sitter_id",sitterId).order("created_at",{ascending:false}),
      supabase.from("sitters").select("*").eq("id",sitterId).single(),
    ]);
    setFamilies(fams||[]);setInvoices(invs||[]);setSitter(sit);
    if(fams?.length){
      const [{data:kids},{data:mems}]=await Promise.all([
        supabase.from("children").select("*").in("family_id",fams.map(f=>f.id)),
        supabase.from("members").select("*").in("family_id",fams.map(f=>f.id)),
      ]);
      const kg={},mg={};
      (kids||[]).forEach(k=>{if(!kg[k.family_id])kg[k.family_id]=[];kg[k.family_id].push(k);});
      (mems||[]).forEach(m=>{if(!mg[m.family_id])mg[m.family_id]=[];mg[m.family_id].push(m);});
      setFamilyChildren(kg);setFamilyMembers(mg);
    }
    setLoading(false);
  },[sitterId]);

  useEffect(()=>{load();},[load]);

  async function markPaid(inv){
    await supabase.from("invoices").update({status:"paid",paid_date:new Date().toISOString().slice(0,10)}).eq("id",inv.id);
    setConfirmPaid(null);load();
  }

  async function deleteInv(id){
    await supabase.from("invoices").delete().eq("id",id);load();
  }

  async function openPrint(inv){
    const {data:items}=await supabase.from("invoice_items").select("*").eq("invoice_id",inv.id).order("sort_order");
    const family=families.find(f=>f.id===inv.family_id)||{name:"—"};
    const admin=(familyMembers[inv.family_id]||[]).find(m=>m.role==="admin");
    printInvoice(inv,items||[],sitter||{},family,admin);
  }

  const filtered=filter==="all"?invoices:invoices.filter(i=>i.status===filter);
  const statusColors={draft:"#B0B8C8",sent:"#7BAAEE",paid:"#88D8B8"};

  if(loading) return <div style={{textAlign:"center",padding:"60px 0"}}><Spinner size={24}/></div>;

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600}}>Invoices</div>
        <div style={{display:"flex",gap:8}}>
          <button className="bg" style={{padding:"7px 12px",fontSize:12}} onClick={()=>setShowSettings(true)}>⚙️ Settings</button>
          <button className="bp" onClick={()=>setShowNew(true)}>+ New Invoice</button>
        </div>
      </div>

      {/* Filter */}
      <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
        {["all","draft","sent","paid"].map(s=>(
          <button key={s} onClick={()=>setFilter(s)}
            style={{padding:"5px 12px",borderRadius:20,border:`1px solid ${filter===s?"#7BAAEE":"rgba(255,255,255,.1)"}`,background:filter===s?"rgba(111,163,232,.15)":"rgba(255,255,255,.04)",color:filter===s?"#7BAAEE":"rgba(255,255,255,.4)",fontSize:11,cursor:"pointer",textTransform:"capitalize"}}>
            {s==="all"?"All":s.charAt(0).toUpperCase()+s.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length===0
        ?<div className="es"><div className="ic">💰</div><h3>No invoices yet</h3><p>Create your first invoice for a family.</p><button className="bp" onClick={()=>setShowNew(true)}>+ Create Invoice</button></div>
        :<div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filtered.map(inv=>{
            const fam=families.find(f=>f.id===inv.family_id);
            return (
              <div key={inv.id} className="card" style={{padding:"14px 18px"}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <span style={{fontWeight:700,fontSize:15}}>{inv.invoice_number}</span>
                      <span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:20,background:`${statusColors[inv.status]}22`,color:statusColors[inv.status],textTransform:"capitalize"}}>{inv.status}</span>
                    </div>
                    <div style={{fontSize:12,color:"var(--text-dim)"}}>{fam?.name} · Issued {fmtDate(inv.issued_date)}</div>
                    {inv.due_date&&<div style={{fontSize:11,color:"var(--text-faint)"}}>Due {fmtDate(inv.due_date)}</div>}
                    {inv.paid_date&&<div style={{fontSize:11,color:"#88D8B8"}}>Paid {fmtDate(inv.paid_date)}</div>}
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
                    <button className="bg" style={{padding:"5px 10px",fontSize:11}} onClick={()=>openPrint(inv)}>🖨️ Print</button>
                    {inv.status!=="paid"&&<button className="bg" style={{padding:"5px 10px",fontSize:11}} onClick={()=>setEditInv(inv)}>✏️ Edit</button>}
                    {inv.status==="sent"&&<button className="bp" style={{padding:"5px 10px",fontSize:11,background:"linear-gradient(135deg,#3A9E7A,#2A7A5A)"}} onClick={()=>setConfirmPaid(inv)}>✅ Mark Paid</button>}
                    {inv.status==="draft"&&<button className="bd" style={{padding:"5px 10px",fontSize:11}} onClick={()=>deleteInv(inv.id)}>🗑️</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      }

      <InvoiceModal open={showNew||!!editInv} onClose={()=>{setShowNew(false);setEditInv(null);}}
        sitterId={sitterId} sitterName={sitterName||''} families={families} allFamilyChildren={familyChildren} onSaved={load} editInvoice={editInv||null}/>
      <PaymentSettingsModal open={showSettings} onClose={()=>setShowSettings(false)} sitterId={sitterId} onSaved={load}/>
      <Confirm open={!!confirmPaid} title="Mark as paid?" message={`Mark ${confirmPaid?.invoice_number} as paid today?`} onConfirm={()=>markPaid(confirmPaid)} onCancel={()=>setConfirmPaid(null)}/>
    </div>
  );
}

// ─── Invoices Tab (Family) ────────────────────────────────────────────────────
function FamilyInvoicesTab({familyId, currentUserId}) {
  const [invoices,setInvoices] = useState([]);
  const [sitter,setSitter]     = useState(null);
  const [family,setFamily]     = useState(null);
  const [member,setMember]     = useState(null);
  const [loading,setLoading]   = useState(true);

  useEffect(()=>{
    async function load(){
      setLoading(true);
      const [{data:invs},{data:fam},{data:mem}]=await Promise.all([
        supabase.from("invoices").select("*").eq("family_id",familyId).in("status",["sent","paid"]).order("created_at",{ascending:false}),
        supabase.from("families").select("*, sitters(*)").eq("id",familyId).single(),
        supabase.from("members").select("*").eq("family_id",familyId).eq("user_id",currentUserId).maybeSingle(),
      ]);
      setInvoices(invs||[]);
      setFamily(fam);
      setSitter(fam?.sitters||null);
      setMember(mem);
      setLoading(false);
    }
    load();
  },[familyId,currentUserId]);

  async function openPrint(inv){
    const {data:items}=await supabase.from("invoice_items").select("*").eq("invoice_id",inv.id).order("sort_order");
    printInvoice(inv,items||[],sitter||{},family||{name:"—"},member);
  }

  const statusColors={sent:"#7BAAEE",paid:"#88D8B8"};
  if(loading) return <div style={{textAlign:"center",padding:"60px 0"}}><Spinner size={24}/></div>;

  return (
    <div>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,marginBottom:16}}>Invoices</div>
      {invoices.length===0
        ?<div className="es"><div className="ic">💰</div><h3>No invoices yet</h3><p>Your sitter hasn't sent any invoices yet.</p></div>
        :<div style={{display:"flex",flexDirection:"column",gap:10}}>
          {invoices.map(inv=>(
            <div key={inv.id} className="card" style={{padding:"14px 18px"}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <span style={{fontWeight:700,fontSize:15}}>{inv.invoice_number}</span>
                    <span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:20,background:`${statusColors[inv.status]}22`,color:statusColors[inv.status],textTransform:"capitalize"}}>{inv.status}</span>
                  </div>
                  <div style={{fontSize:12,color:"var(--text-dim)"}}>Issued {fmtDate(inv.issued_date)}</div>
                  {inv.due_date&&<div style={{fontSize:11,color:"var(--text-faint)"}}>Due {fmtDate(inv.due_date)}</div>}
                  {inv.paid_date&&<div style={{fontSize:11,color:"#88D8B8"}}>Paid {fmtDate(inv.paid_date)}</div>}
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <button className="bg" style={{padding:"5px 10px",fontSize:11}} onClick={()=>openPrint(inv)}>🖨️ View / Print</button>
                </div>
              </div>

              {/* Payment buttons inline for sent invoices */}
              {inv.status==="sent"&&sitter&&(
                <PayButtons sitter={sitter} invoice={inv}/>
              )}
            </div>
          ))}
        </div>
      }
    </div>
  );
}

// ─── Pay Buttons ─────────────────────────────────────────────────────────────
function PayButtons({sitter, invoice}) {
  const [items,setItems] = useState(null);
  useEffect(()=>{
    supabase.from("invoice_items").select("*").eq("invoice_id",invoice.id)
      .then(({data})=>setItems(data||[]));
  },[invoice.id]);

  const total=items?items.reduce((s,i)=>s+(i.amount||0),0):0;
  const enabled=(sitter.payment_methods||[]).filter(m=>m.enabled);
  if(!enabled.length||!items) return null;

  return (
    <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid rgba(255,255,255,.06)"}}>
      <div style={{fontSize:10,fontWeight:600,letterSpacing:".9px",textTransform:"uppercase",color:"var(--text-faint)",marginBottom:8}}>
        Pay {fmt(total)}
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
        {enabled.map(m=>{
          const pt=PAYMENT_TYPES.find(p=>p.id===m.type);
          if(!pt) return null;
          const link=pt.deeplink?pt.deeplink(m.handle,total.toFixed(2),invoice.invoice_number):null;
          const weblink=pt.weblink?pt.weblink(m.handle,total.toFixed(2),invoice.invoice_number):link;
          return link
            ?<div key={m.type} style={{display:"inline-flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                <a href={link} target="_blank" rel="noopener noreferrer"
                  style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:10,background:"var(--card-bg)",border:"1px solid var(--border)",color:"rgba(255,255,255,.8)",textDecoration:"none",fontSize:12,fontWeight:500}}>
                  {pt.icon} {pt.label}{m.handle?` (${m.handle})`:""}
                </a>
                {pt.weblink&&<a href={weblink} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"var(--text-faint)",textDecoration:"none"}}>open profile ↗</a>}
              </div>
            :<div key={m.type} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:10,background:"var(--card-bg)",border:"1px solid var(--border)",color:"var(--text-dim)",fontSize:12}}>
                {pt.icon} {pt.label}{m.handle?`: ${m.handle}`:""}
              </div>;
        })}
      </div>
    </div>
  );
}


// ─── Invite Welcome Page ──────────────────────────────────────────────────────
function InviteWelcome({token, onContinue}) {
  const [invite, setInvite] = useState(null);
  const [sitter, setSitter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(()=>{
    async function load(){
      const {data, error} = await supabase
        .from('invite_tokens')
        .select('*, sitters(name, avatar_url, city, state)')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .is('used_at', null)
        .single();
      if(error || !data){ setError('This invite link has expired or already been used.'); setLoading(false); return; }
      setInvite(data);
      setSitter(data.sitters);
      setLoading(false);
    }
    load();
  },[token]);

  if(loading) return (
    <div style={{position:'relative',zIndex:1,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <Spinner size={24}/>
    </div>
  );

  if(error) return (
    <div style={{position:'relative',zIndex:1,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{textAlign:'center',maxWidth:360}}>
        <div style={{fontSize:40,marginBottom:16}}>😕</div>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600,marginBottom:8}}>Invite not found</div>
        <p style={{fontSize:13,color:'var(--text-faint)',lineHeight:1.6,marginBottom:24}}>{error}</p>
        <button className="bp" onClick={()=>window.location.href='/?portal=parent'}>Go to sign up</button>
      </div>
    </div>
  );

  return (
    <div style={{position:'relative',zIndex:1,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{width:'100%',maxWidth:460}} className="fade-up">

        {/* Logo */}
        <div style={{textAlign:'center',marginBottom:28}}>
          <div className="leaf" style={{fontSize:36,marginBottom:8}}>➿</div>
          <div className="logo-text" style={{fontSize:28}}>littleloop</div>
        </div>

        {/* Welcome card */}
        <div className="card" style={{padding:'28px 24px',marginBottom:16,textAlign:'center'}}>
          <div style={{fontSize:48,marginBottom:12}}>{sitter?.avatar_url||'➿'}</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:600,marginBottom:6}}>
            You're invited!
          </div>
          <p style={{fontSize:14,color:'var(--text-dim)',lineHeight:1.6,marginBottom:20}}>
            <strong>{sitter?.name||'Your sitter'}</strong> has invited <strong>{invite.family_name}</strong> to join littleloop
            {sitter?.city ? ` · ${sitter.city}${sitter.state?', '+sitter.state:''}` : ''}.
          </p>

          {/* Features */}
          <div style={{textAlign:'left',marginBottom:24}}>
            {[['🌸','Daily updates','Photos and notes from your sitter'],
              ['💬','Messaging','Private chat, always in reach'],
              ['✅','Check in/out','See when your kids arrive and leave'],
              ['💳','Invoices','View and pay in one place']].map(([icon,title,desc])=>(
              <div key={title} style={{display:'flex',gap:12,marginBottom:12,alignItems:'flex-start'}}>
                <span style={{fontSize:20,flexShrink:0}}>{icon}</span>
                <div>
                  <div style={{fontSize:13,fontWeight:600}}>{title}</div>
                  <div style={{fontSize:12,color:'var(--text-faint)'}}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          <button className="bp full" onClick={()=>onContinue(invite)}>
            Create your account →
          </button>
          <div style={{fontSize:11,color:'var(--text-faint)',marginTop:10}}>
            Sign up with {invite.admin_email} to auto-connect to {invite.family_name}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Reset Password Form ──────────────────────────────────────────────────────
function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [alert, setAlert]       = useState(null);
  const [done, setDone]         = useState(false);

  async function submit(e){
    e.preventDefault();
    if(password.length<8){setAlert({t:"e",m:"Password must be at least 8 characters."});return;}
    if(password!==confirm){setAlert({t:"e",m:"Passwords don't match."});return;}
    setLoading(true);setAlert(null);
    const {error}=await supabase.auth.updateUser({password});
    setLoading(false);
    if(error){setAlert({t:"e",m:error.message});return;}
    setDone(true);
    // Sign out and redirect to login after 2 seconds
    setTimeout(async()=>{
      await supabase.auth.signOut();
      window.location.href='/';
    },2000);
  }

  return (
    <div style={{position:"relative",zIndex:1,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div className="mb" style={{maxWidth:420,width:"100%",padding:32}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div className="leaf" style={{fontSize:36,marginBottom:8}}>➿</div>
          <div className="logo-text" style={{fontSize:26,marginBottom:6}}>littleloop</div>
          <p style={{fontSize:13,color:"var(--text-dim)"}}>Set your new password</p>
        </div>
        {done
          ?<div className="al al-s">Password updated! Redirecting to login…</div>
          :<form onSubmit={submit}>
            {alert&&<div className={`al al-${alert.t}`}>{alert.m}</div>}
            <Field label="New password" value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="At least 8 characters"/>
            <Field label="Confirm password" value={confirm} onChange={e=>setConfirm(e.target.value)} type="password" placeholder="Repeat password"/>
            <button type="submit" className="bp full" disabled={loading} style={{marginTop:8}}>
              {loading?<><Spinner/> Saving…</>:"Set Password"}
            </button>
          </form>
        }
      </div>
    </div>
  );
}


// ─── Theme Picker ─────────────────────────────────────────────────────────────
function ThemePicker({currentTheme, onSelect}) {
  const dark  = PALETTES.filter(p=>p.dark);
  const light = PALETTES.filter(p=>!p.dark);
  return (
    <div>
      <SectionLabel>Dark themes</SectionLabel>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:20}}>
        {dark.map(p=>(
          <button key={p.id} onClick={()=>onSelect(p.id)} style={{
            border:`2px solid ${currentTheme===p.id?"var(--accent,#7BAAEE)":"rgba(255,255,255,.1)"}`,
            borderRadius:12,padding:"10px 8px",cursor:"pointer",
            background:p.body,transition:"all .2s",
            boxShadow:currentTheme===p.id?"0 0 0 2px var(--accent,#7BAAEE)22":"none",
            position:"relative",overflow:"hidden"
          }}>
            <div style={{width:"100%",height:28,borderRadius:6,background:p.accentGrad,marginBottom:6}}/>
            <div style={{fontSize:10,fontWeight:600,color:"var(--text-dim)",letterSpacing:".5px"}}>{p.name}</div>
            {currentTheme===p.id&&<div style={{position:"absolute",top:6,right:6,width:14,height:14,borderRadius:"50%",background:"var(--accent,#7BAAEE)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8}}>✓</div>}
          </button>
        ))}
      </div>
      <SectionLabel>Light themes</SectionLabel>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
        {light.map(p=>(
          <button key={p.id} onClick={()=>onSelect(p.id)} style={{
            border:`2px solid ${currentTheme===p.id?"#666":"rgba(0,0,0,.12)"}`,
            borderRadius:12,padding:"10px 8px",cursor:"pointer",
            background:p.body,transition:"all .2s",
            boxShadow:currentTheme===p.id?"0 0 0 2px #66666622":"none",
            position:"relative",overflow:"hidden"
          }}>
            <div style={{width:"100%",height:28,borderRadius:6,background:p.accentGrad,marginBottom:6}}/>
            <div style={{fontSize:10,fontWeight:600,color:"rgba(20,36,58,.6)",letterSpacing:".5px"}}>{p.name}</div>
            {currentTheme===p.id&&<div style={{position:"absolute",top:6,right:6,width:14,height:14,borderRadius:"50%",background:p.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"#fff"}}>✓</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Sitter Profile/Settings Tab ─────────────────────────────────────────────
function SitterProfileTab({sitterId, sitterName, onNameChange}) {
  const [theme, setTheme]       = useState(localStorage.getItem('ll_theme')||'midnight');
  // Profile fields
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileAlert, setProfileAlert]   = useState(null);
  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting]                   = useState(false);

  async function deleteAccount(){
    setDeleting(true);
    try{
      // Call edge function which uses service role to fully delete auth user
      const {error} = await supabase.functions.invoke('delete-account');
      if(error) throw error;
      // Clear local storage
      Object.keys(localStorage).filter(k=>k.startsWith('ll_')).forEach(k=>localStorage.removeItem(k));
      await supabase.auth.signOut();
      window.location.href = '/';
    }catch(err){
      alert('Error deleting account: ' + err.message);
      setDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    }
  }

  // Password fields
  const [curPassword, setCurPassword]     = useState('');
  const [newPassword, setNewPassword]     = useState('');
  const [confirmPass, setConfirmPass]     = useState('');
  const [passSaving, setPassSaving]       = useState(false);
  const [passAlert, setPassAlert]         = useState(null);

  useEffect(()=>{
    async function load(){
      const {data:{user}} = await supabase.auth.getUser();
      setEmail(user?.email||'');
      const {data} = await supabase.from('sitters').select('name').eq('id',sitterId).single();
      setName(data?.name||sitterName||'');
    }
    load();
  },[sitterId]);

  function selectTheme(id) {
    setTheme(id);
    applyTheme(id);
    localStorage.setItem('ll_theme', id);
    supabase.from('sitters').update({theme_id:id}).eq('id',sitterId);
  }

  async function saveProfile(e){
    e.preventDefault();
    if(!name.trim()){setProfileAlert({t:'e',m:'Name is required.'});return;}
    setProfileSaving(true);setProfileAlert(null);
    try{
      // Update name in sitters table
      const {error:dbErr} = await supabase.from('sitters').update({name:name.trim()}).eq('id',sitterId);
      if(dbErr) throw dbErr;
      // Update email in auth if changed
      const {data:{user}} = await supabase.auth.getUser();
      if(email.trim()!==user.email){
        const {error:authErr} = await supabase.auth.updateUser({email:email.trim()});
        if(authErr) throw authErr;
        setProfileAlert({t:'s',m:'Profile updated! Check your new email for a confirmation link.'});
      } else {
        // Update name in auth metadata too
        await supabase.auth.updateUser({data:{name:name.trim()}});
        setProfileAlert({t:'s',m:'Profile updated!'});
        if(onNameChange) onNameChange(name.trim());
      }
    }catch(err){setProfileAlert({t:'e',m:err.message});}
    finally{setProfileSaving(false);}
  }

  async function savePassword(e){
    e.preventDefault();
    if(newPassword.length<8){setPassAlert({t:'e',m:'Password must be at least 8 characters.'});return;}
    if(newPassword!==confirmPass){setPassAlert({t:'e',m:'Passwords do not match.'});return;}
    setPassSaving(true);setPassAlert(null);
    try{
      // Re-authenticate with current password first
      const {data:{user}} = await supabase.auth.getUser();
      const {error:signInErr} = await supabase.auth.signInWithPassword({email:user.email, password:curPassword});
      if(signInErr) throw new Error('Current password is incorrect.');
      const {error:updateErr} = await supabase.auth.updateUser({password:newPassword});
      if(updateErr) throw updateErr;
      setPassAlert({t:'s',m:'Password changed successfully!'});
      setCurPassword('');setNewPassword('');setConfirmPass('');
    }catch(err){setPassAlert({t:'e',m:err.message});}
    finally{setPassSaving(false);}
  }

  return (
    <div>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,marginBottom:20}}>Profile & Settings</div>

      {/* Profile info */}
      <div className="card" style={{padding:"20px 18px",marginBottom:14}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontWeight:600,marginBottom:16}}>👤 Your Profile</div>
        {profileAlert&&<div className={`al al-${profileAlert.t}`}>{profileAlert.m}</div>}
        <form onSubmit={saveProfile}>
          <Field label="Display name" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/>
          <Field label="Email address" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/>
          <button type="submit" className="bp" disabled={profileSaving}>
            {profileSaving?<><Spinner/> Saving…</>:"Save Profile"}
          </button>
        </form>
      </div>

      {/* Change password */}
      <div className="card" style={{padding:"20px 18px",marginBottom:14}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontWeight:600,marginBottom:16}}>🔒 Change Password</div>
        {passAlert&&<div className={`al al-${passAlert.t}`}>{passAlert.m}</div>}
        <form onSubmit={savePassword}>
          <Field label="Current password" type="password" value={curPassword} onChange={e=>setCurPassword(e.target.value)} placeholder="Your current password"/>
          <Field label="New password" type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="At least 8 characters"/>
          <Field label="Confirm new password" type="password" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} placeholder="Repeat new password"/>
          <button type="submit" className="bp" disabled={passSaving}>
            {passSaving?<><Spinner/> Saving…</>:"Change Password"}
          </button>
        </form>
      </div>

      {/* Theme */}
      <div className="card" style={{padding:"20px 18px",marginBottom:14}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontWeight:600,marginBottom:16}}>🎨 App Theme</div>
        <ThemePicker currentTheme={theme} onSelect={selectTheme}/>
      </div>

      {/* Delete account */}
      <div className="card" style={{padding:"20px 18px",marginBottom:14,border:"1px solid rgba(192,80,80,.2)",background:"rgba(192,80,80,.04)"}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontWeight:600,marginBottom:8,color:"#F5AAAA"}}>⚠️ Delete Account</div>
        <p style={{fontSize:12,color:"var(--text-faint)",lineHeight:1.6,marginBottom:16}}>
          Permanently deletes your sitter account and all associated data — families, children, invoices, posts, and messages. This cannot be undone.
        </p>
        {!showDeleteConfirm
          ? <button className="bd" onClick={()=>setShowDeleteConfirm(true)}>Delete my account</button>
          : <div>
              <div className="al al-e" style={{marginBottom:12}}>
                Type <strong>DELETE</strong> to confirm you want to permanently remove your account.
              </div>
              <input className="fi" value={deleteConfirmText} onChange={e=>setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm" style={{marginBottom:10}}/>
              <div style={{display:'flex',gap:8}}>
                <button className="bd" disabled={deleteConfirmText!=='DELETE'||deleting}
                  onClick={deleteAccount}>
                  {deleting?<><Spinner size={12}/> Deleting…</>:'Permanently delete'}
                </button>
                <button className="bg" onClick={()=>{setShowDeleteConfirm(false);setDeleteConfirmText('');}}>Cancel</button>
              </div>
            </div>
        }
      </div>
    </div>
  );
}

// ─── Member Profile/Settings Tab ─────────────────────────────────────────────
function MemberProfileTab({memberId, memberName, onNameChange}) {
  const [theme, setTheme]         = useState(localStorage.getItem('ll_theme')||'midnight');
  const [name, setName]           = useState('');
  const [email, setEmail]         = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileAlert, setProfileAlert]   = useState(null);
  const [curPassword, setCurPassword]     = useState('');
  const [newPassword, setNewPassword]     = useState('');
  const [confirmPass, setConfirmPass]     = useState('');
  const [passSaving, setPassSaving]       = useState(false);
  const [passAlert, setPassAlert]         = useState(null);

  useEffect(()=>{
    async function load(){
      const {data:{user}} = await supabase.auth.getUser();
      setEmail(user?.email||'');
      if(memberId){
        const {data} = await supabase.from('members').select('name').eq('id',memberId).single();
        setName(data?.name||memberName||'');
      } else {
        setName(memberName||'');
      }
    }
    load();
  },[memberId]);

  function selectTheme(id) {
    setTheme(id);
    applyTheme(id);
    localStorage.setItem('ll_theme', id);
    if(memberId) supabase.from('members').update({theme_id:id}).eq('id',memberId);
  }

  async function saveProfile(e){
    e.preventDefault();
    if(!name.trim()){setProfileAlert({t:'e',m:'Name is required.'});return;}
    setProfileSaving(true);setProfileAlert(null);
    try{
      if(memberId){
        const {error:dbErr} = await supabase.from('members').update({name:name.trim()}).eq('id',memberId);
        if(dbErr) throw dbErr;
      }
      const {data:{user}} = await supabase.auth.getUser();
      if(email.trim()!==user.email){
        const {error:authErr} = await supabase.auth.updateUser({email:email.trim()});
        if(authErr) throw authErr;
        setProfileAlert({t:'s',m:'Profile updated! Check your new email for a confirmation link.'});
      } else {
        await supabase.auth.updateUser({data:{name:name.trim()}});
        setProfileAlert({t:'s',m:'Profile updated!'});
        if(onNameChange) onNameChange(name.trim());
      }
    }catch(err){setProfileAlert({t:'e',m:err.message});}
    finally{setProfileSaving(false);}
  }

  async function savePassword(e){
    e.preventDefault();
    if(newPassword.length<8){setPassAlert({t:'e',m:'Password must be at least 8 characters.'});return;}
    if(newPassword!==confirmPass){setPassAlert({t:'e',m:'Passwords do not match.'});return;}
    setPassSaving(true);setPassAlert(null);
    try{
      const {data:{user}} = await supabase.auth.getUser();
      const {error:signInErr} = await supabase.auth.signInWithPassword({email:user.email, password:curPassword});
      if(signInErr) throw new Error('Current password is incorrect.');
      const {error:updateErr} = await supabase.auth.updateUser({password:newPassword});
      if(updateErr) throw updateErr;
      setPassAlert({t:'s',m:'Password changed successfully!'});
      setCurPassword('');setNewPassword('');setConfirmPass('');
    }catch(err){setPassAlert({t:'e',m:err.message});}
    finally{setPassSaving(false);}
  }

  return (
    <div>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,marginBottom:20}}>Profile & Settings</div>

      <div className="card" style={{padding:"20px 18px",marginBottom:14}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontWeight:600,marginBottom:16}}>👤 Your Profile</div>
        {profileAlert&&<div className={`al al-${profileAlert.t}`}>{profileAlert.m}</div>}
        <form onSubmit={saveProfile}>
          <Field label="Display name" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/>
          <Field label="Email address" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/>
          <button type="submit" className="bp" disabled={profileSaving}>
            {profileSaving?<><Spinner/> Saving…</>:"Save Profile"}
          </button>
        </form>
      </div>

      <div className="card" style={{padding:"20px 18px",marginBottom:14}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontWeight:600,marginBottom:16}}>🔒 Change Password</div>
        {passAlert&&<div className={`al al-${passAlert.t}`}>{passAlert.m}</div>}
        <form onSubmit={savePassword}>
          <Field label="Current password" type="password" value={curPassword} onChange={e=>setCurPassword(e.target.value)} placeholder="Your current password"/>
          <Field label="New password" type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="At least 8 characters"/>
          <Field label="Confirm new password" type="password" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} placeholder="Repeat new password"/>
          <button type="submit" className="bp" disabled={passSaving}>
            {passSaving?<><Spinner/> Saving…</>:"Change Password"}
          </button>
        </form>
      </div>

      <div className="card" style={{padding:"20px 18px",marginBottom:14}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontWeight:600,marginBottom:16}}>🎨 App Theme</div>
        <ThemePicker currentTheme={theme} onSelect={selectTheme}/>
      </div>
    </div>
  );
}


// ─── Check In/Out ─────────────────────────────────────────────────────────────


// ─── On My Way / ETA ──────────────────────────────────────────────────────────
const ETA_OPTIONS = [
  {label:'5 min',  minutes:5},
  {label:'10 min', minutes:10},
  {label:'30 min', minutes:30},
  {label:'45 min', minutes:45},
  {label:'1 hour', minutes:60},
];

function OnMyWayButton({familyId, memberId, memberName}) {
  const [expanded, setExpanded] = useState(false);
  const [sent,     setSent]     = useState(false);
  const [current,  setCurrent]  = useState(null);
  const [loading,  setLoading]  = useState(false);

  useEffect(()=>{
    async function loadETA(){
      const {data}=await supabase.from('eta_notifications')
        .select('*').eq('family_id',familyId).eq('member_id',memberId)
        .gt('expires_at',new Date().toISOString())
        .order('created_at',{ascending:false}).limit(1).maybeSingle();
      setCurrent(data||null);
    }
    if(familyId&&memberId) loadETA();
  },[familyId,memberId]);

  async function send(minutes){
    setLoading(true);
    const expires=new Date(Date.now()+Math.max(minutes*2,120)*60*1000).toISOString();
    const eta_time=new Date(Date.now()+minutes*60*1000).toISOString();
    const {data,error}=await supabase.from('eta_notifications').insert({
      family_id:familyId, member_id:memberId, member_name:memberName,
      eta_minutes:minutes, eta_time, expires_at:expires,
    }).select().single();
    setLoading(false);
    if(!error){setCurrent(data);setSent(true);setExpanded(false);setTimeout(()=>setSent(false),3000);}
  }

  async function cancel(){
    if(!current) return;
    await supabase.from('eta_notifications').delete().eq('id',current.id);
    setCurrent(null);
  }

  if(current){
    const etaTime=new Date(current.eta_time);
    const minsLeft=Math.max(0,Math.round((etaTime-Date.now())/60000));
    return (
      <div style={{marginTop:12,padding:'10px 14px',borderRadius:12,
        background:'rgba(58,158,122,.1)',border:'1px solid rgba(94,207,170,.3)',
        display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:18}}>🚗</span>
          <div>
            <div style={{fontSize:13,fontWeight:600,color:'#5ECFAA'}}>On the way!</div>
            <div style={{fontSize:11,color:'var(--text-faint)'}}>
              {minsLeft>0?`~${minsLeft} min away`:'Arriving soon'}
            </div>
          </div>
        </div>
        <button onClick={cancel} style={{background:'none',border:'none',fontSize:11,
          color:'var(--text-faint)',cursor:'pointer',textDecoration:'underline'}}>Cancel</button>
      </div>
    );
  }

  return (
    <div style={{marginTop:12}}>
      {!expanded
        ?<button onClick={()=>setExpanded(true)} style={{width:'100%',padding:'10px 14px',
            borderRadius:12,border:'1px solid rgba(94,207,170,.3)',
            background:'rgba(58,158,122,.08)',color:'#5ECFAA',fontSize:13,fontWeight:600,
            cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
            <span>🚗</span>{sent?'Sitter notified! ✓':'On My Way — notify sitter'}
          </button>
        :<div style={{padding:'12px 14px',borderRadius:12,border:'1px solid rgba(94,207,170,.3)',
            background:'rgba(58,158,122,.06)'}}>
            <div style={{fontSize:12,fontWeight:600,color:'#5ECFAA',marginBottom:10}}>How far away are you?</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10}}>
              {ETA_OPTIONS.map(o=>(
                <button key={o.minutes} onClick={()=>send(o.minutes)} disabled={loading}
                  style={{padding:'7px 14px',borderRadius:20,border:'1px solid rgba(94,207,170,.3)',
                    background:'rgba(58,158,122,.1)',color:'#5ECFAA',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                  {loading?<Spinner size={10}/>:o.label}
                </button>
              ))}
            </div>
            <button onClick={()=>setExpanded(false)}
              style={{background:'none',border:'none',fontSize:11,color:'var(--text-faint)',cursor:'pointer'}}>
              Cancel
            </button>
          </div>
      }
    </div>
  );
}

function CheckInButton({child, familyId, currentUserId, checkerName, isSitter, onChecked}) {
  const [status, setStatus]   = useState(null); // 'in' | 'out' | null
  const [loading, setLoading] = useState(false);
  const [lastEntry, setLastEntry] = useState(null);

  useEffect(()=>{
    async function loadStatus(){
      const {data} = await supabase
        .from('checkins')
        .select('*')
        .eq('child_id', child.id)
        .order('checked_at', {ascending:false})
        .limit(1)
        .maybeSingle();
      if(data){ setStatus(data.status); setLastEntry(data); }
      else setStatus(null);
    }
    loadStatus();
  },[child.id]);

  async function toggle(){
    setLoading(true);
    const newStatus = status==='in' ? 'out' : 'in';
    const now = new Date().toISOString();
    const {data:inserted, error} = await supabase.from('checkins').insert({
      child_id: child.id,
      family_id: familyId,
      status: newStatus,
      checked_by: currentUserId,
      checked_by_name: checkerName,
      checked_by_role: isSitter ? 'sitter' : 'member',
      checked_at: now,
    }).select().single();
    if(error){
      console.error('checkin error:', error);
    } else {
      setStatus(newStatus);
      setLastEntry(inserted||{status:newStatus,checked_at:now,checked_by_name:checkerName});
      if(onChecked) onChecked(child.id, newStatus);
    }
    setLoading(false);
  }

  const isIn = status==='in';
  const btnColor = isIn
    ? 'linear-gradient(135deg,#E05A5A,#B03030)'
    : 'linear-gradient(135deg,#3A9E7A,#2A7A5A)';

  return (
    <div style={{display:'flex',flexDirection:'column',gap:4}}>
      <button onClick={toggle} disabled={loading}
        style={{display:'inline-flex',alignItems:'center',gap:6,padding:'6px 12px',
          borderRadius:10,border:'none',background:btnColor,color:'#fff',
          fontSize:11,fontWeight:600,cursor:'pointer',opacity:loading?.6:1,transition:'all .2s'}}>
        {loading ? <Spinner size={10}/> : isIn ? '✓ Checked In' : '⊕ Check In'}
      </button>
      {lastEntry&&(
        <div style={{fontSize:9,color:'var(--text-faint,rgba(255,255,255,.3))',lineHeight:1.4}}>
          {status==='in'?'In':'Out'} · {timeAgo(lastEntry.checked_at)} · {lastEntry.checked_by_name}
        </div>
      )}
    </div>
  );
}

// ─── Checkin Log (sitter view) ────────────────────────────────────────────────
function CheckinLog({familyId}) {
  const [log, setLog]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('today');

  useEffect(()=>{
    async function load(){
      setLoading(true);
      let query = supabase
        .from('checkins')
        .select('*, children(name,avatar)')
        .eq('family_id', familyId)
        .order('checked_at', {ascending:false});

      if(filter==='today'){
        const start = new Date(); start.setHours(0,0,0,0);
        query = query.gte('checked_at', start.toISOString());
      } else if(filter==='week'){
        const start = new Date(); start.setDate(start.getDate()-7);
        query = query.gte('checked_at', start.toISOString());
      }
      const {data} = await query.limit(100);
      setLog(data||[]);
      setLoading(false);
    }
    load();
  },[familyId, filter]);

  return (
    <div style={{marginTop:20}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontWeight:600}}>Check-in Log</div>
        <div style={{display:'flex',gap:6}}>
          {['today','week','all'].map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              style={{padding:'4px 10px',borderRadius:20,border:`1px solid ${filter===f?'var(--accent,#7BAAEE)':'var(--border,rgba(255,255,255,.1))'}`,
                background:filter===f?'rgba(111,163,232,.15)':'transparent',
                color:filter===f?'var(--accent,#7BAAEE)':'var(--text-faint,rgba(255,255,255,.4))',
                fontSize:10,cursor:'pointer',textTransform:'capitalize'}}>
              {f==='all'?'All time':f.charAt(0).toUpperCase()+f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {loading ? <div style={{textAlign:'center',padding:20}}><Spinner size={16}/></div>
      : log.length===0 ? <div style={{textAlign:'center',padding:20,color:'var(--text-faint)',fontSize:12}}>No check-ins recorded yet.</div>
      : <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {log.map((entry,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',
              borderRadius:10,background:'var(--input-bg,rgba(255,255,255,.03))',
              border:'1px solid var(--border,rgba(255,255,255,.06))'}}>
              <div style={{fontSize:20,flexShrink:0}}>{entry.children?.avatar||'🧒'}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:500}}>{entry.children?.name||'Unknown'}</div>
                <div style={{fontSize:10,color:'var(--text-faint)',marginTop:1}}>
                  {entry.checked_by_name} · {new Date(entry.checked_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
                </div>
              </div>
              <div style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,
                background:entry.status==='in'?'rgba(58,158,122,.15)':'rgba(192,80,80,.15)',
                color:entry.status==='in'?'#88D8B8':'#F5AAAA',
                border:`1px solid ${entry.status==='in'?'rgba(58,158,122,.25)':'rgba(192,80,80,.25)'}`}}>
                {entry.status==='in'?'Checked In':'Checked Out'}
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  );
}

// ─── Sitter Onboarding ────────────────────────────────────────────────────────
const SITTER_AVATARS = ["➿","🌻","🌸","🦋","🌙","⭐","🌈","🎨","🎵","🌊","🍀","🦄"];

function SitterOnboarding({session, onComplete}) {
  const sitterId = session.user.id;
  const [step, setStep]       = useState(0);
  const [saving, setSaving]   = useState(false);
  const [alert, setAlert]     = useState(null);

  // Step 0 — Profile
  const [name, setName]         = useState(session.user.user_metadata?.name || session.user.email.split('@')[0]);
  const [avatar, setAvatar]     = useState('➿');

  // Step 1 — Legal / address
  const [legalName, setLegalName]   = useState('');
  const [addr1, setAddr1]           = useState('');
  const [addr2, setAddr2]           = useState('');
  const [city, setCity]             = useState('');
  const [state, setState]           = useState('');
  const [zip, setZip]               = useState('');

  // Step 2 — Payment methods
  const [methods, setMethods] = useState(
    PAYMENT_TYPES.map(pt => ({type:pt.id, handle:'', enabled:false}))
  );

  const STEPS = [
    {title:'Welcome to littleloop ➿', sub:'Let\'s set up your sitter profile'},
    {title:'Invoice details 🧾', sub:'Used on invoices — families need this for FSA reimbursement'},
    {title:'How you get paid 💰', sub:'Families will see these options when paying an invoice'},
  ];

  function toggleMethod(id) {
    setMethods(m => m.map(x => x.type===id ? {...x, enabled:!x.enabled} : x));
  }
  function setHandle(id, val) {
    setMethods(m => m.map(x => x.type===id ? {...x, handle:val} : x));
  }

  async function finish() {
    setSaving(true); setAlert(null);
    try {
      // Update auth metadata
      await supabase.auth.updateUser({data:{name:name.trim()}});
      // Update sitters table
      const {error} = await supabase.from('sitters').update({
        name: name.trim(),
        avatar_url: avatar,
        legal_name: legalName.trim()||null,
        address_line1: addr1.trim()||null,
        address_line2: addr2.trim()||null,
        city: city.trim()||null,
        state: state.trim()||null,
        zip: zip.trim()||null,
        payment_methods: methods,
        onboarded: true,
      }).eq('id', sitterId);
      if(error) throw error;
      localStorage.setItem(`ll_onboarded_${sitterId}`, '1');
      onComplete(name.trim());
    } catch(err) {
      setAlert(err.message);
      setSaving(false);
    }
  }

  const progress = ((step) / (STEPS.length - 1)) * 100;

  return (
    <div style={{position:'relative',zIndex:1,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}>
      <div style={{width:'100%',maxWidth:520}}>

        {/* Header */}
        <div style={{textAlign:'center',marginBottom:28}}>
          <div className="leaf" style={{fontSize:36,marginBottom:8}}>➿</div>
          <div className="logo-text" style={{fontSize:28,marginBottom:4}}>littleloop</div>
          <div style={{fontSize:13,color:'var(--text-faint)'}}>Sitter Setup</div>
        </div>

        {/* Progress bar */}
        <div style={{height:3,background:'var(--border)',borderRadius:3,marginBottom:28,overflow:'hidden'}}>
          <div style={{height:'100%',width:`${progress}%`,background:'var(--accent-grad,linear-gradient(90deg,#3A6FD4,#3A9E7A))',borderRadius:3,transition:'width .4s ease'}}/>
        </div>

        {/* Step header */}
        <div style={{marginBottom:22}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600,marginBottom:4}}>{STEPS[step].title}</div>
          <div style={{fontSize:13,color:'var(--text-faint)'}}>{STEPS[step].sub}</div>
        </div>

        {alert&&<div className="al al-e" style={{marginBottom:16}}>{alert}</div>}

        {/* ── Step 0: Profile ── */}
        {step===0&&(
          <div>
            <div className="card" style={{padding:'20px 18px',marginBottom:16}}>
              <Field label="Your name" value={name} onChange={e=>setName(e.target.value)} placeholder="How families will know you"/>
              <div>
                <label className="fl">Choose your avatar</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:14}}>
                  {SITTER_AVATARS.map(a=>(
                    <button key={a} onClick={()=>setAvatar(a)}
                      style={{width:44,height:44,borderRadius:12,fontSize:22,border:`2px solid ${avatar===a?'var(--accent,#7BAAEE)':'var(--border,rgba(255,255,255,.1))'}`,
                        background:avatar===a?'rgba(111,163,232,.12)':'var(--input-bg)',cursor:'pointer',transition:'all .15s'}}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontSize:11,color:'var(--text-faint)'}}>Step 1 of 3</div>
              <button className="bp" onClick={()=>setStep(1)} disabled={!name.trim()}>Continue →</button>
            </div>
          </div>
        )}

        {/* ── Step 1: Legal / Address ── */}
        {step===1&&(
          <div>
            <div className="card" style={{padding:'20px 18px',marginBottom:16}}>
              <Field label="Legal name (as it appears on tax docs)" value={legalName} onChange={e=>setLegalName(e.target.value)} placeholder="Full legal name" required={false}/>
              <Field label="Address line 1" value={addr1} onChange={e=>setAddr1(e.target.value)} placeholder="Street address" required={false}/>
              <Field label="Address line 2 (optional)" value={addr2} onChange={e=>setAddr2(e.target.value)} placeholder="Apt, suite, etc." required={false}/>
              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:10}}>
                <div>
                  <label className="fl">City</label>
                  <input className="fi" value={city} onChange={e=>setCity(e.target.value)} placeholder="City"/>
                </div>
                <div>
                  <label className="fl">State</label>
                  <input className="fi" value={state} onChange={e=>setState(e.target.value)} placeholder="MO" maxLength={2}/>
                </div>
                <div>
                  <label className="fl">ZIP</label>
                  <input className="fi" value={zip} onChange={e=>setZip(e.target.value)} placeholder="65801"/>
                </div>
              </div>
              <div className="al al-i" style={{marginTop:4}}>This info appears on invoices for FSA/DCFSA reimbursement. You can update it anytime in your profile.</div>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <button className="bg" onClick={()=>setStep(0)}>← Back</button>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{fontSize:11,color:'var(--text-faint)'}}>Step 2 of 3</div>
                <button className="bp" onClick={()=>setStep(2)}>Continue →</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Payment methods ── */}
        {step===2&&(
          <div>
            <div className="card" style={{padding:'20px 18px',marginBottom:16}}>
              {PAYMENT_TYPES.map(pt=>{
                const m = methods.find(x=>x.type===pt.id);
                const hasHandle = pt.placeholder!=='(no handle needed)';
                return (
                  <div key={pt.id} style={{marginBottom:12,padding:'12px 14px',borderRadius:12,
                    background:m.enabled?'rgba(111,163,232,.06)':'var(--input-bg,rgba(255,255,255,.03))',
                    border:`1px solid ${m.enabled?'rgba(111,163,232,.25)':'var(--border,rgba(255,255,255,.07))'}`,
                    transition:'all .2s'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:m.enabled&&hasHandle?10:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <span style={{fontSize:20}}>{pt.icon}</span>
                        <span style={{fontSize:14,fontWeight:500}}>{pt.label}</span>
                      </div>
                      <button onClick={()=>toggleMethod(pt.id)}
                        style={{width:42,height:24,borderRadius:12,border:'none',cursor:'pointer',transition:'all .2s',
                          background:m.enabled?'var(--accent,#3A6FD4)':'var(--border,rgba(255,255,255,.15))',
                          position:'relative',flexShrink:0}}>
                        <span style={{position:'absolute',top:3,left:m.enabled?20:3,width:18,height:18,borderRadius:'50%',background:'#fff',transition:'left .2s',boxShadow:'0 1px 3px rgba(0,0,0,.3)'}}/>
                      </button>
                    </div>
                    {m.enabled&&hasHandle&&(
                      <input className="fi" value={m.handle} onChange={e=>setHandle(pt.id,e.target.value)}
                        placeholder={pt.placeholder} style={{marginBottom:0}}/>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <button className="bg" onClick={()=>setStep(1)}>← Back</button>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{fontSize:11,color:'var(--text-faint)'}}>Step 3 of 3</div>
                <button className="bp" onClick={finish} disabled={saving}>
                  {saving?<><Spinner/> Saving…</>:'Finish Setup ✓'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Skip link */}
        <div style={{textAlign:'center',marginTop:20}}>
          <button onClick={()=>{localStorage.setItem(`ll_onboarded_${sitterId}`,'1');onComplete(name);}}
            style={{background:'none',border:'none',color:'var(--text-faint)',fontSize:12,cursor:'pointer',textDecoration:'underline'}}>
            Skip for now
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Sitter Dashboard ─────────────────────────────────────────────────────────
function SitterDashboard({session,onSignOut}) {
  const sitterId=session.user.id;
  const [name,setName]=useState(session.user.user_metadata?.name||session.user.email.split("@")[0]);
  const [onboarded,setOnboarded]=useState(!!localStorage.getItem(`ll_onboarded_${session.user.id}`));
  const [tab,setTab]=useState("families");
  const [unread,setUnread]=useState({messages:0,feed:0,eta:0});

  useEffect(()=>{
    if(onboarded) return;
    supabase.from('sitters').select('onboarded').eq('id',sitterId).single()
      .then(({data})=>{
        if(data?.onboarded){
          localStorage.setItem(`ll_onboarded_${sitterId}`,'1');
          setOnboarded(true);
        }
      });
  },[]);
  useEffect(()=>{
    async function checkUnread(){
      const lastSeenMsg=localStorage.getItem(`ll_seen_msg_${sitterId}`)||'1970-01-01';
      const {count:msgCount} = await supabase.from('messages')
        .select('id',{count:'exact',head:true})
        .neq('sender_id',sitterId)
        .gt('created_at',lastSeenMsg);
      // Feed: comments from non-sitter users
      const lastSeenFeed=localStorage.getItem(`ll_seen_feed_comments_${sitterId}`)||'1970-01-01';
      const {count:feedCount} = await supabase.from('post_comments')
        .select('id',{count:'exact',head:true})
        .neq('author_id',sitterId)
        .gt('created_at',lastSeenFeed);
      setUnread({messages:msgCount||0,feed:feedCount||0});
    }
    checkUnread();
    // Real-time updates
    const ch=supabase.channel('sitter-unread')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},(p)=>{
        if(p.new.sender_id!==sitterId) setUnread(u=>({...u,messages:u.messages+1}));
      })
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'post_comments'},(p)=>{
        if(p.new.author_id!==sitterId) setUnread(u=>({...u,feed:u.feed+1}));
      })
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'eta_notifications'},()=>{
        if(tab!=='families') setUnread(u=>({...u,eta:u.eta+1}));
      }).subscribe();
    return()=>supabase.removeChannel(ch);
  },[sitterId]);

  // Clear badge when tab is opened
  useEffect(()=>{
    if(tab==='messages'){
      localStorage.setItem(`ll_seen_msg_${sitterId}`,new Date().toISOString());
      setUnread(u=>({...u,messages:0}));
    }
    if(tab==='feed'){
      localStorage.setItem(`ll_seen_feed_comments_${sitterId}`,new Date().toISOString());
      setUnread(u=>({...u,feed:0}));
    }
    if(tab==='families'){
      setUnread(u=>({...u,eta:0}));
    }
  },[tab]);

  // Subscribe to push on mount
  useEffect(()=>{ subscribeToPush(sitterId); },[sitterId]);

  const NAV=[
    {id:"families",icon:"👨‍👩‍👧",label:"Families",badge:unread.eta},
    {id:"feed",icon:"🌸",label:"Feed",badge:unread.feed},
    {id:"invoices",icon:"💰",label:"Invoices"},
    {id:"messages",icon:"💬",label:"Messages",badge:unread.messages},
    {id:"profile",icon:"⚙️",label:"Profile"},
  ];

  if(!onboarded) return (
    <><Bg/><SitterOnboarding session={session} onComplete={n=>{setName(n);setOnboarded(true);}}/></>
  );

  return (
    <div style={{position:"relative",zIndex:1,minHeight:"100vh",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(255,255,255,.06)",background:"var(--nav-bg,rgba(0,0,0,.2))",backdropFilter:"blur(20px)",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div className="leaf" style={{fontSize:22,filter:"drop-shadow(0 0 10px rgba(58,158,122,.4))"}}>➿</div>
          <div className="logo-text" style={{fontSize:20}}>littleloop</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:12,color:"var(--text-faint)",display:"none"}} className="hide-mobile-name">{name}</div>
          <button className="bg" style={{padding:"6px 12px",fontSize:12}} onClick={onSignOut}>Sign out</button>
        </div>
      </div>
      <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,.06)",background:"var(--nav-bg,rgba(0,0,0,.15))"}}>
        {NAV.map(n=>(
          <div key={n.id} className={`nav-tab ${tab===n.id?"active":""}`} onClick={()=>setTab(n.id)}>
            <span style={{position:"relative",display:"inline-block"}}>
              <span style={{fontSize:18}}>{n.icon}</span>
              {n.badge>0&&<span style={{position:"absolute",top:-3,right:-5,width:8,height:8,borderRadius:"50%",background:"#E05A5A",boxShadow:"0 0 0 2px var(--body-bg,#0C1420)"}}/>}
            </span>
            <span>{n.label}</span>
          </div>
        ))}
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 14px",maxWidth:800,width:"100%",margin:"0 auto"}}>
        {tab==="families"&&<FamiliesTab sitterId={sitterId} sitterName={name}/>}
        {tab==="feed"&&<SitterFeedWrapper sitterId={sitterId} sitterName={name}/>}
        {tab==="invoices"&&<SitterInvoicesTab sitterId={sitterId} sitterName={name}/>}
        {tab==="messages"&&<SitterMessagesWrapper sitterId={sitterId} sitterName={name}/>}
        {tab==="profile"&&<SitterProfileTab sitterId={sitterId} sitterName={name} onNameChange={setName}/>}
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
  const [name,setName]=useState(session.user.user_metadata?.name||session.user.email.split("@")[0]);

  const load = useCallback(async()=>{
    setLoading(true);
    const {data:mem}=await supabase.from("members").select("*").eq("user_id",session.user.id).maybeSingle();
    if(!mem){setLoading(false);return;}
    setMember(mem);
    const [{data:fam},{data:kids},{data:mems},{data:fsRows}]=await Promise.all([
      supabase.from("families").select("*").eq("id",mem.family_id).single(),
      supabase.from("children").select("*").eq("family_id",mem.family_id),
      supabase.from("members").select("*").eq("family_id",mem.family_id),
      supabase.from("family_sitters").select("status,sitters(id,name,avatar_url)").eq("family_id",mem.family_id).neq("status","inactive"),
    ]);
    const sittersList=(fsRows||[]).map(r=>({...r.sitters,connection_status:r.status})).filter(Boolean);
    const famWithSitters = fam ? {...fam, sitters_list:sittersList, sitter_name:sittersList[0]?.name||'Sitter'} : fam;
    setFamily(famWithSitters);setChildren(kids||[]);setMembers(mems||[]);
    setLoading(false);
  },[session.user.id]);

  useEffect(()=>{load();},[load]);

  // Subscribe to push on mount
  useEffect(()=>{ if(session?.user?.id) subscribeToPush(session.user.id); },[session?.user?.id]);

  const isAdmin  = member?.role==="admin";
  const canView  = ["admin","member"].includes(member?.role);
  const feedOnly = member?.role==="feed_only";
  const pickup   = member?.role==="pickup";

  // Build nav based on role
  const [unread,setUnread]=useState({messages:0,invoices:0,feed:0});

  useEffect(()=>{
    if(!member||!family) return;
    async function checkUnread(){
      const userId=session.user.id;
      // Messages unread
      const lastSeenMsg=localStorage.getItem(`ll_seen_msg_${userId}`)||'1970-01-01';
      const {count:msgCount} = await supabase.from('messages')
        .select('id',{count:'exact',head:true})
        .neq('sender_id',userId)
        .gt('created_at',lastSeenMsg);
      // Invoices unread (sent invoices not yet seen)
      const lastSeenInv=localStorage.getItem(`ll_seen_inv_${family.id}_${userId}`)||'1970-01-01';
      const {count:invCount} = await supabase.from('invoices')
        .select('id',{count:'exact',head:true})
        .eq('family_id',family.id)
        .in('status',['sent'])
        .gt('created_at',lastSeenInv);
      // Feed unread
      const lastSeenFeed=localStorage.getItem(`ll_seen_feed_${family.id}_${userId}`)||'1970-01-01';
      const {count:feedCount} = await supabase.from('posts')
        .select('id',{count:'exact',head:true})
        .eq('family_id',family.id)
        .gt('created_at',lastSeenFeed);
      setUnread({messages:msgCount||0,invoices:invCount||0,feed:feedCount||0});
    }
    checkUnread();
    const ch=supabase.channel('parent-unread')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},(p)=>{
        if(p.new.sender_id!==session.user.id) setUnread(u=>({...u,messages:u.messages+1}));
      })
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'posts',filter:`family_id=eq.${family?.id}`},()=>{
        setUnread(u=>({...u,feed:u.feed+1}));
      })
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'invoices',filter:`family_id=eq.${family?.id}`},()=>{
        setUnread(u=>({...u,invoices:u.invoices+1}));
      })
      .subscribe();
    return()=>supabase.removeChannel(ch);
  },[member,family]);

  // Clear badges when tabs opened
  useEffect(()=>{
    const userId=session.user.id;
    if(tab==='messages'){
      localStorage.setItem(`ll_seen_msg_${userId}`,new Date().toISOString());
      setUnread(u=>({...u,messages:0}));
    }
    if(tab==='invoices'&&family){
      localStorage.setItem(`ll_seen_inv_${family.id}_${userId}`,new Date().toISOString());
      setUnread(u=>({...u,invoices:0}));
    }
    if(tab==='feed'&&family){
      localStorage.setItem(`ll_seen_feed_${family.id}_${userId}`,new Date().toISOString());
      setUnread(u=>({...u,feed:0}));
    }
  },[tab,family]);

  const NAV=[
    ...(!feedOnly&&!pickup?[{id:"home",icon:"🏠",label:"Home"}]:[]),
    {id:"feed",icon:"🌸",label:"Feed",badge:unread.feed},
    ...(canView||isAdmin?[{id:"invoices",icon:"💰",label:"Invoices",badge:unread.invoices}]:[]),
    {id:"messages",icon:"💬",label:"Messages",badge:unread.messages},
    {id:"profile",icon:"⚙️",label:"Profile"},
  ];

  // Default tab based on role
  useEffect(()=>{
    if(pickup) setTab("messages");
    else if(feedOnly) setTab("feed");
  },[pickup,feedOnly]);

  if(loading) return <><Bg/><div style={{position:"relative",zIndex:1,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner size={24}/></div></>;

  return (
    <div style={{position:"relative",zIndex:1,minHeight:"100vh",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(255,255,255,.06)",background:"var(--nav-bg,rgba(0,0,0,.2))",backdropFilter:"blur(20px)",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div className="leaf" style={{fontSize:22,filter:"drop-shadow(0 0 10px rgba(58,158,122,.4))"}}>➿</div>
          <div className="logo-text" style={{fontSize:20}}>littleloop</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:12,color:"var(--text-faint)",display:"none"}} className="hide-mobile-name">{name}</div>
          <button className="bg" style={{padding:"6px 12px",fontSize:12}} onClick={onSignOut}>Sign out</button>
        </div>
      </div>

      <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,.06)",background:"var(--nav-bg,rgba(0,0,0,.15))"}}>
        {NAV.map(n=>(
          <div key={n.id} className={`nav-tab ${tab===n.id?"active":""}`} onClick={()=>setTab(n.id)}>
            <span style={{position:"relative",display:"inline-block"}}>
              <span style={{fontSize:18}}>{n.icon}</span>
              {n.badge>0&&<span style={{position:"absolute",top:-3,right:-5,width:8,height:8,borderRadius:"50%",background:"#E05A5A",boxShadow:"0 0 0 2px var(--body-bg,#0C1420)"}}/>}
            </span>
            <span>{n.label}</span>
          </div>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"16px 14px",maxWidth:800,width:"100%",margin:"0 auto"}}>

        {tab==="home"&&(
          <div>
            {!family
              ?<div className="es"><div className="ic">👨‍👩‍👧</div><h3>Not connected yet</h3><p>Your account isn't linked to a family yet.<br/>Make sure you signed up with the email your sitter invited.</p></div>
              :<>
                {/* Family card */}
                <div className="card fade-up" style={{padding:24,marginBottom:16}}>
                  <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
                    <div style={{width:48,height:48,borderRadius:14,background:"linear-gradient(135deg,#3A9E7A,#2A7A5A)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>👨‍👩‍👧</div>
                    <div style={{flex:1,minWidth:0}}>
                      {isAdmin
                        ?<FamilyNameEditor familyId={family.id} name={family.name} onSaved={n=>{setFamily(f=>({...f,name:n}));}}/>
                        :<div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600}}>{family.name}</div>
                      }
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
                      ?<div style={{fontSize:12,color:"var(--text-faint)",fontStyle:"italic"}}>No children added yet.</div>
                      :<div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {children.map(c=>(
                          <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
                            background:`${c.color||"#8B78D4"}12`,borderRadius:14,border:`1px solid ${c.color||"#8B78D4"}33`}}>
                            <button onClick={()=>setSelectedChild(c)} style={{display:"flex",alignItems:"center",gap:7,background:"none",border:"none",cursor:"pointer",flex:1,minWidth:0,padding:0}}>
                              <span style={{fontSize:22}}>{c.avatar||"🌟"}</span>
                              <span style={{fontSize:13,fontWeight:500,color:"var(--text,#E4EAF4)"}}>{c.name}</span>
                              {isAdmin&&<span style={{fontSize:11,opacity:.4,marginLeft:4}} onClick={e=>{e.stopPropagation();setEditChild(c);}}>✏️</span>}
                            </button>
                            {(isAdmin||member?.role==="member"||member?.role==="pickup")&&(
                              <CheckInButton child={c} familyId={family.id} currentUserId={session.user.id}
                                checkerName={name} isSitter={false}/>
                            )}
                          </div>
                        ))}
                      </div>
                    }
                  </div>

                  {/* On My Way */}
                  {(isAdmin||member?.role==='member')&&(
                    <OnMyWayButton familyId={family.id} memberId={member?.id} memberName={name}/>
                  )}

                  {/* Sitters */}
                  <div style={{marginBottom:20}}>
                    <SectionLabel>Sitters</SectionLabel>
                    {(family?.sitters_list||[]).length===0
                      ?<div style={{fontSize:12,color:"var(--text-faint)",fontStyle:"italic"}}>No sitters connected yet.</div>
                      :<div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {(family.sitters_list||[]).map(s=>(
                          <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
                            background:"var(--input-bg,rgba(255,255,255,.03))",borderRadius:12,
                            border:"1px solid var(--border,rgba(255,255,255,.06))"}}>
                            <span style={{fontSize:22}}>{s.avatar_url||"➿"}</span>
                            <div style={{flex:1}}>
                              <div style={{fontSize:13,fontWeight:500}}>{s.name}</div>
                            </div>
                            <span className={`sb sb-${s.connection_status==="active"?"a":"p"}`} style={{fontSize:9}}>
                              {s.connection_status==="active"?"Active":"Pending"}
                            </span>
                          </div>
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
                        <div key={m.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"var(--card-bg)",borderRadius:12,border:"1px solid rgba(255,255,255,.06)"}}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <span style={{fontSize:22}}>{m.avatar||"👤"}</span>
                            <div>
                              <div style={{fontSize:13,fontWeight:500}}>{m.name}{m.user_id===session.user.id&&<span style={{fontSize:10,color:"var(--text-faint)",marginLeft:6}}>(you)</span>}</div>
                              <div style={{fontSize:11,color:"var(--text-faint)"}}>{m.email}</div>
                            </div>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                            <span className={`sb sb-${m.status==="active"?"a":"p"}`} style={{fontSize:9}}>{ROLE_LABELS[m.role]||m.role}</span>
                            {isAdmin&&m.user_id!==session.user.id&&(
                              <button className="bg" style={{padding:"4px 8px",fontSize:11}} onClick={()=>setEditMember(m)}>✏️</button>
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

        {tab==="feed"&&family&&<FeedTab familyId={family.id} sitterId={null} memberId={member?.id} isSitter={false} children={children} unseenCount={0} onMarkSeen={null} sitterName={family.sitter_name||'Sitter'} currentUserName={name} currentUserAvatar={member?.avatar||'👤'}/>}
        {tab==="feed"&&!family&&<div className="es"><div className="ic">🌸</div><h3>Not connected</h3><p>No family connected yet.</p></div>}
        {tab==="messages"&&member&&<MessagesTabWrapper currentUserId={session.user.id} member={member} family={family} memberName={name} memberAvatar={member?.avatar||"👤"}/>}
        {tab==="invoices"&&family&&<FamilyInvoicesTab familyId={family.id} currentUserId={session.user.id}/>}
        {tab==="profile"&&<MemberProfileTab memberId={member?.id} memberName={name} onNameChange={setName}/>}
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
  const inviteToken = getInviteToken();
  const [inviteData, setInviteData] = useState(null); // set after welcome page

  useEffect(()=>{
    const tag=document.createElement("style");
    tag.textContent=CSS;
    document.head.appendChild(tag);
    // Apply saved theme
    const saved=localStorage.getItem('ll_theme')||'midnight';
    applyTheme(saved);
    return()=>document.head.removeChild(tag);
  },[]);

  useEffect(()=>{
    // Check if this is a password recovery redirect via URL hash
    const hash = window.location.hash;
    if(hash.includes("type=recovery")) {
      setUserRole("__reset__");
      // Let Supabase process the token from hash
      supabase.auth.getSession().then(({data:{session}})=>{
        setSession(session??null);
      });
      return;
    }

    supabase.auth.getSession().then(({data:{session}})=>{
      setSession(session??null);
      if(session) setUserRole(session.user.user_metadata?.role||"sitter");
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      setSession(session??null);
      if(session) setUserRole(session.user.user_metadata?.role||"sitter");
      if(event==="PASSWORD_RECOVERY") setUserRole("__reset__");
    });
    return()=>subscription.unsubscribe();
  },[]);

  if(session===undefined) return (
    <><Bg/>
      <div style={{position:"relative",zIndex:1,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{textAlign:"center"}}>
          <div className="leaf" style={{fontSize:40,marginBottom:12}}>➿</div>
          <Spinner size={20}/>
        </div>
      </div>
    </>
  );

  const signOut=()=>supabase.auth.signOut();

  if(userRole==="__reset__") return <><Bg/><ResetPasswordForm/></>;
  // Invite flow — show welcome page, then pre-fill signup
  if(inviteToken && !inviteData && !session) return (
    <><Bg/><InviteWelcome token={inviteToken} onContinue={inv=>setInviteData(inv)}/></>
  );
  if(!session) return <><Bg/><AuthForm portal={inviteData ? "parent" : portal} inviteData={inviteData}/></>;
  if(userRole==="parent") return <><Bg/><ParentDashboard session={session} onSignOut={signOut}/></>;
  return <><Bg/><SitterDashboard session={session} onSignOut={signOut}/></>;
}
